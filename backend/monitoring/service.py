"""Monitoring operations behind the API: accounts, check-ins, recording chat
and voice signals, rescoring, alerts, case events, and the victim/counsellor
views.

main.py calls record_chat() and record_voice_session() when a signed-in
victim chats or speaks; everything else is reached through monitoring.api.

Sign-in credentials live in monitoring.auth; stored recordings in
monitoring.storage.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

import yaml

from . import auth, crypto, db, questionnaires, scoring, storage

DAY = scoring.DAY
NEGATIVE_EMOTIONS = ("sad", "fearful", "angry", "disgust")
EVENT_KINDS = ("hearing", "fir", "chargesheet", "compensation", "counselling",
               "bail_hearing", "parole", "adjournment", "trial_end", "other")
# Kinds where s.15A makes notice to the victim mandatory before the hearing.
NOTICE_KINDS = ("bail_hearing", "parole")
ENTITLEMENT_STAGES = ("fir", "chargesheet", "conviction", "trial_end",
                      "medical_report", "post_mortem", "tame", "other")
ENTITLEMENT_STATUS = ("due", "received", "not_received", "unknown")
SIGNAL_METRICS = ("text_distress", "voice_distress", "voice_arousal", "voice_valence")
LEVEL_RANK = {"crisis": 0, "high": 1, "watch": 2}

FALLBACK_CRISIS_MESSAGE = (
    "If you're thinking about harming yourself or you're in danger right now, please reach out immediately: "
    "Emergency 112 · Women Helpline 181 · Tele-MANAS 14416 (24x7 mental health support).")

WELLBEING_MESSAGES = {
    "en": {
        None: "Check in whenever you feel ready - there's no pressure.",
        "stable": "You've been holding steady. Keep being gentle with yourself.",
        "watch": "Things may have felt a little heavier lately. Small check-ins help, and we're here.",
        "elevated": "This seems like a hard stretch. Your counsellor is here whenever you're ready to talk.",
        "high": "This seems like a very hard time. You don't have to carry it alone - your counsellor is here for you.",
    },
    "hi": {
        None: "जब भी आप तैयार हों, बात कर सकते हैं - कोई जल्दी नहीं है।",
        "stable": "आप संभले हुए हैं। अपने साथ नरमी से पेश आते रहिए।",
        "watch": "हाल में शायद चीज़ें थोड़ी भारी लगी हों। छोटी-छोटी बातचीत मदद करती है, और हम यहाँ हैं।",
        "elevated": "यह मुश्किल दौर लगता है। जब भी आप तैयार हों, आपकी काउंसलर बात करने के लिए यहाँ हैं।",
        "high": "यह बहुत कठिन समय लगता है। आपको यह अकेले नहीं उठाना है - आपकी काउंसलर आपके साथ हैं।",
    },
}


class NotFound(LookupError):
    pass


def crisis_message():
    try:
        with open(Path(__file__).resolve().parent.parent / "chat_training" / "config.yaml") as f:
            return " ".join(str(yaml.safe_load(f)["safety"]["crisis_message"]).split())
    except Exception:
        return FALLBACK_CRISIS_MESSAGE


iso = db.iso


# One definition of "what day is it", shared with scoring so the victim's card
# and the counsellor's alert can never disagree about a hearing date.
_today = scoring.today_for


# ---------------------------------------------------------------- accounts

def _insert_user(conn, role, name, language="en", phone=None, case_ref=None, consent=None,
                 counsellor_id=None, created_at=None):
    token = auth.new_token()
    user_id = db.new_id()
    conn.execute(
        "INSERT INTO users (id, role, name_enc, phone_enc, case_ref_enc, language, counsellor_id, consent, "
        "token_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, role, crypto.enc(name), crypto.enc(phone), crypto.enc(case_ref), language, counsellor_id,
         json.dumps(consent or {}), auth.hash_token(token), created_at or db.now()))
    return user_id, token


def create_counsellor(name, username=None, password=None):
    with db.connect() as conn:
        user_id, token = _insert_user(conn, "counsellor", name)
        if username and password:
            username = auth.set_credentials(conn, user_id, username, password)
    return {"user_id": user_id, "token": token, "role": "counsellor", "name": name,
            "username": username if password else None}


def register_victim(name, language="en", phone=None, case_ref=None, consent=None, created_at=None,
                    username=None, password=None):
    """Assigns the counsellor with the fewest victims.

    username + password are optional: without them the account is reachable
    only through the access token returned here (anonymous mode); with them it
    can be signed into again from any device.
    """
    with db.connect() as conn:
        counsellor = conn.execute(
            "SELECT c.id, c.name_enc FROM users c "
            "LEFT JOIN users v ON v.counsellor_id = c.id AND v.role = 'victim' "
            "WHERE c.role = 'counsellor' GROUP BY c.id ORDER BY COUNT(v.id), c.created_at LIMIT 1").fetchone()
        user_id, token = _insert_user(conn, "victim", name, language, phone, case_ref, consent,
                                      counsellor["id"] if counsellor else None, created_at)
        if username and password:
            username = auth.set_credentials(conn, user_id, username, password)
    return {"user_id": user_id, "token": token, "role": "victim",
            "username": username if password else None,
            "counsellor": crypto.dec(counsellor["name_enc"]) if counsellor else None}


def _name_of(conn, user_id):
    row = conn.execute("SELECT name_enc FROM users WHERE id = ?", (user_id,)).fetchone() if user_id else None
    return crypto.dec(row["name_enc"]) if row else None


def _profile_of(conn, user_id):
    row = conn.execute("SELECT data_enc FROM profiles WHERE user_id = ?", (user_id,)).fetchone()
    return crypto.dec_json(row["data_enc"]) if row else None


def profile(user):
    with db.connect() as conn:
        counsellor = _name_of(conn, user["counsellor_id"])
        credentials = auth.credentials_of(conn, user["id"])
        onboarding = _profile_of(conn, user["id"])
    return {"user_id": user["id"], "role": user["role"], "name": crypto.dec(user["name_enc"]),
            "language": user["language"], "consent": user["consent"], "counsellor": counsellor,
            "created_at": iso(user["created_at"]),
            "username": credentials["username"] if credentials else None,
            "has_password": credentials is not None,
            "signed_in_with": "session" if user.get("session_id") else "access_token",
            "profile": onboarding}


def save_profile(user, answers, display_name=None, language=None, now=None):
    """Onboarding answers (the person's own baseline), encrypted. The display
    name and language also update the account: the app greets and replies in them."""
    now = now or db.now()
    data = {**answers, "completed_at": iso(now)}
    display_name = (display_name or "").strip()
    with db.connect() as conn:
        conn.execute("INSERT INTO profiles (user_id, data_enc, updated_at) VALUES (?, ?, ?) "
                     "ON CONFLICT(user_id) DO UPDATE SET data_enc = excluded.data_enc, updated_at = excluded.updated_at",
                     (user["id"], crypto.enc_json(data), now))
        if display_name:
            conn.execute("UPDATE users SET name_enc = ? WHERE id = ?", (crypto.enc(display_name), user["id"]))
        if language:
            conn.execute("UPDATE users SET language = ? WHERE id = ?", (language, user["id"]))
    return {"profile": data, "name": display_name or crypto.dec(user["name_enc"]),
            "language": language or user["language"]}


def update_consent(user, changes):
    consent = {**user["consent"], **{k: v for k, v in changes.items() if v is not None}}
    with db.connect() as conn:
        conn.execute("UPDATE users SET consent = ? WHERE id = ?", (json.dumps(consent), user["id"]))
    # Turning message storage off erases what was already kept, rather than
    # only stopping new writes.
    if user["consent"].get("store_messages") and not consent.get("store_messages"):
        forget_conversation(user["id"])
    return consent


def delete_account(user):
    """Erases the account and every check-in, score, alert, event and session.

    Database rows go by cascade; bucket objects have to be deleted explicitly,
    and they go first so a failure cannot leave orphaned audio behind.
    """
    removed = storage.delete_all_for_user(user["id"])
    with db.connect() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    return {"deleted": True, "recordings_deleted": removed}


# ---------------------------------------------------------------- sign-in

def login(username, password, device=None):
    """username + password -> session token. Raises auth.AuthError."""
    result = auth.authenticate(username, password, device)
    user = result["user"]
    with db.connect() as conn:
        counsellor = _name_of(conn, user["counsellor_id"])
    return {"token": result["token"], "session_id": result["session_id"], "user_id": user["id"],
            "role": user["role"], "name": crypto.dec(user["name_enc"]), "username": result["username"],
            "language": user["language"], "consent": user["consent"], "counsellor": counsellor,
            "expires_at": iso(db.now() + auth.SESSION_TTL)}


def set_credentials(user, username, password, current_password=None):
    """Adds a username + password to an account that only had an access token,
    or replaces them. Replacing needs the current password and signs every
    other device out, like auth.change_password(). Raises auth.AuthError."""
    with db.connect() as conn:
        existing = conn.execute("SELECT password_hash FROM credentials WHERE user_id = ?",
                                (user["id"],)).fetchone()
        if existing is not None and not (current_password
                                         and auth.verify_password(current_password, existing["password_hash"])):
            raise auth.AuthError("Current password is incorrect")
        username = auth.set_credentials(conn, user["id"], username, password)
        revoked = auth.revoke_all_sessions(conn, user["id"], user.get("session_id")) if existing else 0
    return {"username": username, "has_password": True, "other_sessions_signed_out": revoked}


def list_sessions(user, now=None):
    """The account holder's own "where am I signed in" list."""
    now = now or db.now()
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? "
                            "ORDER BY last_seen_at DESC", (user["id"], now)).fetchall()
    return [{"id": r["id"], "device": r["device"], "started_at": iso(r["created_at"]),
             "last_seen_at": iso(r["last_seen_at"]), "expires_at": iso(r["expires_at"]),
             "current": r["id"] == user.get("session_id")} for r in rows]


