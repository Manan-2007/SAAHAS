"""Fine-tunes the distress classifier (message -> level 0-3) and evaluates it.

Run via ../train_distress.sh:
  ./train_distress.sh             full run -> model/ (what the backend serves)
  ./train_distress.sh --quick     smoke test on a 4,000-example sample -> model_quick/
                                  (never touches the live model)
  ./train_distress.sh --epochs 3  override epochs

Every full run keeps the model it replaces in model_previous/, so a bad run can
be undone by swapping the folders back.
"""

import argparse
import gc
import json
import math
import random
import shutil
import time
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup

import prepare

HERE = Path(__file__).resolve().parent
LEVELS = prepare.LEVELS

PROBES = [
    "I finally slept well last night and talked to my sister.",
    "I'm so anxious about the hearing, I can't focus on anything.",
    "Nothing matters anymore. I feel empty every single day.",
    "I don't want to live anymore. I keep thinking about ending it.",
    "आज मन थोड़ा हल्का है, बच्चों के साथ समय बिताया।",
    "मुझे अब जीने का मन नहीं करता।",
]


def free_gpu_cache(device):
    gc.collect()
    if device == "mps":
        torch.mps.empty_cache()
    elif device == "cuda":
        torch.cuda.empty_cache()


def gpu_memory_gb(device):
    if device == "mps":
        return torch.mps.driver_allocated_memory() / 1e9
    if device == "cuda":
        return torch.cuda.max_memory_allocated() / 1e9
    return 0.0


def load_rows(name):
    with (prepare.DATA_DIR / f"{name}.jsonl").open(encoding="utf-8") as f:
        return [json.loads(line) for line in f]


def predict(model, tok, texts, device, max_length, batch_size=32):
    model.eval()
    probs = []
    with torch.no_grad():
        for i in range(0, len(texts), batch_size):
            enc = tok(texts[i:i + batch_size], truncation=True, max_length=max_length,
                      padding=True, return_tensors="pt").to(device)
            probs.append(torch.softmax(model(**enc).logits.float(), dim=-1).cpu().numpy())
    return np.concatenate(probs)


def evaluate(model, tok, rows, device, max_length):
    probs = predict(model, tok, [r["text"] for r in rows], device, max_length)
    y_true = [r["level"] for r in rows]
    y_pred = probs.argmax(-1).tolist()
    by_source = {}
    for src in sorted({r["source"] for r in rows}):
        idx = [i for i, r in enumerate(rows) if r["source"] == src]
        by_source[src] = round(float(np.mean([y_true[i] == y_pred[i] for i in idx])), 3)
    report = classification_report(y_true, y_pred, labels=list(range(4)), target_names=LEVELS,
                                   output_dict=True, zero_division=0)
    return {
        "macro_f1": round(f1_score(y_true, y_pred, average="macro"), 4),
        "high_risk_recall": round(report["high"]["recall"], 4),
        "per_level": {l: {k: round(v, 3) for k, v in report[l].items()} for l in LEVELS},
        "accuracy_by_source": by_source,
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=list(range(4))).tolist(),
    }


