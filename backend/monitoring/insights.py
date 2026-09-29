"""Conversation insights: what the assistant tells the counsellor about a
conversation - how the person seemed, what worried them, and any problem with
their case - without handing over the conversation itself.

How the privacy works
  - While someone chats or talks, their turns are held in memory here (not on
    disk) together with each turn's distress reading.
  - When the conversation goes quiet (IDLE_S), a voice call ends, or a voice
    check-in finishes, the chat model writes a short structured summary in its
    own words. The summary is stored, encrypted; the buffered turns are dropped.
  - Nothing is summarised without the share_insights consent, and the turns
    are never written to disk by this module. The words are kept only where
    the person separately chose store_messages (monitoring.service).

The model gets a small budget and runs at background priority on the chat
thread, so it never delays a reply; if it is unavailable or returns something
unusable, a rule-based summary built from the distress readings and the
case-issue detector is stored instead, so the counsellor is never left blind.
"""

import json
import re
import threading
import time

from . import case_issues, crypto, db, events

IDLE_S = 90                 # quiet this long and the conversation is summarised
MAX_TURNS = 60              # per person, oldest dropped first
MIN_USER_TURNS = 1
MAX_TOKENS = 260
LEVEL_LABELS = ("calm", "low", "moderate", "high")
EMOTION_WORDS = ("anxious", "afraid", "sad", "hopeless", "angry", "frustrated", "ashamed", "lonely",
                 "exhausted", "numb", "overwhelmed", "hopeful", "relieved", "calm", "determined", "confused")

INSTRUCTION = (
    "You are writing a private hand-over note for a trauma-informed counsellor about a conversation "
    "between their client (a survivor of a caste atrocity in India) and the SAHAAS support assistant. "
    "Write in English, in your own words. Never quote the client, never include names of other people, "
    "places or phone numbers, and never diagnose. Report only what the client actually said or clearly "
    "showed.\n\n"
    "Return ONLY a JSON object with these keys:\n"
    '  "emotions": up to 4 single words for how the client seemed (e.g. anxious, hopeful)\n'
    '  "summary": 1-2 sentences on what the conversation was about\n'
    '  "concerns": up to 4 short phrases, the client\'s main worries\n'
    '  "case_problems": list of {"category", "description"} for problems with the police, courts, '
    "lawyers, relief money or threats. category must be one of: " + ", ".join(
        k for k in case_issues.PATTERNS) + ", other. Empty list if none.\n"
    '  "risk_notes": one sentence on safety or self-harm risk, or "" if none was expressed\n'
    '  "follow_up": one concrete suggestion for the counsellor\'s next contact\n'
    "Only list a case problem the client actually described; do not infer one. Pick the category whose "
    "name matches the description (travel costs are tame_not_paid, missing money is relief_not_received); "
    "use other if none fits."
)
PRONOUNS = {"woman": "The client is a woman (she/her).", "man": "The client is a man (he/him).",
            "nonbinary": "Refer to the client as they/them."}


class _Buffer:
    def __init__(self):
        self._lock = threading.Lock()
        self._turns = {}          # user_id -> list of turns
        self._users = {}          # user_id -> the user dict (consent, language)

    def add(self, user, turn):
        with self._lock:
            turns = self._turns.setdefault(user["id"], [])
            turns.append(turn)
            del turns[:-MAX_TURNS]
            self._users[user["id"]] = user

    def take(self, user_id):
        with self._lock:
            return self._users.pop(user_id, None), self._turns.pop(user_id, [])

    def idle(self, now, idle_s=IDLE_S):
        with self._lock:
            return [uid for uid, turns in self._turns.items()
                    if turns and now - turns[-1]["at"] >= idle_s]

    def forget(self, user_id):
        with self._lock:
            self._turns.pop(user_id, None)
            self._users.pop(user_id, None)

    def size(self, user_id):
        with self._lock:
            return len(self._turns.get(user_id, ()))


buffer = _Buffer()


