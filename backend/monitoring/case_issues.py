"""Case issues: problems with the justice process, surfaced to the counsellor
with the legal steps that fit them.

Three ways in:
  detected       a pattern match on what the person says (chat, a spoken turn,
                 a voice check-in, a message to the counsellor). Instant, and
                 the words are matched in the original language, before any
                 translation.
  insight        the conversation summary (monitoring.insights) names a problem
                 the patterns missed.
  victim_report  the person taps "Report a problem" in Support.
  counsellor     logged by hand.

An open issue of the same category is updated rather than duplicated, so
"the police won't write my FIR" said three times is one issue seen three
times. The summary is a paraphrase from the category; the person's own words
are kept as evidence only with the store_messages consent.

Detection is deliberately a net, not a judge: a false hit costs the
counsellor one "dismiss", a miss costs the person a right they had.
"""

import json
import re
from pathlib import Path

from . import crypto, db, events

_ACTIONS = None
STATUSES = ("open", "in_progress", "action_taken", "resolved", "dismissed")
ACTIVE = ("open", "in_progress", "action_taken")
SOURCES = ("detected", "insight", "victim_report", "counsellor")
# Categories that are a safety matter as much as a legal one.
SAFETY = ("threat", "pressure_to_compromise", "boycott_harassment")


def legal_actions():
    global _ACTIONS
    if _ACTIONS is None:
        with open(Path(__file__).resolve().parent / "legal_actions.json", encoding="utf-8") as f:
            _ACTIONS = json.load(f)
    return _ACTIONS


def categories():
    return legal_actions()["categories"]


# ---------------------------------------------------------------- detection

_NEG = r"(?:refus\w*|won'?t|wouldn'?t|didn'?t|did not|don'?t|do not|not ready to|aren'?t|are not|isn'?t|is not|never|not)"
_I = re.I

