"""Reaching a human: the per-message distress feed the counsellor watches,
callback requests, secure messages between a person and their counsellor,
and the counsellor's contact card.

Everything here publishes to monitoring.events so the other side sees it at
once: the counsellor's dashboard for a reading, a request or a message; the
person's app for a reply.
"""

import time

from . import crypto, db, events

LEVEL_LABELS = ("none", "low", "moderate", "high")
CHANNELS = ("chat", "voice_call", "voice_checkin", "voice_note", "message", "ivrs")
REQUEST_KINDS = ("callback", "talk_soon", "ivrs_callback")
PREFERRED_TIMES = ("asap", "morning", "afternoon", "evening")
REPEATED_WINDOW_H = 24

# Checked 2026-09-18. KIRAN (1800-599-0019) is gone: it was merged into
# Tele-MANAS, so it is deliberately not listed.
HELPLINES = [
    {"number": "112", "name": "Emergency", "hours": "24x7",
     "what": {"en": "Police, fire or ambulance if you are in danger now", "hi": "अभी खतरे में हों तो पुलिस, दमकल या एम्बुलेंस"}},
    {"number": "14566", "name": "National Helpline Against Atrocities", "hours": "24x7, toll-free",
     "what": {"en": "Report an atrocity or a problem with your SC/ST case", "hi": "अत्याचार या SC/ST मामले से जुड़ी समस्या की शिकायत"}},
    {"number": "181", "name": "Women Helpline", "hours": "24x7",
     "what": {"en": "Support for women facing violence", "hi": "हिंसा झेल रही महिलाओं के लिए सहायता"}},
    {"number": "14416", "name": "Tele-MANAS", "hours": "24x7, free, many languages",
     "what": {"en": "Someone to talk to about how you feel", "hi": "अपने मन की बात किसी से कहने के लिए"}},
    {"number": "15100", "name": "NALSA Legal Aid", "hours": "Free legal help",
     "what": {"en": "Free lawyers and legal advice", "hi": "मुफ़्त वकील और कानूनी सलाह"}},
]


class NotFound(LookupError):
    pass


def _counsellor_of(conn, user_id):
    row = conn.execute("SELECT counsellor_id FROM users WHERE id = ?", (user_id,)).fetchone()
    return row["counsellor_id"] if row else None


def _name(conn, user_id):
    row = conn.execute("SELECT name_enc FROM users WHERE id = ?", (user_id,)).fetchone() if user_id else None
    return crypto.dec(row["name_enc"]) if row else None


def _assigned(conn, counsellor, victim_id):
    row = conn.execute("SELECT * FROM users WHERE id = ? AND role = 'victim' AND counsellor_id = ?",
                       (victim_id, counsellor["id"])).fetchone()
    if row is None:
        raise NotFound("No such client assigned to you")
    return row


# ---------------------------------------------------------------- readings (the live feed)

