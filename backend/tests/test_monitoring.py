import json
import os
import sys
import tempfile
import time
from datetime import date, timedelta
from pathlib import Path

os.environ["SAHAAS_DATA_DIR"] = tempfile.mkdtemp(prefix="sahaas-test-")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from monitoring import api, auth, db, service  # noqa: E402

DAY = 86400
db.init()
app = FastAPI()
app.include_router(api.router)
client = TestClient(app)


@pytest.fixture(autouse=True)
def empty_db():
    with db.connect() as conn:
        conn.execute("DELETE FROM users")
    yield


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def register(name="Sunita", **extra):
    body = {"name": name, "language": "en", "consent": {"data_storage": True}, **extra}
    r = client.post("/auth/register", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_register_requires_storage_consent():
    r = client.post("/auth/register", json={"name": "A", "consent": {"data_storage": False}})
    assert r.status_code == 400


def test_victim_gets_counsellor_and_personal_data_is_encrypted():
    service.create_counsellor("Dr. Ananya")
    v = register("Sunita Devi", phone="9876543210")
    assert v["counsellor"] == "Dr. Ananya"
    with db.connect() as conn:
        row = conn.execute("SELECT name_enc, phone_enc, token_hash FROM users WHERE id = ?", (v["user_id"],)).fetchone()
    assert "Sunita" not in row["name_enc"] and "9876" not in row["phone_enc"] and v["token"] not in row["token_hash"]
    assert client.get("/me", headers=bearer(v["token"])).json()["name"] == "Sunita Devi"


def test_auth_errors():
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers=bearer("not-a-token")).status_code == 401
    v = register()
    assert client.get("/counsellor/victims", headers=bearer(v["token"])).status_code == 403


def test_questionnaire_definitions():
    q = client.get("/questionnaires/phq9?lang=hi").json()
    assert q["language"] == "hi" and len(q["items"]) == 9 and q["options"][0]["label"] == "बिल्कुल नहीं"
    assert client.get("/questionnaires/phq9?lang=pa").json()["language"] == "en"
    assert client.get("/questionnaires/nope").status_code == 404
    assert {q["id"] for q in client.get("/questionnaires").json()} == {"phq9", "gad7", "pcptsd5", "phq4"}


def test_invalid_answers_rejected():
    v = register()
    assert client.post("/me/questionnaires/phq9", json={"answers": [0] * 8}, headers=bearer(v["token"])).status_code == 422
    assert client.post("/me/questionnaires/gad7", json={"answers": [4] * 7}, headers=bearer(v["token"])).status_code == 422


def test_self_harm_answer_raises_crisis_and_victim_sees_no_clinical_labels():
    c = service.create_counsellor("Dr. A")
    v = register()
    r = client.post("/me/questionnaires/phq9", json={"answers": [1] * 9}, headers=bearer(v["token"])).json()
    assert r["crisis"] and "112" in r["crisis_message"]
    assert not any(k in json.dumps(r) for k in ("severity", "score", "total"))
    alerts = client.get("/counsellor/alerts", headers=bearer(c["token"])).json()
    assert alerts[0]["level"] == "crisis" and alerts[0]["victim_name"] == "Sunita"
    caseload = client.get("/counsellor/victims", headers=bearer(c["token"])).json()
    assert caseload[0]["crisis"] and caseload[0]["score"] >= 80


def test_score_combines_signals_and_other_counsellors_cannot_see_victim():
    c1 = service.create_counsellor("C1")
    v = register()
    c2 = service.create_counsellor("C2")
    user = auth.user_for_token(v["token"])
    service.record_chat(user, "I feel hopeless", {"score": 70.0})
    service.record_voice_session(user, {"probabilities": {"sad": 60, "neutral": 40}, "valence": 0.2,
                                        "arousal": 0.3, "voiced_seconds": 5})
    detail = client.get(f"/counsellor/victims/{v['user_id']}", headers=bearer(c1["token"])).json()
    assert set(detail["latest"]["components"]) == {"text", "voice"}
    assert detail["latest"]["confidence"] == 0.35
    assert client.get(f"/counsellor/victims/{v['user_id']}", headers=bearer(c2["token"])).status_code == 404