PATTERNS = {
    "fir_refused": [
        rf"\bpolice\b.{{0,40}}\b{_NEG}\b.{{0,12}}\b(?:register|file|write|lodge|take|accept|record)\w*\b.{{0,20}}\b(?:fir|f\.i\.r|complaint|case|report)\b",
        r"\b(?:fir|complaint|report)\b.{0,20}\b(?:was |is |has |still )?(?:not|never|n'?t)\s+(?:been\s+)?(?:registered|filed|lodged|taken|written|accepted)\b",
        r"\b(?:inquiry|enquiry)\s+first\b",
        r"(?:एफ\s?आई\s?आर|FIR|रिपोर्ट|शिकायत|केस)\s*(?:दर्ज|लिख)\w*\s*(?:नहीं|से\s*मना)",
        r"पुलिस.{0,30}(?:मना\s*कर|(?:दर्ज|लिख)\w*\s*नहीं)",
        r"\b(?:fir|report|complaint|case)\s+(?:darj|likh\w*|file)\s+(?:nahi|nhi|nahin)\b",
        r"\bpolice\b.{0,30}\b(?:mana\s+kar\w*|nahi\s+likh\w*|nhi\s+likh\w*)",
    ],
    "fir_copy": [
        r"\b(?:didn'?t|did not|never|haven'?t|have not|not)\s+(?:give|given|got|get|received|receive)\w*\b.{0,20}\bcopy\b.{0,10}\bfir\b",
        r"\bfir\b.{0,6}\bcopy\b.{0,20}\b(?:not|never|n'?t)\b",
        r"(?:एफ\s?आई\s?आर|FIR)\s*की\s*(?:कॉपी|प्रति).{0,20}नहीं",
        r"\bfir\s+(?:ki\s+)?(?:copy|kopi)\b.{0,20}\b(?:nahi|nhi)\b",
    ],
    "investigation_delay": [
        r"\b(?:no|still no|not yet|hasn'?t|has not|haven'?t|have not)\b.{0,12}\b(?:charge ?sheet|investigation|arrest)\w*",
        r"\b(?:charge ?sheet|investigation)\b.{0,30}\b(?:not (?:filed|done|started|complete\w*)|still pending|delayed|stuck)\b",
        r"\b(?:not|never|nobody|no one)\b.{0,15}\b(?:been )?arrested\b",
        r"\b(?:roaming|walking around) free\b",
        r"(?:चार्जशीट|जांच|जाँच|गिरफ्तारी|गिरफ़्तारी).{0,30}(?:नहीं\s*हु|अभी\s*तक\s*नहीं|रुकी)",
        r"खुलेआम\s*घूम",
        r"\b(?:chargesheet|jaanch|jach|giraftari|arrest)\b.{0,30}\b(?:nahi hu\w*|abhi tak nahi)\b",
        r"\bkhule(?:aam)?\s+ghoom\w*|\bkhule(?:aam)?\s+ghum\w*",
    ],
    "threat": [
        r"\bthreat(?:en|ened|ening|s)?\b",
        r"\bintimidat\w*",
        r"\b(?:will|would|going to|gonna|'ll)\s+(?:kill|hurt|harm|beat|burn|attack|rape|finish)\s+(?:us|my|our|him|her)\b",
        r"\b(?:they|he|she|someone|people|his (?:family|brothers|men)|their men)\b.{0,15}\b(?:said|say|says|told|warned)\b.{0,40}\b(?:kill|hurt|harm|burn|finish|beat|rape|attack)\b",
        r"\b(?:following|stalking) (?:me|us|my)\b",
        r"धमकी|धमका",
        r"जान\s*से\s*मार",
        r"मार\s*(?:डालेंगे|देंगे|डालने)",
        r"\b(?:dhamki|dhamka\w*|jaan\s+se\s+maar\w*)\b",
        r"\bmaar\s+(?:denge|dalenge|dalne|daalenge)\b",
    ],
    "pressure_to_compromise": [
        r"\b(?:compromise|settle|take back|withdraw|drop)\b.{0,10}\b(?:the |my |our )?(?:case|complaint|fir|matter)\b",
        r"\b(?:pressur\w*|forc\w*|push\w*)\b.{0,30}\b(?:compromise|settle|take back|withdraw)\b",
        r"\b(?:offer\w*)\b.{0,15}\bmoney\b.{0,20}\b(?:to|if)\b",
        r"समझौता|समझौते|(?:केस|शिकायत|मुकदमा)\s*वापस",
        r"\b(?:samjhauta|samjhota|samjhauta)\b|\b(?:case|complaint|mukadma)\s+wapas\b",
    ],
    "no_hearing_notice": [
        r"\b(?:no one|nobody|didn'?t|did not|never|wasn'?t|was not|weren'?t|not)\b.{0,10}\b(?:tell|told|inform\w*|notif\w*)\b.{0,40}\b(?:hearing|court date|date|bail|notice)\b",
        r"\b(?:i|we)\b.{0,6}\b(?:didn'?t|did not|never)\s+(?:know|knew)\b.{0,20}\b(?:hearing|bail|court date)\b",
        r"\bfound out\b.{0,40}\b(?:bail|released|out of jail)\b",
        r"\b(?:he|they|accused|the man|the men)\b.{0,10}\b(?:is|are|was|were|got)\b.{0,6}\b(?:out|released)\b.{0,20}\b(?:bail|jail)\b",
        r"(?:सुनवाई|तारीख|जमानत|ज़मानत).{0,30}(?:बताया\s*नहीं|नहीं\s*बताया|सूचना\s*नहीं|पता\s*नहीं\s*चला|खबर\s*नहीं)",
        r"(?:जमानत|ज़मानत)\s*पर\s*(?:छूट|बाहर)",
        r"\b(?:tareekh|tarikh|sunwai|zamanat|jamanat|bail)\b.{0,30}\b(?:bataya nahi|nahi bataya|pata nahi chala|khabar nahi)\b",
        r"\b(?:zamanat|jamanat|bail)\s+(?:pe|par)\s+(?:chhut|chut|bahar)\w*",
    ],
    "relief_not_received": [
        r"\b(?:haven'?t|have not|didn'?t|did not|never|not|still not|still haven'?t|no)\b.{0,10}\b(?:got|get|received|receive|been paid|paid)\b.{0,40}\b(?:compensation|relief|money|payment|amount|instal?ment)\b",
        r"\b(?:compensation|relief money|relief|payment|instal?ment)\b.{0,30}\b(?:not (?:come|arrived|received|paid|given)|never (?:came|arrived)|still pending|hasn'?t come|has not come|delayed)\b",
        r"(?:मुआवज़ा|मुआवजा|सहायता\s*राशि|राहत\s*राशि|पैसा|पैसे).{0,30}(?:नहीं\s*मिल|नहीं\s*आ|अभी\s*तक\s*नहीं)",
        r"\b(?:muavza|muavaza|mawaza|muawza|sahayata rashi|compensation)\b.{0,30}\b(?:nahi mil\w*|nahi aaya|abhi tak nahi)\b",
    ],
    "tame_not_paid": [
        r"\b(?:travel|bus|train|fare|daily allowance|ta/?da|expenses?)\b.{0,40}\b(?:not (?:paid|given|reimbursed)|never (?:paid|got)|didn'?t (?:get|pay))\b",
        r"\b(?:my own pocket|own money|paid (?:it )?myself)\b.{0,40}\b(?:court|police|hospital|travel|bus|train)\b",
        r"\b(?:fare|travel|bus|train|ticket|auto|rickshaw)\b.{0,40}\b(?:own pocket|out of pocket|own money|myself)\b",
        r"(?:किराया|यात्रा|भत्ता).{0,30}(?:नहीं\s*मिल|नहीं\s*दिया)",
        r"\b(?:kiraya|bhatta|yatra kharcha)\b.{0,30}\b(?:nahi mila|nahi diya)\b",
    ],
    "hearing_delays": [
        r"\badjourn\w*",
        r"\b(?:date|hearing)s?\b.{0,10}\b(?:keeps?|kept)\b.{0,15}\b(?:changing|changed|postponed|moved|pushed)\b",
        r"\b(?:postponed|next date)\s+again\b",
        r"\b(?:case|trial)\b.{0,20}\b(?:going on|pending|dragging)\b.{0,10}\bfor (?:years|months)\b",
        r"तारीख\s*पे\s*तारीख|तारीख़\s*पे\s*तारीख़",
        r"(?:तारीख|तारीख़|सुनवाई).{0,20}(?:फिर\s*से|बार\s*बार).{0,20}(?:बढ़|टल|बदल)",
        r"\b(?:tareekh|tarikh)\s+pe\s+(?:tareekh|tarikh)\b",
        r"\b(?:date|tareekh|tarikh)\b.{0,10}\b(?:phir se|fir se|baar baar)\b.{0,10}\b(?:badh|tal|badal)\w*",
    ],
    "no_lawyer": [
        r"\b(?:no|don'?t have a|do not have a|can'?t afford a|cannot afford a|need a|without a)\s+(?:lawyer|advocate|vakil)\b",
        r"\b(?:lawyer|advocate|prosecutor|spp|vakil)\b.{0,30}\b(?:not (?:coming|helping|responding|answering|picking|attending)|never (?:comes|came|helps|answers)|doesn'?t (?:come|help|answer|care)|didn'?t (?:come|show up))\b",
        r"वकील.{0,20}नहीं",
        r"\bvakil\b.{0,20}\b(?:nahi|nhi)\b",
    ],
    "boycott_harassment": [
        r"\bboycott\w*",
        r"\b(?:won'?t|will not|refus\w* to|don'?t|do not)\s+(?:let|allow)\s+(?:us|me)\b.{0,10}\b(?:use|take|draw|fill|enter|come|walk)\b",
        r"\b(?:not allowed|aren'?t allowed|can'?t)\b.{0,6}\b(?:use|take|draw|fill)\b.{0,10}\b(?:water|the well|the tap|the handpump|the road)\b",
        r"\bharass\w*",
        r"बहिष्कार|हुक्का\s*पानी|पानी\s*(?:भरने|लेने)\s*नहीं",
        r"\b(?:bahishkar|hukka pani)\b|\bpani\s+(?:bharne|lene)\s+nahi\b",
    ],
    "disrespect": [
        r"\b(?:police|officer|officers|constable|court|judge|clerk|doctor|officials?|staff)\b.{0,30}\b(?:insulted|humiliated|abused|shouted at|laughed at|mocked|disrespected|misbehaved|caste (?:name|slur)s?)\b",
        r"(?:पुलिस|अधिकारी|डॉक्टर|दरोगा).{0,30}(?:बेइज़्ज़ती|बेइज्जती|अपमान|गाली|जातिसूचक)",
        r"\b(?:police|afsar|officer|doctor|daroga)\b.{0,30}\b(?:beizzati|apmaan|apman|gaali|gali di)\b",
    ],
}
_COMPILED = {cat: [re.compile(p, _I) for p in pats] for cat, pats in PATTERNS.items()}


