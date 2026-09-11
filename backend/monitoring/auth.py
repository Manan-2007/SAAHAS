"""Bearer-token auth. Tokens are random, shown once at registration, and
stored only as SHA-256 hashes.

Endpoints outside /me and /counsellor keep working without a token
(anonymous mode: nothing is stored).
"""

import hashlib
import json
import secrets

from fastapi import Depends, Header, HTTPException

from . import db


def new_token():
    return secrets.token_urlsafe(32)


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def user_for_token(token):
    if not token:
        return None
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE token_hash = ?", (hash_token(token),)).fetchone()
    if row is None:
        return None
    user = dict(row)
    user["consent"] = json.loads(user["consent"] or "{}")
    return user


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
