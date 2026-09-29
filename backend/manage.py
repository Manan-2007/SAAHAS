"""Admin commands for the monitoring backend.

  ./venv/bin/python manage.py create-counsellor "Dr. Ananya Sharma"
  ./venv/bin/python manage.py create-counsellor "Dr. Ananya Sharma" --username ananya --phone 9876500000 --hours "Mon-Sat 10am-6pm"
  ./venv/bin/python manage.py set-password --user-id <id>   # reset a lost password
  ./venv/bin/python manage.py sign-out --user-id <id>       # revoke every session
  ./venv/bin/python manage.py storage-status   # which recordings bucket is configured
  ./venv/bin/python manage.py purge-demo       # delete leftover seed-demo data (backs up the database first)
  ./venv/bin/python manage.py list-counsellors
  ./venv/bin/python manage.py recompute-all    # rescore every victim now

Tokens are printed once - they are stored only as hashes. Passwords are
prompted for rather than passed as arguments, so they stay out of the shell
history and the process list.
"""

import argparse
import getpass
import shutil
import time

from monitoring import auth, crypto, db, service, storage

DAY = service.DAY


def ask_password(prompt="Password: "):
    password = getpass.getpass(prompt)
    if password != getpass.getpass("Repeat: "):
        raise SystemExit("Passwords did not match.")
    try:
        auth.check_password_strength(password)
    except auth.AuthError as exc:
        raise SystemExit(str(exc))
    return password


def set_password(user_id=None, username=None):
    """Admin reset: no current password needed, and every session is revoked."""
    with db.connect() as conn:
        if user_id is None:
            row = conn.execute("SELECT user_id FROM credentials WHERE username_index = ?",
                               (auth.username_index(username),)).fetchone()
            if row is None:
                raise SystemExit(f"No account with username {username!r}.")
            user_id = row["user_id"]
        elif conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone() is None:
            raise SystemExit(f"No account with id {user_id!r}.")

        existing = auth.credentials_of(conn, user_id)
        if existing is None and not username:
            raise SystemExit("This account has no username yet - pass --username to create one.")
        name = username or existing["username"]
        password = ask_password(f"New password for {name}: ")
        auth.set_credentials(conn, user_id, name, password)
        revoked = auth.revoke_all_sessions(conn, user_id)
    print(f"Password set for {name}. {revoked} active session(s) signed out.")


def backup_db():
    """A copy of the database before anything is deleted, so it can be undone."""
    target = db.DATA_DIR / "backups"
    target.mkdir(parents=True, exist_ok=True)
    path = target / f"sahaas-{time.strftime('%Y%m%d-%H%M%S')}.db"
    with db.connect() as conn:
        conn.execute("PRAGMA wal_checkpoint(FULL)")
    shutil.copy2(db.DB_PATH, path)
    return path


def list_counsellors():
    with db.connect() as conn:
        rows = conn.execute("SELECT c.id, c.name_enc, (SELECT COUNT(*) FROM users v WHERE v.counsellor_id = c.id) AS n, "
                            "(SELECT 1 FROM credentials WHERE user_id = c.id) AS pw FROM users c "
                            "WHERE c.role = 'counsellor'").fetchall()
        unassigned = conn.execute("SELECT COUNT(*) FROM users WHERE role = 'victim' AND counsellor_id IS NULL").fetchone()[0]
    for r in rows:
        print(f"  {crypto.dec(r['name_enc'])}  id={r['id']}  clients={r['n']}  password={'yes' if r['pw'] else 'no'}")
    if not rows:
        print("  (no counsellors yet)")
    print(f"Unassigned victims: {unassigned}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="command", required=True)
    c = sub.add_parser("create-counsellor")
    c.add_argument("name")
    c.add_argument("--username", help="also set up password sign-in for this counsellor")
    c.add_argument("--phone", help="a work number victims can see and call")
    c.add_argument("--hours", help='when they can be reached, e.g. "Mon-Sat 10am-6pm"')
    pw = sub.add_parser("set-password", help="reset a password without knowing the old one")
    pw.add_argument("--user-id")
    pw.add_argument("--username")
    so = sub.add_parser("sign-out", help="revoke every session token on an account")
    so.add_argument("--user-id", required=True)
    sub.add_parser("storage-status")
    sub.add_parser("purge-demo", help="delete leftover seed-demo accounts (database backed up first)")
    sub.add_parser("list-counsellors")
    sub.add_parser("recompute-all")
    args = ap.parse_args()

    db.init()
    if args.command == "create-counsellor":
        password = ask_password(f"Password for {args.username}: ") if args.username else None
        result = service.create_counsellor(args.name, args.username, password, args.phone, args.hours)
        print(f"Counsellor {args.name} created. Token (shown once):\n  {result['token']}")
        if result["adopted"]:
            print(f"Took over {result['adopted']} victim(s) who had no counsellor.")
        if result["username"]:
            print(f"Sign in with username {result['username']!r} at POST /auth/login.")
    elif args.command == "set-password":
        if not args.user_id and not args.username:
            raise SystemExit("Pass --user-id or --username.")
        set_password(args.user_id, args.username)
    elif args.command == "sign-out":
        with db.connect() as conn:
            print(f"Revoked {auth.revoke_all_sessions(conn, args.user_id)} session(s).")
    elif args.command == "storage-status":
        print(f"Recordings bucket: {storage.status()}")
    elif args.command == "purge-demo":
        print(f"Backed up the database to {backup_db()}")
        result = service.purge_demo()
        print(f"Removed {result['victims']} demo victim(s), {result['counsellors']} demo counsellor(s) and "
              f"{result['recordings']} recording(s).")
        if result["unassigned_victims"]:
            print(f"{result['unassigned_victims']} real victim(s) now have no counsellor - "
                  "create one with create-counsellor and they are assigned automatically.")
    elif args.command == "list-counsellors":
        list_counsellors()
    elif args.command == "recompute-all":
        print(f"Rescored {service.recompute_all()} victims.")


if __name__ == "__main__":
    main()
