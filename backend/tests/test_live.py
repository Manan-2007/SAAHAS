"""Live monitoring: per-message readings, case issues and their legal steps,
conversation insights, reaching the counsellor, missed check-in calls (IVRS),
the event bus, gender/app style, and the demo purge."""

import asyncio
import json
import os
import sys
import tempfile
import threading
import time
from pathlib import Path

os.environ.setdefault("SAHAAS_DATA_DIR", tempfile.mkdtemp(prefix="sahaas-test-"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from monitoring import (api, auth, case_issues, crypto, db, events, insights, outreach,  # noqa: E402
                        service, support)

DAY = 86400
db.init()
app = FastAPI()
app.include_router(api.router)
client = TestClient(app)

HIGH = {"level": 3, "label": "high", "score": 90.0, "high_risk": True}
MODERATE = {"level": 2, "label": "moderate", "score": 62.0, "high_risk": False}
LOW = {"level": 1, "label": "low", "score": 30.0, "high_risk": False}


@pytest.fixture(autouse=True)
def empty_db():
    with db.connect() as conn:
        conn.execute("DELETE FROM users")
    insights.buffer._turns.clear()
    insights.buffer._users.clear()
    yield


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def counsellor(name="Dr. C"):
    c = service.create_counsellor(name)
    return {**c, "id": c["user_id"]}


def victim(name="Asha", **extra):
    body = {"name": name, "language": "en", "consent": {"data_storage": True, **extra.pop("consent", {})}, **extra}
    r = client.post("/auth/register", json=body)
    assert r.status_code == 200, r.text
    v = r.json()
    return {**v, "user": auth.user_for_token(v["token"])}


# ---------------------------------------------------------------- gender and style

def test_gender_sets_the_default_style_and_can_be_changed():
    counsellor()
    w = victim("Meena", gender="woman")
    m = victim("Ravi", gender="man")
    n = victim("Sam")
    me = client.get("/me", headers=bearer(w["token"])).json()
    assert me["gender"] == "woman" and me["ui_style"] == "warm"
    assert client.get("/me", headers=bearer(m["token"])).json()["ui_style"] == "calm"
    assert client.get("/me", headers=bearer(n["token"])).json()["ui_style"] == "calm"
    with db.connect() as conn:
        assert "woman" not in (conn.execute("SELECT gender_enc FROM users WHERE id = ?", (w["user_id"],)).fetchone()[0])
    r = client.patch("/me/settings", json={"ui_style": "calm", "phone": "+91 98765 43210"}, headers=bearer(w["token"]))
    assert r.status_code == 200 and r.json()["ui_style"] == "calm" and r.json()["phone"] == "+91 98765 43210"
    assert client.patch("/me/settings", json={"gender": "robot"}, headers=bearer(w["token"])).status_code == 422


def test_new_counsellor_adopts_people_who_signed_up_with_nobody_there():
    v = victim()
    assert v["counsellor"] is None
    c = counsellor("Dr. New")
    assert c["adopted"] == 1
    assert client.get("/me", headers=bearer(v["token"])).json()["counsellor"] == "Dr. New"


def test_ivrs_calls_need_a_phone():
    counsellor()
    r = client.post("/auth/register", json={"name": "A", "consent": {"data_storage": True, "ivrs_calls": True}})
    assert r.status_code == 422
    v = victim()
    assert client.patch("/me/consent", json={"ivrs_calls": True}, headers=bearer(v["token"])).status_code == 422


# ---------------------------------------------------------------- per-message readings

def test_every_message_leaves_a_reading_for_the_counsellor_and_never_the_words():
    c = counsellor()
    v = victim()
    service.process_message(v["user"], "I feel very low today", "chat", MODERATE, False)
    service.process_message(v["user"], "hello", "chat", LOW, False)
    feed = client.get("/counsellor/feed", headers=bearer(c["token"])).json()
    assert [f["label"] for f in feed] == ["low", "moderate"]
    assert all("text" not in f for f in feed) and feed[0]["victim_name"] == "Asha"
    rows = client.get("/counsellor/victims", headers=bearer(c["token"])).json()
    assert rows[0]["latest_reading"]["label"] == "low" and rows[0]["peak_24h"]["label"] == "moderate"


def test_two_hard_messages_in_a_day_raise_a_watch_alert_once():
    c = counsellor()
    v = victim()
    for _ in range(3):
        service.process_message(v["user"], "everything feels heavy", "chat", MODERATE, False)
    alerts = [a for a in client.get("/counsellor/alerts", headers=bearer(c["token"])).json()
              if a["reason"] == "repeated_distress"]
    assert len(alerts) == 1 and alerts[0]["level"] == "watch"


def test_a_high_message_puts_the_person_at_the_top():
    c = counsellor()
    calm = victim("Calm")
    hard = victim("Hard")
    service.process_message(calm["user"], "fine", "chat", LOW, False)
    service.process_message(hard["user"], "I can't go on", "chat", HIGH, True)
    rows = client.get("/counsellor/victims", headers=bearer(c["token"])).json()
    assert rows[0]["name"] == "Hard" and rows[0]["crisis"]


# ---------------------------------------------------------------- case issues

def test_a_threat_becomes_an_issue_an_alert_and_case_pressure():
    c = counsellor()
    v = victim(consent={"store_messages": True})
    service.process_message(v["user"], "his brothers threatened to kill my son", "chat", LOW, False)
    issues = client.get("/counsellor/issues", headers=bearer(c["token"])).json()
    assert [i["category"] for i in issues] == ["threat"]
    issue = issues[0]
    assert issue["severity"] == "high" and issue["evidence"] == "his brothers threatened to kill my son"
    assert any(s["basis"].startswith("SC/ST (PoA) Act s.15A(1)") for s in issue["steps"] if "basis" in s)
    alerts = client.get("/counsellor/alerts", headers=bearer(c["token"])).json()
    assert any(a["reason"] == "threat_reported" and a["level"] == "high" for a in alerts)
    detail = client.get(f"/counsellor/victims/{v['user_id']}", headers=bearer(c["token"])).json()
    assert detail["latest"]["details"]["case_pressure"]["open_issues"]["count"] == 1


def test_the_same_problem_twice_is_one_issue_seen_twice_and_words_need_consent():
    c = counsellor()
    v = victim()
    service.process_message(v["user"], "the police refused to register my FIR", "chat", LOW, False)
    service.process_message(v["user"], "police still won't file the complaint", "chat", LOW, False)
    issues = client.get("/counsellor/issues", headers=bearer(c["token"])).json()
    assert len(issues) == 1 and issues[0]["occurrences"] == 2 and issues[0]["evidence"] is None


def test_counsellor_works_an_issue_through_to_resolved_and_every_step_is_logged():
    c = counsellor()
    v = victim()
    service.process_message(v["user"], "nobody told me about the bail hearing", "chat", LOW, False)
    issue = client.get("/counsellor/issues", headers=bearer(c["token"])).json()[0]
    r = client.patch(f"/counsellor/issues/{issue['id']}", json={"action": "notice_right", "note": "Wrote to SPP"},
                     headers=bearer(c["token"]))
    assert r.json()["status"] == "in_progress"
    r = client.patch(f"/counsellor/issues/{issue['id']}", json={"status": "resolved"}, headers=bearer(c["token"]))
    body = r.json()
    assert body["status"] == "resolved" and [a["action"] for a in body["actions"]] == ["notice_right", "status"]
    assert client.get("/counsellor/issues", headers=bearer(c["token"])).json() == []
    other = counsellor("Dr. Other")
    assert client.patch(f"/counsellor/issues/{issue['id']}", json={"status": "open"},
                        headers=bearer(other["token"])).status_code == 404


def test_victim_reports_a_problem_and_sees_only_plain_words():
    c = counsellor()
    v = victim(language="hi")
    cats = client.get("/me/issues/categories", headers=bearer(v["token"])).json()
    assert any(x["category"] == "fir_refused" and "FIR" in x["label"] for x in cats)
    r = client.post("/me/issues", json={"category": "relief_not_received", "note": "8 months, nothing"},
                    headers=bearer(v["token"]))
    assert r.status_code == 200 and set(r.json()) >= {"label", "status"} and "steps" not in r.json()
    assert client.post("/me/issues", json={"category": "nope"}, headers=bearer(v["token"])).status_code == 422
    issue = client.get("/counsellor/issues", headers=bearer(c["token"])).json()[0]
    assert issue["source"] == "victim_report" and issue["evidence"] == "8 months, nothing"


def test_legal_steps_cite_a_source_for_every_basis():
    data = client.get("/counsellor/legal-actions", headers=bearer(counsellor()["token"])).json()
    for cat, spec in data["categories"].items():
        assert spec["victim_label"]["en"] and spec["steps"], cat
        for step in spec["steps"]:
            if "basis" in step and "source" in step:
                assert step["source"] in data["sources"], (cat, step["id"])


# ---------------------------------------------------------------- insights

def _json_note(**over):
    note = {"emotions": ["anxious", "determined"], "summary": "Worried about the hearing next week.",
            "concerns": ["hearing next week"], "case_problems": [{"category": "no_lawyer", "description":
                                                                  "Has no lawyer for the hearing"}],
            "risk_notes": "", "follow_up": "Help find legal aid before the hearing."}
    note.update(over)
    return "```json\n" + json.dumps(note) + "\n```"


def test_insight_is_written_from_the_conversation_and_the_turns_are_dropped():
    c = counsellor()
    v = victim()
    service.process_message(v["user"], "the hearing is next week and I'm scared", "chat", MODERATE, False)
    insights.note_turn(v["user"], "assistant", "That sounds frightening.", "chat")
    seen = {}

    def fake(messages, max_tokens):
        seen["prompt"] = messages[-1]["content"]
        return _json_note()

    item = insights.flush(v["user_id"], None, fake)
    assert item["generator"] == "model" and item["emotions"] == ["anxious", "determined"]
    assert "Client [distress: moderate]: the hearing is next week" in seen["prompt"]
    assert insights.buffer.size(v["user_id"]) == 0
    got = client.get(f"/counsellor/victims/{v['user_id']}/insights", headers=bearer(c["token"])).json()
    assert got[0]["summary"] == "Worried about the hearing next week." and got[0]["peak_level"] == "moderate"
    cats = [i["category"] for i in client.get("/counsellor/issues", headers=bearer(c["token"])).json()]
    assert "no_lawyer" in cats
    with db.connect() as conn:
        raw = conn.execute("SELECT data_enc FROM insights").fetchone()[0]
    assert "hearing" not in raw


def test_insight_falls_back_to_rules_when_the_model_fails():
    counsellor()
    v = victim()
    service.process_message(v["user"], "the police refused to register my FIR", "chat", HIGH, True)

    def broken(messages, max_tokens):
        raise RuntimeError("model down")

    item = insights.flush(v["user_id"], None, broken)
    assert item["generator"] == "rules" and "Police refused or delayed the FIR" in item["concerns"]
    assert item["risk_notes"]


def test_no_insight_without_consent():
    counsellor()
    v = victim(consent={"share_insights": False})
    service.process_message(v["user"], "rough day", "chat", LOW, False)
    assert insights.buffer.size(v["user_id"]) == 0
    assert insights.flush(v["user_id"], None, lambda m, t: _json_note()) is None


def test_parse_is_forgiving_and_strict_about_categories():
    assert insights.parse("no json here") is None
    assert insights.parse('<think>x</think>{"summary": "ok", "case_problems": [{"category": "made_up", '
                          '"description": "police refused to register my FIR"}]}')["case_problems"][0][
        "category"] == "fir_refused"
    assert insights.parse('{"emotions": "sad, tired", "summary": "s"}')["emotions"] == ["sad", "tired"]


def test_idle_conversations_are_summarised_on_their_own():
    counsellor()
    v = victim()
    service.process_message(v["user"], "just checking in", "chat", LOW, False, now=time.time() - 200)
    assert insights.flush_idle(lambda m, t: _json_note(case_problems=[])) == 1


# ---------------------------------------------------------------- reaching the counsellor

def test_callback_requests_and_messages_both_ways():
    c = counsellor()
    support.set_counsellor_contact({"id": c["id"]}, "0120-555-0101", "Mon-Sat 10-6")
    v = victim()
    card = client.get("/me/support", headers=bearer(v["token"])).json()
    assert card["counsellor"] == {"name": "Dr. C", "phone": "0120-555-0101", "hours": "Mon-Sat 10-6"}
    assert {h["number"] for h in card["helplines"]} >= {"112", "14566", "181", "14416", "15100"}
    assert not any(h["number"].startswith("1800-599") for h in card["helplines"])      # KIRAN is gone

    r = client.post("/me/contact-requests", json={"preferred_time": "evening", "note": "after work"},
                    headers=bearer(v["token"]))
    assert r.status_code == 200
    client.post("/me/contact-requests", json={"preferred_time": "asap"}, headers=bearer(v["token"]))
    reqs = client.get("/counsellor/contact-requests", headers=bearer(c["token"])).json()
    assert len(reqs) == 1 and reqs[0]["preferred_time"] == "asap" and reqs[0]["note"] == "after work"
    client.post(f"/counsellor/contact-requests/{reqs[0]['id']}", json={"status": "done", "response": "Called"},
                headers=bearer(c["token"]))
    mine = client.get("/me/support", headers=bearer(v["token"])).json()["requests"]
    assert mine[0]["status"] == "done" and mine[0]["response"] == "Called" and "note" not in mine[0]

    support.send_from_victim(v["user"], "Can we talk tomorrow?")
    inbox = client.get("/counsellor/messages", headers=bearer(c["token"])).json()
    assert inbox[0]["unread"] == 1 and inbox[0]["last"]["text"] == "Can we talk tomorrow?"
    client.post(f"/counsellor/victims/{v['user_id']}/messages", json={"text": "Yes, 11am."}, headers=bearer(c["token"]))
    assert client.get("/counsellor/messages", headers=bearer(c["token"])).json()[0]["unread"] == 0
    assert client.get("/me/support", headers=bearer(v["token"])).json()["unread_messages"] == 1
    thread = client.get("/me/messages", headers=bearer(v["token"])).json()
    assert [m["sender"] for m in thread] == ["victim", "counsellor"]
    assert client.get("/me/support", headers=bearer(v["token"])).json()["unread_messages"] == 0
    with db.connect() as conn:
        assert "tomorrow" not in conn.execute("SELECT text_enc FROM counsellor_messages").fetchone()[0]


def test_mood_tap_counts_as_contact():
    counsellor()
    v = victim()
    assert client.post("/me/mood", json={"mood": "tired"}, headers=bearer(v["token"])).json()["saved"]
    assert client.post("/me/mood", json={"mood": "furious"}, headers=bearer(v["token"])).status_code == 422


# ---------------------------------------------------------------- outreach (IVRS)

class FakeDialer:
    def __init__(self):
        self.calls = []

    def place_call(self, call_id, phone):
        self.calls.append((call_id, phone))
        return f"fake-{call_id}"


def _overdue_victim(phone="9876543210", ivrs=True):
    v = victim(phone=phone, consent={"ivrs_calls": ivrs})
    with db.connect() as conn:       # signed up 5 days ago, never checked in
        conn.execute("UPDATE users SET created_at = ? WHERE id = ?", (time.time() - 5 * DAY, v["user_id"]))
    return v


def _noon(offset_days=0):
    t = time.localtime()
    return time.mktime((t.tm_year, t.tm_mon, t.tm_mday, 12, 0, 0, 0, 0, -1)) + offset_days * DAY


def test_missed_checkin_queues_one_call_only_for_people_who_opted_in():
    counsellor()
    yes = _overdue_victim()
    _overdue_victim(ivrs=False)
    now = _noon()
    assert len(outreach.schedule_missed(now)) == 1
    assert outreach.schedule_missed(now) == []
    dialer = FakeDialer()
    assert outreach.dial_due(now, dialer) and dialer.calls[0][1] == "9876543210"
    call = client.get("/me/checkin-call", headers=bearer(yes["token"])).json()["call"]
    assert call["status"] == "calling" and call["reschedules_left"] == outreach.MAX_RESCHEDULES


def test_calls_wait_for_the_call_window():
    counsellor()
    _overdue_victim()
    t = time.localtime()
    late = time.mktime((t.tm_year, t.tm_mon, t.tm_mday, 22, 30, 0, 0, 0, -1))
    outreach.schedule_missed(late)
    assert outreach.dial_due(late, FakeDialer()) == []


def test_keypad_checkin_saves_a_pulse_and_completes_the_call():
    c = counsellor()
    v = _overdue_victim()
    now = _noon()
    outreach.schedule_missed(now)
    [call_id] = outreach.dial_due(now, FakeDialer())
    step = outreach.respond(call_id, "answered", now=now)
    assert "Press 2" in " ".join(step["say"]) and "Asha" not in " ".join(step["say"])
    step = outreach.respond(call_id, "digits", "1", now=now)
    for digit in "2130":
        step = outreach.respond(call_id, "digits", digit, now=now)
    assert step["hangup"] and "Thank you for checking in" in step["say"][0]
    detail = client.get(f"/counsellor/victims/{v['user_id']}", headers=bearer(c["token"])).json()
    assert detail["questionnaires"][0]["instrument"] == "phq4" and detail["questionnaires"][0]["channel"] == "ivrs"
    assert detail["questionnaires"][0]["total"] == 6
    calls = client.get("/counsellor/outreach?status=all", headers=bearer(c["token"])).json()
    assert calls[0]["status"] == "completed"


def test_rescheduling_is_capped_so_it_cannot_become_avoidance():
    counsellor()
    v = _overdue_victim()
    now = _noon()
    outreach.schedule_missed(now)
    [call_id] = outreach.dial_due(now, FakeDialer())
    for i in range(outreach.MAX_RESCHEDULES):
        outreach.respond(call_id, "answered", now=now)
        outreach.respond(call_id, "digits", "2", now=now)
        step = outreach.respond(call_id, "digits", "1", now=now)
        assert "call you again" in step["say"][0]
        with db.connect() as conn:
            conn.execute("UPDATE outreach_calls SET status = 'calling' WHERE id = ?", (call_id,))
    step = outreach.respond(call_id, "answered", now=now)
    said = " ".join(step["say"])
    assert "can't move this call again" in said and "Press 2" not in said
    step = outreach.respond(call_id, "digits", "2", now=now)
    assert "didn't get that" in step["say"][0]
    r = client.post("/me/checkin-call/reschedule", json={"option": "1"}, headers=bearer(v["token"]))
    assert r.status_code == 409


def test_app_reschedule_uses_the_same_budget_and_checking_in_cancels_the_call():
    counsellor()
    v = _overdue_victim()
    now = time.time()
    outreach.schedule_missed(now)
    r = client.post("/me/checkin-call/reschedule", json={"option": "1"}, headers=bearer(v["token"]))
    assert r.status_code == 200 and r.json()["call"]["reschedules_left"] == outreach.MAX_RESCHEDULES - 1
    client.post("/me/questionnaires/phq4", json={"answers": [0, 1, 0, 1]}, headers=bearer(v["token"]))
    assert client.get("/me/checkin-call", headers=bearer(v["token"])).json()["call"] is None


def test_unanswered_calls_retry_then_escalate_to_the_counsellor():
    c = counsellor()
    _overdue_victim()
    now = _noon()
    outreach.schedule_missed(now)
    dialer = FakeDialer()
    for attempt in range(outreach.MAX_ATTEMPTS):
        [call_id] = outreach.dial_due(now, dialer)
        outreach.respond(call_id, "no_answer", now=now)
        now += outreach.RETRY_AFTER_MIN * 60 + 1
    alerts = client.get("/counsellor/alerts", headers=bearer(c["token"])).json()
    assert any(a["reason"] == "outreach_escalated" and a["level"] == "high" for a in alerts)


def test_webhooks_need_the_key_and_render_twiml():
    counsellor()
    _overdue_victim()
    now = _noon()
    outreach.schedule_missed(now)
    [call_id] = outreach.dial_due(now, FakeDialer())
    assert client.post(f"/ivrs/twilio/voice?call_id={call_id}&key=wrong").status_code == 403
    r = client.post(f"/ivrs/twilio/voice?call_id={call_id}&key={outreach.webhook_key()}",
                    data={"CallStatus": "in-progress"})
    assert r.status_code == 200 and "<Gather" in r.text and 'language="en-IN"' in r.text
    r = client.post(f"/ivrs/webhook?key={outreach.webhook_key()}", json={"call_id": call_id, "event": "digits",
                                                                          "digits": "3"})
    assert r.json()["hangup"]
    assert client.get("/counsellor/contact-requests", headers=bearer(counsellor("x")["token"])).json() == []


# ---------------------------------------------------------------- event bus

def test_events_reach_the_right_subscriber_from_a_worker_thread():
    async def run():
        events.bind(asyncio.get_running_loop())
        mine, other = events.subscribe("c1"), events.subscribe("c2")
        threading.Thread(target=events.publish, args=("c1", "reading"), kwargs={"victim_id": "v"}).start()
        got = await asyncio.wait_for(mine.get(), 2)
        assert got["type"] == "reading" and got["victim_id"] == "v" and other.empty()
        events.unsubscribe("c1", mine)
        events.unsubscribe("c2", other)
        assert events.listeners("c1") == 0
    try:
        asyncio.run(run())
    finally:
        events.bind(None)


# ---------------------------------------------------------------- demo purge

def test_purge_demo_removes_only_seeded_data():
    with db.connect() as conn:
        demo_c, _ = service._insert_user(conn, "counsellor", "Demo Counsellor")
        service._insert_user(conn, "victim", "Demo - Ravi (synthetic)", counsellor_id=demo_c)
        service._insert_user(conn, "victim", "Asha", case_ref="DEMO-6305", counsellor_id=demo_c)
        real, _ = service._insert_user(conn, "victim", "Jais", counsellor_id=demo_c)
    result = service.purge_demo()
    assert result == {"victims": 2, "counsellors": 1, "recordings": 0, "unassigned_victims": 1}
    with db.connect() as conn:
        left = [crypto.dec(r[0]) for r in conn.execute("SELECT name_enc FROM users")]
    assert left == ["Jais"]