def detect(text):
    """Categories spotted in one message. Matching runs on the original words."""
    text = (text or "").strip()
    if not text:
        return []
    return [cat for cat, pats in _COMPILED.items() if any(p.search(text) for p in pats)]


# ---------------------------------------------------------------- storage

def _summary_for(category, source):
    title = categories().get(category, categories()["other"])["title"]
    how = {"detected": "Mentioned in conversation", "insight": "From the conversation summary",
           "victim_report": "Reported by the person", "counsellor": "Logged by counsellor"}[source]
    return f"{title}. {how}."


def _counsellor_of(conn, user_id):
    row = conn.execute("SELECT counsellor_id FROM users WHERE id = ?", (user_id,)).fetchone()
    return row["counsellor_id"] if row else None


def record(conn, user, category, source, *, evidence=None, summary=None, now=None):
    """Opens an issue or bumps the matching open one. Returns (issue_id, created)."""
    if category not in categories():
        category = "other"
    now = now or db.now()
    severity = categories()[category]["severity"]
    keep_words = bool(evidence) and user["consent"].get("store_messages")
    existing = conn.execute(
        f"SELECT id FROM case_issues WHERE user_id = ? AND category = ? AND status IN ({','.join('?' * len(ACTIVE))}) "
        "ORDER BY created_at DESC LIMIT 1", (user["id"], category, *ACTIVE)).fetchone()
    if existing is not None:
        if source == "insight":
            # The summary re-describing something already caught is not a new mention.
            return existing["id"], False
        sets = "occurrences = occurrences + 1, last_seen_at = ?, updated_at = ?"
        args = [now, now]
        if keep_words:
            sets += ", evidence_enc = ?"
            args.append(crypto.enc(evidence[:1000]))
        conn.execute(f"UPDATE case_issues SET {sets} WHERE id = ?", (*args, existing["id"]))
        return existing["id"], False
    cur = conn.execute(
        "INSERT INTO case_issues (user_id, category, severity, source, summary_enc, evidence_enc, status, "
        "created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)",
        (user["id"], category, severity, source, crypto.enc(summary or _summary_for(category, source)),
         crypto.enc(evidence[:1000]) if keep_words else None, now, now, now))
    issue_id = cur.lastrowid
    _raise_alert(conn, user["id"], category, now)
    return issue_id, True


