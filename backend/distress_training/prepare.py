"""Maps every dataset in distress_training/datasets/ onto one 4-level
distress scale and writes data/train.jsonl + data/valid.jsonl.

Known public datasets have hand-written label mappings below. Your own
data works too: put .jsonl/.csv files with a `text` column and a `level`
column (0-3) in any folder under datasets/.
"""

import csv
import hashlib
import json
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
DATASETS_DIR = HERE / "datasets"
DATA_DIR = HERE / "data"
LEVELS = ["none", "low", "moderate", "high"]

# GoEmotions label ids (simplified config)
GOEMO_DISTRESS = {9, 12, 14, 16, 19, 24, 25}   # disappointment, embarrassment, fear, grief, nervousness, remorse, sadness
GOEMO_CALM = {0, 1, 4, 5, 7, 8, 13, 15, 17, 18, 20, 21, 22, 23, 26, 27}  # positive, curious, neutral


def load_config():
    with open(HERE / "config.yaml") as f:
        return yaml.safe_load(f)


def cssrs(r):
    sev = int(r["severity"])     # C-SSRS 0 no risk, 1 wish to be dead, 2+ active ideation/plan/behaviour
    return r["content"], 0 if sev == 0 else 2 if sev == 1 else 3


def suicide_binary(r):
    return r["text"], 3 if r["class"] == "suicide" else 0


def depression(r):
    return r["clean_text"], 2 if str(r["is_depression"]) == "1" else 0


def goemotions(r):
    labels = r["labels"] if isinstance(r["labels"], list) else json.loads(r["labels"])
    labels = {int(x) for x in labels}
    if labels & GOEMO_DISTRESS:
        return r["text"], 1
    if labels <= GOEMO_CALM:
        return r["text"], 0
    return None                  # anger/confusion etc. alone: not clearly distress or calm


def mindbridge(r):
    user = next(m["content"] for m in r["messages"] if m["role"] == "user")
    answer = user.split("Patient response", 1)[-1].split(":", 1)[-1].strip()
    call = next(m for m in r["messages"] if m.get("tool_calls"))["tool_calls"][0]["function"]["arguments"]
    args = json.loads(call) if isinstance(call, str) else call
    score = int(args["score"])
    meta = r["metadata"]
    if meta["scale"] == "phq9" and int(meta["item_num"]) == 9:   # thoughts of self-harm
        return answer, 3 if score >= 1 else 0
    return answer, min(score, 2)


def generic(r):
    r = {str(k).lower(): v for k, v in r.items()}
    if "text" in r and "level" in r and str(r["level"]).strip() in {"0", "1", "2", "3"}:
        return r["text"], int(str(r["level"]).strip())
    return None


ADAPTERS = {
    "av9ash__CSSR-S_labelled_suicidewatch_posts_reddit": cssrs,
    "Ram07__Detection-for-Suicide": suicide_binary,
    "hugginglearners__reddit-depression-cleaned": depression,
    "google-research-datasets__go_emotions": goemotions,
    "Huzayfah-Patel__mindbridge-phq9-hindi-dialogues": mindbridge,
}


def load_records(path):
    if path.suffix == ".jsonl":
        with path.open(encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    yield json.loads(line)
    elif path.suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        yield from (data if isinstance(data, list) else data.get("data", []))
    elif path.suffix == ".csv":
        csv.field_size_limit(sys.maxsize)
        with path.open(encoding="utf-8", newline="") as f:
            yield from csv.DictReader(f)


def clean(text):
    return re.sub(r"\s+", " ", str(text or "")).strip()


def run(cfg=None):
    cfg = cfg or load_config()
    d = cfg["data"]
    rng = random.Random(cfg["training"]["seed"])

    groups = defaultdict(list)      # (source, level) -> texts
    seen = set()
    for folder in sorted(p for p in DATASETS_DIR.iterdir() if p.is_dir()):
        adapter = ADAPTERS.get(folder.name, generic)
        n = 0
        for path in sorted(folder.rglob("*")):
            if path.suffix not in {".jsonl", ".json", ".csv"}:
                continue
            for rec in load_records(path):
                try:
                    out = adapter(rec)
                except (KeyError, ValueError, TypeError, StopIteration, IndexError):
                    out = None
                if not out:
                    continue
                text, level = clean(out[0]), out[1]
                if not d["min_chars"] <= len(text) <= d["max_chars"]:
                    continue
                key = hashlib.sha1(text.lower().encode()).hexdigest()
                if key in seen:
                    continue
                seen.add(key)
                groups[(folder.name, level)].append(text)
                n += 1
        if n == 0:
            print(f"  ! {folder.name}: nothing usable (own data needs `text` + `level` 0-3 columns)")

    if not groups:
        sys.exit("No data. Run `./train_distress.sh fetch` or add files to distress_training/datasets/.")

    train, valid = [], []
    table = defaultdict(lambda: [0, 0, 0, 0])
    for (source, level), texts in sorted(groups.items()):
        rng.shuffle(texts)
        texts = texts[: d["max_per_source_level"]]
        n_valid = max(1, int(len(texts) * d["valid_fraction"]))
        rows = [{"text": t, "level": level, "source": source} for t in texts]
        valid += rows[:n_valid]
        train += rows[n_valid:]
        table[source][level] = len(texts)
    rng.shuffle(train)

    print(f"\n  {'source':52s} " + " ".join(f"{l:>9s}" for l in LEVELS))
    for source, counts in sorted(table.items()):
        print(f"  {source:52s} " + " ".join(f"{c:9d}" for c in counts))
    totals = Counter(r["level"] for r in train + valid)
    print(f"  {'TOTAL':52s} " + " ".join(f"{totals[i]:9d}" for i in range(4)))

    DATA_DIR.mkdir(exist_ok=True)
    for name, rows in (("train", train), ("valid", valid)):
        with (DATA_DIR / f"{name}.jsonl").open("w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"\n  Wrote {len(train)} training and {len(valid)} validation examples.")
    return len(train), len(valid)


if __name__ == "__main__":
    run()
