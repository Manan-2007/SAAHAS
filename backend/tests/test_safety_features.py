"""Safety password (duress), missed-call check-in, and court-day mode."""

import time
from datetime import date, timedelta

from test_live import (DAY, FakeDialer, _noon, bearer, client, counsellor, db, empty_db, outreach,  # noqa: F401
                       service, victim)

PASSWORD = "real-password-1"
SAFETY = "safety-password-1"


def _victim_with_login(name="Asha", **extra):
    v = victim(name=name, username=f"{name.lower()}-{time.time_ns()}", password=PASSWORD, **extra)
    return v


def _login(username, password):
    return client.post("/auth/login", json={"username": username, "password": password})


# ---------------------------------------------------------------- duress

def test_safety_password_opens_an_empty_copy_and_alerts_the_counsellor():
    c = counsellor()
    v = _victim_with_login()
    real = bearer(v["token"])
    client.post("/me/mood", json={"mood": "low"}, headers=real)

    r = client.put("/me/duress-password", json={"current_password": PASSWORD, "duress_password": SAFETY},
                   headers=real)
    assert r.status_code == 200 and client.get("/me", headers=real).json()["has_duress"] is True

    forced = _login(v["username"], SAFETY)
    assert forced.status_code == 200
    body = forced.json()
    assert body["role"] == "victim" and body["counsellor"] is None and body["user_id"] != v["user_id"]
    decoy = bearer(body["token"])
    me = client.get("/me", headers=decoy).json()
    # Looks like the same account: same name and username, onboarded, no tell-tale flag.
    assert me["name"] == "Asha" and me["username"] == v["username"] and me["profile"] is not None
    assert me["has_duress"] is False and me["counsellor"] is None
    # Changing the password inside the copy "works" and leaves the real one alone.
    assert client.post("/me/password", json={"current_password": "x", "new_password": "whatever-123"},
                       headers=decoy).status_code == 200
    assert _login(v["username"], PASSWORD).status_code == 200

    alerts = client.get(f"/counsellor/victims/{v['user_id']}", headers=bearer(c["token"])).json()["alerts"]
    duress = [a for a in alerts if a["reason"] == "duress_login"]
    assert duress and duress[0]["level"] == "crisis"
    # The copy is in nobody's caseload and a new counsellor doesn't adopt it.
    ids = [row["user_id"] for row in client.get("/counsellor/victims", headers=bearer(c["token"])).json()]
    assert ids == [v["user_id"]]
    assert service.create_counsellor("Dr. Two")["adopted"] == 0

    # A second forced sign-in reuses the same copy.
    assert _login(v["username"], SAFETY).json()["user_id"] == body["user_id"]


def test_safety_password_rules():
    counsellor()
    v = _victim_with_login()
    h = bearer(v["token"])
    same = {"current_password": PASSWORD, "duress_password": PASSWORD}
    assert client.put("/me/duress-password", json=same, headers=h).status_code == 422
    wrong = {"current_password": "nope-nope-nope", "duress_password": SAFETY}
    assert client.put("/me/duress-password", json=wrong, headers=h).status_code == 401
    ok = {"current_password": PASSWORD, "duress_password": SAFETY}
    assert client.put("/me/duress-password", json=ok, headers=h).status_code == 200
    assert client.request("DELETE", "/me/duress-password", json={"current_password": PASSWORD},
                          headers=h).json() == {"has_duress": False}
    assert _login(v["username"], SAFETY).status_code == 401


def test_deleting_the_account_removes_the_copy_too():
    counsellor()
    v = _victim_with_login()
    client.put("/me/duress-password", json={"current_password": PASSWORD, "duress_password": SAFETY},
               headers=bearer(v["token"]))
    _login(v["username"], SAFETY)
    client.delete("/me", headers=bearer(v["token"]))
    with db.connect() as conn:
        assert conn.execute("SELECT COUNT(*) FROM users WHERE decoy_of = ?", (v["user_id"],)).fetchone()[0] == 0


# ---------------------------------------------------------------- missed-call check-in

def _key():
    return outreach.webhook_key()


def test_missed_call_queues_a_callback_only_for_people_who_agreed_to_calls():
    counsellor()
    yes = victim(phone="+91 98765 43210", consent={"ivrs_calls": True})
    victim(name="Bina", phone="9123456789")
    assert client.post("/ivrs/missed-call?key=wrong", json={"from": "9876543210"}).status_code == 403
    # Same answer for a registered, an unregistered and an opted-out number.
    for caller in ("+919876543210", "9000000000", "9123456789"):
        assert client.post(f"/ivrs/missed-call?key={_key()}", json={"from": caller}).json() == {"ok": True}
    with db.connect() as conn:
        rows = conn.execute("SELECT user_id, reason FROM outreach_calls").fetchall()
    assert [(r["user_id"], r["reason"]) for r in rows] == [(yes["user_id"], "missed_call")]

    with db.connect() as conn:
        when = conn.execute("SELECT scheduled_for FROM outreach_calls").fetchone()[0]
    [call_id] = outreach.dial_due(when, FakeDialer())          # inside the call window
    step = outreach.respond(call_id, "answered", now=when)
    said = " ".join(step["say"])
    assert "calling you back" in said and "Asha" not in said and "counsellor" not in said.lower()