def publish(model, tok, metrics, model_dir, keep_previous):
    """Write to a staging folder, then swap it in, so a running backend never
    loads a half-written model. The replaced model moves to <dir>_previous."""
    staging = model_dir.with_name(model_dir.name + "_staging")
    shutil.rmtree(staging, ignore_errors=True)
    model.save_pretrained(staging)
    tok.save_pretrained(staging)
    (staging / "metrics.json").write_text(json.dumps(metrics, indent=2))
    if model_dir.exists():
        if keep_previous:
            previous = model_dir.with_name(model_dir.name + "_previous")
            shutil.rmtree(previous, ignore_errors=True)
            model_dir.rename(previous)
        else:
            shutil.rmtree(model_dir)
    staging.rename(model_dir)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--epochs", type=int)
    ap.add_argument("--quick", action="store_true", help="smoke test: 4,000 training rows, 1 epoch -> model_quick/")
    ap.add_argument("--skip-prepare", action="store_true")
    args = ap.parse_args()

    cfg = prepare.load_config()
    t = cfg["training"]
    random.seed(t["seed"])
    torch.manual_seed(t["seed"])
    if not args.skip_prepare:
        print("Preparing datasets ...")
        prepare.run(cfg)

    train, valid = load_rows("train"), load_rows("valid")
    epochs = 1 if args.quick else (args.epochs or t["epochs"])
    if args.quick:
        train, valid = random.sample(train, min(4000, len(train))), random.sample(valid, min(600, len(valid)))
    # Smoke tests go to their own folder so they can never replace a real model
    model_dir = HERE / ("model_quick" if args.quick else cfg.get("model_dir", "model"))

    bs = t["batch_size"]
    accum = int(t.get("grad_accumulation", 1))
    device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\nTraining {cfg['base_model']} on {len(train)} examples for {epochs} epoch(s) on {device} "
          f"(batch {bs} x {accum} accumulation = {bs * accum} per update) -> {model_dir.name}/ ...")
    tok = AutoTokenizer.from_pretrained(cfg["base_model"])
    model = AutoModelForSequenceClassification.from_pretrained(
        cfg["base_model"], num_labels=4,
        id2label=dict(enumerate(LEVELS)), label2id={l: i for i, l in enumerate(LEVELS)}).to(device)

    # sqrt-inverse class weights: rarer levels (moderate) count more, without exploding
    counts = np.bincount([r["level"] for r in train], minlength=4)
    weights = torch.tensor((counts.sum() / (4 * np.maximum(counts, 1))) ** 0.5, dtype=torch.float32, device=device)
    loss_fn = torch.nn.CrossEntropyLoss(weight=weights)

    batches_per_epoch = math.ceil(len(train) / bs)
    updates_per_epoch = math.ceil(batches_per_epoch / accum)
    total_updates = updates_per_epoch * epochs
    optimizer = torch.optim.AdamW(model.parameters(), lr=float(t["learning_rate"]), weight_decay=0.01)
    scheduler = get_linear_schedule_with_warmup(optimizer, int(total_updates * t["warmup_fraction"]), total_updates)

    best = None
    update = 0
    peak_gpu = 0.0
    started = time.time()
    for epoch in range(1, epochs + 1):
        model.train()
        random.shuffle(train)
        window_loss, window_n = 0.0, 0
        for b, i in enumerate(range(0, len(train), bs), start=1):
            batch = train[i:i + bs]
            enc = tok([r["text"] for r in batch], truncation=True, max_length=t["max_length"],
                      padding=True, return_tensors="pt").to(device)
            labels = torch.tensor([r["level"] for r in batch], device=device)
            loss = loss_fn(model(**enc).logits, labels)
            (loss / accum).backward()
            window_loss += loss.item()
            window_n += 1
            if b % accum and b != batches_per_epoch:
                continue
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad(set_to_none=True)
            update += 1
            if update % 25 == 0 or update == total_updates:
                peak_gpu = max(peak_gpu, gpu_memory_gb(device))
                elapsed = time.time() - started
                eta = elapsed / update * (total_updates - update)
                print(f"  epoch {epoch} update {update}/{total_updates}  loss {window_loss / window_n:.3f} "
                      f"(chance = 1.386)  gpu mem {gpu_memory_gb(device):.1f} GB  "
                      f"elapsed {elapsed / 60:.1f} min  eta {eta / 60:.1f} min", flush=True)
                window_loss, window_n = 0.0, 0

        free_gpu_cache(device)
        metrics = evaluate(model, tok, valid, device, t["max_length"])
        free_gpu_cache(device)
        print(f"\n  epoch {epoch}: macro-F1 {metrics['macro_f1']}  high-risk recall {metrics['high_risk_recall']}")
        for level in LEVELS:
            m = metrics["per_level"][level]
            print(f"    {level:9s} precision {m['precision']:.3f}  recall {m['recall']:.3f}  f1 {m['f1-score']:.3f}  n={int(m['support'])}")
        print("    accuracy by source:", metrics["accuracy_by_source"])
        if best is None or metrics["macro_f1"] > best["macro_f1"]:
            # keep_previous only for the first save of a run, so model_previous/
            # holds the model from before this run, not this run's epoch 1
            keep = best is None and not args.quick
            best = {**metrics, "epoch": epoch, "base_model": cfg["base_model"], "train_examples": len(train)}
            publish(model, tok, best, model_dir, keep_previous=keep)
            print(f"  saved to {model_dir}")

    minutes = (time.time() - started) / 60
    print(f"\nTraining took {minutes:.1f} min; peak GPU memory {peak_gpu:.1f} GB")
    print("Confusion matrix (rows = true, cols = predicted):", LEVELS)
    for level, row in zip(LEVELS, best["confusion_matrix"]):
        print(f"  {level:9s} {row}")

    del model, optimizer
    free_gpu_cache(device)
    best_model = AutoModelForSequenceClassification.from_pretrained(model_dir).to(device)
    probs = predict(best_model, tok, PROBES, device, t["max_length"])
    print("\nSample messages:")
    for text, p in zip(PROBES, probs):
        print(f"  {LEVELS[int(p.argmax())]:9s} (high-risk {p[3]:.2f})  {text}")
    if args.quick:
        print(f"\nQuick test saved to {model_dir.name}/ - the live model in model/ was not touched.")
    else:
        print("\nDone. A running backend picks up the new model on the next message. "
              "The model it replaced is in model_previous/.")


if __name__ == "__main__":
    main()