def record_reading(user, channel, distress, crisis=False, issues=(), now=None):
    """One message's distress reading. Never the words. Returns the view."""
    if distress is None and not crisis:
        return None
    now = now or time.time()
    score = float(distress["score"]) if distress else 100.0
    level = int(distress["level"]) if distress else 3
    with db.connect() as conn:
        cur = conn.execute(
            "INSERT INTO readings (user_id, created_at, channel, score, level, crisis, issues) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user["id"], now, channel, score, level, int(bool(crisis)), ",".join(issues)))
        reading_id = cur.lastrowid
        counsellor = _counsellor_of(conn, user["id"])
        repeated = False
        if level >= 2 and not crisis:
            recent = conn.execute("SELECT COUNT(*) FROM readings WHERE user_id = ? AND level >= 2 AND created_at >= ?",
                                  (user["id"], now - REPEATED_WINDOW_H * 3600)).fetchone()[0]
            if recent >= 2 and not conn.execute("SELECT 1 FROM alerts WHERE user_id = ? AND reason = 'repeated_distress' "
                                                "AND (status != 'resolved' OR handled_at >= ?)",
                                                (user["id"], now - REPEATED_WINDOW_H * 3600)).fetchone():
                conn.execute("INSERT INTO alerts (user_id, created_at, level, reason, message) VALUES (?, ?, 'watch', "
                             "'repeated_distress', ?)",
                             (user["id"], now, f"{recent} messages rated moderate or high distress in the last "
                                                f"{REPEATED_WINDOW_H} hours"))
                repeated = True
    view = {"id": reading_id, "victim_id": user["id"], "at": db.iso(now), "channel": channel,
            "score": round(score, 1), "level": level, "label": LEVEL_LABELS[level], "crisis": bool(crisis),
            "issues": list(issues)}
    events.publish(counsellor, "reading", **view)
    if repeated:
        events.publish(counsellor, "alert", victim_id=user["id"], reason="repeated_distress")
    return view


def _reading_view(conn, r, with_name=False):
    out = {"id": r["id"], "victim_id": r["user_id"], "at": db.iso(r["created_at"]), "channel": r["channel"],
           "score": round(r["score"], 1), "level": r["level"], "label": LEVEL_LABELS[r["level"]],
           "crisis": bool(r["crisis"]), "issues": [i for i in r["issues"].split(",") if i]}
    if with_name:
        out["victim_name"] = _name(conn, r["user_id"])
    return out


def readings_for(counsellor, victim_id, limit=100):
    with db.connect() as conn:
        _assigned(conn, counsellor, victim_id)
        rows = conn.execute("SELECT * FROM readings WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                            (victim_id, int(limit))).fetchall()
        return [_reading_view(conn, r) for r in rows]


def feed(counsellor, limit=100, since=None):
    """Every reading across the caseload, newest first."""
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT r.* FROM readings r JOIN users v ON v.id = r.user_id WHERE v.counsellor_id = ? "
            + ("AND r.created_at > ? " if since else "") + "ORDER BY r.created_at DESC LIMIT ?",
            (counsellor["id"], *([since] if since else []), int(limit))).fetchall()
        return [_reading_view(conn, r, with_name=True) for r in rows]


def latest_reading(conn, victim_id):
    r = conn.execute("SELECT * FROM readings WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
                     (victim_id,)).fetchone()
    return _reading_view(conn, r) if r else None


def recent_peak(conn, victim_id, hours=24):
    row = conn.execute("SELECT MAX(level) AS lvl, COUNT(*) AS n FROM readings WHERE user_id = ? AND created_at >= ?",
                       (victim_id, time.time() - hours * 3600)).fetchone()
    return {"level": row["lvl"], "label": LEVEL_LABELS[row["lvl"]] if row["lvl"] is not None else None,
            "count": row["n"]}


# ---------------------------------------------------------------- contact requests

def _request_view(conn, r, for_counsellor=True):
    out = {"id": r["id"], "kind": r["kind"], "preferred_time": r["preferred_time"], "status": r["status"],
           "at": db.iso(r["created_at"]), "handled_at": db.iso(r["handled_at"]),
           "response": crypto.dec(r["response_enc"])}
    if for_counsellor:
        out.update({"victim_id": r["user_id"], "victim_name": _name(conn, r["user_id"]),
                    "note": crypto.dec(r["note_enc"]), "handled_by": _name(conn, r["handled_by"])})
    return out


def request_contact(user, kind="callback", preferred_time="asap", note=None, now=None):
    if kind not in REQUEST_KINDS or preferred_time not in PREFERRED_TIMES:
        raise ValueError("Unknown request")
    now = now or time.time()
    with db.connect() as conn:
        open_one = conn.execute("SELECT id FROM contact_requests WHERE user_id = ? AND status != 'done' "
                                "AND kind = ?", (user["id"], kind)).fetchone()
        if open_one is not None:
            # One open request at a time: asking again updates it (and moves it up).
            conn.execute("UPDATE contact_requests SET created_at = ?, preferred_time = ?, "
                         "note_enc = COALESCE(?, note_enc), status = 'open' WHERE id = ?",
                         (now, preferred_time, crypto.enc(note) if note else None, open_one["id"]))
            req_id = open_one["id"]
        else:
            req_id = conn.execute("INSERT INTO contact_requests (user_id, created_at, kind, preferred_time, note_enc) "
                                  "VALUES (?, ?, ?, ?, ?)", (user["id"], now, kind, preferred_time,
                                                             crypto.enc(note) if note else None)).lastrowid
        counsellor = _counsellor_of(conn, user["id"])
        view = _request_view(conn, conn.execute("SELECT * FROM contact_requests WHERE id = ?", (req_id,)).fetchone(),
                             for_counsellor=False)
    events.publish(counsellor, "contact_request", victim_id=user["id"], request_id=req_id, kind=kind)
    return view


def my_requests(user):
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM contact_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
                            (user["id"],)).fetchall()
        return [_request_view(conn, r, for_counsellor=False) for r in rows]


