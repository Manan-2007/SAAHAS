"""Dynamic Distress Score: one 0-100 number per victim from four signals,
plus trend and alert rules.

  questionnaires  latest PHQ-9 / GAD-7 / PC-PTSD-5 / PHQ-4 (last 21 days),
                  mapped onto 0-100 via each instrument's clinical bands
  text            distress model scores of chat messages / voice transcripts (last 7 days)
  voice           negative affect in voice check-ins (last 7 days)
  engagement      going quiet: days since last contact, overdue questionnaires

Missing signals are left out and the weights renormalized; `confidence` is
the share of weight that was available. Any crisis signal in the last 72 h
(PHQ-9 item 9, a chat/voice message flagged as high-risk) raises the score
to at least 80 and flags `crisis`.

These weights and cut-offs are a transparent starting point, not a clinically
validated model. With pilot data, fit them to predict the next PHQ-9/PC-PTSD-5
result and counsellor-confirmed crises.
"""

import json

import numpy as np

DAY = 86400.0

WEIGHTS = {"questionnaires": 0.45, "text": 0.25, "voice": 0.15, "engagement": 0.15}
TIERS = [(75, "high"), (50, "elevated"), (25, "watch"), (0, "stable")]
TIER_RANK = {"stable": 0, "watch": 1, "elevated": 2, "high": 3}

QUESTIONNAIRE_WINDOW_DAYS = 21
SIGNAL_WINDOW_DAYS = 7
CRISIS_WINDOW_HOURS = 72
CRISIS_FLOOR = 80
RISING_POINTS = 15            # 7-day rise that raises a "rising" alert
TREND_POINTS = 10             # 7-day change that counts as rising/falling
NEW_ACCOUNT_GRACE_DAYS = 3    # no engagement penalty right after signing up

# questionnaire total -> 0-100 severity points, anchored on clinical bands
ANCHORS = {
    "phq9": ([0, 5, 10, 15, 20, 27], [0, 25, 50, 70, 85, 100]),
    "gad7": ([0, 5, 10, 15, 21], [0, 25, 50, 75, 100]),
    "pcptsd5": ([0, 2, 3, 4, 5], [0, 35, 60, 75, 90]),
    "phq4": ([0, 3, 6, 9, 12], [0, 25, 50, 75, 100]),
}
INSTRUMENT_WEIGHT = {"phq9": 1.0, "gad7": 1.0, "pcptsd5": 1.0, "phq4": 0.6}
FULL_INSTRUMENTS = ("phq9", "gad7", "pcptsd5")


def tier_for(score):
    return next(name for cut, name in TIERS if score >= cut)


def _decayed_mean(rows, now, half_life_days):
    num = den = 0.0
    for created_at, value in rows:
        w = 0.5 ** ((now - created_at) / DAY / half_life_days)
        num += w * value
        den += w
    return num / den if den else None


