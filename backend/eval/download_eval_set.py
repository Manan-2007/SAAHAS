"""Download the evaluation sets: CREMA-D (acted) and MELD (natural).

CREMA-D: 7,442 clips, 91 actors, crowd-rated acted emotions
(https://github.com/CheyneyComputerScience/CREMA-D). Filenames encode the
label: {actor}_{sentence}_{EMO}_{level}.wav with EMO in
ANG, DIS, FEA, HAP, NEU, SAD (no surprised / calm).

MELD: utterances from the Friends TV series - spontaneous conversational
speech with room noise and laugh tracks, i.e. the domain live mic audio
actually lives in. Pulled from the AudioLLMs/meld_emotion_test mirror
(test split only, never used for training) via the HF datasets-server API.
Covers all 7 base emotions including surprise.

Samples are deterministic (seeded) and balanced per emotion. Re-running
skips files that already exist.
"""

import json
import random
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

DATA_ROOT = Path(__file__).resolve().parent / "data"
SEED = 42

# ---------------- CREMA-D ----------------

CREMA_TREE_URL = "https://api.github.com/repos/CheyneyComputerScience/CREMA-D/git/trees/387d831b"
CREMA_MEDIA_URL = "https://media.githubusercontent.com/media/CheyneyComputerScience/CREMA-D/master/AudioWAV/{name}"
CREMA_PER_EMOTION = 20
CREMA_DIR = DATA_ROOT / "crema_d"

# CREMA-D code -> project label
CREMA_LABELS = {"ANG": "angry", "DIS": "disgust", "FEA": "fearful",
                "HAP": "happy", "NEU": "neutral", "SAD": "sad"}

# ---------------- MELD ----------------

MELD_DATASET = "AudioLLMs/meld_emotion_test"
MELD_ROWS_URL = ("https://datasets-server.huggingface.co/rows"
                 f"?dataset={MELD_DATASET.replace('/', '%2F')}&config=default&split=test")
MELD_TOTAL = 2610
MELD_PER_EMOTION = 20
MELD_DIR = DATA_ROOT / "meld"

# emotion keywords in the mirror's free-text answers -> project label
# (longest first so "sadness" wins over "sad", etc.)
MELD_KEYWORDS = [
    ("disgusted", "disgust"), ("disgust", "disgust"),
    ("surprised", "surprised"), ("surprise", "surprised"),
    ("fearful", "fearful"), ("fear", "fearful"),
    ("sadness", "sad"), ("sad", "sad"),
    ("anger", "angry"), ("angry", "angry"),
    ("joyful", "happy"), ("joy", "happy"), ("happy", "happy"),
    ("neutral", "neutral"),
]