def counsellor_requests(counsellor, status="open"):
    where = "v.counsellor_id = ?" + ("" if status == "all" else " AND r.status != 'done'" if status == "open"
                                      else " AND r.status = ?")
    args = [counsellor["id"]] + ([] if status in ("all", "open") else [status])
    with db.connect() as conn:
        rows = conn.execute(f"SELECT r.* FROM contact_requests r JOIN users v ON v.id = r.user_id WHERE {where} "
                            "ORDER BY r.status = 'done', r.created_at DESC LIMIT 200", args).fetchall()
        return [_request_view(conn, r) for r in rows]


def handle_request(counsellor, request_id, status, response=None, now=None):
    if status not in ("acknowledged", "done"):
        raise ValueError("status must be acknowledged or done")
    now = now or time.time()
    with db.connect() as conn:
        row = conn.execute("SELECT r.* FROM contact_requests r JOIN users v ON v.id = r.user_id "
                           "WHERE r.id = ? AND v.counsellor_id = ?", (request_id, counsellor["id"])).fetchone()
        if row is None:
            raise NotFound("No such request for your clients")
        conn.execute("UPDATE contact_requests SET status = ?, handled_by = ?, handled_at = ?, "
                     "response_enc = COALESCE(?, response_enc) WHERE id = ?",
                     (status, counsellor["id"], now, crypto.enc(response) if response else None, request_id))
        view = _request_view(conn, conn.execute("SELECT * FROM contact_requests WHERE id = ?", (request_id,)).fetchone())
    events.publish(counsellor["id"], "contact_request", victim_id=row["user_id"], request_id=request_id, handled=True)
    events.publish(row["user_id"], "contact_request", request_id=request_id, status=status)
    return view


# ---------------------------------------------------------------- secure messages

def _message_view(r):
    return {"id": r["id"], "at": db.iso(r["created_at"]), "sender": r["sender"],
            "text": crypto.dec(r["text_enc"]), "read_at": db.iso(r["read_at"])}


def send_from_victim(user, text, now=None):
    text = (text or "").strip()
    if not text:
        raise ValueError("Message is empty")
    now = now or time.time()
    with db.connect() as conn:
        cur = conn.execute("INSERT INTO counsellor_messages (user_id, created_at, sender, sender_id, text_enc) "
                           "VALUES (?, ?, 'victim', ?, ?)", (user["id"], now, user["id"], crypto.enc(text[:4000])))
        counsellor = _counsellor_of(conn, user["id"])
        view = _message_view(conn.execute("SELECT * FROM counsellor_messages WHERE id = ?", (cur.lastrowid,)).fetchone())
    events.publish(counsellor, "message", victim_id=user["id"], message_id=view["id"])
    return view


def send_from_counsellor(counsellor, victim_id, text, now=None):
    text = (text or "").strip()
    if not text:
        raise ValueError("Message is empty")
    now = now or time.time()
    with db.connect() as conn:
        _assigned(conn, counsellor, victim_id)
        cur = conn.execute("INSERT INTO counsellor_messages (user_id, created_at, sender, sender_id, text_enc) "
                           "VALUES (?, ?, 'counsellor', ?, ?)", (victim_id, now, counsellor["id"], crypto.enc(text[:4000])))
        # Replying reads the thread.
        conn.execute("UPDATE counsellor_messages SET read_at = ? WHERE user_id = ? AND sender = 'victim' "
                     "AND read_at IS NULL", (now, victim_id))
        view = _message_view(conn.execute("SELECT * FROM counsellor_messages WHERE id = ?", (cur.lastrowid,)).fetchone())
    events.publish(victim_id, "message", message_id=view["id"])
    events.publish(counsellor["id"], "message", victim_id=victim_id, message_id=view["id"], own=True)
    return view