def revoke_session(user, session_id):
    with db.connect() as conn:
        if not auth.revoke_session(conn, user["id"], session_id):
            raise NotFound("No such active session on this account")
    return {"revoked": True, "session_id": session_id}


def sign_out(user, all_devices=False):
    """Ends this session, or every session on the account."""
    with db.connect() as conn:
        if all_devices:
            return {"signed_out": auth.revoke_all_sessions(conn, user["id"])}
        if user.get("session_id") is None:
            # An access token is not a session; rotate_token() retires that one.
            return {"signed_out": 0}
        auth.revoke_session(conn, user["id"], user["session_id"])
    return {"signed_out": 1}


def rotate_token(user):
    """Replaces the access token, e.g. when the old one may have been seen.
    The new one is shown once, like the original."""
    token = auth.new_token()
    with db.connect() as conn:
        conn.execute("UPDATE users SET token_hash = ? WHERE id = ?", (auth.hash_token(token), user["id"]))
    return {"token": token}


# ---------------------------------------------------------------- recordings

def list_recordings(user_id):
    return storage.list_recordings(user_id)


def delete_recording(user, attachment_id):
    if not storage.delete_recording(user["id"], attachment_id):
        raise NotFound("No such recording")
    return {"deleted": True}


def victim_recordings(counsellor, victim_id):
    with db.connect() as conn:
        _assigned_victim(conn, counsellor, victim_id)
    return storage.list_recordings(victim_id)