def test_message_text_stored_only_with_consent():
    v = register(consent={"data_storage": True, "store_messages": False})
    service.record_chat(auth.user_for_token(v["token"]), "private words", {"score": 10.0})
    w = register("W", consent={"data_storage": True, "store_messages": True})
    service.record_chat(auth.user_for_token(w["token"]), "kept words", {"score": 10.0})
    with db.connect() as conn:
        rows = {r["user_id"]: r["detail_enc"] for r in conn.execute("SELECT user_id, detail_enc FROM observations")}
    assert rows[v["user_id"]] is None
    assert rows[w["user_id"]] and "kept" not in rows[w["user_id"]]


def test_voice_analysis_consent_off_records_nothing():
    v = register(consent={"data_storage": True, "voice_analysis": False})
    assert service.record_voice_session(auth.user_for_token(v["token"]), {"probabilities": {"sad": 90}}) is None
    with db.connect() as conn:
        assert conn.execute("SELECT COUNT(*) FROM observations").fetchone()[0] == 0


def test_rising_trend_and_upcoming_hearing_raise_alerts():
    c = service.create_counsellor("C")
    now = time.time()
    v = service.register_victim("Meena", consent={"data_storage": True}, created_at=now - 20 * DAY)
    user = auth.user_for_token(v["token"])
    for days_ago, score in [(14, 20), (10, 25), (7, 30), (0, 75)]:
        service.record_chat(user, "x", {"score": float(score)}, now=now - days_ago * DAY)
    service.submit_questionnaire(user, "gad7", [3, 3, 2, 2, 2, 2, 2], now=now)
    r = client.post(f"/counsellor/victims/{v['user_id']}/events", headers=bearer(c["token"]),
                    json={"kind": "hearing", "date": (date.today() + timedelta(days=2)).isoformat(),
                          "title": "District court"})
    assert r.status_code == 200 and r.json()["days_until"] == 2
    reasons = {a["reason"] for a in client.get("/counsellor/alerts", headers=bearer(c["token"])).json()}
    assert {"rising_distress", "upcoming_event"} <= reasons
    trend = client.get("/counsellor/victims", headers=bearer(c["token"])).json()[0]["trend"]
    assert trend["direction"] == "rising"


def test_gone_quiet_alert_without_claiming_high_distress():
    service.create_counsellor("C")
    now = time.time()
    v = service.register_victim("Ravi", consent={"data_storage": True}, created_at=now - 20 * DAY)
    user = auth.user_for_token(v["token"])
    service.record_chat(user, "x", {"score": 60.0}, now=now - 15 * DAY)
    result = service.recompute(user["id"], now)
    assert set(result["components"]) == {"engagement"} and result["score"] < 50
    assert [a["reason"] for a in result["new_alerts"]] == ["gone_quiet"]


def test_acknowledge_and_resolve_alert():
    c = service.create_counsellor("C")
    v = register()
    client.post("/me/questionnaires/phq9", json={"answers": [0] * 8 + [2]}, headers=bearer(v["token"]))
    alert = client.get("/counsellor/alerts", headers=bearer(c["token"])).json()[0]
    assert client.post(f"/counsellor/alerts/{alert['id']}/acknowledge", headers=bearer(c["token"])).json()["status"] == "acknowledged"
    done = client.post(f"/counsellor/alerts/{alert['id']}/resolve", json={"note": "Called, safe with family"},
                       headers=bearer(c["token"])).json()
    assert done["status"] == "resolved" and done["note"] == "Called, safe with family" and done["handled_by"] == "C"
    assert client.get("/counsellor/alerts", headers=bearer(c["token"])).json() == []


