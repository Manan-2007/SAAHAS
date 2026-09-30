"""Missed check-in outreach: an automated phone call (IVRS) to someone who
missed a check-in, with a reschedule option that cannot become a way to avoid
it forever.

Policy (all constants below; change them here, not in the call flow)
  - A check-in counts as missed MISSED_AFTER_H after it fell due. A brand-new
    account's first check-in falls due NEW_ACCOUNT_GRACE_DAYS after sign-up.
  - Only people who opted in (consent.ivrs_calls) and gave a phone number are
    called. Everyone else is left to the counsellor's gone_quiet alert.
  - Calls are placed only inside CALL_WINDOW (local time).
  - On the call: 1 = a four-question check-in by keypad (PHQ-4), 2 = another
    time, 3 = ask for a call back from their counsellor. Emergency: 112.
  - Rescheduling is allowed MAX_RESCHEDULES times, and never past the deadline
    (MAX_DEFER_H after the check-in was missed). After that the call offers
    only "check in now" or "call me back".
  - No answer: retried after RETRY_AFTER_MIN, up to MAX_ATTEMPTS.
  - Out of attempts or past the deadline: the call is escalated - a high alert
    for the counsellor to reach the person themselves.

Shared-phone safety: the call never says the person's name, the case, or the
words counsellor or court - someone else may pick up. It says it is SAHAAS
calling for a regular check-in, nothing more.

Telephony is behind a provider (see PROVIDERS). "console" places no real call
and only logs, which is the default until a carrier is configured.
"""

import base64
import hashlib
import hmac
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

from . import crypto, db, events, questionnaires

MISSED_AFTER_H = 24
NEW_ACCOUNT_GRACE_DAYS = 3
MAX_RESCHEDULES = 2
MAX_DEFER_H = 72
RETRY_AFTER_MIN = 60
MAX_ATTEMPTS = 3
CALL_WINDOW = (9, 20)                # 09:00-20:00 local time
RESCHEDULE_OPTIONS = {"1": 2 * 3600, "2": 24 * 3600}    # keypad digit -> delay
PULSE = "phq4"