def _raise_alert(conn, user_id, category, now):
    """A new high-severity issue is something to act on today."""
    spec = categories()[category]
    if spec["severity"] != "high":
        return
    reason = "threat_reported" if category in SAFETY else "case_issue"
    message = f"{spec['title']} - see Case Issues for the legal steps"
    open_alert = conn.execute("SELECT id FROM alerts WHERE user_id = ? AND reason = ? AND status != 'resolved'",
                              (user_id, reason)).fetchone()
    if open_alert is not None:
        conn.execute("UPDATE alerts SET message = ?, created_at = ? WHERE id = ?", (message, now, open_alert["id"]))
        return
    conn.execute("INSERT INTO alerts (user_id, created_at, level, reason, message) VALUES (?, ?, 'high', ?, ?)",
                 (user_id, now, reason, message))


def record_many(user, categories_found, source, *, evidence=None, now=None):
    """Convenience for the chat/voice pipeline. Publishes one event per new issue."""
    if not categories_found:
        return []
    out = []
    with db.connect() as conn:
        counsellor = _counsellor_of(conn, user["id"])
        for cat in dict.fromkeys(categories_found):
            issue_id, created = record(conn, user, cat, source, evidence=evidence, now=now)
            out.append({"id": issue_id, "category": cat, "created": created})
    for item in out:
        events.publish(counsellor, "issue", victim_id=user["id"], issue_id=item["id"],
                       category=item["category"], created=item["created"])
        if item["created"] and categories()[item["category"]]["severity"] == "high":
            events.publish(counsellor, "alert", victim_id=user["id"], category=item["category"])
    return out