def test_wellbeing_is_gentle_and_number_free():
    v = register(language="hi")
    client.post("/me/questionnaires/phq9", json={"answers": [2, 2, 3, 3, 1, 1, 1, 1, 0]}, headers=bearer(v["token"]))
    w = client.get("/me/wellbeing", headers=bearer(v["token"])).json()
    assert set(w) == {"stress", "energy", "fatigue", "message", "has_data"}
    assert w["fatigue"] == "Rest needed" and not any(ch.isdigit() for ch in w["message"])


def test_due_checkins_offer_full_set_first_then_pulse():
    v = register()
    due = {d["instrument"]: d["due"] for d in client.get("/me/due", headers=bearer(v["token"])).json()}
    assert due == {"phq9": True, "gad7": True, "pcptsd5": True, "phq4": False}
    for inst, answers in (("phq9", [0] * 9), ("gad7", [0] * 7), ("pcptsd5", [0] * 5)):
        client.post(f"/me/questionnaires/{inst}", json={"answers": answers}, headers=bearer(v["token"]))
    due = {d["instrument"]: d["due"] for d in client.get("/me/due", headers=bearer(v["token"])).json()}
    assert due == {"phq9": False, "gad7": False, "pcptsd5": False, "phq4": True}


def test_timeline_has_chart_data():
    c = service.create_counsellor("C")
    now = time.time()
    v = service.register_victim("T", consent={"data_storage": True}, created_at=now - 10 * DAY)
    user = auth.user_for_token(v["token"])
    for d in (5, 3, 1):
        service.record_chat(user, "x", {"score": 40.0}, now=now - d * DAY)
    t = client.get(f"/counsellor/victims/{v['user_id']}/timeline?days=30", headers=bearer(c["token"])).json()
    assert len(t["scores"]) == 3 and len(t["signals"]["text_distress"]) == 3


def test_delete_account_erases_everything():
    v = register()
    client.post("/me/questionnaires/phq9", json={"answers": [1] * 9}, headers=bearer(v["token"]))
    assert client.delete("/me", headers=bearer(v["token"])).json() == {"deleted": True, "recordings_deleted": 0}
    with db.connect() as conn:
        for table in ("users", "observations", "questionnaires", "scores", "alerts",
                      "credentials", "sessions", "attachments"):
            assert conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] == 0
    assert client.get("/me", headers=bearer(v["token"])).status_code == 401


def test_alerts_not_duplicated_and_resolved_crisis_needs_a_new_signal():
    c = service.create_counsellor("C")
    v = register()
    user = auth.user_for_token(v["token"])
    now = time.time()
    service.submit_questionnaire(user, "phq9", [0] * 8 + [1], now=now)
    for hours in (13, 26, 40):            # hourly rescoring keeps seeing the same signal
        service.recompute(user["id"], now + hours * 3600)
    open_alerts = client.get("/counsellor/alerts", headers=bearer(c["token"])).json()
    assert [a["reason"] for a in open_alerts] == ["crisis_signal"]

    client.post(f"/counsellor/alerts/{open_alerts[0]['id']}/resolve", json={"note": "Spoke to her"},
                headers=bearer(c["token"]))
    service.recompute(user["id"], now + 41 * 3600)
    assert client.get("/counsellor/alerts", headers=bearer(c["token"])).json() == []

    service.record_chat(user, "x", {"score": 90.0}, crisis=True, now=now + 42 * 3600)
    assert [a["reason"] for a in client.get("/counsellor/alerts", headers=bearer(c["token"])).json()] == ["crisis_signal"]


# ------------------------------------------------------- conversation memory

def consenting(name="Meera"):
    """A victim who agreed to have their messages kept."""
    return register(name, consent={"data_storage": True, "store_messages": True})