def victim_recording_bytes(counsellor, victim_id, attachment_id):
    with db.connect() as conn:
        _assigned_victim(conn, counsellor, victim_id)
    found = storage.load_recording(victim_id, attachment_id)
    if found is None:
        raise NotFound("No such recording")
    return found


# ---------------------------------------------------------------- recording

def _insert_observation(conn, user_id, now, source, metric, value, detail_enc=None):
    conn.execute("INSERT INTO observations (user_id, created_at, source, metric, value, detail_enc) "
                 "VALUES (?, ?, ?, ?, ?, ?)", (user_id, now, source, metric, float(value), detail_enc))


def _insert_questionnaire(conn, user_id, instrument, answers, channel, now):
    result = questionnaires.score(instrument, answers)
    conn.execute(
        "INSERT INTO questionnaires (user_id, created_at, instrument, total, severity, flags, answers_enc, channel) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, now, instrument, result["total"], result["severity"], ",".join(result["flags"]),
         crypto.enc_json(answers), channel))
    return result


def submit_questionnaire(user, instrument, answers, channel="app", now=None):
    """Victim-facing result: no totals or clinical labels - those go to the counsellor."""
    now = now or db.now()
    with db.connect() as conn:
        result = _insert_questionnaire(conn, user["id"], instrument, answers, channel, now)
    recompute(user["id"], now)
    crisis = "self_harm_thoughts" in result["flags"]
    return {"saved": True, "instrument": instrument, "crisis": crisis,
            "crisis_message": crisis_message() if crisis else None,
            "wellbeing": wellbeing(user["id"], now, user["language"])}


def record_chat(user, text, distress=None, crisis=False, now=None):
    """distress: distress_engine.score() result, or None when that model isn't trained."""
    now = now or db.now()
    detail = crypto.enc(text) if user["consent"].get("store_messages") else None
    with db.connect() as conn:
        if distress is not None:
            _insert_observation(conn, user["id"], now, "chat", "text_distress", distress["score"], detail)
        else:
            _insert_observation(conn, user["id"], now, "chat", "activity", 1, detail)
        if crisis:
            _insert_observation(conn, user["id"], now, "chat", "crisis", 1)
    return recompute(user["id"], now)


# ---------------------------------------------------------------- conversation

# How many turns are carried into a new chat or call. The chat model keeps the
# last 16 either way; a few more here lets the UI show what came before.
CONVERSATION_TURNS = 24


def remember_message(user, role, text, channel="chat", now=None):
    """Stores one turn (either side) so the conversation survives a reload, a
    new call, or a move between the chat and the voice call.

    Nothing is written without the store_messages consent, which is also what
    the chat screen promises. Returns True when it was stored."""
    text = (text or "").strip()
    if not text or user is None or user["role"] != "victim":
        return False
    if not user["consent"].get("store_messages"):
        return False
    with db.connect() as conn:
        conn.execute("INSERT INTO messages (user_id, created_at, channel, role, text_enc) "
                     "VALUES (?, ?, ?, ?, ?)",
                     (user["id"], now or db.now(), channel, role, crypto.enc(text)))
    return True


def conversation(user_id, limit=CONVERSATION_TURNS):
    """The last turns, oldest first: [{role, content, at, channel}].

    Ready to hand straight to the chat model as history."""
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT created_at, channel, role, text_enc FROM messages "
            "WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
            (user_id, int(limit))).fetchall()
    turns = []
    for row in reversed(rows):
        try:
            content = crypto.dec(row["text_enc"])
        except Exception:
            continue            # a row written under a key we no longer have
        turns.append({"role": row["role"], "content": content,
                      "at": db.iso(row["created_at"]), "channel": row["channel"]})
    return turns


def forget_conversation(user_id):
    """Erases the stored conversation. Used by "delete my conversation" and
    whenever the store_messages consent is switched off."""
    with db.connect() as conn:
        cur = conn.execute("DELETE FROM messages WHERE user_id = ?", (user_id,))
    return cur.rowcount


def voice_distress(summary):
    """0-100 for one voice check-in: share of negative emotions, blended with low valence."""
    probs = summary.get("probabilities") or {}
    negative = sum(float(probs.get(e, 0)) for e in NEGATIVE_EMOTIONS) / 100
    valence = summary.get("valence")
    value = 0.6 * negative + 0.4 * (1 - valence) if valence is not None else negative
    return round(100 * min(max(value, 0.0), 1.0), 1)


