"""Admin commands for the monitoring backend.

  ./venv/bin/python manage.py create-counsellor "Dr. Ananya Sharma"
  ./venv/bin/python manage.py seed-demo        # demo counsellor + 4 synthetic victims, 30 days of history
  ./venv/bin/python manage.py recompute-all    # rescore every victim now

Tokens are printed once - they are stored only as hashes.
"""

import argparse
import random

from monitoring import auth, db, service

DAY = service.DAY


def spread(total, n, top):
    base, extra = divmod(total, n)
    return [min(base + (1 if i < extra else 0), top) for i in range(n)]


def phq9(total, self_harm=0):
    return spread(total - self_harm, 8, 3) + [self_harm]


def seed_demo():
    """Synthetic, clearly-labelled demo data so the counsellor dashboard can be built and shown."""
    rng = random.Random(7)
    now = db.now()
    counsellor = service.create_counsellor("Demo Counsellor")
    stories = [
        # name, phq9 by days-ago, gad7 by days-ago, pc-ptsd-5, chat distress (start, end), events, self-harm
        ("Demo - Asha (synthetic)", {28: 17, 14: 11, 1: 6}, {28: 14, 14: 9, 1: 5}, {14: 4, 1: 2}, (65, 20), [], 0),
        ("Demo - Meena (synthetic)", {28: 7, 14: 10, 1: 16}, {28: 6, 14: 9, 1: 15}, {14: 3}, (25, 72),
         [(2, "hearing", "District sessions court hearing"), (20, "compensation", "Second compensation instalment")], 0),
        ("Demo - Ravi (synthetic)", {28: 12}, {28: 10}, {28: 3}, (45, 50), [(9, "hearing", "Witness statement")], 0),
        ("Demo - Kiran (synthetic)", {16: 13, 2: 19}, {16: 11, 2: 16}, {2: 5}, (50, 88), [], 1),
    ]
    tokens = []
    for name, phq, gad, ptsd, (chat_start, chat_end), events, self_harm in stories:
        victim = service.register_victim(name, "hi" if "Meena" in name else "en", case_ref=f"DEMO-{rng.randint(1000, 9999)}",
                                         consent={"data_storage": True, "voice_analysis": True, "store_messages": False},
                                         created_at=now - 32 * DAY)
        user = auth.user_for_token(victim["token"])
        last_active_day = 13 if "Ravi" in name else 0
        with db.connect() as conn:
            for day, total in phq.items():
                service._insert_questionnaire(conn, user["id"], "phq9",
                                              phq9(total, self_harm if day == min(phq) else 0), "app", now - day * DAY)
            for day, total in gad.items():
                service._insert_questionnaire(conn, user["id"], "gad7", spread(total, 7, 3), "app", now - day * DAY)
            for day, total in ptsd.items():
                service._insert_questionnaire(conn, user["id"], "pcptsd5", [1] * total + [0] * (5 - total), "app",
                                              now - day * DAY)
            for day in range(30, last_active_day - 1, -1):
                if rng.random() < 0.55:
                    frac = (30 - day) / 30
                    score = chat_start + (chat_end - chat_start) * frac + rng.uniform(-8, 8)
                    service._insert_observation(conn, user["id"], now - day * DAY + rng.uniform(0, 3600 * 12),
                                                "chat", "text_distress", max(0, min(100, score)))
                if day % 4 == 0:
                    frac = (30 - day) / 30
                    sad = 20 + 50 * frac if chat_end > chat_start else 60 - 45 * frac
                    service._insert_observation(conn, user["id"], now - day * DAY, "voice", "voice_distress",
                                                sad + rng.uniform(-5, 5))
                    service._insert_observation(conn, user["id"], now - day * DAY, "voice", "voice_arousal",
                                                rng.uniform(0.25, 0.55))
            if self_harm:
                service._insert_observation(conn, user["id"], now - 1 * DAY, "chat", "crisis", 1)
        for day in range(30, -1, -1):
            service.recompute(user["id"], now - day * DAY + 3600 * 20)
        for offset, kind, title in events:
            service.add_event(counsellor | {"id": counsellor["user_id"]}, user["id"], kind,
                              service._today(now + offset * DAY).isoformat(), title)
        with db.connect() as conn:      # alerts from weeks ago were handled already
            conn.execute("UPDATE alerts SET status = 'resolved', handled_by = ?, handled_at = ? "
                         "WHERE user_id = ? AND created_at < ?", (counsellor["user_id"], now, user["id"], now - 5 * DAY))
        tokens.append((name, victim["token"]))

    print("Seeded synthetic demo data.\n")
    print(f"Counsellor token (Demo Counsellor):\n  {counsellor['token']}\n")
    print("Victim tokens:")
    for name, token in tokens:
        print(f"  {name}: {token}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="command", required=True)
    c = sub.add_parser("create-counsellor")
    c.add_argument("name")
    sub.add_parser("seed-demo")
    sub.add_parser("recompute-all")
    args = ap.parse_args()

    db.init()
    if args.command == "create-counsellor":
        result = service.create_counsellor(args.name)
        print(f"Counsellor {args.name} created. Token (shown once):\n  {result['token']}")
    elif args.command == "seed-demo":
        seed_demo()
    elif args.command == "recompute-all":
        print(f"Rescored {service.recompute_all()} victims.")


if __name__ == "__main__":
    main()