def test_conversation_is_kept_and_read_back_in_order():
    v = consenting()
    user = auth.user_for_token(v["token"])
    for role, text in (("user", "My hearing is on Friday."),
                       ("assistant", "That's soon. How are you feeling?"),
                       ("user", "Nervous.")):
        assert service.remember_message(user, role, text, "chat")

    r = client.get("/me/conversation", headers=bearer(v["token"]))
    assert r.status_code == 200
    turns = r.json()["turns"]
    assert [t["role"] for t in turns] == ["user", "assistant", "user"]
    assert [t["content"] for t in turns][0] == "My hearing is on Friday."
    assert r.json()["stored"] is True


def test_stored_messages_are_encrypted_at_rest():
    v = consenting()
    service.remember_message(auth.user_for_token(v["token"]), "user", "My hearing is on Friday.", "chat")
    with db.connect() as conn:
        row = conn.execute("SELECT text_enc FROM messages WHERE user_id = ?", (v["user_id"],)).fetchone()
    assert "hearing" not in row["text_enc"]


def test_nothing_is_kept_without_the_store_messages_consent():
    v = register("Asha")          # data_storage only: messages are not kept
    user = auth.user_for_token(v["token"])
    assert service.remember_message(user, "user", "Please don't keep this.", "chat") is False
    r = client.get("/me/conversation", headers=bearer(v["token"]))
    assert r.json() == {"turns": [], "stored": False}


def test_turning_the_consent_off_erases_what_was_kept():
    v = consenting()
    service.remember_message(auth.user_for_token(v["token"]), "user", "Something private.", "chat")
    client.patch("/me/consent", json={"store_messages": False}, headers=bearer(v["token"]))
    with db.connect() as conn:
        assert conn.execute("SELECT COUNT(*) c FROM messages WHERE user_id = ?",
                            (v["user_id"],)).fetchone()["c"] == 0


def test_a_victim_can_delete_the_conversation_on_its_own():
    v = consenting()
    user = auth.user_for_token(v["token"])
    service.remember_message(user, "user", "One.", "chat")
    service.remember_message(user, "assistant", "Two.", "voice")
    assert client.delete("/me/conversation", headers=bearer(v["token"])).json() == {"deleted": 2}
    assert client.get("/me/conversation", headers=bearer(v["token"])).json()["turns"] == []


def test_deleting_the_account_takes_the_conversation_with_it():
    v = consenting()
    service.remember_message(auth.user_for_token(v["token"]), "user", "One.", "chat")
    client.delete("/me", headers=bearer(v["token"]))
    with db.connect() as conn:
        assert conn.execute("SELECT COUNT(*) c FROM messages WHERE user_id = ?",
                            (v["user_id"],)).fetchone()["c"] == 0


# ---------------------------------------------------------------- case-aware distress

def _days_from_today(n):
    return (date.today() + timedelta(days=n)).isoformat()


def test_hearing_raises_case_pressure_and_a_forecast():
    c = service.create_counsellor("C")
    v = register()
    client.post(f"/counsellor/victims/{v['user_id']}/events", headers=bearer(c["token"]),
                json={"kind": "hearing", "date": _days_from_today(4), "title": "District court"})
    detail = client.get(f"/counsellor/victims/{v['user_id']}", headers=bearer(c["token"])).json()
    assert detail["latest"]["components"]["case_pressure"] > 0
    # 4 days out on a 14-day ramp
    assert detail["latest"]["details"]["case_pressure"]["next_hearing"]["days_until"] == 4
    assert detail["forecast"]["peak_on"] == _days_from_today(4)
    assert detail["forecast"]["peak_score"] >= detail["latest"]["score"]
    reasons = {a["reason"] for a in detail["alerts"]}
    assert "hearing_soon" in reasons