def get_json(url, retries=6):
    req = urllib.request.Request(url, headers={"User-Agent": "voice-emotion-eval/1.0"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            if attempt == retries - 1:
                raise
            if e.code == 429:   # rate limited: honor Retry-After or back off hard
                wait = int(e.headers.get("Retry-After") or 0) or 15 * (attempt + 1)
                time.sleep(min(wait, 120))
            else:
                time.sleep(2.0 * (attempt + 1))
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(2.0 * (attempt + 1))


def parse_meld_label(answer):
    """Extract the emotion from the mirror's free-text answer; None if ambiguous."""
    text = answer.lower()
    found = {label for kw, label in MELD_KEYWORDS if kw in text}
    return found.pop() if len(found) == 1 else None


def download_crema():
    CREMA_DIR.mkdir(parents=True, exist_ok=True)
    print("CREMA-D: fetching file listing...")
    tree = get_json(CREMA_TREE_URL)["tree"]
    files = [t["path"] for t in tree if t["path"].endswith(".wav")]

    rng = random.Random(SEED)
    by_emotion = defaultdict(list)
    for name in files:
        emo = name.split("_")[2]
        if emo in CREMA_LABELS:
            by_emotion[emo].append(name)

    sample = []
    for emo, names in sorted(by_emotion.items()):
        rng.shuffle(names)
        seen_actors, chosen = set(), []
        for name in names:                      # pass 1: unique actors
            actor = name.split("_")[0]
            if actor not in seen_actors:
                seen_actors.add(actor)
                chosen.append(name)
                if len(chosen) == CREMA_PER_EMOTION:
                    break
        for name in names:                      # pass 2: top up if needed
            if len(chosen) == CREMA_PER_EMOTION:
                break
            if name not in chosen:
                chosen.append(name)
        sample.extend(chosen)

    downloaded = skipped = 0
    for i, name in enumerate(sample, 1):
        dest = CREMA_DIR / name
        if dest.exists() and dest.stat().st_size > 1000:
            skipped += 1
            continue
        urllib.request.urlretrieve(CREMA_MEDIA_URL.format(name=name), dest)
        downloaded += 1
        if i % 20 == 0:
            print(f"  {i}/{len(sample)}")
    print(f"CREMA-D done: {downloaded} downloaded, {skipped} already present.")


def download_meld():
    MELD_DIR.mkdir(parents=True, exist_ok=True)
    existing = {int(p.name.split("_")[1]) for p in MELD_DIR.glob("meld_*.wav")}

    print("MELD: scanning test-split labels (metadata only)...")
    by_label = defaultdict(list)
    for offset in range(0, MELD_TOTAL, 100):
        rows = get_json(f"{MELD_ROWS_URL}&offset={offset}&length=100")["rows"]
        for r in rows:
            label = parse_meld_label(r["row"].get("answer", ""))
            if label:
                by_label[label].append(r["row_idx"])
        time.sleep(0.7)   # stay under the datasets-server rate limit
    print("  label counts:", {k: len(v) for k, v in sorted(by_label.items())})

    rng = random.Random(SEED)
    chosen = []
    for label, indices in sorted(by_label.items()):
        rng.shuffle(indices)
        chosen.extend((idx, label) for idx in indices[:MELD_PER_EMOTION])

    # Group by 100-row page: one API call per page instead of one per clip
    # (signed audio URLs expire, so pages are re-fetched fresh here)
    by_page = defaultdict(list)
    skipped = 0
    for idx, label in chosen:
        dest = MELD_DIR / f"meld_{idx:04d}_{label}.wav"
        if idx in existing or (dest.exists() and dest.stat().st_size > 1000):
            skipped += 1
            continue
        by_page[idx // 100].append((idx, label))

    downloaded = 0
    total = sum(len(v) for v in by_page.values())
    for page in sorted(by_page):
        rows = get_json(f"{MELD_ROWS_URL}&offset={page * 100}&length=100")["rows"]
        by_idx = {r["row_idx"]: r["row"] for r in rows}
        for idx, label in by_page[page]:
            src = by_idx[idx]["context"][0]["src"]
            urllib.request.urlretrieve(src, MELD_DIR / f"meld_{idx:04d}_{label}.wav")
            downloaded += 1
            time.sleep(0.3)
        print(f"  {downloaded}/{total}")
        time.sleep(0.7)
    print(f"MELD done: {downloaded} downloaded, {skipped} already present.")


# ---------------- CREMA-D per-actor sessions ----------------
# For measuring per-speaker adaptation: a few actors with MANY clips each
# (a simulated "session" = one speaker's clips streamed in sequence).

SESSION_ACTORS = 4
SESSION_PER_EMOTION = 4   # clips per emotion per actor -> 24 clips/actor
SESSION_DIR = DATA_ROOT / "sessions"


def download_sessions():
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    print("Sessions: fetching CREMA-D listing...")
    tree = get_json(CREMA_TREE_URL)["tree"]
    files = [t["path"] for t in tree if t["path"].endswith(".wav")]

    by_actor = defaultdict(lambda: defaultdict(list))
    for name in files:
        actor, _, emo, _ = name.split("_")
        if emo in CREMA_LABELS:
            by_actor[actor][emo].append(name)

    # actors with enough clips in every emotion, deterministic pick
    eligible = sorted(a for a, emos in by_actor.items()
                      if all(len(emos[e]) >= SESSION_PER_EMOTION for e in CREMA_LABELS))
    rng = random.Random(SEED)
    actors = rng.sample(eligible, SESSION_ACTORS)
    print(f"  actors: {actors}")

    downloaded = skipped = 0
    for actor in actors:
        actor_dir = SESSION_DIR / actor
        actor_dir.mkdir(exist_ok=True)
        chosen = []
        for emo in sorted(CREMA_LABELS):
            names = sorted(by_actor[actor][emo])
            rng.shuffle(names)
            chosen.extend(names[:SESSION_PER_EMOTION])
        for name in chosen:
            dest = actor_dir / name
            if dest.exists() and dest.stat().st_size > 1000:
                skipped += 1
                continue
            urllib.request.urlretrieve(CREMA_MEDIA_URL.format(name=name), dest)
            downloaded += 1
        print(f"  actor {actor}: {len(chosen)} clips")
    print(f"Sessions done: {downloaded} downloaded, {skipped} already present.")


def main():
    download_crema()
    download_meld()
    download_sessions()


if __name__ == "__main__":
    sys.exit(main())