def compute(conn, user_id, now):
    user = conn.execute("SELECT created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    if user is None:
        return None
    components, details = {}, {}

    rows = conn.execute(
        "SELECT instrument, total, created_at FROM questionnaires "
        "WHERE user_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC",
        (user_id, now - QUESTIONNAIRE_WINDOW_DAYS * DAY, now)).fetchall()
    latest = {}
    for r in rows:
        latest.setdefault(r["instrument"], r)
    if latest:
        num = den = 0.0
        parts = {}
        for inst, r in latest.items():
            points = float(np.interp(r["total"], *ANCHORS[inst]))
            age = (now - r["created_at"]) / DAY
            w = INSTRUMENT_WEIGHT[inst] * 0.5 ** (age / 14)
            num += w * points
            den += w
            parts[inst] = {"total": r["total"], "points": round(points, 1), "age_days": round(age, 1)}
        components["questionnaires"] = num / den
        details["questionnaires"] = parts

    for component, metric in (("text", "text_distress"), ("voice", "voice_distress")):
        obs = conn.execute(
            "SELECT created_at, value FROM observations "
            "WHERE user_id = ? AND metric = ? AND created_at >= ? AND created_at <= ?",
            (user_id, metric, now - SIGNAL_WINDOW_DAYS * DAY, now)).fetchall()
        if obs:
            components[component] = _decayed_mean([(o["created_at"], o["value"]) for o in obs], now, 3)
            details[component] = {"observations": len(obs)}

    last_contact = conn.execute(
        "SELECT MAX(t) FROM (SELECT MAX(created_at) AS t FROM observations WHERE user_id = ? AND created_at <= ? "
        "UNION ALL SELECT MAX(created_at) FROM questionnaires WHERE user_id = ? AND created_at <= ?)",
        (user_id, now, user_id, now)).fetchone()[0]
    if (now - user["created_at"]) / DAY >= NEW_ACCOUNT_GRACE_DAYS:
        quiet_days = (now - (last_contact or user["created_at"])) / DAY
        engagement = float(np.clip((quiet_days - 3) / 11, 0, 1)) * 100
        if not any(inst in latest for inst in FULL_INSTRUMENTS):
            engagement = min(100.0, engagement + 20)
        components["engagement"] = engagement
        details["engagement"] = {"days_since_last_contact": round(quiet_days, 1)}

    if not components:
        return None

    available = sum(WEIGHTS[k] for k in components)
    score = sum(WEIGHTS[k] * v for k, v in components.items()) / available
    if set(components) == {"engagement"}:
        # Silence alone is a reason to reach out, not evidence of high distress
        score = min(score, 49.0)

    since = now - CRISIS_WINDOW_HOURS * 3600
    reasons, signal_times = [], []
    q_at = conn.execute("SELECT MAX(created_at) FROM questionnaires WHERE user_id = ? AND created_at BETWEEN ? AND ? "
                        "AND flags LIKE '%self_harm_thoughts%'", (user_id, since, now)).fetchone()[0]
    if q_at:
        reasons.append("PHQ-9: thoughts of being better off dead or self-harm")
        signal_times.append(q_at)
    for r in conn.execute("SELECT source, MAX(created_at) AS t FROM observations WHERE user_id = ? "
                          "AND metric = 'crisis' AND created_at BETWEEN ? AND ? GROUP BY source",
                          (user_id, since, now)).fetchall():
        reasons.append(f"{r['source']} message flagged as high risk")
        signal_times.append(r["t"])
    if reasons:
        score = max(score, CRISIS_FLOOR)

    return {
        "score": round(score, 1),
        "tier": tier_for(score),
        "crisis": bool(reasons),
        "crisis_reasons": reasons,
        "crisis_signal_at": max(signal_times) if signal_times else None,
        "confidence": round(available / sum(WEIGHTS.values()), 2),
        "components": {k: round(v, 1) for k, v in components.items()},
        "details": details,
    }


def trend(conn, user_id, now):
    rows = conn.execute("SELECT created_at, score FROM scores WHERE user_id = ? AND created_at BETWEEN ? AND ? "
                        "ORDER BY created_at", (user_id, now - 30 * DAY, now)).fetchall()
    if len(rows) < 2:
        return {"direction": "not_enough_data", "change_7d": None, "slope_per_week": None, "points": len(rows)}
    current = rows[-1]["score"]
    older = [r for r in rows if r["created_at"] <= now - 7 * DAY]
    reference = older[-1]["score"] if older else rows[0]["score"]
    change = round(current - reference, 1)
    t = np.array([r["created_at"] for r in rows]) / DAY
    slope = None
    if len(rows) >= 3 and t[-1] - t[0] >= 1:
        slope = round(float(np.polyfit(t, [r["score"] for r in rows], 1)[0]) * 7, 1)
    direction = "rising" if change >= TREND_POINTS else "falling" if change <= -TREND_POINTS else "steady"
    return {"direction": direction, "change_7d": change, "slope_per_week": slope, "points": len(rows)}


def evaluate_alerts(conn, user_id, result, trend_info, upcoming, now):
    """Raises alerts for the rules below. One open alert per reason: while it
    is open nothing new is added, and after a counsellor resolves it the same
    reason stays quiet for its cool-down. Crisis alerts are the exception:
    they follow the signal - a new crisis message re-raises (or refreshes)
    the alert, the same old signal never does."""
    created = []

    def raise_alert(level, reason, message, cooldown_hours):
        if conn.execute("SELECT 1 FROM alerts WHERE user_id = ? AND reason = ? AND status != 'resolved'",
                        (user_id, reason)).fetchone():
            return
        if conn.execute("SELECT 1 FROM alerts WHERE user_id = ? AND reason = ? AND status = 'resolved' "
                        "AND handled_at >= ?", (user_id, reason, now - cooldown_hours * 3600)).fetchone():
            return
        cur = conn.execute("INSERT INTO alerts (user_id, created_at, level, reason, message) VALUES (?, ?, ?, ?, ?)",
                           (user_id, now, level, reason, message))
        created.append({"id": cur.lastrowid, "level": level, "reason": reason, "message": message})

    tier = result["tier"]
    if result["crisis"]:
        message = "; ".join(result["crisis_reasons"])
        last = conn.execute("SELECT id, created_at, status FROM alerts WHERE user_id = ? AND reason = 'crisis_signal' "
                            "ORDER BY created_at DESC LIMIT 1", (user_id,)).fetchone()
        if last is None or result["crisis_signal_at"] > last["created_at"]:
            if last is not None and last["status"] != "resolved":
                conn.execute("UPDATE alerts SET message = ?, created_at = ? WHERE id = ?", (message, now, last["id"]))
            else:
                cur = conn.execute("INSERT INTO alerts (user_id, created_at, level, reason, message) "
                                   "VALUES (?, ?, 'crisis', 'crisis_signal', ?)", (user_id, now, message))
                created.append({"id": cur.lastrowid, "level": "crisis", "reason": "crisis_signal", "message": message})
    elif tier == "high":
        raise_alert("high", "high_distress", f"Distress score {result['score']} (high)", 24)

    change = trend_info.get("change_7d")
    if change is not None and change >= RISING_POINTS and tier != "stable":
        raise_alert("watch", "rising_distress", f"Distress score up {change} points in 7 days", 72)

    if result["components"].get("engagement", 0) >= 70 and TIER_RANK[tier] >= TIER_RANK["watch"]:
        days = result["details"]["engagement"]["days_since_last_contact"]
        raise_alert("watch", "gone_quiet", f"No contact for {days:.0f} days while distress was {tier}", 72)

    soon = [e for e in upcoming if e["days_until"] <= 3]
    if soon and TIER_RANK[tier] >= TIER_RANK["elevated"]:
        e = soon[0]
        raise_alert("watch", "upcoming_event",
                    f"{e['kind'].title()} in {e['days_until']} day(s) while distress is {tier}", 72)

    return created


def dumps_components(result):
    return json.dumps({k: result[k] for k in ("components", "details", "crisis_reasons")})