def record_voice_session(user, summary, distress=None, crisis=False, now=None):
    """summary: {probabilities (0-100 per emotion), valence, arousal, voiced_seconds, emotion, transcript}.
    Skipped when the victim turned voice analysis off."""
    if not user["consent"].get("voice_analysis", True):
        return None
    now = now or db.now()
    detail = crypto.enc_json({
        "emotion": summary.get("emotion"),
        "voiced_seconds": summary.get("voiced_seconds"),
        "transcript": summary.get("transcript") if user["consent"].get("store_messages") else None,
    })
    with db.connect() as conn:
        _insert_observation(conn, user["id"], now, "voice", "voice_distress", voice_distress(summary), detail)
        if summary.get("arousal") is not None:
            _insert_observation(conn, user["id"], now, "voice", "voice_arousal", summary["arousal"])
        if summary.get("valence") is not None:
            _insert_observation(conn, user["id"], now, "voice", "voice_valence", summary["valence"])
        if distress is not None:
            _insert_observation(conn, user["id"], now, "voice", "text_distress", distress["score"])
        if crisis:
            _insert_observation(conn, user["id"], now, "voice", "crisis", 1)
    return recompute(user["id"], now)


# ---------------------------------------------------------------- scoring

def recompute(user_id, now=None):
    """Scores the victim now, stores the point (merged with one from the last
    10 minutes, so a burst of chat messages is one point), and raises alerts."""
    now = now or db.now()
    with db.connect() as conn:
        result = scoring.compute(conn, user_id, now)
        if result is None:
            return None
        last = conn.execute("SELECT id, created_at FROM scores WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
                            (user_id,)).fetchone()
        values = (result["score"], result["tier"], int(result["crisis"]), result["confidence"],
                  scoring.dumps_components(result), now)
        if last and 0 <= now - last["created_at"] < 600:
            conn.execute("UPDATE scores SET score = ?, tier = ?, crisis = ?, confidence = ?, components = ?, "
                         "created_at = ? WHERE id = ?", (*values, last["id"]))
        else:
            conn.execute("INSERT INTO scores (score, tier, crisis, confidence, components, created_at, user_id) "
                         "VALUES (?, ?, ?, ?, ?, ?, ?)", (*values, user_id))
        trend = scoring.trend(conn, user_id, now)
        upcoming = _upcoming_events(conn, user_id, now, 7)
        new_alerts = scoring.evaluate_alerts(conn, user_id, result, trend, upcoming, now)
    return {**result, "trend": trend, "upcoming_events": upcoming, "new_alerts": new_alerts}


def recompute_all(now=None):
    """Periodic pass: engagement changes even when a victim sends nothing."""
    with db.connect() as conn:
        ids = [r["id"] for r in conn.execute("SELECT id FROM users WHERE role = 'victim'")]
    for user_id in ids:
        recompute(user_id, now)
    return len(ids)


# ---------------------------------------------------------------- victim views

def wellbeing(user_id, now=None, lang="en"):
    """Gentle, number-free summary for the victim's own screens, shaped like
    the frontend's Stress / Energy / Fatigue rows."""
    now = now or db.now()
    with db.connect() as conn:
        last = conn.execute("SELECT tier FROM scores WHERE user_id = ? AND created_at <= ? "
                            "ORDER BY created_at DESC LIMIT 1", (user_id, now)).fetchone()
        trend = scoring.trend(conn, user_id, now)
        arousal = conn.execute("SELECT value FROM observations WHERE user_id = ? AND metric = 'voice_arousal' "
                               "AND created_at BETWEEN ? AND ? ORDER BY created_at DESC LIMIT 1",
                               (user_id, now - 7 * DAY, now)).fetchone()
        phq9 = conn.execute("SELECT answers_enc FROM questionnaires WHERE user_id = ? AND instrument = 'phq9' "
                            "AND created_at BETWEEN ? AND ? ORDER BY created_at DESC LIMIT 1",
                            (user_id, now - 21 * DAY, now)).fetchone()
    tier = last["tier"] if last else None
    if tier in ("elevated", "high") or trend["direction"] == "rising":
        stress = "Elevated"
    elif trend["direction"] == "falling":
        stress = "Improving"
    else:
        stress = "Stable"
    energy = "Stable"
    if arousal:
        energy = "Rest needed" if arousal["value"] < 0.3 else "Elevated" if arousal["value"] > 0.65 else "Stable"
    fatigue = "Stable"
    if phq9:
        answers = crypto.dec_json(phq9["answers_enc"])
        fatigue = "Rest needed" if answers[2] + answers[3] >= 4 else "Stable"     # sleep + tiredness items
    messages = WELLBEING_MESSAGES.get(lang, WELLBEING_MESSAGES["en"])
    return {"stress": stress, "energy": energy, "fatigue": fatigue, "message": messages[tier],
            "has_data": tier is not None}


def due_checkins(user_id, now=None):
    """Full questionnaires come due every 14 days; the PHQ-4 pulse fills the
    gaps and is only offered when no full questionnaire is due."""
    now = now or db.now()
    with db.connect() as conn:
        last = {r["instrument"]: r["t"] for r in conn.execute(
            "SELECT instrument, MAX(created_at) AS t FROM questionnaires WHERE user_id = ? GROUP BY instrument",
            (user_id,))}
    out = []
    for inst, spec in questionnaires.INSTRUMENTS.items():
        done = last.get(inst)
        next_due = done + spec["interval_days"] * DAY if done else None
        out.append({"instrument": inst, "name": spec["name"], "due": done is None or now >= next_due,
                    "last_completed_at": iso(done), "next_due_at": iso(next_due),
                    "interval_days": spec["interval_days"]})
    if any(c["due"] for c in out if c["instrument"] != "phq4"):
        next(c for c in out if c["instrument"] == "phq4")["due"] = False
    return out