def wanted(user):
    """share_insights defaults on for accounts made before the consent existed,
    the same as for new ones; it is shown and can be switched off."""
    return bool(user) and user.get("role") == "victim" and user["consent"].get("share_insights", True)


def note_turn(user, role, text, channel, reading=None, now=None):
    """Remember one turn (either side) for the next summary. In memory only."""
    text = (text or "").strip()
    if not text or not wanted(user):
        return
    buffer.add(user, {"role": role, "text": text[:1500], "channel": channel, "at": now or time.time(),
                      "score": reading["score"] if reading else None,
                      "level": reading["level"] if reading else None})


# ---------------------------------------------------------------- summarising

def prompt_messages(turns, gender=None):
    lines = []
    for t in turns:
        who = "Client" if t["role"] == "user" else "Assistant"
        mood = f" [distress: {LEVEL_LABELS[t['level']]}]" if t.get("level") is not None else ""
        lines.append(f"{who}{mood}: {t['text']}")
    who = PRONOUNS.get(gender, "Refer to the client as 'the client' or they/them; do not guess their gender.")
    return [{"role": "system", "content": INSTRUCTION + "\n" + who},
            {"role": "user", "content": "Conversation:\n" + "\n".join(lines) + "\n\nJSON:"}]


_FENCE = re.compile(r"```(?:json)?|```", re.I)


def parse(text):
    """The first JSON object in the model's answer, normalised; None if unusable."""
    if not text:
        return None
    text = _FENCE.sub("", re.sub(r"<think>.*?</think>", "", text, flags=re.S))
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    raw = json.loads(text[start:i + 1])
                except ValueError:
                    return None
                return normalise(raw)
    return None


def _strings(value, limit, length=80):
    if isinstance(value, str):
        value = [v.strip() for v in re.split(r"[,;]", value)]
    if not isinstance(value, list):
        return []
    return [str(v).strip()[:length] for v in value if str(v).strip()][:limit]


def normalise(raw):
    if not isinstance(raw, dict):
        return None
    problems = []
    for p in raw.get("case_problems") or []:
        if isinstance(p, dict):
            cat = str(p.get("category", "other")).strip().lower()
            desc = str(p.get("description", "")).strip()[:200]
        else:
            cat, desc = "other", str(p).strip()[:200]
        # The model's label is a guess; the words in its own description are
        # evidence. When the detector recognises the description, it wins.
        found = case_issues.detect(desc)
        if found and cat not in found:
            cat = found[0]
        elif not found and cat not in case_issues.categories():
            cat = "other"
        if desc or cat != "other":
            problems.append({"category": cat, "description": desc})
    out = {
        "emotions": [e.lower() for e in _strings(raw.get("emotions"), 4, 24)],
        "summary": str(raw.get("summary") or "").strip()[:400],
        "concerns": _strings(raw.get("concerns"), 4),
        "case_problems": problems[:5],
        "risk_notes": str(raw.get("risk_notes") or "").strip()[:240],
        "follow_up": str(raw.get("follow_up") or "").strip()[:240],
    }
    return out if out["summary"] or out["concerns"] or out["emotions"] else None


def rules_summary(turns):
    """What can be said without the model: the readings and the detector."""
    user_turns = [t for t in turns if t["role"] == "user"]
    levels = [t["level"] for t in user_turns if t.get("level") is not None]
    peak = max(levels) if levels else None
    found = []
    for t in user_turns:
        found += case_issues.detect(t["text"])
    found = list(dict.fromkeys(found))
    emotions = []
    if peak is not None:
        emotions = [{0: "settled", 1: "uneasy", 2: "distressed", 3: "in acute distress"}[peak]]
    return {
        "emotions": emotions,
        "summary": f"{len(user_turns)} message(s) from the client; the model summary was unavailable, "
                   "so this note is built from the distress readings and case-problem detection.",
        "concerns": [case_issues.categories()[c]["title"] for c in found][:4],
        "case_problems": [{"category": c, "description": case_issues.categories()[c]["title"]} for c in found],
        "risk_notes": "The distress model rated at least one message high risk." if peak == 3 else "",
        "follow_up": "Check in on how they are doing." if not found
        else "Go through the case problems raised and agree the next legal step.",
    }


