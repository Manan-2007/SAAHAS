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
-- What was actually said, both sides, so a conversation can carry on where it
-- left off: a new chat, the next voice call, or after a reload. Written only
-- with the store_messages consent, and encrypted like every other personal
-- field. Cascades away with the account.
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    channel TEXT NOT NULL DEFAULT 'chat',   -- chat | voice
    role TEXT NOT NULL,                     -- user | assistant
    text_enc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS msg_user_time ON messages(user_id, created_at);
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
-- What the person is owed and whether it actually arrived. Relief under the
-- SC/ST (Prevention of Atrocities) Rules is paid in stages - 25% at FIR, 50% at
-- charge sheet, 25% when the trial ends - and travel/maintenance (TAME, Rule 11)
-- is due within three days of a trip to the police, hospital or court. Victims
-- are rarely told, so money that never arrives reads as "nothing happened"
-- instead of as a missed entitlement someone can chase.
CREATE TABLE IF NOT EXISTS entitlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,           -- fir | chargesheet | trial_end | tame | other
    amount REAL,                   -- rupees; counsellor-only, never sent to victims
    due_on TEXT,                   -- YYYY-MM-DD
    status TEXT NOT NULL DEFAULT 'due',   -- due | received | not_received | unknown
    note_enc TEXT,
    asked_at REAL,
    answered_at REAL,
    created_by TEXT,
    created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS ent_user_status ON entitlements(user_id, status);
"""

# Columns added after the first release. SQLite has no "ADD COLUMN IF NOT
# EXISTS", so init() checks the table first.
MIGRATIONS = [
    # s.15A: notice to the victim before a bail/parole hearing is mandatory
    # (Hariram Bhambhi v. Satyanarayan, 2021). NULL means "nobody recorded it".
    ("case_events", "notice_given", "INTEGER"),
]


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
        for table, column, decl in MIGRATIONS:
            have = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
            if column not in have:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


def new_id():
    return uuid.uuid4().hex


def now():
    return time.time()


def iso(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="seconds") if ts else None
