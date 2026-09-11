"""Auth: passwords, sign-in, sessions, lockout, token rotation."""

import os
import sys
import tempfile
from pathlib import Path

os.environ["SAHAAS_DATA_DIR"] = tempfile.mkdtemp(prefix="sahaas-auth-test-")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from monitoring import api, auth, db, service  # noqa: E402

db.init()
app = FastAPI()
app.include_router(api.router)
client = TestClient(app)

PASSWORD = "correct horse battery"
CONSENT = {"data_storage": True}


@pytest.fixture(autouse=True)
def empty_db():
    with db.connect() as conn:
        conn.execute("DELETE FROM users")
    yield


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def register(name="Sunita", username=None, password=None, **extra):
    body = {"name": name, "language": "en", "consent": CONSENT, **extra}
    if username:
        body |= {"username": username, "password": password or PASSWORD}
    r = client.post("/auth/register", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def login(username, password=PASSWORD):
    return client.post("/auth/login", json={"username": username, "password": password})


# ---------------------------------------------------------------- passwords

def test_password_hash_is_salted_and_verifiable():
    a, b = auth.hash_password(PASSWORD), auth.hash_password(PASSWORD)
    assert a != b                                    # per-password salt
    assert a.startswith("scrypt$")
    assert auth.verify_password(PASSWORD, a)
    assert not auth.verify_password("wrong password", a)
    assert not auth.verify_password(PASSWORD, "not-a-hash")


def test_short_passwords_are_rejected():
    with pytest.raises(auth.AuthError):
        auth.hash_password("short")
    r = client.post("/auth/register", json={"name": "A", "consent": CONSENT,
                                            "username": "asha", "password": "short"})
    assert r.status_code == 422


def test_username_and_password_must_arrive_together():
    assert client.post("/auth/register", json={"name": "A", "consent": CONSENT,
                                               "username": "asha"}).status_code == 422


# ---------------------------------------------------------------- sign-in

def test_register_then_login_from_a_new_device():
    v = register("Sunita Devi", username="sunita")
    assert v["username"] == "sunita"

    r = login("sunita")
    assert r.status_code == 200, r.text
    session = r.json()
    assert session["token"] != v["token"]            # a session token, not the access token
    assert session["user_id"] == v["user_id"] and session["role"] == "victim"

    # Both credentials reach the same account.
    for token in (v["token"], session["token"]):
        assert client.get("/me", headers=bearer(token)).json()["user_id"] == v["user_id"]


def test_login_is_case_and_whitespace_insensitive():
    register(username="Sunita")
    assert login("  sUnItA  ").status_code == 200


def test_wrong_password_and_unknown_user_are_indistinguishable():
    register(username="sunita")
    wrong = login("sunita", "wrong password")
    missing = login("nobody", "wrong password")
    assert wrong.status_code == missing.status_code == 401
    assert wrong.json()["detail"] == missing.json()["detail"]


def test_username_is_not_stored_in_the_clear():
    v = register(username="sunita")
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM credentials WHERE user_id = ?", (v["user_id"],)).fetchone()
    assert "sunita" not in row["username_enc"]           # encrypted
    assert "sunita" not in row["username_index"]         # keyed HMAC, not a plain hash
    assert PASSWORD not in row["password_hash"]
    assert client.get("/me", headers=bearer(v["token"])).json()["username"] == "sunita"


def test_usernames_are_unique():
    register("First", username="sunita")
    r = client.post("/auth/register", json={"name": "Second", "consent": CONSENT,
                                            "username": "SUNITA", "password": PASSWORD})
    assert r.status_code == 409


def test_credentials_can_be_added_to_a_token_only_account():
    v = register()                                   # anonymous: no username
    assert client.get("/me", headers=bearer(v["token"])).json()["has_password"] is False
    assert login("later").status_code == 401

    r = client.put("/me/credentials", json={"username": "later", "password": PASSWORD},
                   headers=bearer(v["token"]))
    assert r.status_code == 200
    assert r.json() == {"username": "later", "has_password": True, "other_sessions_signed_out": 0}
    assert login("later").json()["user_id"] == v["user_id"]


def test_replacing_credentials_needs_the_current_password():
    register(username="sunita")
    phone = login("sunita").json()["token"]
    laptop = login("sunita").json()["token"]
    new = {"username": "sunita2", "password": "a whole new phrase"}

    # Someone holding an unlocked phone must not be able to take the account over
    assert client.put("/me/credentials", json=new, headers=bearer(laptop)).status_code == 401
    assert client.put("/me/credentials", json={**new, "current_password": "not it"},
                      headers=bearer(laptop)).status_code == 401
    assert login("sunita").status_code == 200

    r = client.put("/me/credentials", json={**new, "current_password": PASSWORD}, headers=bearer(laptop))
    assert r.status_code == 200 and r.json()["other_sessions_signed_out"] >= 1
    assert client.get("/me", headers=bearer(phone)).status_code == 401
    assert client.get("/me", headers=bearer(laptop)).status_code == 200
    assert login("sunita2", "a whole new phrase").status_code == 200


# ---------------------------------------------------------------- onboarding profile

def test_onboarding_profile_is_saved_encrypted_and_returned_by_me():
    v = register(name="Sunita", username="sunita")
    assert client.get("/me", headers=bearer(v["token"])).json()["profile"] is None

    answers = {"display_name": "Suni", "language": "hi", "coping": "Talking it out",
               "low_time": "Evenings", "channel": "Speaking out loud", "baseline_mood": 3, "comfort": "Slow breathing"}
    r = client.put("/me/profile", json=answers, headers=bearer(v["token"]))
    assert r.status_code == 200 and r.json()["name"] == "Suni" and r.json()["language"] == "hi"

    me = client.get("/me", headers=bearer(v["token"])).json()
    assert me["name"] == "Suni" and me["language"] == "hi"
    assert me["profile"]["coping"] == "Talking it out" and me["profile"]["baseline_mood"] == 3
    assert me["profile"]["completed_at"]
    with db.connect() as conn:
        stored = conn.execute("SELECT data_enc FROM profiles").fetchone()["data_enc"]
    assert "Talking it out" not in stored


def test_onboarding_profile_is_validated_victim_only_and_erased_with_the_account():
    v = register(username="sunita")
    assert client.put("/me/profile", json={"baseline_mood": 9}, headers=bearer(v["token"])).status_code == 422
    c = service.create_counsellor("Dr. Ananya")
    assert client.put("/me/profile", json={"coping": "x"}, headers=bearer(c["token"])).status_code == 403

    client.put("/me/profile", json={"coping": "Quiet time alone"}, headers=bearer(v["token"]))
    assert client.delete("/me", headers=bearer(v["token"])).status_code == 200
    with db.connect() as conn:
        assert conn.execute("SELECT COUNT(*) FROM profiles").fetchone()[0] == 0


def test_lockout_after_repeated_failures():
    register(username="sunita")
    for _ in range(auth.MAX_FAILED_ATTEMPTS):
        assert login("sunita", "wrong password").status_code == 401
    locked = login("sunita")                         # correct password, still locked out
    assert locked.status_code == 429
    assert "Try again" in locked.json()["detail"]


def test_a_successful_login_clears_the_failure_count():
    register(username="sunita")
    for _ in range(auth.MAX_FAILED_ATTEMPTS - 1):
        login("sunita", "wrong password")
    assert login("sunita").status_code == 200
    with db.connect() as conn:
        row = conn.execute("SELECT failed_attempts, locked_until FROM credentials").fetchone()
    assert row["failed_attempts"] == 0 and row["locked_until"] is None


# ---------------------------------------------------------------- sessions

def test_sessions_are_listed_and_can_be_revoked_one_at_a_time():
    register(username="sunita")
    phone = login("sunita").json()["token"]
    laptop = login("sunita").json()["token"]

    sessions = client.get("/me/sessions", headers=bearer(laptop)).json()
    assert len(sessions) == 2
    assert [s["current"] for s in sessions].count(True) == 1

    phone_id = next(s["id"] for s in sessions if not s["current"])
    assert client.delete(f"/me/sessions/{phone_id}", headers=bearer(laptop)).status_code == 200
    assert client.get("/me", headers=bearer(phone)).status_code == 401
    assert client.get("/me", headers=bearer(laptop)).status_code == 200
    assert client.delete(f"/me/sessions/{phone_id}", headers=bearer(laptop)).status_code == 404


def test_logout_ends_only_this_session_unless_asked_for_all():
    register(username="sunita")
    phone = login("sunita").json()["token"]
    laptop = login("sunita").json()["token"]

    assert client.post("/auth/logout", json={}, headers=bearer(phone)).json() == {"signed_out": 1}
    assert client.get("/me", headers=bearer(phone)).status_code == 401
    assert client.get("/me", headers=bearer(laptop)).status_code == 200

    assert client.post("/auth/logout", json={"all_devices": True}, headers=bearer(laptop)).json() == {"signed_out": 1}
    assert client.get("/me", headers=bearer(laptop)).status_code == 401


def test_expired_sessions_stop_working_and_get_purged():
    v = register(username="sunita")
    token = login("sunita").json()["token"]
    with db.connect() as conn:
        conn.execute("UPDATE sessions SET expires_at = ? WHERE user_id = ?", (db.now() - 1, v["user_id"]))
    assert client.get("/me", headers=bearer(token)).status_code == 401
    assert auth.purge_expired_sessions() == 1


def test_last_seen_is_refreshed_on_use():
    register(username="sunita")
    token = login("sunita").json()["token"]
    with db.connect() as conn:
        conn.execute("UPDATE sessions SET last_seen_at = 1000")
    client.get("/me", headers=bearer(token))
    with db.connect() as conn:
        assert conn.execute("SELECT last_seen_at FROM sessions").fetchone()[0] > 1000


def test_device_label_comes_from_the_user_agent():
    register(username="sunita")
    client.post("/auth/login", json={"username": "sunita", "password": PASSWORD},
                headers={"User-Agent": "SAHAAS/1.0 (Android)"})
    with db.connect() as conn:
        assert conn.execute("SELECT device FROM sessions").fetchone()[0] == "SAHAAS/1.0 (Android)"


# ---------------------------------------------------------------- rotation

def test_changing_the_password_signs_other_devices_out():
    register(username="sunita")
    phone = login("sunita").json()["token"]
    laptop = login("sunita").json()["token"]

    r = client.post("/me/password", json={"current_password": PASSWORD, "new_password": "a whole new phrase"},
                    headers=bearer(laptop))
    assert r.status_code == 200 and r.json()["other_sessions_signed_out"] == 1
    assert client.get("/me", headers=bearer(phone)).status_code == 401
    assert client.get("/me", headers=bearer(laptop)).status_code == 200     # the device that changed it stays in
    assert login("sunita", PASSWORD).status_code == 401
    assert login("sunita", "a whole new phrase").status_code == 200


def test_changing_the_password_needs_the_current_one():
    v = register(username="sunita")
    r = client.post("/me/password", json={"current_password": "not it", "new_password": "a whole new phrase"},
                    headers=bearer(v["token"]))
    assert r.status_code == 401


def test_password_change_on_a_token_only_account_is_a_conflict():
    v = register()
    r = client.post("/me/password", json={"current_password": PASSWORD, "new_password": "a whole new phrase"},
                    headers=bearer(v["token"]))
    assert r.status_code == 409


def test_rotating_the_access_token_retires_the_old_one():
    v = register()
    new = client.post("/me/token/rotate", headers=bearer(v["token"])).json()["token"]
    assert new != v["token"]
    assert client.get("/me", headers=bearer(v["token"])).status_code == 401
    assert client.get("/me", headers=bearer(new)).json()["user_id"] == v["user_id"]


# ---------------------------------------------------------------- roles

def test_counsellor_sign_in_and_role_separation():
    c = service.create_counsellor("Dr. Ananya", "ananya", PASSWORD)
    assert c["username"] == "ananya"
    token = login("ananya").json()["token"]
    assert client.get("/counsellor/victims", headers=bearer(token)).status_code == 200

    v = register(username="sunita")
    victim_token = login("sunita").json()["token"]
    assert client.get("/counsellor/victims", headers=bearer(victim_token)).status_code == 403
    assert client.get("/me/wellbeing", headers=bearer(token)).status_code == 403
    assert client.get("/me", headers=bearer(token)).json()["role"] == "counsellor"
    assert v["user_id"] != c["user_id"]


def test_unauthenticated_and_malformed_headers():
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers=bearer("not-a-token")).status_code == 401
    assert client.get("/me", headers={"Authorization": "Basic abc"}).status_code == 401
    assert client.get("/me", headers={"Authorization": "Bearer"}).status_code == 401
    assert client.get("/questionnaires").status_code == 200          # public routes stay open
