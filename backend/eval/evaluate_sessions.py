"""Measure per-session speaker calibration on simulated sessions.

A session = one CREMA-D actor's clips streamed in a fixed shuffled order
through the production path, with a SpeakerSession accumulating that
speaker's baseline exactly as the live WebSocket loop does. Run twice -
adaptation ON vs OFF - on identical clip orders, and compare.

Usage: venv/bin/python eval/evaluate_sessions.py
"""

import random
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import librosa  # noqa: E402

SESSION_DIR = Path(__file__).resolve().parent / "data" / "sessions"
SEED = 42

CREMA_LABELS = {"ANG": "angry", "DIS": "disgust", "FEA": "fearful",
                "HAP": "happy", "NEU": "neutral", "SAD": "sad"}
SCORE_ALIAS = {"calm": "neutral"}


def main():
    actor_dirs = sorted(d for d in SESSION_DIR.iterdir() if d.is_dir())
    if not actor_dirs:
        print("No session data - run eval/download_eval_set.py first")
        return 1

    print("Loading production pipeline...")
    import main as app_main  # noqa: E402
    from analysis import TARGET_SR  # noqa: E402
    from emotion_engine import EMOTIONS  # noqa: E402
    from speaker_session import SpeakerSession  # noqa: E402

    # Transcription is display-only (fusion weight 0) - skip it for speed
    app_main.text_engine = None

    # Preload audio + fixed per-actor order so ON and OFF see identical runs
    sessions = {}
    for actor_dir in actor_dirs:
        wavs = sorted(actor_dir.glob("*.wav"))
        rng = random.Random(SEED + int(actor_dir.name))
        rng.shuffle(wavs)
        sessions[actor_dir.name] = [
            (librosa.load(w, sr=TARGET_SR)[0], CREMA_LABELS[w.name.split("_")[2]])
            for w in wavs
        ]

    results = {}
    for mode in ("off", "on"):
        per_actor = {}
        correct = total = 0
        t0 = time.time()
        for actor, clips in sessions.items():
            session = SpeakerSession() if mode == "on" else None
            a_correct = 0
            for audio, true in clips:
                r = app_main.analyze_and_predict(audio, TARGET_SR,
                                                 require_recent=False, session=session)
                if r["status"] != "speech":
                    continue
                pred = EMOTIONS[int(np.argmax(r["probs"]))]
                pred = SCORE_ALIAS.get(pred, pred)
                a_correct += (pred == true)
                total += 1
            correct += a_correct
            per_actor[actor] = a_correct
        results[mode] = (correct, per_actor)
        print(f"adaptation {mode:>3}: {correct} correct "
              f"(per actor: {per_actor})  [{time.time()-t0:.0f}s]")

    off, on = results["off"][0], results["on"][0]
    n = sum(len(c) for c in sessions.values())
    print(f"\nadaptation OFF: {off}/{n}   ON: {on}/{n}   delta: {on - off:+d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
