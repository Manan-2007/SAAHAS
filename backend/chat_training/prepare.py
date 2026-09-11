"""Turns every dataset dropped into chat_training/datasets/ into mlx-lm chat
training data (data/train.jsonl, data/valid.jsonl).

Formats are detected per record, so mixed sources can sit side by side:
  chat         {"messages": [{"role": "user"|"assistant", "content": ...}]}
  ShareGPT     {"conversations": [{"from": "human"|"gpt", "value": ...}]}
  dialog       {"dialog": [{"speaker": "usr"|"sys"|"seeker"|"supporter", "text": ...}]}
  pairs        instruction(+input)/output, prompt/response, input/output,
               question/answer, Context/Response, questionText/answerText
  tagged text  {"text": "<HUMAN>: ... <ASSISTANT>: ..."}
  row-per-turn conv_id + utterance_idx + utterance (EmpatheticDialogues CSV)
File types: .jsonl .json .csv .parquet (subfolders are fine).

Every multi-turn conversation is expanded into one example per supporter
reply, so all replies are learned (mlx-lm's mask_prompt only trains on the
final assistant turn of each example).
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

USER_ROLES = {"user", "human", "usr", "seeker", "client", "patient", "prompter", "questioner"}
ASSISTANT_ROLES = {"assistant", "gpt", "bot", "sys", "supporter", "therapist", "counselor",
                   "counsellor", "model", "chatbot", "listener"}

# (prompt key, reply key), checked in order; keys are matched case-insensitively
PAIR_KEYS = [
    ("instruction", "output"), ("instruction", "response"),
    ("prompt", "response"), ("prompt", "completion"), ("input", "output"),
    ("question", "answer"), ("context", "response"), ("questiontext", "answertext"),
    ("query", "response"),
]

TAG_RE = re.compile(
    r"(?:^|\s)<?\s*(?:###\s*)?(HUMAN|USER|CLIENT|PATIENT|ASSISTANT|THERAPIST|COUNSEL+OR|BOT)\s*>?\s*:",
    re.I)
USER_TAGS = {"human", "user", "client", "patient"}

# Replies containing these teach the model things it must not do in SAHAAS:
# point people to external links/phone numbers of random practices, or
# sound like a generic assistant.
URL_RE = re.compile(r"https?://|www\.", re.I)
CONTACT_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.\w+\b|\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
BOILERPLATE_RE = re.compile(r"as an ai (language )?model", re.I)

# Supporters in crowd-sourced chats talk about their own lives ("my wife and
# kids...", "that happened to me too"); a model trained on that learns to
# claim a human life it doesn't have.
PERSONAL_CLAIM_RE = re.compile(
    r"\bmy (wife|husband|kids|children|son|daughter|boyfriend|girlfriend|partner|mom|mum|dad|"
    r"mother|father|brother|sister|family|job|boss|coworkers?|dog|cat|house|car)\b"
    r"|\bwhen i was (a )?(kid|child|young|younger|little|teenager)\b"
    r"|\b(happened|been through that) (to me )?too\b|\bsame thing happened to me\b",
    re.I)


def load_config():
    with open(HERE / "config.yaml") as f:
        return yaml.safe_load(f)


def clean(text):
    if not isinstance(text, str):
        return ""
    text = text.replace("_comma_", ",")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def role_of(raw):
    r = str(raw or "").strip().lower()
    if r in USER_ROLES:
        return "user"
    if r in ASSISTANT_ROLES:
        return "assistant"
    if r == "system":
        return "system"
    return None


def from_turns(turns):
    out = []
    for t in turns:
        if not isinstance(t, dict):
            return None
        t = {str(k).lower(): v for k, v in t.items()}
        role = next((role_of(t[k]) for k in ("role", "from", "speaker", "author") if k in t), None)
        if role is None:
            return None      # unknown speaker labels: can't tell who is the supporter
        text = next((clean(t[k]) for k in ("content", "value", "text", "utterance", "message") if k in t), "")
        out.append({"role": role, "content": text})
    return out


def from_tagged(text):
    parts = TAG_RE.split(text)
    if len(parts) < 5:           # need at least one user + one assistant segment
        return None
    return [{"role": "user" if tag.lower() in USER_TAGS else "assistant", "content": clean(body)}
            for tag, body in zip(parts[1::2], parts[2::2])]


def to_conversation(rec):
    if isinstance(rec, str):
        try:
            rec = json.loads(rec)
        except ValueError:
            return None
    if hasattr(rec, "tolist"):
        rec = rec.tolist()
    if isinstance(rec, list):
        return from_turns(rec)
    if not isinstance(rec, dict):
        return None
    r = {str(k).lower(): v for k, v in rec.items()}

    for key in ("messages", "conversations", "conversation", "dialog", "dialogue", "turns"):
        turns = r.get(key)
        if isinstance(turns, str):
            try:
                turns = json.loads(turns)
            except ValueError:
                turns = None
        if hasattr(turns, "tolist"):
            turns = turns.tolist()
        if isinstance(turns, list) and turns:
            return from_turns(turns)

    for a, b in PAIR_KEYS:
        if a in r and b in r:
            prompt = clean(r[a])
            if a == "instruction" and clean(r.get("input")):
                prompt = clean(r["input"])      # instruction is usually a generic directive
            return [{"role": "user", "content": prompt}, {"role": "assistant", "content": clean(r[b])}]

    text = r.get("text")
    if isinstance(text, str):
        stripped = text.strip()
        if stripped.startswith(("{", "[")):
            return to_conversation(stripped)
        return from_tagged(text)
    return None


def load_records(path):
    suffix = path.suffix.lower()
    if suffix == ".jsonl":
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        yield json.loads(line)
                    except ValueError:
                        continue
    elif suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = next((data[k] for k in ("data", "train", "examples") if isinstance(data.get(k), list)), [data])
        yield from data
    elif suffix == ".csv":
        csv.field_size_limit(sys.maxsize)
        with path.open(encoding="utf-8", newline="") as f:
            yield from csv.DictReader(f)
    elif suffix == ".parquet":
        import pandas as pd
        yield from pd.read_parquet(path).to_dict("records")


def conversations_from_file(path):
    records = list(load_records(path))
    first = {str(k).lower() for k in records[0]} if records and isinstance(records[0], dict) else set()
    if {"conv_id", "utterance"} <= first:
        convs = defaultdict(list)
        for rec in records:
            rec = {str(k).lower(): v for k, v in rec.items()}
            convs[rec["conv_id"]].append(rec)
        for rows in convs.values():
            rows.sort(key=lambda x: int(x.get("utterance_idx") or 0))
            yield [{"role": "user" if i % 2 == 0 else "assistant", "content": clean(x.get("utterance"))}
                   for i, x in enumerate(rows)]
        return
    for rec in records:
        conv = to_conversation(rec)
        if conv:
            yield conv


def normalize(conv):
    """Merge same-speaker runs, drop system turns, start on user, end on assistant."""
    out = []
    for m in conv:
        if m["role"] == "system" or not m["content"]:
            continue
        if out and out[-1]["role"] == m["role"]:
            out[-1]["content"] += "\n" + m["content"]
        else:
            out.append(dict(m))
    while out and out[0]["role"] != "user":
        out.pop(0)
    while out and out[-1]["role"] != "assistant":
        out.pop()
    return out


def expand(conv, max_context_turns):
    for i, m in enumerate(conv):
        if m["role"] != "assistant":
            continue
        example = conv[max(0, i + 1 - max_context_turns): i + 1]
        if example[0]["role"] != "user":
            example = example[1:]
        yield example


def keep(example, d):
    reply = example[-1]["content"]
    if not d["min_reply_chars"] <= len(reply) <= d["max_reply_chars"]:
        return False
    low = reply.lower()
    if any(phrase in low for phrase in d.get("drop_phrases") or ()):
        return False
    if any(len(m["content"]) > d["max_turn_chars"] for m in example):
        return False
    if d.get("drop_personal_claims", True) and PERSONAL_CLAIM_RE.search(reply):
        return False
    return not (URL_RE.search(reply) or CONTACT_RE.search(reply) or BOILERPLATE_RE.search(reply))


def run(cfg=None):
    cfg = cfg or load_config()
    d = cfg["data"]
    batch_size = cfg["training"]["batch_size"]
    # A short persona line keeps every example cheap to train on; the full
    # system_prompt.txt is still used when chatting.
    system_prompt = (d.get("training_system_prompt")
                     or (HERE / "system_prompt.txt").read_text(encoding="utf-8")).strip()

    files = sorted(p for p in DATASETS_DIR.rglob("*")
                   if p.is_file() and p.suffix.lower() in {".jsonl", ".json", ".csv", ".parquet"}
                   and not p.name.startswith("."))
    if not files:
        sys.exit(f"No datasets found. Drop .jsonl/.json/.csv/.parquet files into {DATASETS_DIR}\n"
                 f"or run `./train_chat.sh fetch` to download the recommended open datasets.")

    by_source = defaultdict(list)
    skipped = Counter()
    seen = set()
    for path in files:
        source = path.relative_to(DATASETS_DIR).parts[0]
        n_before = len(by_source[source])
        try:
            convs = list(conversations_from_file(path))
        except Exception as exc:
            print(f"  ! skipped {path.name}: {exc}")
            continue
        if not convs:
            print(f"  ! {path.relative_to(DATASETS_DIR)}: no conversations recognized (see prepare.py for formats)")
        for conv in convs:
            for example in expand(normalize(conv), d["max_context_turns"]):
                if not keep(example, d):
                    skipped[source] += 1
                    continue
                key = hashlib.sha1((example[-2]["content"] + "\x00" + example[-1]["content"]).encode()).hexdigest()
                if key in seen:
                    skipped[source] += 1
                    continue
                seen.add(key)
                by_source[source].append(example)
        print(f"  {path.relative_to(DATASETS_DIR)}: +{len(by_source[source]) - n_before} examples")

    rng = random.Random(0)
    caps = d.get("source_caps") or {}
    examples = []
    print("\nPer source (after filtering):")
    for source, items in sorted(by_source.items()):
        rng.shuffle(items)
        cap = caps.get(source, d["max_per_source"])
        capped = items[:cap] if cap else items
        examples += capped
        print(f"  {source:45s} {len(capped):6d} kept of {len(items):6d}  ({skipped[source]} filtered/duplicate)")
    rng.shuffle(examples)
    if d["max_examples"]:
        examples = examples[: d["max_examples"]]

    n_valid = max(batch_size, int(len(examples) * d["valid_fraction"]))
    if len(examples) < n_valid + batch_size:
        sys.exit(f"Only {len(examples)} usable examples - need at least {n_valid + batch_size}. Add more data.")
    valid, train = examples[:n_valid], examples[n_valid:]

    DATA_DIR.mkdir(exist_ok=True)
    for name, rows in (("train", train), ("valid", valid)):
        with (DATA_DIR / f"{name}.jsonl").open("w", encoding="utf-8") as f:
            for ex in rows:
                f.write(json.dumps({"messages": [{"role": "system", "content": system_prompt}] + ex},
                                   ensure_ascii=False) + "\n")
    print(f"\nWrote {len(train)} training and {len(valid)} validation examples to {DATA_DIR}")
    return len(train), len(valid)


if __name__ == "__main__":
    run()