def test_missed_calls_are_capped_per_day():
    counsellor()
    victim(phone="9876543210", consent={"ivrs_calls": True})
    now = _noon()
    for _ in range(outreach.MISSED_CALL_PER_DAY):
        call_id = outreach.request_callback("9876543210", now)
        outreach.dial_due(now, FakeDialer())
        outreach.respond(call_id, "answered", now=now)
        outreach.respond(call_id, "digits", "3", now=now)      # asks for a call back, call ends
    assert outreach.request_callback("9876543210", now) is None


def test_twilio_missed_call_is_rejected_so_it_costs_nothing():
    counsellor()
    victim(phone="9876543210", consent={"ivrs_calls": True})
    r = client.post(f"/ivrs/twilio/incoming?key={_key()}", data={"From": "+919876543210"})
    assert "<Reject" in r.text
    with db.connect() as conn:
        assert conn.execute("SELECT COUNT(*) FROM outreach_calls").fetchone()[0] == 1


def test_support_screen_shows_the_missed_call_number_once_set(monkeypatch):
    counsellor()
    v = victim(phone="9876543210", consent={"ivrs_calls": True})
    assert client.get("/me/support", headers=bearer(v["token"])).json()["missed_call"] is None
    monkeypatch.setenv("SAHAAS_MISSED_CALL_NUMBER", "080-4000-0000")
    info = client.get("/me/support", headers=bearer(v["token"])).json()["missed_call"]
    assert info == {"number": "080-4000-0000", "enabled": True}


# ---------------------------------------------------------------- court-day mode

def _court_date(c, v, day, kind="bail_hearing"):
    r = client.post(f"/counsellor/victims/{v['user_id']}/events",
                    json={"kind": kind, "date": day.isoformat(), "title": "Hearing"}, headers=bearer(c["token"]))
    assert r.status_code in (200, 201), r.text


def test_court_day_mode_before_during_and_after():
    c = counsellor()
    v = victim()
    h = bearer(v["token"])
    assert client.get("/me/court-day", headers=h).json() is None

    today = date.today()
    _court_date(c, v, today + timedelta(days=1))
    before = client.get("/me/court-day", headers=h).json()
    assert before["phase"] == "before" and before["title"] == "Tomorrow is a court date"
    ids = {t["id"] for t in before["tips"]}
    assert {"tickets", "rights", "breathe"} <= ids
    tickets = next(t for t in before["tips"] if t["id"] == "tickets")
    assert tickets["basis"] == "SC/ST (PoA) Rules r.11" and tickets["source_url"].startswith("https://")
    assert tickets["action"] == {"kind": "problem", "category": "tame_not_paid",
                                 "label": "I had to pay for travel myself"}
    text = str(before).lower()
    assert "bail" not in text and "score" not in text          # no docket word, no numbers

    user = {"id": v["user_id"], "language": "en"}
    noon, evening = _noon(1), _noon(1) + 7 * 3600               # tomorrow 12:00 and 19:00
    assert service.court_day(user, noon)["phase"] == "day"
    after = service.court_day(user, evening)
    assert after["phase"] == "after" and [a["kind"] for a in after["actions"]] == ["chat", "checkin"]
    assert service.court_day(user, _noon(2))["phase"] == "after"
    assert service.court_day(user, _noon(3)) is None


def test_court_day_speaks_hindi():
    c = counsellor()
    v = victim(language="hi")
    _court_date(c, v, date.today() + timedelta(days=1), kind="hearing")
    assert client.get("/me/court-day", headers=bearer(v["token"])).json()["title"] == "कल अदालत की तारीख है"


def test_evening_after_court_rings_once_without_mentioning_court():
    c = counsellor()
    v = victim(phone="9876543210", consent={"ivrs_calls": True})
    victim(name="Bina", phone="9123456789")                    # no consent to calls
    _court_date(c, v, date.today(), kind="hearing")
    assert outreach.schedule_after_court(_noon()) == []        # not before the evening
    evening = _noon() + 6.5 * 3600                              # 18:30
    [call_id] = outreach.schedule_after_court(evening)
    assert outreach.schedule_after_court(evening + 600) == []
    outreach.dial_due(evening, FakeDialer())
    said = " ".join(outreach.respond(call_id, "answered", now=evening)["say"]).lower()
    assert "this evening" in said and "court" not in said and "hearing" not in said
