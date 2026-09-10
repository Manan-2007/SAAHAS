"""Evaluate the production prediction path on the downloaded eval sets.

Imports main.py so the exact deployed pipeline runs: VAD -> engines
(emotion2vec+ ensembled with Odyssey WavLM) -> calm synthesis -> calibration
-> affect reweighting. Scores three variants so each layer's effect is
visible: raw emotion2vec+ alone, the full fused pipeline, and the pipeline
with the unreliable-class headline policy applied.

Sources are scored separately - CREMA-D is acted studio speech, MELD is
spontaneous TV-show conversation - because they answer different questions:
CREMA-D tracks regressions on clean speech, MELD approximates live-mic
reality (expect much lower numbers there; natural 8-class SOTA is ~0.3-0.4
macro-F1).

Scoring notes:
- Neither corpus has "calm": a predicted "calm" is scored as "neutral".
- Clips the VAD rejects are reported as skipped, not scored.

Usage: venv/bin/python eval/evaluate.py [--limit N] [--no-valence] [--e2v-weight W]
Writes eval/results/<timestamp>.json for later diffing between pipeline
versions.
"""

import argparse
import json
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import librosa  # noqa: E402

DATA_ROOT = Path(__file__).resolve().parent / "data"
RESULTS_DIR = Path(__file__).resolve().parent / "results"

CREMA_LABELS = {"ANG": "angry", "DIS": "disgust", "FEA": "fearful",
                "HAP": "happy", "NEU": "neutral", "SAD": "sad"}

SCORE_ALIAS = {"calm": "neutral"}   # calm does not exist in the eval corpora

VARIANTS = ["engine only", "full pipeline", "pipeline + headline policy"]


def collect_clips():
    """Returns [(path, true_label, source), ...] across all eval corpora."""
    items = []
    for wav in sorted((DATA_ROOT / "crema_d").glob("*.wav")):
        items.append((wav, CREMA_LABELS[wav.name.split("_")[2]], "crema_d"))
    for wav in sorted((DATA_ROOT / "meld").glob("meld_*.wav")):
        items.append((wav, wav.stem.split("_")[2], "meld"))
    return items


def metrics(pairs, emotions):
    """pairs: list of (true, predicted). Returns acc, UAR, macro-F1, confusion."""
    conf = defaultdict(Counter)
    for true, pred in pairs:
        conf[true][pred] += 1

    recalls, f1s = [], []
    present = [e for e in emotions if any(t == e for t, _ in pairs)]
    for e in present:
        tp = conf[e][e]
        fn = sum(conf[e].values()) - tp
        fp = sum(conf[t][e] for t in conf if t != e)
        recall = tp / max(tp + fn, 1)
        precision = tp / max(tp + fp, 1)
        f1 = 2 * precision * recall / max(precision + recall, 1e-9)
        recalls.append(recall)
        f1s.append(f1)

    acc = sum(1 for t, p in pairs if t == p) / max(len(pairs), 1)
    return acc, float(np.mean(recalls)), float(np.mean(f1s)), conf