def open_pressure(conn, user_id):
    """Open high-severity issues, for the case_pressure part of the score."""
    return conn.execute(
        f"SELECT COUNT(*) FROM case_issues WHERE user_id = ? AND severity = 'high' "
        f"AND status IN ({','.join('?' * len(ACTIVE))})", (user_id, *ACTIVE)).fetchone()[0]


# ---------------------------------------------------------------- views

def view(conn, row, *, for_counsellor=True, lang="en"):
    spec = categories().get(row["category"], categories()["other"])
    out = {"id": row["id"], "category": row["category"], "severity": row["severity"],
           "status": row["status"], "source": row["source"], "occurrences": row["occurrences"],
           "created_at": db.iso(row["created_at"]), "updated_at": db.iso(row["updated_at"]),
           "last_seen_at": db.iso(row["last_seen_at"])}
    if for_counsellor:
        out.update({"victim_id": row["user_id"], "title": spec["title"],
                    "summary": crypto.dec(row["summary_enc"]), "evidence": crypto.dec(row["evidence_enc"]),
                    "steps": spec["steps"],
                    "actions": [{"id": a["id"], "at": db.iso(a["created_at"]), "action": a["action"],
                                 "note": crypto.dec(a["note_enc"]),
                                 "by": _name(conn, a["by_id"])}
                                for a in conn.execute("SELECT * FROM issue_actions WHERE issue_id = ? "
                                                      "ORDER BY created_at", (row["id"],)).fetchall()]})
    else:
        # The person sees their own words for it and a plain status - nothing more.
        out["label"] = spec["victim_label"].get(lang) or spec["victim_label"]["en"]
    return out


def _name(conn, user_id):
    row = conn.execute("SELECT name_enc FROM users WHERE id = ?", (user_id,)).fetchone() if user_id else None
    return crypto.dec(row["name_enc"]) if row else None


def counsellor_issues(counsellor, status="active", victim_id=None):
    where, args = ["v.counsellor_id = ?"], [counsellor["id"]]
    if status == "active":
        where.append(f"i.status IN ({','.join('?' * len(ACTIVE))})")
        args += list(ACTIVE)
    elif status != "all":
        where.append("i.status = ?")
        args.append(status)
    if victim_id:
        where.append("i.user_id = ?")
        args.append(victim_id)
    with db.connect() as conn:
        rows = conn.execute("SELECT i.* FROM case_issues i JOIN users v ON v.id = i.user_id WHERE "
                            + " AND ".join(where), args).fetchall()
        out = []
        for r in rows:
            item = view(conn, r)
            item["victim_name"] = _name(conn, r["user_id"])
            out.append(item)
    rank = {"high": 0, "medium": 1}
    out.sort(key=lambda i: (i["status"] in ("resolved", "dismissed"), rank.get(i["severity"], 2),
                            -db.parse_iso(i["last_seen_at"])))
    return out


class IssueNotFound(LookupError):
    pass


def _owned(conn, counsellor, issue_id):
    row = conn.execute("SELECT i.* FROM case_issues i JOIN users v ON v.id = i.user_id "
                       "WHERE i.id = ? AND v.counsellor_id = ?", (issue_id, counsellor["id"])).fetchone()
    if row is None:
        raise IssueNotFound("No such issue for your clients")
    return row