def _event_view(row, today):
    event_date = datetime.strptime(row["event_date"], "%Y-%m-%d").date()
    return {"id": row["id"], "date": row["event_date"], "kind": row["kind"], "title": crypto.dec(row["title_enc"]),
            "days_until": (event_date - today).days,
            "notice_given": None if row["notice_given"] is None else bool(row["notice_given"])}


def _upcoming_events(conn, user_id, now, days):
    today = _today(now)
    rows = conn.execute("SELECT * FROM case_events WHERE user_id = ? AND event_date BETWEEN ? AND ? "
                        "ORDER BY event_date", (user_id, today.isoformat(),
                                                (today + timedelta(days=days)).isoformat())).fetchall()
    return [_event_view(r, today) for r in rows]


def list_events(user_id, now=None):
    today = _today(now or db.now())
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM case_events WHERE user_id = ? ORDER BY event_date", (user_id,)).fetchall()
    return [_event_view(r, today) for r in rows]



# ---------------------------------------------------------------- case calendar (victim side)

# What a victim sees instead of the docket word. A bail hearing is still shown -
# being ambushed by it is worse - but it is not called one. Hindi is a draft and
# needs a native reviewer, like the questionnaire stems; Punjabi falls back to
# English until it has been reviewed too (see CLAUDE.md, known gaps).
VICTIM_EVENT_LABELS = {
    "hearing":      {"en": "Court date", "hi": "अदालत की तारीख"},
    "bail_hearing": {"en": "A court date about your case", "hi": "आपके मामले से जुड़ी अदालत की तारीख"},
    "parole":       {"en": "A court date about your case", "hi": "आपके मामले से जुड़ी अदालत की तारीख"},
    "trial_end":    {"en": "A court date about your case", "hi": "आपके मामले से जुड़ी अदालत की तारीख"},
    "adjournment":  {"en": "Your case moved to a new date", "hi": "आपके मामले की तारीख बदल गई"},
    "fir":          {"en": "A step in your case", "hi": "आपके मामले में एक कदम"},
    "chargesheet":  {"en": "A step in your case", "hi": "आपके मामले में एक कदम"},
    "compensation": {"en": "Support payment", "hi": "सहायता राशि"},
    "counselling":  {"en": "Time with your counsellor", "hi": "आपके काउंसलर के साथ समय"},
    "other":        {"en": "A date in your case", "hi": "आपके मामले की एक तारीख"},
}

# The question the victim actually answers. No amounts: a number someone is owed
# but has not been given is its own kind of distress, so only counsellors see it.
ENTITLEMENT_LABELS = {
    "fir":         {"en": "Support money due when your complaint was registered",
                    "hi": "शिकायत दर्ज होने पर मिलने वाली सहायता राशि"},
    "chargesheet": {"en": "Support money due at the charge sheet stage",
                    "hi": "चार्जशीट के समय मिलने वाली सहायता राशि"},
    "trial_end":   {"en": "Support money due at the end of the case",
                    "hi": "मामला समाप्त होने पर मिलने वाली सहायता राशि"},
    "tame":        {"en": "Travel and daily expenses for going to the court or police station",
                    "hi": "अदालत या थाने जाने का यात्रा और दैनिक खर्च"},
    "other":       {"en": "Support you are entitled to", "hi": "आपको मिलने वाली सहायता"},
}


# The raw kind leaks the docket word ("bail_hearing"), so the victim side gets a
# coarse one that is only good enough to pick an icon.
VICTIM_EVENT_KIND = {
    "hearing": "court_date", "bail_hearing": "court_date", "parole": "court_date",
    "trial_end": "court_date", "adjournment": "date_changed",
    "fir": "case_step", "chargesheet": "case_step",
    "compensation": "support", "counselling": "counselling", "other": "case_step",
}


# The real Annexure-I schedule (G.S.R. 424(E), 14 April 2016). Loaded once.
# Amounts and the stage split both come from the Gazette: the split is NOT a flat
# 25/50/25 - dumping excreta is 10/50/40, rape pays 50% after the medical report,
# murder 50% after the post-mortem, and a social boycott is paid in full at charge
# sheet. Getting that wrong would tell someone they are owed money they are not.
_RELIEF = None


def relief_schedule():
    global _RELIEF
    if _RELIEF is None:
        with open(Path(__file__).resolve().parent / "relief_schedule.json", encoding="utf-8") as f:
            _RELIEF = json.load(f)
    return _RELIEF


def relief_for(section):
    """The Annexure-I row for a section, or None. Match is exact then prefix, so
    '3(1)(r)' finds its row and 'IPC 375' finds rape."""
    key = (section or "").strip().lower()
    entries = relief_schedule()["entries"]
    for e in entries:
        if e["section"].lower() == key:
            return e
    for e in entries:
        if key and key in e["section"].lower():
            return e
    return None


def _label(table, key, lang):
    entry = table.get(key, table["other"])
    return entry.get(lang) or entry["en"]