SCRIPTS = {
    "en": {
        "greet": "Hello. This is SAHAAS, calling for your regular check-in. We just want to know how you are.",
        "greet_callback": "Hello. This is SAHAAS, calling you back. We just want to know how you are.",
        "greet_evening": "Hello. This is SAHAAS. We are calling to see how you are this evening.",
        "menu": "Press 1 to answer four short questions now. Press 2 to choose another time. "
                "Press 3 if you would like someone to call you back. If you are in danger, hang up and dial 112.",
        "menu_no_reschedule": "Press 1 to answer four short questions now, or press 3 if you would like "
                              "someone to call you back. If you are in danger, hang up and dial 112.",
        "options": "Press 0 for not at all, 1 for several days, 2 for more than half the days, "
                   "or 3 for nearly every day.",
        "question": "Over the last two weeks, how often have you been bothered by this:",
        "reschedule": "Press 1 to be called again in two hours. Press 2 to be called tomorrow at this time.",
        "rescheduled": "Thank you. We will call you again then. Take care.",
        "no_more": "We can't move this call again, because we want to make sure you are okay.",
        "done": "Thank you for checking in. You are not alone in this. Take care.",
        "callback": "Thank you. Someone will call you back soon. Take care.",
        "invalid": "Sorry, I didn't get that.",
        "bye": "We will try again later. Take care.",
    },
    "hi": {
        "greet": "नमस्ते। यह साहस है, आपके नियमित चेक-इन के लिए कॉल कर रहे हैं। हम बस जानना चाहते हैं कि आप कैसे हैं।",
        "greet_callback": "नमस्ते। यह साहस है, आपको वापस कॉल कर रहे हैं। हम बस जानना चाहते हैं कि आप कैसे हैं।",
        "greet_evening": "नमस्ते। यह साहस है। हम जानना चाहते हैं कि आज शाम आप कैसे हैं।",
        "menu": "अभी चार छोटे सवालों के जवाब देने के लिए 1 दबाएँ। कोई और समय चुनने के लिए 2 दबाएँ। "
                "अगर आप चाहें कि कोई आपको वापस कॉल करे तो 3 दबाएँ। अगर आप खतरे में हैं तो फ़ोन काटकर 112 डायल करें।",
        "menu_no_reschedule": "अभी चार छोटे सवालों के जवाब देने के लिए 1 दबाएँ, या वापस कॉल के लिए 3 दबाएँ। "
                              "अगर आप खतरे में हैं तो फ़ोन काटकर 112 डायल करें।",
        "options": "बिल्कुल नहीं के लिए 0, कई दिन के लिए 1, आधे से ज़्यादा दिन के लिए 2, और लगभग हर दिन के लिए 3 दबाएँ।",
        "question": "पिछले दो हफ़्तों में, आप कितनी बार इससे परेशान रहे हैं:",
        "reschedule": "दो घंटे बाद कॉल के लिए 1 दबाएँ। कल इसी समय कॉल के लिए 2 दबाएँ।",
        "rescheduled": "धन्यवाद। हम तब फिर कॉल करेंगे। अपना ध्यान रखें।",
        "no_more": "हम इस कॉल को और आगे नहीं बढ़ा सकते, क्योंकि हम जानना चाहते हैं कि आप ठीक हैं।",
        "done": "चेक-इन के लिए धन्यवाद। आप इसमें अकेले नहीं हैं। अपना ध्यान रखें।",
        "callback": "धन्यवाद। जल्द ही कोई आपको वापस कॉल करेगा। अपना ध्यान रखें।",
        "invalid": "माफ़ कीजिए, मैं समझ नहीं पाई।",
        "bye": "हम बाद में फिर कोशिश करेंगे। अपना ध्यान रखें।",
    },
}


def _script(lang):
    return SCRIPTS.get(lang) or SCRIPTS["en"]


# ---------------------------------------------------------------- providers

class ConsoleProvider:
    """No carrier configured: logs the call instead of dialling. Use the
    simulate endpoint (or the tests) to walk through a call."""
    name = "console"

    def place_call(self, call_id, phone):
        masked = f"***{phone[-3:]}" if phone else "?"
        print(f"[outreach] (console) would call {masked} for outreach call {call_id}")
        return f"console-{call_id}"


