"""SQLite storage for the monitoring timeline (data/sahaas.db).

Recordings themselves live in the storage bucket (monitoring.storage); the
attachments table here only points at them.

Every call opens its own short-lived connection, which keeps it safe from
FastAPI's worker threads. Set SAHAAS_DATA_DIR to put the data elsewhere.
"""

import os
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(os.environ.get("SAHAAS_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
DB_PATH = DATA_DIR / "sahaas.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('victim', 'counsellor')),
    name_enc TEXT NOT NULL,
    phone_enc TEXT,
    case_ref_enc TEXT,
    language TEXT NOT NULL DEFAULT 'en',
    counsellor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    consent TEXT NOT NULL DEFAULT '{}',
    token_hash TEXT UNIQUE NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS credentials (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username_index TEXT UNIQUE NOT NULL,   -- keyed HMAC of the lowercased username
    username_enc TEXT NOT NULL,            -- display form
    password_hash TEXT NOT NULL,           -- scrypt$n$r$p$salt$hash
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until REAL,
    password_changed_at REAL NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    device TEXT,                   -- coarse client label, for "where am I signed in"
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL,
    last_seen_at REAL NOT NULL,
    revoked_at REAL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id, revoked_at);
CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data_enc TEXT NOT NULL,        -- onboarding answers (personal baseline), encrypted
    updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    kind TEXT NOT NULL,            -- voice_note | voice_checkin
    bucket_key TEXT NOT NULL,      -- object key inside the storage bucket
    content_type TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    duration_s REAL,
    detail_enc TEXT                -- emotion / transcript snapshot, encrypted
);
CREATE INDEX IF NOT EXISTS attachments_user_time ON attachments(user_id, created_at);
CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    source TEXT NOT NULL,          -- chat | voice | questionnaire | system
    metric TEXT NOT NULL,          -- text_distress | voice_distress | voice_arousal | voice_valence | crisis | activity
    value REAL NOT NULL,
    detail_enc TEXT
);
CREATE INDEX IF NOT EXISTS obs_user_metric_time ON observations(user_id, metric, created_at);
CREATE TABLE IF NOT EXISTS questionnaires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    instrument TEXT NOT NULL,
    total INTEGER NOT NULL,
    severity TEXT NOT NULL,
    flags TEXT NOT NULL DEFAULT '',
    answers_enc TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'app'
);
CREATE INDEX IF NOT EXISTS q_user_time ON questionnaires(user_id, instrument, created_at);
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    score REAL NOT NULL,
    tier TEXT NOT NULL,
    crisis INTEGER NOT NULL,
    confidence REAL NOT NULL,
    components TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_user_time ON scores(user_id, created_at);
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    level TEXT NOT NULL,           -- crisis | high | watch
    reason TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    handled_by TEXT,
    handled_at REAL,
    note_enc TEXT
);
CREATE INDEX IF NOT EXISTS alerts_status_time ON alerts(status, created_at);
CREATE TABLE IF NOT EXISTS case_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_date TEXT NOT NULL,      -- YYYY-MM-DD
    kind TEXT NOT NULL,
    title_enc TEXT NOT NULL,
    created_by TEXT,
    created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS events_user_date ON case_events(user_id, event_date);
"""


@contextmanager
def connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init():
    with connect() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA)


def new_id():
    return uuid.uuid4().hex


def now():
    return time.time()


def iso(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="seconds") if ts else None