def summarise(user, turns, channel, generate=None, now=None):
    """Writes the insight for these turns. generate(messages, max_tokens) -> text
    or None; any failure falls back to rules_summary(). Returns the stored view."""
    if not wanted(user) or sum(t["role"] == "user" for t in turns) < MIN_USER_TURNS:
        return None
    now = now or time.time()
    data, generator = None, "rules"
    if generate is not None:
        try:
            text = generate(prompt_messages(turns, crypto.dec(user.get("gender_enc"))), MAX_TOKENS)
            data = parse(text)
            if data is not None:
                generator = "model"
        except Exception as exc:          # the model is optional here, never fatal
            print(f"[insights] model summary failed, using rules: {exc}")
    if data is None:
        data = rules_summary(turns)
    return store(user, turns, channel, data, generator, now)


def store(user, turns, channel, data, generator, now=None):
    now = now or time.time()
    user_turns = [t for t in turns if t["role"] == "user"]
    levels = [t["level"] for t in user_turns if t.get("level") is not None]
    scores = [t["score"] for t in user_turns if t.get("score") is not None]
    channels = {t["channel"] for t in turns}
    channel = channel or (channels.pop() if len(channels) == 1 else "mixed")
    with db.connect() as conn:
        cur = conn.execute(
            "INSERT INTO insights (user_id, created_at, channel, period_start, period_end, turns, peak_level, "
            "mean_score, data_enc, generator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (user["id"], now, channel, turns[0]["at"], turns[-1]["at"], len(user_turns),
             max(levels) if levels else None, round(sum(scores) / len(scores), 1) if scores else None,
             crypto.enc_json(data), generator))
        insight_id = cur.lastrowid
        counsellor = conn.execute("SELECT counsellor_id FROM users WHERE id = ?", (user["id"],)).fetchone()
        row = conn.execute("SELECT * FROM insights WHERE id = ?", (insight_id,)).fetchone()
        item = view(row)
    # Problems the model heard that the patterns did not.
    cats = [p["category"] for p in data.get("case_problems", []) if p["category"] != "other"]
    if cats:
        case_issues.record_many(user, cats, "insight")
    events.publish(counsellor["counsellor_id"] if counsellor else None, "insight",
                   victim_id=user["id"], insight_id=insight_id)
    return item


def view(row):
    return {"id": row["id"], "at": db.iso(row["created_at"]), "channel": row["channel"],
            "period_start": db.iso(row["period_start"]), "period_end": db.iso(row["period_end"]),
            "turns": row["turns"],
            "peak_level": LEVEL_LABELS[row["peak_level"]] if row["peak_level"] is not None else None,
            "mean_score": row["mean_score"], "generator": row["generator"],
            **crypto.dec_json(row["data_enc"])}


def for_victim(counsellor, victim_id, limit=20):
    with db.connect() as conn:
        if conn.execute("SELECT 1 FROM users WHERE id = ? AND counsellor_id = ?",
                        (victim_id, counsellor["id"])).fetchone() is None:
            return None
        rows = conn.execute("SELECT * FROM insights WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                            (victim_id, int(limit))).fetchall()
        return [view(r) for r in rows]


def latest_for(conn, victim_id):
    row = conn.execute("SELECT * FROM insights WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
                       (victim_id,)).fetchone()
    return view(row) if row else None


def flush(user_id, channel=None, generate=None):
    """Summarise and forget whatever is buffered for this person now."""
    user, turns = buffer.take(user_id)
    if user is None or not turns:
        return None
    return summarise(user, turns, channel, generate)


def flush_idle(generate=None, now=None, idle_s=IDLE_S):
    done = 0
    for user_id in buffer.idle(now or time.time(), idle_s):
        try:
            if flush(user_id, None, generate) is not None:
                done += 1
        except Exception as exc:
            print(f"[insights] could not summarise a conversation: {exc}")
    return done
