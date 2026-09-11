"""Field-level encryption for personal data at rest: names, phone numbers,
case references, questionnaire answers, stored messages and counsellor notes.

Key: SAHAAS_DATA_KEY env var (a Fernet key), or generated once into
data/secret.key. Back that key up - without it the data can't be read.
"""

import json
import os

from cryptography.fernet import Fernet

from . import db

_fernet = None


def _load_key():
    env = os.environ.get("SAHAAS_DATA_KEY")
    if env:
        return env.encode()
    path = db.DATA_DIR / "secret.key"
    if not path.exists():
        db.DATA_DIR.mkdir(parents=True, exist_ok=True)
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as f:
            f.write(Fernet.generate_key())
    return path.read_bytes().strip()


def _cipher():
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_load_key())
    return _fernet


def enc(text):
    if text is None:
        return None
    return _cipher().encrypt(str(text).encode()).decode()


def dec(token):
    if token is None:
        return None
    return _cipher().decrypt(token.encode()).decode()


def enc_json(value):
    return enc(json.dumps(value, ensure_ascii=False))


def dec_json(token):
    return None if token is None else json.loads(dec(token))