def _entitlement_view(row, lang=None, for_counsellor=False):
    out = {"id": row["id"], "stage": row["stage"], "due_on": row["due_on"], "status": row["status"],
           "answered_at": iso(row["answered_at"])}
    if for_counsellor:
        out["amount"] = row["amount"]
        out["note"] = crypto.dec(row["note_enc"])
        out["label"] = _label(ENTITLEMENT_LABELS, row["stage"], "en")
    else:
        out["label"] = _label(ENTITLEMENT_LABELS, row["stage"], lang or "en")
    return out


def my_case(user, now=None, days=60):
    """What is coming up and what is owed - the victim's view. No scores, no
    tiers, no amounts, nothing clinical."""
    now = now or db.now()
    today = _today(now)
    lang = user["language"] or "en"
    with db.connect() as conn:
        events = conn.execute(
            "SELECT * FROM case_events WHERE user_id = ? AND event_date BETWEEN ? AND ? ORDER BY event_date",
            (user["id"], today.isoformat(), (today + timedelta(days=days)).isoformat())).fetchall()
        ents = conn.execute(
            "SELECT * FROM entitlements WHERE user_id = ? AND status IN ('due', 'unknown', 'not_received') "
            "ORDER BY COALESCE(due_on, '9999-12-31')", (user["id"],)).fetchall()
    return {
        "upcoming": [{"id": e["id"], "kind": VICTIM_EVENT_KIND.get(e["kind"], "case_step"),
                      "date": e["event_date"],
                      "days_until": (datetime.strptime(e["event_date"], "%Y-%m-%d").date() - today).days,
                      "label": _label(VICTIM_EVENT_LABELS, e["kind"], lang)} for e in events],
        "entitlements": [_entitlement_view(r, lang) for r in ents],
    }


def answer_entitlement(user, entitlement_id, status, now=None):
    if status not in ENTITLEMENT_STATUS:
        raise ValueError(f"status must be one of {', '.join(ENTITLEMENT_STATUS)}")
    now = now or db.now()
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM entitlements WHERE id = ? AND user_id = ?",
                           (entitlement_id, user["id"])).fetchone()
        if row is None:
            raise NotFound("No such entitlement")
        conn.execute("UPDATE entitlements SET status = ?, answered_at = ? WHERE id = ?",
                     (status, now, entitlement_id))
    recompute(user["id"])           # "never arrived" changes the score
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM entitlements WHERE id = ?", (entitlement_id,)).fetchone()
    return _entitlement_view(row, user["language"] or "en")


# ---------------------------------------------------------------- entitlements (counsellor side)

def list_entitlements(counsellor, victim_id):
    with db.connect() as conn:
        _assigned_victim(conn, counsellor, victim_id)
        rows = conn.execute("SELECT * FROM entitlements WHERE user_id = ? "
                            "ORDER BY COALESCE(due_on, '9999-12-31')", (victim_id,)).fetchall()
    return [_entitlement_view(r, for_counsellor=True) for r in rows]


def add_relief_from_schedule(counsellor, victim_id, section, now=None):
    """Create the whole staged set for one offence, straight from Annexure-I.

    Beats typing amounts by hand: the counsellor gives the section, the schedule
    gives the total, the stages and the percentages."""
    entry = relief_for(section)
    if entry is None:
        raise ValueError(f"No Annexure-I relief row matches section {section!r}")
    now = now or db.now()
    created = []
    with db.connect() as conn:
        _assigned_victim(conn, counsellor, victim_id)
        for part in entry["stages"]:
            amount = round(entry["amount"] * part["percent"] / 100.0, 2)
            note = (f"{entry['offence']} [{entry['section']}] - {part['percent']}% "
                    f"{relief_schedule()['stage_labels'][part['stage']]}")
            cur = conn.execute(
                "INSERT INTO entitlements (user_id, stage, amount, due_on, note_enc, asked_at, "
                "created_by, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)",
                (victim_id, part["stage"], amount, crypto.enc(note), now, counsellor["id"], now))
            created.append(cur.lastrowid)
    recompute(victim_id)
    with db.connect() as conn:
        rows = conn.execute(f"SELECT * FROM entitlements WHERE id IN ({','.join('?' * len(created))})",
                            created).fetchall()
    return {"section": entry["section"], "offence": entry["offence"], "total": entry["amount"],
            "entitlements": [_entitlement_view(r, for_counsellor=True) for r in rows]}