class TwilioProvider:
    """Twilio Programmable Voice. Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
    TWILIO_FROM (an Indian-capable number) and SAHAAS_PUBLIC_URL (https, where
    Twilio can reach /ivrs/twilio/voice)."""
    name = "twilio"

    def __init__(self):
        self.sid = os.environ["TWILIO_ACCOUNT_SID"]
        self.token = os.environ["TWILIO_AUTH_TOKEN"]
        self.sender = os.environ["TWILIO_FROM"]
        self.public = os.environ["SAHAAS_PUBLIC_URL"].rstrip("/")

    def place_call(self, call_id, phone):
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.sid}/Calls.json"
        voice = f"{self.public}/ivrs/twilio/voice?call_id={call_id}&key={webhook_key()}"
        body = urllib.parse.urlencode({
            "To": phone, "From": self.sender, "Url": voice, "Method": "POST",
            "StatusCallback": f"{self.public}/ivrs/twilio/status?call_id={call_id}&key={webhook_key()}",
            "StatusCallbackEvent": "completed", "Timeout": "30",
        }).encode()
        auth = base64.b64encode(f"{self.sid}:{self.token}".encode()).decode()
        req = urllib.request.Request(url, data=body, headers={"Authorization": f"Basic {auth}"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())["sid"]


PROVIDERS = {"console": ConsoleProvider, "twilio": TwilioProvider}


def provider():
    name = os.environ.get("SAHAAS_IVRS_PROVIDER", "console")
    try:
        return PROVIDERS[name]()
    except Exception as exc:
        print(f"[outreach] provider {name!r} unavailable ({exc}); using console")
        return ConsoleProvider()


def webhook_key():
    """Shared secret the carrier echoes back on every webhook. Derived from the
    data key unless SAHAAS_IVRS_SECRET is set, so it is stable across restarts."""
    secret = os.environ.get("SAHAAS_IVRS_SECRET")
    if secret:
        return secret
    return crypto.blind_index("ivrs-webhook", "ivrs")[:32]


def check_key(key):
    return bool(key) and hmac.compare_digest(str(key), webhook_key())


# ---------------------------------------------------------------- scheduling

def _in_window(ts):
    hour = datetime.fromtimestamp(ts).hour
    return CALL_WINDOW[0] <= hour < CALL_WINDOW[1]


def next_call_time(ts):
    """ts, or the next moment inside the call window."""
    if _in_window(ts):
        return ts
    dt = datetime.fromtimestamp(ts)
    start = dt.replace(hour=CALL_WINDOW[0], minute=0, second=0, microsecond=0)
    if dt.hour >= CALL_WINDOW[1]:
        start += timedelta(days=1)
    return start.timestamp()


def missed_since(conn, user, now):
    """When the person's overdue check-in fell due, if it is now missed."""
    last = {r["instrument"]: r["t"] for r in conn.execute(
        "SELECT instrument, MAX(created_at) AS t FROM questionnaires WHERE user_id = ? GROUP BY instrument",
        (user["id"],))}
    if last:
        newest = max(last.values())
        due = min((last.get(i) or newest) + spec["interval_days"] * 86400
                  for i, spec in questionnaires.INSTRUMENTS.items())
        # A pulse or full check-in done recently counts: the person did check in.
        due = max(due, newest + questionnaires.INSTRUMENTS[PULSE]["interval_days"] * 86400)
    else:
        due = user["created_at"] + NEW_ACCOUNT_GRACE_DAYS * 86400
    return due if now - due >= MISSED_AFTER_H * 3600 else None


def _active(conn, user_id):
    return conn.execute("SELECT * FROM outreach_calls WHERE user_id = ? AND status IN ('scheduled', 'calling') "
                        "ORDER BY created_at DESC LIMIT 1", (user_id,)).fetchone()


def _counsellor(conn, user_id):
    row = conn.execute("SELECT counsellor_id FROM users WHERE id = ?", (user_id,)).fetchone()
    return row["counsellor_id"] if row else None


GREETING = {"missed_checkin": "greet", "missed_call": "greet_callback", "after_court": "greet_evening"}
WHAT = {"missed_checkin": "Missed check-in", "missed_call": "Asked for a call back by missed call",
        "after_court": "Evening check after a court date"}

# Missed-call check-in: the person rings the SAHAAS number and hangs up (free
# for them), and SAHAAS calls back. Only numbers of people who agreed to calls
# (consent.ivrs_calls), at most MISSED_CALL_PER_DAY callbacks a day.
MISSED_CALL_PER_DAY = 3
MISSED_CALL_DEADLINE_H = 24

# Evening after a court date: a neutral check-in call (it never mentions court).
COURT_KINDS = ("hearing", "bail_hearing", "parole", "trial_end")
AFTER_COURT_HOUR = 18


def missed_call_number():
    """The number people ring for a callback, shown in the app. None until set."""
    return os.environ.get("SAHAAS_MISSED_CALL_NUMBER") or None


def _digits(phone):
    return "".join(ch for ch in str(phone or "") if ch.isdigit())[-10:]


def request_callback(caller, now=None):
    """A missed call from `caller`. Returns the call id queued, or None. The
    webhook answers the same either way, so it can't be used to test numbers."""
    now = now or time.time()
    want = _digits(caller)
    if len(want) < 10:
        return None
    with db.connect() as conn:
        match = None
        # Phones are encrypted at rest, so there is no index to look up; fine at
        # pilot scale, add a blind index before thousands of people.
        for u in conn.execute("SELECT * FROM users WHERE role = 'victim' AND phone_enc IS NOT NULL "
                              "AND decoy_of IS NULL").fetchall():
            if _digits(crypto.dec(u["phone_enc"])) == want:
                match = u
                break
        if match is None or not json.loads(match["consent"] or "{}").get("ivrs_calls"):
            return None
        recent = conn.execute("SELECT COUNT(*) FROM outreach_calls WHERE user_id = ? AND reason = 'missed_call' "
                              "AND created_at > ?", (match["id"], now - 86400)).fetchone()[0]
        if recent >= MISSED_CALL_PER_DAY:
            return None
        active = _active(conn, match["id"])
        if active is not None:
            # A call is already queued: bring it forward rather than add another.
            conn.execute("UPDATE outreach_calls SET scheduled_for = ?, updated_at = ? WHERE id = ?",
                         (next_call_time(now), now, active["id"]))
            call_id = active["id"]
        else:
            call_id = conn.execute(
                "INSERT INTO outreach_calls (user_id, reason, missed_since, scheduled_for, deadline, status, "
                "created_at, updated_at) VALUES (?, 'missed_call', ?, ?, ?, 'scheduled', ?, ?)",
                (match["id"], now, next_call_time(now), now + MISSED_CALL_DEADLINE_H * 3600, now, now)).lastrowid
        counsellor = _counsellor(conn, match["id"])
    events.publish(counsellor, "outreach", victim_id=match["id"], call_id=call_id, status="scheduled")
    return call_id


def schedule_after_court(now=None):
    """From AFTER_COURT_HOUR on a court day, one gentle call to each person with
    a court date today who agreed to calls and hasn't been checked on since."""
    now = now or time.time()
    local = datetime.fromtimestamp(now)
    if local.hour < AFTER_COURT_HOUR:
        return []
    today = local.date().isoformat()
    created = []
    with db.connect() as conn:
        rows = conn.execute(
            f"SELECT DISTINCT u.* FROM users u JOIN case_events e ON e.user_id = u.id "
            f"WHERE u.role = 'victim' AND u.phone_enc IS NOT NULL AND u.decoy_of IS NULL AND e.event_date = ? "
            f"AND e.kind IN ({','.join('?' * len(COURT_KINDS))})", (today, *COURT_KINDS)).fetchall()
        day_start = datetime.combine(local.date(), datetime.min.time()).timestamp()
        for u in rows:
            if not json.loads(u["consent"] or "{}").get("ivrs_calls") or _active(conn, u["id"]) is not None:
                continue
            if conn.execute("SELECT 1 FROM outreach_calls WHERE user_id = ? AND reason = 'after_court' "
                            "AND missed_since = ?", (u["id"], day_start)).fetchone():
                continue
            # They already checked in this evening: no need to ring.
            if conn.execute("SELECT 1 FROM questionnaires WHERE user_id = ? AND created_at >= ?",
                            (u["id"], day_start + AFTER_COURT_HOUR * 3600)).fetchone():
                continue
            cur = conn.execute(
                "INSERT INTO outreach_calls (user_id, reason, missed_since, scheduled_for, deadline, status, "
                "created_at, updated_at) VALUES (?, 'after_court', ?, ?, ?, 'scheduled', ?, ?)",
                (u["id"], day_start, next_call_time(now), day_start + 86400 + CALL_WINDOW[1] * 3600, now, now))
            created.append((cur.lastrowid, u["id"], _counsellor(conn, u["id"])))
    for call_id, user_id, counsellor in created:
        events.publish(counsellor, "outreach", victim_id=user_id, call_id=call_id, status="scheduled")
    return [c[0] for c in created]


def schedule_missed(now=None):
    """Find missed check-ins and queue a call for each person who opted in."""
    now = now or time.time()
    created = []
    with db.connect() as conn:
        for u in conn.execute("SELECT * FROM users WHERE role = 'victim' AND phone_enc IS NOT NULL "
                              "AND decoy_of IS NULL").fetchall():
            consent = json.loads(u["consent"] or "{}")
            if not consent.get("ivrs_calls") or not crypto.dec(u["phone_enc"]):
                continue
            since = missed_since(conn, u, now)
            if since is None or _active(conn, u["id"]) is not None:
                continue
            # One call per missed check-in: an escalated or finished one for this
            # same due time is not re-queued.
            if conn.execute("SELECT 1 FROM outreach_calls WHERE user_id = ? AND missed_since = ?",
                            (u["id"], since)).fetchone():
                continue
            when = next_call_time(now)
            cur = conn.execute(
                "INSERT INTO outreach_calls (user_id, reason, missed_since, scheduled_for, deadline, status, "
                "created_at, updated_at) VALUES (?, 'missed_checkin', ?, ?, ?, 'scheduled', ?, ?)",
                (u["id"], since, when, since + MAX_DEFER_H * 3600, now, now))
            created.append((cur.lastrowid, u["id"], _counsellor(conn, u["id"])))
    for call_id, user_id, counsellor in created:
        events.publish(counsellor, "outreach", victim_id=user_id, call_id=call_id, status="scheduled")
    return [c[0] for c in created]


def _escalate(conn, call, now, why):
    conn.execute("UPDATE outreach_calls SET status = 'escalated', updated_at = ? WHERE id = ?", (now, call["id"]))
    # An unanswered evening call after court is worth a look, not a high alert.
    level = "watch" if call["reason"] == "after_court" else "high"
    if not conn.execute("SELECT 1 FROM alerts WHERE user_id = ? AND reason = 'outreach_escalated' "
                        "AND status != 'resolved'", (call["user_id"],)).fetchone():
        conn.execute("INSERT INTO alerts (user_id, created_at, level, reason, message) VALUES (?, ?, ?, "
                     "'outreach_escalated', ?)", (call["user_id"], now, level, why))


def dial_due(now=None, dialer=None):
    """Places every call whose time has come. Returns the ids dialled."""
    now = now or time.time()
    dialer = dialer or provider()
    placed, touched = [], []
    with db.connect() as conn:
        rows = conn.execute("SELECT o.*, u.phone_enc FROM outreach_calls o JOIN users u ON u.id = o.user_id "
                            "WHERE o.status = 'scheduled' AND o.scheduled_for <= ?", (now,)).fetchall()
        for call in rows:
            if now > call["deadline"] + 12 * 3600 or call["attempts"] >= MAX_ATTEMPTS:
                _escalate(conn, call, now, f"{WHAT[call['reason']]}: could not reach them by phone")
                touched.append(call)
                continue
            if not _in_window(now):
                conn.execute("UPDATE outreach_calls SET scheduled_for = ?, updated_at = ? WHERE id = ?",
                             (next_call_time(now), now, call["id"]))
                continue
            try:
                ref = dialer.place_call(call["id"], crypto.dec(call["phone_enc"]))
            except Exception as exc:
                print(f"[outreach] could not place call {call['id']}: {exc}")
                conn.execute("UPDATE outreach_calls SET attempts = attempts + 1, scheduled_for = ?, "
                             "updated_at = ? WHERE id = ?", (now + RETRY_AFTER_MIN * 60, now, call["id"]))
                continue
            conn.execute("UPDATE outreach_calls SET status = 'calling', attempts = attempts + 1, provider_ref = ?, "
                         "outcome_enc = ?, updated_at = ? WHERE id = ?",
                         (ref, crypto.enc_json({"step": "menu", "answers": []}), now, call["id"]))
            placed.append(call["id"])
            touched.append(call)
        counsellors = {c["user_id"]: _counsellor(conn, c["user_id"]) for c in touched}
    for c in touched:
        events.publish(counsellors[c["user_id"]], "outreach", victim_id=c["user_id"], call_id=c["id"])
    return placed


# ---------------------------------------------------------------- the call itself

def _load(conn, call_id):
    return conn.execute("SELECT o.*, u.language, u.id AS uid FROM outreach_calls o JOIN users u ON u.id = o.user_id "
                        "WHERE o.id = ?", (call_id,)).fetchone()


def can_reschedule(call, now):
    return (call["reschedules"] < MAX_RESCHEDULES
            and any(now + d <= call["deadline"] for d in RESCHEDULE_OPTIONS.values()))


def _menu(s, call, now):
    return s["menu"] if can_reschedule(call, now) else s["no_more"] + " " + s["menu_no_reschedule"]


def _question(lang, index):
    q = questionnaires.get(PULSE, lang if lang in ("en", "hi") else "en")
    return q["items"][index]["text"]


def respond(call_id, event, digits=None, now=None):
    """One step of the IVR. event: answered | digits | no_answer | busy | failed | completed.
    Returns {say: [...], gather: n_digits or None, hangup: bool, language}."""
    now = now or time.time()
    with db.connect() as conn:
        call = _load(conn, call_id)
        if call is None:
            return {"say": [], "gather": None, "hangup": True, "language": "en"}
        lang = call["language"] if call["language"] in SCRIPTS else "en"
        s = _script(lang)
        state = crypto.dec_json(call["outcome_enc"]) if call["outcome_enc"] else {"step": "menu", "answers": []}
        result = _step(conn, call, state, s, lang, event, (digits or "").strip()[:1], now)
        counsellor = _counsellor(conn, call["uid"])
        status = conn.execute("SELECT status FROM outreach_calls WHERE id = ?", (call_id,)).fetchone()["status"]
    if result.pop("rescore", False):
        from . import service      # local: service imports this module
        service.recompute(call["uid"], now)
    events.publish(counsellor, "outreach", victim_id=call["uid"], call_id=call_id, status=status)
    return {**result, "language": lang}


def _save(conn, call, state, now, status=None, **extra):
    sets = ["outcome_enc = ?", "updated_at = ?"]
    args = [crypto.enc_json(state), now]
    if status:
        sets.append("status = ?")
        args.append(status)
    for k, v in extra.items():
        sets.append(f"{k} = ?")
        args.append(v)
    conn.execute(f"UPDATE outreach_calls SET {', '.join(sets)} WHERE id = ?", (*args, call["id"]))


def _step(conn, call, state, s, lang, event, digit, now):
    if call["status"] not in ("calling", "scheduled"):
        return {"say": [s["bye"]], "gather": None, "hangup": True}

    if event in ("no_answer", "busy", "failed"):
        if call["attempts"] >= MAX_ATTEMPTS or now + RETRY_AFTER_MIN * 60 > call["deadline"]:
            _escalate(conn, call, now, f"{WHAT[call['reason']]}: no answer after {call['attempts']} call(s)")
        else:
            _save(conn, call, {"step": "menu", "answers": []}, now, "scheduled",
                  scheduled_for=next_call_time(now + RETRY_AFTER_MIN * 60))
        return {"say": [], "gather": None, "hangup": True}

    if event == "completed":
        if state["step"] not in ("done",):
            # Hung up part-way: try again later rather than counting it done.
            if call["attempts"] >= MAX_ATTEMPTS or now + RETRY_AFTER_MIN * 60 > call["deadline"]:
                _escalate(conn, call, now, f"{WHAT[call['reason']]}: the call ended before the check-in")
            else:
                _save(conn, call, {"step": "menu", "answers": []}, now, "scheduled",
                      scheduled_for=next_call_time(now + RETRY_AFTER_MIN * 60))
        return {"say": [], "gather": None, "hangup": True}

    if event == "answered":
        state = {"step": "menu", "answers": []}
        _save(conn, call, state, now, "calling")
        return {"say": [s[GREETING.get(call["reason"], "greet")], _menu(s, call, now)], "gather": 1, "hangup": False}

    step = state["step"]
    if step == "menu":
        if digit == "1":
            state = {"step": "q", "answers": []}
            _save(conn, call, state, now)
            return {"say": [s["question"], _question(lang, 0), s["options"]], "gather": 1, "hangup": False}
        if digit == "2" and can_reschedule(call, now):
            state["step"] = "reschedule"
            _save(conn, call, state, now)
            allowed = [k for k, d in RESCHEDULE_OPTIONS.items() if now + d <= call["deadline"]]
            say = s["reschedule"] if len(allowed) == 2 else s["reschedule"].split(". ")[0] + "."
            return {"say": [say], "gather": 1, "hangup": False}
        if digit == "3":
            _callback_request(conn, call, now)
            state["step"] = "done"
            _save(conn, call, state, now, "completed")
            return {"say": [s["callback"]], "gather": None, "hangup": True}
        return {"say": [s["invalid"], _menu(s, call, now)], "gather": 1, "hangup": False}

    if step == "reschedule":
        delay = RESCHEDULE_OPTIONS.get(digit)
        if delay is None or now + delay > call["deadline"] or not can_reschedule(call, now):
            state["step"] = "menu"
            _save(conn, call, state, now)
            return {"say": [s["invalid"], _menu(s, call, now)], "gather": 1, "hangup": False}
        state = {"step": "menu", "answers": []}
        _save(conn, call, state, now, "scheduled", scheduled_for=next_call_time(now + delay),
              reschedules=call["reschedules"] + 1, attempts=0)
        return {"say": [s["rescheduled"]], "gather": None, "hangup": True}

    if step == "q":
        if digit not in ("0", "1", "2", "3"):
            return {"say": [s["invalid"], s["options"]], "gather": 1, "hangup": False}
        answers = state["answers"] + [int(digit)]
        n = len(questionnaires.get(PULSE, "en")["items"])
        if len(answers) < n:
            state = {"step": "q", "answers": answers}
            _save(conn, call, state, now)
            return {"say": [_question(lang, len(answers)), s["options"]], "gather": 1, "hangup": False}
        state = {"step": "done", "answers": answers}
        _save(conn, call, state, now, "completed")
        _submit_checkin(conn, call, answers, now)
        return {"say": [s["done"]], "gather": None, "hangup": True, "rescore": True}

    return {"say": [s["bye"]], "gather": None, "hangup": True}


def _callback_request(conn, call, now):
    conn.execute("INSERT INTO contact_requests (user_id, created_at, kind, preferred_time, status) "
                 "VALUES (?, ?, 'ivrs_callback', 'asap', 'open')", (call["uid"], now))


def _submit_checkin(conn, call, answers, now):
    """The keypad answers go in like any other check-in, marked channel=ivrs.
    respond() rescores once this transaction has closed."""
    result = questionnaires.score(PULSE, answers)
    conn.execute(
        "INSERT INTO questionnaires (user_id, created_at, instrument, total, severity, flags, answers_enc, channel) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'ivrs')",
        (call["uid"], now, PULSE, result["total"], result["severity"], ",".join(result["flags"]),
         crypto.enc_json(answers)))


# ---------------------------------------------------------------- views + the in-app reschedule

def call_view(row, for_counsellor=True):
    out = {"id": row["id"], "status": row["status"], "reason": row["reason"],
           "missed_since": db.iso(row["missed_since"]), "scheduled_for": db.iso(row["scheduled_for"]),
           "deadline": db.iso(row["deadline"]), "attempts": row["attempts"],
           "reschedules": row["reschedules"], "reschedules_left": max(0, MAX_RESCHEDULES - row["reschedules"]),
           "updated_at": db.iso(row["updated_at"])}
    if for_counsellor:
        out["victim_id"] = row["user_id"]
        state = crypto.dec_json(row["outcome_enc"]) if row["outcome_enc"] else None
        out["outcome"] = (state or {}).get("step")
    return out


def victim_call(user, now=None):
    now = now or time.time()
    with db.connect() as conn:
        row = _active(conn, user["id"])
        if row is None:
            return None
        view = call_view(row, for_counsellor=False)
        view["can_reschedule"] = can_reschedule(row, now)
        view["options"] = [{"key": k, "hours": d // 3600} for k, d in RESCHEDULE_OPTIONS.items()
                           if now + d <= row["deadline"]] if view["can_reschedule"] else []
        return view


class RescheduleRefused(ValueError):
    pass


def reschedule_from_app(user, option, now=None):
    """The same budget as on the phone: the app is not a way round the limit."""
    now = now or time.time()
    delay = RESCHEDULE_OPTIONS.get(str(option))
    with db.connect() as conn:
        call = _active(conn, user["id"])
        if call is None:
            raise RescheduleRefused("There is no check-in call to move.")
        if delay is None or not can_reschedule(call, now) or now + delay > call["deadline"]:
            raise RescheduleRefused("This check-in can't be moved again. A short check-in now is all it takes.")
        conn.execute("UPDATE outreach_calls SET scheduled_for = ?, reschedules = reschedules + 1, attempts = 0, "
                     "status = 'scheduled', updated_at = ? WHERE id = ?",
                     (next_call_time(now + delay), now, call["id"]))
        counsellor = _counsellor(conn, user["id"])
    events.publish(counsellor, "outreach", victim_id=user["id"], call_id=call["id"], status="scheduled")
    return victim_call(user, now)


def cancel_for_checkin(conn, user_id, now=None):
    """Checking in in the app makes a pending call pointless."""
    conn.execute("UPDATE outreach_calls SET status = 'cancelled', updated_at = ? WHERE user_id = ? "
                 "AND status IN ('scheduled', 'calling')", (now or time.time(), user_id))


def counsellor_calls(counsellor, status="active"):
    where = "u.counsellor_id = ?"
    args = [counsellor["id"]]
    if status == "active":
        where += " AND o.status IN ('scheduled', 'calling', 'escalated')"
    with db.connect() as conn:
        rows = conn.execute(f"SELECT o.* FROM outreach_calls o JOIN users u ON u.id = o.user_id WHERE {where} "
                            "ORDER BY o.updated_at DESC LIMIT 200", args).fetchall()
        out = []
        for r in rows:
            item = call_view(r)
            name = conn.execute("SELECT name_enc FROM users WHERE id = ?", (r["user_id"],)).fetchone()
            item["victim_name"] = crypto.dec(name["name_enc"]) if name else None
            out.append(item)
    return out


# ---------------------------------------------------------------- carrier formats

def twiml(step, call_id):
    """Renders a respond() result as TwiML for Twilio's <Say>/<Gather>."""
    from xml.sax.saxutils import escape
    lang = "hi-IN" if step["language"] == "hi" else "en-IN"
    says = "".join(f'<Say language="{lang}">{escape(t)}</Say>' for t in step["say"])
    if step["gather"]:
        action = escape(f"/ivrs/twilio/voice?call_id={call_id}&key={webhook_key()}&step=digits")
        return (f'<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="{step["gather"]}" '
                f'timeout="8" action="{action}" method="POST">{says}</Gather>'
                f'<Redirect method="POST">{action}</Redirect></Response>')
    return f'<?xml version="1.0" encoding="UTF-8"?><Response>{says}<Hangup/></Response>'


def verify_twilio_signature(url, params, signature):
    """Twilio's X-Twilio-Signature: HMAC-SHA1 of the URL plus sorted POST params."""
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not token:
        return False
    data = url + "".join(f"{k}{params[k]}" for k in sorted(params))
    expected = base64.b64encode(hmac.new(token.encode(), data.encode(), hashlib.sha1).digest()).decode()
    return hmac.compare_digest(expected, signature or "")