def test_bail_hearing_without_notice_raises_a_high_alert():
    c = service.create_counsellor("C")
    v = register()
    client.post(f"/counsellor/victims/{v['user_id']}/events", headers=bearer(c["token"]),
                json={"kind": "bail_hearing", "date": _days_from_today(3), "title": "Bail application",
                      "notice_given": False})
    detail = client.get(f"/counsellor/victims/{v['user_id']}", headers=bearer(c["token"])).json()
    alert = next(a for a in detail["alerts"] if a["reason"] == "bail_no_notice")
    assert alert["level"] == "high"
    assert "15A" in alert["message"]


def test_notice_recorded_means_no_bail_alert():
    c = service.create_counsellor("C")
    v = register()
    client.post(f"/counsellor/victims/{v['user_id']}/events", headers=bearer(c["token"]),
                json={"kind": "bail_hearing", "date": _days_from_today(3), "title": "Bail application",
                      "notice_given": True})
    detail = client.get(f"/counsellor/victims/{v['user_id']}", headers=bearer(c["token"])).json()
    assert "bail_no_notice" not in {a["reason"] for a in detail["alerts"]}


def test_victim_case_view_hides_numbers_and_softens_bail():
    c = service.create_counsellor("C")
    v = register()
    client.post(f"/counsellor/victims/{v['user_id']}/events", headers=bearer(c["token"]),
                json={"kind": "bail_hearing", "date": _days_from_today(5), "title": "Bail application"})
    case = client.get("/me/case", headers=bearer(v["token"])).json()
    blob = json.dumps(case).lower()
    for banned in ("bail", "score", "tier", "distress", "risk", "accused"):
        assert banned not in blob
    assert case["upcoming"][0]["label"] == "A court date about your case"


def test_entitlement_not_received_raises_alert_and_hides_amount_from_victim():
    c = service.create_counsellor("C")
    v = register()
    ent = client.post(f"/counsellor/victims/{v['user_id']}/entitlements", headers=bearer(c["token"]),
                      json={"stage": "chargesheet", "amount": 412500,
                            "due_on": _days_from_today(-45)}).json()
    assert ent["amount"] == 412500

    case = client.get("/me/case", headers=bearer(v["token"])).json()
    assert case["entitlements"][0]["id"] == ent["id"]
    assert "amount" not in case["entitlements"][0]
    assert "412500" not in json.dumps(case)

    client.post(f"/me/entitlements/{ent['id']}", headers=bearer(v["token"]),
                json={"status": "not_received"})
    detail = client.get(f"/counsellor/victims/{v['user_id']}", headers=bearer(c["token"])).json()
    alert = next(a for a in detail["alerts"] if a["reason"] == "entitlement_unpaid")
    assert alert["level"] == "high"
    assert detail["latest"]["details"]["case_pressure"]["unpaid_entitlements"]["count"] == 1


def test_three_adjournments_raise_a_streak_alert():
    c = service.create_counsellor("C")
    v = register()
    for n in (10, 40, 70):
        client.post(f"/counsellor/victims/{v['user_id']}/events", headers=bearer(c["token"]),
                    json={"kind": "adjournment", "date": _days_from_today(-n), "title": "Adjourned"})
    detail = client.get(f"/counsellor/victims/{v['user_id']}", headers=bearer(c["token"])).json()
    assert "adjournment_streak" in {a["reason"] for a in detail["alerts"]}


def test_forecast_list_sorts_worst_first_and_is_counsellor_scoped():
    c1 = service.create_counsellor("C1")
    c2 = service.create_counsellor("C2")
    near = register("Near")
    far = register("Far")
    for v, day in ((near, 1), (far, 12)):
        client.post(f"/counsellor/victims/{v['user_id']}/events", headers=bearer(c1["token"]),
                    json={"kind": "hearing", "date": _days_from_today(day), "title": "Court"})
    rows = client.get("/counsellor/forecast", headers=bearer(c1["token"])).json()
    assert [r["name"] for r in rows][0] == "Near"
    assert client.get("/counsellor/forecast", headers=bearer(c2["token"])).json() == []


