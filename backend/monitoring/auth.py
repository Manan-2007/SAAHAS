"""Authentication: two kinds of bearer credential, both stored only as hashes.

  access token   issued once at registration (and by manage.py). Long-lived,
                 no username needed - this is the anonymous-first path for a
                 victim who does not want to create an identity. Rotatable.
  session token  issued by /auth/login against a username + password, so an
                 account can be reached again from a new device. Expires
                 (SAHAAS_SESSION_DAYS, default 30) and can be revoked one
                 device at a time.

Both arrive as `Authorization: Bearer <token>`; user_for_token() accepts
either. Endpoints outside /me, /auth and /counsellor keep working with no
token at all (anonymous mode: nothing is stored).

Passwords are hashed with scrypt (stdlib, memory-hard) with a per-password
salt. Repeated wrong passwords lock an account for a widening interval - that
credential is the only way into a victim's timeline, so online guessing has
to stay expensive.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import unicodedata

from fastapi import Depends, Header, HTTPException

from . import crypto, db

SESSION_DAYS = float(os.environ.get("SAHAAS_SESSION_DAYS", 30))
SESSION_TTL = SESSION_DAYS * 86400
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 200       # scrypt cost is flat, but don't hash unbounded input
MAX_FAILED_ATTEMPTS = 5         # before the first lockout
LOCKOUT_BASE_S = 60             # 5th failure locks 1 min, then 2, 4, 8 ... capped
LOCKOUT_MAX_S = 3600

# scrypt: ~16 MB and ~100 ms per hash on a laptop CPU.
SCRYPT_N = 2 ** 14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_MAXMEM = 64 * 1024 * 1024


class AuthError(Exception):
    """Wrong credentials, a locked account, or a username already taken."""

    def __init__(self, message, status=401):
        super().__init__(message)
        self.status = status


# ---------------------------------------------------------------- tokens

def new_token():
    return secrets.token_urlsafe(32)


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


# ---------------------------------------------------------------- passwords

def normalize_username(username):
    """Case- and unicode-folded, so "Asha " and "asha" are the same account."""
    return unicodedata.normalize("NFKC", str(username)).strip().casefold()


def username_index(username):
    return crypto.blind_index(normalize_username(username), "username")


def check_password_strength(password):
    password = str(password)
    if len(password) < MIN_PASSWORD_LENGTH:
        raise AuthError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters", status=422)
    if len(password) > MAX_PASSWORD_LENGTH:
        raise AuthError(f"Password must be at most {MAX_PASSWORD_LENGTH} characters", status=422)
    return password


def _prep(password):
    return unicodedata.normalize("NFKC", str(password)).encode()


def _b64(raw):
    return base64.urlsafe_b64encode(raw).decode()


def hash_password(password):
    """scrypt$n$r$p$salt$hash - the parameters travel with the hash, so they
    can be raised later without invalidating existing passwords."""
    check_password_strength(password)
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(_prep(password), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P,
                            maxmem=SCRYPT_MAXMEM, dklen=32)
    return "$".join(["scrypt", str(SCRYPT_N), str(SCRYPT_R), str(SCRYPT_P), _b64(salt), _b64(digest)])


def verify_password(password, encoded):
    try:
        scheme, n, r, p, salt, digest = encoded.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.urlsafe_b64decode(digest)
        actual = hashlib.scrypt(_prep(password), salt=base64.urlsafe_b64decode(salt),
                                n=int(n), r=int(r), p=int(p), maxmem=SCRYPT_MAXMEM, dklen=len(expected))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# ---------------------------------------------------------------- lookup

def _as_user(row):
    user = dict(row)
    user["consent"] = json.loads(user["consent"] or "{}")
    return user


def user_for_token(token, now=None):
    """Resolves an access token or a live session token to its user.

    Returns None for anything unknown, expired or revoked. On a session hit
    the session's last_seen_at is refreshed, which is what /me/sessions shows.
    """
    if not token:
        return None
    now = now or db.now()
    token_hash = hash_token(token)
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE token_hash = ?", (token_hash,)).fetchone()
        if row is not None:
            return _as_user(row)
        session = conn.execute(
            "SELECT * FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?",
            (token_hash, now)).fetchone()
        if session is None:
            return None
        conn.execute("UPDATE sessions SET last_seen_at = ? WHERE id = ?", (now, session["id"]))
        row = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
        if row is None:
            return None
        user = _as_user(row)
    user["session_id"] = session["id"]
    return user


# ---------------------------------------------------------------- sessions

def start_session(conn, user_id, device=None, now=None):
    now = now or db.now()
    token = new_token()
    cur = conn.execute(
        "INSERT INTO sessions (user_id, token_hash, device, created_at, expires_at, last_seen_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, hash_token(token), (device or "").strip()[:120] or None, now, now + SESSION_TTL, now))
    return token, cur.lastrowid


def revoke_session(conn, user_id, session_id, now=None):
    cur = conn.execute("UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
                       (now or db.now(), session_id, user_id))
    return cur.rowcount > 0


def revoke_all_sessions(conn, user_id, except_id=None, now=None):
    cur = conn.execute("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL "
                       "AND (? IS NULL OR id != ?)", (now or db.now(), user_id, except_id, except_id))
    return cur.rowcount


def purge_expired_sessions(now=None):
    """Housekeeping: drop rows for sessions nobody can use any more."""
    now = now or db.now()
    with db.connect() as conn:
        cur = conn.execute("DELETE FROM sessions WHERE expires_at < ? OR revoked_at IS NOT NULL", (now,))
    return cur.rowcount


# ---------------------------------------------------------------- credentials

def set_credentials(conn, user_id, username, password, now=None):
    """Attaches (or replaces) the username + password on an account."""
    now = now or db.now()
    username = unicodedata.normalize("NFKC", str(username)).strip()
    if not username:
        raise AuthError("Username cannot be empty", status=422)
    index = username_index(username)
    taken = conn.execute("SELECT user_id FROM credentials WHERE username_index = ? AND user_id != ?",
                         (index, user_id)).fetchone()
    if taken is not None:
        raise AuthError("That username is already taken", status=409)
    password_hash = hash_password(password)
    conn.execute(
        "INSERT INTO credentials (user_id, username_index, username_enc, password_hash, "
        "password_changed_at, created_at) VALUES (?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(user_id) DO UPDATE SET username_index = excluded.username_index, "
        "username_enc = excluded.username_enc, password_hash = excluded.password_hash, "
        "password_changed_at = excluded.password_changed_at, failed_attempts = 0, locked_until = NULL",
        (user_id, index, crypto.enc(username), password_hash, now, now))
    return username


def credentials_of(conn, user_id):
    row = conn.execute("SELECT username_enc, password_changed_at FROM credentials WHERE user_id = ?",
                       (user_id,)).fetchone()
    if row is None:
        return None
    return {"username": crypto.dec(row["username_enc"]), "password_set_at": row["password_changed_at"]}


def _lockout_until(failed_attempts, now):
    """Doubling backoff once the allowance is spent, capped at LOCKOUT_MAX_S."""
    if failed_attempts < MAX_FAILED_ATTEMPTS:
        return None
    over = failed_attempts - MAX_FAILED_ATTEMPTS
    return now + min(LOCKOUT_BASE_S * (2 ** over), LOCKOUT_MAX_S)


def authenticate(username, password, device=None, now=None):
    """username + password -> a fresh session token. Raises AuthError.

    The failure is raised only after the transaction closes: db.connect()
    commits on a clean exit, so raising inside the block would roll back the
    very attempt counter the lockout depends on.
    """
    now = now or db.now()
    failure = None
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM credentials WHERE username_index = ?",
                           (username_index(username),)).fetchone()
        if row is None:
            # Spend comparable time on an unknown username so response time
            # doesn't reveal which accounts exist.
            hash_password(secrets.token_urlsafe(16))
            failure = AuthError("Incorrect username or password")
        elif row["locked_until"] and row["locked_until"] > now:
            minutes = max(1, round((row["locked_until"] - now) / 60))
            failure = AuthError(f"Too many attempts. Try again in {minutes} minute(s)", status=429)
        elif not verify_password(password, row["password_hash"]):
            failed = row["failed_attempts"] + 1
            conn.execute("UPDATE credentials SET failed_attempts = ?, locked_until = ? WHERE user_id = ?",
                         (failed, _lockout_until(failed, now), row["user_id"]))
            failure = AuthError("Incorrect username or password")
        else:
            conn.execute("UPDATE credentials SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?",
                         (row["user_id"],))
            token, session_id = start_session(conn, row["user_id"], device, now)
            user = _as_user(conn.execute("SELECT * FROM users WHERE id = ?", (row["user_id"],)).fetchone())
    if failure is not None:
        raise failure
    return {"token": token, "session_id": session_id, "user": user,
            "username": crypto.dec(row["username_enc"])}


def change_password(user, current_password, new_password, keep_session_id=None, now=None):
    """Rotating the password signs every other device out."""
    now = now or db.now()
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM credentials WHERE user_id = ?", (user["id"],)).fetchone()
        if row is None:
            raise AuthError("This account has no password set. Add a username and password first.", status=409)
        if not verify_password(current_password, row["password_hash"]):
            raise AuthError("Current password is incorrect")
        conn.execute("UPDATE credentials SET password_hash = ?, password_changed_at = ?, "
                     "failed_attempts = 0, locked_until = NULL WHERE user_id = ?",
                     (hash_password(new_password), now, user["id"]))
        revoked = revoke_all_sessions(conn, user["id"], keep_session_id, now)
    return {"changed": True, "other_sessions_signed_out": revoked}


# ---------------------------------------------------------------- dependencies

def _bearer(authorization):
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    return token.strip() if scheme.lower() == "bearer" and token.strip() else None


def optional_user(authorization: str | None = Header(default=None)):
    token = _bearer(authorization)
    if token is None:
        return None
    user = user_for_token(token)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def current_user(user=Depends(optional_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Sign-in required")
    return user


def victim(user=Depends(current_user)):
    if user["role"] != "victim":
        raise HTTPException(status_code=403, detail="Victim account required")
    return user


def counsellor(user=Depends(current_user)):
    if user["role"] != "counsellor":
        raise HTTPException(status_code=403, detail="Counsellor account required")
    return user