def add_entitlement(counsellor, victim_id, stage, amount=None, due_on=None, note=None, now=None):
    if stage not in ENTITLEMENT_STAGES:
        raise ValueError(f"stage must be one of {', '.join(ENTITLEMENT_STAGES)}")
    now = now or db.now()
    with db.connect() as conn:
        _assigned_victim(conn, counsellor, victim_id)
        cur = conn.execute(
            "INSERT INTO entitlements (user_id, stage, amount, due_on, note_enc, asked_at, created_by, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (victim_id, stage, amount, due_on, crypto.enc(note) if note else None, now, counsellor["id"], now))
        ent_id = cur.lastrowid
    recompute(victim_id)
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM entitlements WHERE id = ?", (ent_id,)).fetchone()
    return _entitlement_view(row, for_counsellor=True)


def update_entitlement(counsellor, entitlement_id, status=None, amount=None, due_on=None, note=None):
    if status is not None and status not in ENTITLEMENT_STATUS:
        raise ValueError(f"status must be one of {', '.join(ENTITLEMENT_STATUS)}")
    with db.connect() as conn:
        row = conn.execute("SELECT e.*, v.id AS vid FROM entitlements e JOIN users v ON v.id = e.user_id "
                           "WHERE e.id = ? AND v.counsellor_id = ?",
                           (entitlement_id, counsellor["id"])).fetchone()
        if row is None:
            raise NotFound("No such entitlement for your victims")
        sets, args = [], []
        for column, value in (("status", status), ("amount", amount), ("due_on", due_on)):
            if value is not None:
                sets.append(f"{column} = ?")
                args.append(value)
        if note is not None:
            sets.append("note_enc = ?")
            args.append(crypto.enc(note))
        if sets:
            conn.execute(f"UPDATE entitlements SET {', '.join(sets)} WHERE id = ?", (*args, entitlement_id))
        victim_id = row["vid"]
    recompute(victim_id)
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM entitlements WHERE id = ?", (entitlement_id,)).fetchone()
    return _entitlement_view(row, for_counsellor=True)


def caseload_forecast(counsellor, now=None):
    """Who is predicted to climb this fortnight, worst first. Triage by what is
    coming, not by today's number."""
    now = now or db.now()
    out = []
    with db.connect() as conn:
        victims = conn.execute("SELECT id FROM users WHERE role = 'victim' AND counsellor_id = ?",
                               (counsellor["id"],)).fetchall()
        for v in victims:
            latest = _latest_score(conn, v["id"])
            if latest is None:
                continue
            f = scoring.forecast(conn, v["id"], latest["score"], now)
            if f is None:
                continue
            out.append({"victim_id": v["id"], "name": _name_of(conn, v["id"]),
                        "score": latest["score"], "tier": latest["tier"], **f})
    out.sort(key=lambda r: (-r["peak_score"], r["days_until"]))
    return out


# ---------------------------------------------------------------- counsellor views

def _assigned_victim(conn, counsellor, victim_id):
    row = conn.execute("SELECT * FROM users WHERE id = ? AND role = 'victim' AND counsellor_id = ?",
                       (victim_id, counsellor["id"])).fetchone()
    if row is None:
        raise NotFound("No such victim assigned to you")
    return row


def _latest_score(conn, user_id):
    row = conn.execute("SELECT * FROM scores WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
                       (user_id,)).fetchone()
    if row is None:
        return None
    return {"score": row["score"], "tier": row["tier"], "crisis": bool(row["crisis"]),
            "confidence": row["confidence"], "updated_at": iso(row["created_at"]), **json.loads(row["components"])}


def _last_contact(conn, user_id):
    return conn.execute(
        "SELECT MAX(t) FROM (SELECT MAX(created_at) AS t FROM observations WHERE user_id = ? "
        "UNION ALL SELECT MAX(created_at) FROM questionnaires WHERE user_id = ?)", (user_id, user_id)).fetchone()[0]


def list_victims(counsellor, now=None):
    """Caseload, most urgent first: crisis, then highest score."""
    now = now or db.now()
    out = []
    with db.connect() as conn:
        for v in conn.execute("SELECT * FROM users WHERE role = 'victim' AND counsellor_id = ?",
                              (counsellor["id"],)).fetchall():
            latest = _latest_score(conn, v["id"])
            upcoming = _upcoming_events(conn, v["id"], now, 30)
            out.append({
                "user_id": v["id"],
                "name": crypto.dec(v["name_enc"]),
                "case_ref": crypto.dec(v["case_ref_enc"]),
                "language": v["language"],
                "score": latest["score"] if latest else None,
                "tier": latest["tier"] if latest else None,
                "crisis": latest["crisis"] if latest else False,
                "confidence": latest["confidence"] if latest else None,
                "trend": scoring.trend(conn, v["id"], now),
                "open_alerts": conn.execute("SELECT COUNT(*) FROM alerts WHERE user_id = ? AND status = 'open'",
                                            (v["id"],)).fetchone()[0],
                "last_contact_at": iso(_last_contact(conn, v["id"])),
                "next_event": upcoming[0] if upcoming else None,
            })
    out.sort(key=lambda x: (not x["crisis"], -(x["score"] if x["score"] is not None else -1)))
    return out


def victim_detail(counsellor, victim_id, now=None):
    now = now or db.now()
    with db.connect() as conn:
        v = _assigned_victim(conn, counsellor, victim_id)
        qs = conn.execute("SELECT * FROM questionnaires WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
                          (victim_id,)).fetchall()
        alert_rows = conn.execute("SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
                                  (victim_id,)).fetchall()
        detail = {
            "user_id": v["id"],
            "name": crypto.dec(v["name_enc"]),
            "case_ref": crypto.dec(v["case_ref_enc"]),
            "phone": crypto.dec(v["phone_enc"]),
            "language": v["language"],
            "consent": json.loads(v["consent"]),
            "created_at": iso(v["created_at"]),
            "last_contact_at": iso(_last_contact(conn, victim_id)),
            "latest": _latest_score(conn, victim_id),
            "trend": scoring.trend(conn, victim_id, now),
            "questionnaires": [{
                "id": q["id"], "instrument": q["instrument"], "name": questionnaires.INSTRUMENTS[q["instrument"]]["name"],
                "total": q["total"], "max_score": questionnaires.max_score(q["instrument"]),
                "severity": q["severity"], "flags": [f for f in q["flags"].split(",") if f],
                "answers": crypto.dec_json(q["answers_enc"]), "channel": q["channel"], "at": iso(q["created_at"]),
            } for q in qs],
            "alerts": [_alert_view(conn, a) for a in alert_rows],
        }
        latest = detail["latest"]
        detail["forecast"] = scoring.forecast(conn, victim_id, latest["score"], now) if latest else None
        detail["entitlements"] = [_entitlement_view(r, for_counsellor=True) for r in conn.execute(
            "SELECT * FROM entitlements WHERE user_id = ? ORDER BY COALESCE(due_on, '9999-12-31')",
            (victim_id,)).fetchall()]
    detail["events"] = list_events(victim_id, now)
    return detail


def timeline(counsellor, victim_id, days=30, now=None):
    """Chart data: score history, questionnaire totals, daily signal averages."""
    now = now or db.now()
    since = now - days * DAY
    with db.connect() as conn:
        _assigned_victim(conn, counsellor, victim_id)
        scores = conn.execute("SELECT created_at, score, tier, crisis FROM scores WHERE user_id = ? "
                              "AND created_at BETWEEN ? AND ? ORDER BY created_at", (victim_id, since, now)).fetchall()
        qs = conn.execute("SELECT created_at, instrument, total, severity FROM questionnaires WHERE user_id = ? "
                          "AND created_at BETWEEN ? AND ? ORDER BY created_at", (victim_id, since, now)).fetchall()
        obs = conn.execute(f"SELECT created_at, metric, value FROM observations WHERE user_id = ? "
                           f"AND metric IN ({','.join('?' * len(SIGNAL_METRICS))}) AND created_at BETWEEN ? AND ?",
                           (victim_id, *SIGNAL_METRICS, since, now)).fetchall()
    daily = {}
    for o in obs:
        day = datetime.fromtimestamp(o["created_at"]).date().isoformat()
        daily.setdefault(o["metric"], {}).setdefault(day, []).append(o["value"])
    return {
        "scores": [{"at": iso(s["created_at"]), "score": s["score"], "tier": s["tier"], "crisis": bool(s["crisis"])}
                   for s in scores],
        "questionnaires": [{"at": iso(q["created_at"]), "instrument": q["instrument"], "total": q["total"],
                            "severity": q["severity"]} for q in qs],
        "signals": {metric: [{"date": d, "mean": round(sum(v) / len(v), 3), "count": len(v)}
                             for d, v in sorted(by_day.items())] for metric, by_day in daily.items()},
    }


def add_event(counsellor, victim_id, kind, event_date, title, notice_given=None):
    with db.connect() as conn:
        _assigned_victim(conn, counsellor, victim_id)
        cur = conn.execute("INSERT INTO case_events "
                           "(user_id, event_date, kind, title_enc, notice_given, created_by, created_at) "
                           "VALUES (?, ?, ?, ?, ?, ?, ?)",
                           (victim_id, event_date, kind, crypto.enc(title),
                            None if notice_given is None else int(notice_given),
                            counsellor["id"], db.now()))
        event_id = cur.lastrowid
    recompute(victim_id)            # an imminent hearing can raise an alert
    return next(e for e in list_events(victim_id) if e["id"] == event_id)


def delete_event(counsellor, event_id):
    with db.connect() as conn:
        row = conn.execute("SELECT e.id FROM case_events e JOIN users v ON v.id = e.user_id "
                           "WHERE e.id = ? AND v.counsellor_id = ?", (event_id, counsellor["id"])).fetchone()
        if row is None:
            raise NotFound("No such event for your victims")
        conn.execute("DELETE FROM case_events WHERE id = ?", (event_id,))


def _alert_view(conn, a):
    return {"id": a["id"], "user_id": a["user_id"], "victim_name": _name_of(conn, a["user_id"]),
            "at": iso(a["created_at"]), "level": a["level"], "reason": a["reason"], "message": a["message"],
            "status": a["status"], "handled_by": _name_of(conn, a["handled_by"]), "handled_at": iso(a["handled_at"]),
            "note": crypto.dec(a["note_enc"])}


def list_alerts(counsellor, status="open"):
    """Most urgent first: crisis, high, watch; newest first within a level."""
    query = ("SELECT a.* FROM alerts a JOIN users v ON v.id = a.user_id WHERE v.counsellor_id = ?"
             + ("" if status == "all" else " AND a.status = ?"))
    params = (counsellor["id"],) if status == "all" else (counsellor["id"], status)
    with db.connect() as conn:
        rows = conn.execute(query, params).fetchall()
        alerts = [_alert_view(conn, a) for a in rows]
    alerts.sort(key=lambda a: (LEVEL_RANK.get(a["level"], 9), -datetime.fromisoformat(a["at"]).timestamp()))
    return alerts


def update_alert(counsellor, alert_id, status, note=None):
    with db.connect() as conn:
        row = conn.execute("SELECT a.id FROM alerts a JOIN users v ON v.id = a.user_id "
                           "WHERE a.id = ? AND v.counsellor_id = ?", (alert_id, counsellor["id"])).fetchone()
        if row is None:
            raise NotFound("No such alert for your victims")
        conn.execute("UPDATE alerts SET status = ?, handled_by = ?, handled_at = ?, "
                     "note_enc = COALESCE(?, note_enc) WHERE id = ?",
                     (status, counsellor["id"], db.now(), crypto.enc(note), alert_id))
        return _alert_view(conn, conn.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone())