def thread_for_victim(user, limit=100, now=None):
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM counsellor_messages WHERE user_id = ? ORDER BY created_at DESC, id DESC "
                            "LIMIT ?", (user["id"], int(limit))).fetchall()
        conn.execute("UPDATE counsellor_messages SET read_at = ? WHERE user_id = ? AND sender = 'counsellor' "
                     "AND read_at IS NULL", (now or time.time(), user["id"]))
    return [_message_view(r) for r in reversed(rows)]


def thread_for_counsellor(counsellor, victim_id, limit=200, now=None):
    with db.connect() as conn:
        _assigned(conn, counsellor, victim_id)
        rows = conn.execute("SELECT * FROM counsellor_messages WHERE user_id = ? ORDER BY created_at DESC, id DESC "
                            "LIMIT ?", (victim_id, int(limit))).fetchall()
        conn.execute("UPDATE counsellor_messages SET read_at = ? WHERE user_id = ? AND sender = 'victim' "
                     "AND read_at IS NULL", (now or time.time(), victim_id))
    return [_message_view(r) for r in reversed(rows)]


def inbox(counsellor):
    """One row per client with messages: the last message and the unread count."""
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT m.user_id, MAX(m.created_at) AS last_at, "
            "SUM(CASE WHEN m.sender = 'victim' AND m.read_at IS NULL THEN 1 ELSE 0 END) AS unread "
            "FROM counsellor_messages m JOIN users v ON v.id = m.user_id WHERE v.counsellor_id = ? "
            "GROUP BY m.user_id ORDER BY last_at DESC", (counsellor["id"],)).fetchall()
        out = []
        for r in rows:
            last = conn.execute("SELECT * FROM counsellor_messages WHERE user_id = ? ORDER BY created_at DESC, id DESC "
                                "LIMIT 1", (r["user_id"],)).fetchone()
            out.append({"victim_id": r["user_id"], "victim_name": _name(conn, r["user_id"]),
                        "last_at": db.iso(r["last_at"]), "unread": r["unread"],
                        "last": {"sender": last["sender"], "text": crypto.dec(last["text_enc"])[:140]}})
    return out


def unread_for_victim(conn, user_id):
    return conn.execute("SELECT COUNT(*) FROM counsellor_messages WHERE user_id = ? AND sender = 'counsellor' "
                        "AND read_at IS NULL", (user_id,)).fetchone()[0]


# ---------------------------------------------------------------- counsellor card

def set_counsellor_contact(counsellor, phone=None, hours=None, now=None):
    now = now or time.time()
    with db.connect() as conn:
        conn.execute("INSERT INTO counsellor_profiles (user_id, phone_enc, hours_enc, updated_at) VALUES (?, ?, ?, ?) "
                     "ON CONFLICT(user_id) DO UPDATE SET phone_enc = excluded.phone_enc, "
                     "hours_enc = excluded.hours_enc, updated_at = excluded.updated_at",
                     (counsellor["id"], crypto.enc(phone) if phone else None,
                      crypto.enc(hours) if hours else None, now))
    return counsellor_contact(counsellor["id"])


def counsellor_contact(counsellor_id):
    if not counsellor_id:
        return None
    with db.connect() as conn:
        name = _name(conn, counsellor_id)
        row = conn.execute("SELECT * FROM counsellor_profiles WHERE user_id = ?", (counsellor_id,)).fetchone()
    return {"name": name, "phone": crypto.dec(row["phone_enc"]) if row else None,
            "hours": crypto.dec(row["hours_enc"]) if row else None}


def victim_support(user):
    """Everything the Support screen needs in one call."""
    lang = user.get("language") or "en"
    with db.connect() as conn:
        unread = unread_for_victim(conn, user["id"])
    return {
        "counsellor": counsellor_contact(user.get("counsellor_id")),
        "unread_messages": unread,
        "requests": my_requests(user),
        "helplines": [{**h, "what": h["what"].get(lang) or h["what"]["en"]} for h in HELPLINES],
    }