def update(counsellor, issue_id, *, status=None, action=None, note=None, now=None):
    """Move an issue along and/or log a step taken. Every change is kept."""
    if status is not None and status not in STATUSES:
        raise ValueError(f"status must be one of {', '.join(STATUSES)}")
    now = now or db.now()
    with db.connect() as conn:
        row = _owned(conn, counsellor, issue_id)
        if action or note:
            conn.execute("INSERT INTO issue_actions (issue_id, created_at, by_id, action, note_enc) "
                         "VALUES (?, ?, ?, ?, ?)", (issue_id, now, counsellor["id"], action or "note",
                                                    crypto.enc(note) if note else None))
        if status is not None and status != row["status"]:
            conn.execute("INSERT INTO issue_actions (issue_id, created_at, by_id, action, note_enc) "
                         "VALUES (?, ?, ?, 'status', ?)", (issue_id, now, counsellor["id"], crypto.enc(status)))
            conn.execute("UPDATE case_issues SET status = ?, updated_at = ? WHERE id = ?", (status, now, issue_id))
        elif action and row["status"] == "open":
            # Doing something about it is what "in progress" means.
            conn.execute("UPDATE case_issues SET status = 'in_progress', updated_at = ? WHERE id = ?", (now, issue_id))
        else:
            conn.execute("UPDATE case_issues SET updated_at = ? WHERE id = ?", (now, issue_id))
        item = view(conn, conn.execute("SELECT * FROM case_issues WHERE id = ?", (issue_id,)).fetchone())
        victim_id = row["user_id"]
    events.publish(counsellor["id"], "issue", victim_id=victim_id, issue_id=issue_id, category=item["category"])
    events.publish(victim_id, "issue", issue_id=issue_id)
    return item


def log_by_counsellor(counsellor, victim_id, category, note=None):
    with db.connect() as conn:
        v = conn.execute("SELECT * FROM users WHERE id = ? AND role = 'victim' AND counsellor_id = ?",
                         (victim_id, counsellor["id"])).fetchone()
        if v is None:
            raise IssueNotFound("No such client assigned to you")
        user = {"id": v["id"], "consent": json.loads(v["consent"] or "{}")}
        issue_id, _ = record(conn, user, category, "counsellor")
        if note:
            conn.execute("INSERT INTO issue_actions (issue_id, created_at, by_id, action, note_enc) "
                         "VALUES (?, ?, ?, 'note', ?)", (issue_id, db.now(), counsellor["id"], crypto.enc(note)))
        item = view(conn, conn.execute("SELECT * FROM case_issues WHERE id = ?", (issue_id,)).fetchone())
    events.publish(counsellor["id"], "issue", victim_id=victim_id, issue_id=issue_id, category=category)
    return item


def victim_report(user, category, note=None):
    """The person reporting a problem themselves. Their note is sent on purpose,
    so it is kept as evidence regardless of the chat-storage consent."""
    if category not in categories():
        raise ValueError("Unknown category")
    now = db.now()
    with db.connect() as conn:
        counsellor = _counsellor_of(conn, user["id"])
        issue_id, created = record(conn, {**user, "consent": {**user["consent"], "store_messages": True}},
                                   category, "victim_report", evidence=note, now=now)
        item = view(conn, conn.execute("SELECT * FROM case_issues WHERE id = ?", (issue_id,)).fetchone(),
                    for_counsellor=False, lang=user.get("language") or "en")
    events.publish(counsellor, "issue", victim_id=user["id"], issue_id=issue_id, category=category,
                   created=created, reported=True)
    return item


def victim_issues(user):
    lang = user.get("language") or "en"
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM case_issues WHERE user_id = ? AND status != 'dismissed' "
                            "ORDER BY created_at DESC LIMIT 30", (user["id"],)).fetchall()
        return [view(conn, r, for_counsellor=False, lang=lang) for r in rows]


def categories_for_victim(lang="en"):
    return [{"category": k, "label": v["victim_label"].get(lang) or v["victim_label"]["en"],
             "severity": v["severity"]} for k, v in categories().items()]