def test_another_counsellor_cannot_touch_entitlements():
    c1 = service.create_counsellor("C1")
    c2 = service.create_counsellor("C2")
    v = register()
    ent = client.post(f"/counsellor/victims/{v['user_id']}/entitlements", headers=bearer(c1["token"]),
                      json={"stage": "fir", "amount": 100000}).json()
    assert client.get(f"/counsellor/victims/{v['user_id']}/entitlements",
                      headers=bearer(c2["token"])).status_code == 404
    assert client.patch(f"/counsellor/entitlements/{ent['id']}", headers=bearer(c2["token"]),
                        json={"status": "received"}).status_code == 404


def test_victim_card_and_score_agree_about_what_day_a_hearing_is():
    """The victim's 'days_until' and the score's hearing ramp are computed in
    different modules. When one used UTC and the other local time they drifted a
    day apart in IST, so a hearing was 'today' in an alert and 'tomorrow' on the
    card."""
    c = service.create_counsellor("C")
    v = register()
    client.post(f"/counsellor/victims/{v['user_id']}/events", headers=bearer(c["token"]),
                json={"kind": "hearing", "date": _days_from_today(2), "title": "Court"})
    case = client.get("/me/case", headers=bearer(v["token"])).json()
    detail = client.get(f"/counsellor/victims/{v['user_id']}", headers=bearer(c["token"])).json()
    assert (case["upcoming"][0]["days_until"]
            == detail["latest"]["details"]["case_pressure"]["next_hearing"]["days_until"]
            == detail["forecast"]["days_until"] == 2)


def test_relief_schedule_is_the_gazette_not_a_flat_25_50_25():
    """Annexure-I does not use one split. Dumping excreta is 10/50/40, rape pays
    half after the medical report, murder half after the post-mortem, and a social
    boycott is paid in full at charge sheet. Telling someone otherwise would
    promise them money on a date the rules do not."""
    sched = service.relief_schedule()
    assert "G.S.R. 424(E)" in sched["notification"]
    for entry in sched["entries"]:
        assert sum(s["percent"] for s in entry["stages"]) == 100, entry["section"]

    def split(section):
        e = service.relief_for(section)
        return e["amount"], [(s["stage"], s["percent"]) for s in e["stages"]]

    assert split("3(1)(b)") == (100000, [("fir", 10), ("chargesheet", 50), ("conviction", 40)])
    assert split("IPC 375") == (500000, [("medical_report", 50), ("chargesheet", 25), ("trial_end", 25)])
    assert split("IPC 376D")[0] == 825000
    assert split("murder") == (825000, [("post_mortem", 50), ("chargesheet", 50)])
    assert split("3(1)(zc)") == (100000, [("chargesheet", 100)])
    assert split("3(1)(r)") == (100000, [("fir", 25), ("chargesheet", 50), ("conviction", 25)])


def test_creating_relief_from_a_section_splits_the_real_amount():
    c = service.create_counsellor("C")
    v = register()
    out = client.post(f"/counsellor/victims/{v['user_id']}/relief", headers=bearer(c["token"]),
                      json={"section": "IPC 375"}).json()
    assert out["total"] == 500000
    got = {e["stage"]: e["amount"] for e in out["entitlements"]}
    assert got == {"medical_report": 250000, "chargesheet": 125000, "trial_end": 125000}
    # the victim is asked the question but never shown the money
    case = client.get("/me/case", headers=bearer(v["token"])).json()
    assert len(case["entitlements"]) == 3
    assert "250000" not in json.dumps(case)
    assert all("amount" not in e for e in case["entitlements"])


def test_unknown_section_is_refused_rather_than_guessed():
    c = service.create_counsellor("C")
    v = register()
    r = client.post(f"/counsellor/victims/{v['user_id']}/relief", headers=bearer(c["token"]),
                    json={"section": "not a real section"})
    assert r.status_code == 422
