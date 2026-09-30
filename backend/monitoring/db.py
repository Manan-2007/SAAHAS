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
-- One row per message or spoken turn: what the distress model made of it, never
-- the words. This is the per-message feed the counsellor watches live; the
-- Distress Score is still computed from observations.
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    channel TEXT NOT NULL,         -- chat | voice_call | voice_checkin | voice_note | message | ivrs
    score REAL NOT NULL,           -- 0-100, the distress model's expected level
    level INTEGER NOT NULL,        -- 0 none | 1 low | 2 moderate | 3 high
    crisis INTEGER NOT NULL DEFAULT 0,
    issues TEXT NOT NULL DEFAULT ''   -- case-issue categories spotted in this turn
);
CREATE INDEX IF NOT EXISTS readings_user_time ON readings(user_id, created_at);
-- Problems with the justice process the person has run into: police refusing
-- an FIR, threats, no notice of a hearing, relief that never came. Detected in
-- what they say, reported by them directly, or logged by the counsellor, and
-- tracked until something has been done about it.
CREATE TABLE IF NOT EXISTS case_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,        -- high | medium
    source TEXT NOT NULL,          -- detected | victim_report | counsellor | insight
    summary_enc TEXT NOT NULL,     -- a paraphrase, never a quote
    evidence_enc TEXT,             -- the words themselves, only with store_messages consent
    status TEXT NOT NULL DEFAULT 'open',   -- open | in_progress | action_taken | resolved | dismissed
    occurrences INTEGER NOT NULL DEFAULT 1,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL,
    last_seen_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS issues_user_status ON case_issues(user_id, status);
CREATE TABLE IF NOT EXISTS issue_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL REFERENCES case_issues(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    by_id TEXT,
    action TEXT NOT NULL,          -- a step from legal_actions.json, or 'note' / 'status'
    note_enc TEXT
);
CREATE INDEX IF NOT EXISTS actions_issue ON issue_actions(issue_id, created_at);
-- What the assistant tells the counsellor about a conversation: emotions,
-- concerns and case problems, in its own words. Written with the
-- share_insights consent; the conversation itself is not kept for this.
CREATE TABLE IF NOT EXISTS insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    channel TEXT NOT NULL,         -- chat | voice_call | voice_checkin | mixed
    period_start REAL NOT NULL,
    period_end REAL NOT NULL,
    turns INTEGER NOT NULL,
    peak_level INTEGER,
    mean_score REAL,
    data_enc TEXT NOT NULL,        -- {emotions, summary, concerns, case_problems, risk_notes, follow_up}
    generator TEXT NOT NULL        -- the model, or 'rules' when it was unavailable
);
CREATE INDEX IF NOT EXISTS insights_user_time ON insights(user_id, created_at);
-- "Please call me" / "I want to talk" requests from the person to their counsellor.
CREATE TABLE IF NOT EXISTS contact_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    kind TEXT NOT NULL,            -- callback | talk_soon | ivrs_callback
    preferred_time TEXT,           -- asap | morning | afternoon | evening
    note_enc TEXT,
    status TEXT NOT NULL DEFAULT 'open',   -- open | acknowledged | done
    handled_by TEXT,
    handled_at REAL,
    response_enc TEXT
);
CREATE INDEX IF NOT EXISTS contact_user_status ON contact_requests(user_id, status);
-- Secure messages between a person and their counsellor. Sent on purpose to a
-- human, so kept (encrypted) regardless of the chat-storage consent.
CREATE TABLE IF NOT EXISTS counsellor_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- the victim in the thread
    created_at REAL NOT NULL,
    sender TEXT NOT NULL,          -- victim | counsellor
    sender_id TEXT,
    text_enc TEXT NOT NULL,
    read_at REAL
);
CREATE INDEX IF NOT EXISTS cmsg_user_time ON counsellor_messages(user_id, created_at);
-- Missed check-in outreach: the IVRS call queue and its reschedule budget.
CREATE TABLE IF NOT EXISTS outreach_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,          -- missed_checkin | missed_call | after_court
    missed_since REAL NOT NULL,    -- when the check-in was due
    scheduled_for REAL NOT NULL,   -- next call attempt
    deadline REAL NOT NULL,        -- rescheduling can never push past this
    status TEXT NOT NULL DEFAULT 'scheduled',
        -- scheduled | calling | completed | escalated | cancelled
    attempts INTEGER NOT NULL DEFAULT 0,
    reschedules INTEGER NOT NULL DEFAULT 0,
    provider_ref TEXT,
    outcome_enc TEXT,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS outreach_status_time ON outreach_calls(status, scheduled_for);
-- Counsellor contact details a victim may see (a work line, office hours).
CREATE TABLE IF NOT EXISTS counsellor_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone_enc TEXT,
    hours_enc TEXT,
    updated_at REAL NOT NULL
);
"""

# Columns added after the first release. SQLite has no "ADD COLUMN IF NOT
# EXISTS", so init() checks the table first.
MIGRATIONS = [
    # s.15A: notice to the victim before a bail/parole hearing is mandatory
    # (Hariram Bhambhi v. Satyanarayan, 2021). NULL means "nobody recorded it".
    ("case_events", "notice_given", "INTEGER"),
    # Asked at sign-up; shapes the app's tone (encrypted like other personal data).
    ("users", "gender_enc", "TEXT"),
    # 'warm' | 'calm' - the person's own choice of app style, overriding the default
    ("users", "ui_style", "TEXT"),
    # Duress (safety) password: signing in with it opens an empty decoy account
    # and alerts the counsellor. scrypt hash like password_hash; NULL = not set.
    ("credentials", "duress_hash", "TEXT"),
    # A decoy account points at the real one. Decoys are never assigned a
    # counsellor and never adopted, so they appear in no caseload.
    ("users", "decoy_of", "TEXT"),
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


def parse_iso(value):
    """The inverse of iso(), for sorting views; 0 for a missing value."""
    return datetime.fromisoformat(value).timestamp() if value else 0.0