def print_confusion(conf, emotions):
    labels = [e for e in emotions if e in conf or any(conf[t][e] for t in conf)]
    width = max(len(l) for l in labels) + 1
    print(" " * width + "".join(f"{l[:6]:>8}" for l in labels))
    for t in labels:
        if t not in conf:
            continue
        print(f"{t:<{width}}" + "".join(f"{conf[t][p]:>8}" for p in labels))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="only score first N clips")
    parser.add_argument("--no-valence", action="store_true",
                        help="disable the valence term in the fusion (A/B experiments)")
    parser.add_argument("--e2v-weight", type=float, default=None,
                        help="ensemble share for emotion2vec+ (0..1; 1.0 = no ensemble)")
    parser.add_argument("--text-weight", type=float, default=None,
                        help="base weight of the ASR text branch (0 = disabled)")
    parser.add_argument("--e2v-model", choices=["base", "large"], default=None,
                        help="emotion2vec+ checkpoint to load (A/B experiments)")
    args = parser.parse_args()

    clips = collect_clips()
    if not clips:
        print(f"No clips under {DATA_ROOT} - run eval/download_eval_set.py first")
        return 1
    if args.limit:
        clips = clips[: args.limit]

    print("Loading production pipeline (this loads the engines)...")
    import emotion_engine  # noqa: E402  (light; must be patched BEFORE main builds the engine)
    if args.e2v_model:
        emotion_engine.E2V_MODEL_ID = f"emotion2vec/emotion2vec_plus_{args.e2v_model}"
    import main as app_main  # noqa: E402  (heavy import by design)
    import analysis  # noqa: E402
    from analysis import TARGET_SR  # noqa: E402
    from emotion_engine import pick_headline, EMOTIONS  # noqa: E402

    import text_emotion  # noqa: E402
    if args.no_valence:
        analysis.VALENCE_STRENGTH = 0.0
    if args.e2v_weight is not None:
        emotion_engine.ENSEMBLE_E2V_WEIGHT = args.e2v_weight
    if args.text_weight is not None:
        text_emotion.TEXT_FUSION_WEIGHT = args.text_weight

    dim_name = app_main.dim_engine.name if app_main.dim_engine else "heuristic prosody"
    ens_name = (f"{app_main.wavlm_engine.name} (e2v weight "
                f"{emotion_engine.ENSEMBLE_E2V_WEIGHT})" if app_main.wavlm_engine else "none")
    print(f"Engine: {app_main.engine.name}   dimensional: {dim_name}   ensemble: {ens_name}"
          f"{'   (valence disabled)' if args.no_valence else ''}")
    sources = Counter(s for _, _, s in clips)
    print(f"Scoring {len(clips)} clips ({dict(sources)})...\n")

    pairs = {v: [] for v in VARIANTS}          # variant -> [(true, pred, source)]
    skipped = defaultdict(list)
    t0 = time.time()

    for i, (wav, true, source) in enumerate(clips, 1):
        audio, _ = librosa.load(wav, sr=TARGET_SR)
        result = app_main.analyze_and_predict(audio, TARGET_SR, require_recent=False)
        if result["status"] != "speech":
            skipped[source].append(wav.name)
            continue

        probs = result["probs"]
        preds = {
            "engine only": EMOTIONS[int(np.argmax(result["engine_probs"]))],
            "full pipeline": EMOTIONS[int(np.argmax(probs))],
            "pipeline + headline policy":
                EMOTIONS[pick_headline(probs, app_main.CONFIDENT_TOP)[0]],
        }
        for variant, pred in preds.items():
            pairs[variant].append((true, SCORE_ALIAS.get(pred, pred), source))

        if i % 25 == 0:
            print(f"  {i}/{len(clips)} ({time.time() - t0:.0f}s)")

    n_scored = len(pairs[VARIANTS[0]])
    n_skipped = sum(len(v) for v in skipped.values())
    print(f"\nScored {n_scored} clips, VAD skipped {n_skipped} "
          f"({ {k: len(v) for k, v in skipped.items()} })")

    report = {}
    for variant in VARIANTS:
        print(f"\n=== {variant} ===")
        report[variant] = {}
        scopes = [("combined", pairs[variant])] + [
            (src, [(t, p) for t, p, s in pairs[variant] if s == src])
            for src in sorted(sources)
        ]
        for scope_name, scope_pairs in scopes:
            scope_pairs = [(t, p) for t, p, *_ in scope_pairs]
            acc, uar, f1, conf = metrics(scope_pairs, EMOTIONS)
            print(f"{scope_name:<10} accuracy {acc:.3f}   UAR {uar:.3f}   macro-F1 {f1:.3f}")
            report[variant][scope_name] = {
                "accuracy": acc, "uar": uar, "macro_f1": f1,
                "confusion": {t: dict(c) for t, c in conf.items()},
            }

    print("\nConfusion (pipeline + headline policy):")
    for src in sorted(sources):
        src_pairs = [(t, p) for t, p, s in pairs["pipeline + headline policy"] if s == src]
        print(f"\n[{src}]")
        _, _, _, conf = metrics(src_pairs, EMOTIONS)
        print_confusion(conf, EMOTIONS)

    RESULTS_DIR.mkdir(exist_ok=True)
    out = RESULTS_DIR / f"{time.strftime('%Y%m%d-%H%M%S')}.json"
    report["meta"] = {
        "engine": app_main.engine.name,
        "dimensional": dim_name,
        "ensemble": ens_name,
        "e2v_weight": emotion_engine.ENSEMBLE_E2V_WEIGHT,
        "text_engine": app_main.text_engine.name if app_main.text_engine else "none",
        "text_weight": text_emotion.TEXT_FUSION_WEIGHT,
        "valence_strength": analysis.VALENCE_STRENGTH,
        "clips_scored": n_scored,
        "clips_skipped_by_vad": {k: v for k, v in skipped.items()},
        "calibration": {"temperature": app_main.CAL_TEMPERATURE,
                        "blend": app_main.CAL_BLEND,
                        "strength": app_main.CAL_STRENGTH},
    }
    out.write_text(json.dumps(report, indent=2))
    print(f"\nSaved {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
