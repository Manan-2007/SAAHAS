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
    assert detail["latest"]["confidence"] == 0.4
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
