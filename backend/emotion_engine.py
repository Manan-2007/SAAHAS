"""Emotion classification engine.

Primary: emotion2vec+ (ACL 2024) via FunASR - a speech emotion foundation
model trained on 42,500+ hours of real emotional speech. Hugely better
generalization than anything trainable on RAVDESS's 1.5 hours of acted clips.

Fallback: the original RAVDESS-trained MFCC CNN, used automatically when
FunASR or the checkpoint is unavailable (e.g. no internet on first run).

Both paths emit a probability vector over the project's 8 emotions:
angry, calm, disgust, fearful, happy, neutral, sad, surprised.

emotion2vec+ has no "calm" class, so calm is synthesized from the neutral
mass when the measured arousal of the delivery is low - a flat, even
delivery is what separates calm from plain neutral in the first place.
"""

import os
import numpy as np
import librosa

EMOTIONS = ["angry", "calm", "disgust", "fearful", "happy", "neutral", "sad", "surprised"]

# emotion2vec+ label -> project label (None = redistribute)
E2V_MAP = {
    "angry": "angry", "disgusted": "disgust", "fearful": "fearful",
    "happy": "happy", "neutral": "neutral", "sad": "sad",
    "surprised": "surprised", "other": None, "unknown": None,
}

E2V_SR = 16000

# base (~90M) or large (~300M): same FunASR API, same 9-class head.
# MEASURED (eval/results, 2026-07-18): large is +3.6pts raw on natural
# speech but the WavLM ensemble member already covers that ground - through
# the full pipeline large nets only +0.9 on MELD while costing 4.3 on
# CREMA-D and ~3x interim latency. Base wins as the live engine.
E2V_MODEL_ID = "emotion2vec/emotion2vec_plus_base"


class Emotion2VecEngine:
    def __init__(self):
        from funasr import AutoModel
        self.name = "emotion2vec+ " + E2V_MODEL_ID.rsplit("_", 1)[-1]
        self.model = AutoModel(
            model=E2V_MODEL_ID,
            hub="hf",
            disable_update=True,
            disable_pbar=True,
            log_level="ERROR",
        )

    def predict(self, audio, sr):
        """audio: float32 speech-only samples. Returns probs over EMOTIONS."""
        if sr != E2V_SR:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=E2V_SR)
        audio = np.asarray(audio, dtype=np.float32)

        result = self.model.generate(
            audio, granularity="utterance", extract_embedding=False, fs=E2V_SR,
        )[0]

        probs = {e: 0.0 for e in EMOTIONS}
        unmapped = 0.0
        for label, score in zip(result["labels"], result["scores"]):
            key = label.split("/")[-1].strip().lower()
            target = E2V_MAP.get(key, None)
            if target is None:
                unmapped += float(score)
            else:
                probs[target] += float(score)

        vec = np.array([probs[e] for e in EMOTIONS], dtype=np.float64)
        total = vec.sum()
        if total <= 0:
            return np.full(len(EMOTIONS), 1.0 / len(EMOTIONS))
        return vec / total


WAVLM_MODEL_ID = "3loi/SER-Odyssey-Baseline-WavLM-Categorical"

# Odyssey WavLM label -> project label (None = redistribute)
WAVLM_MAP = {
    "angry": "angry", "sad": "sad", "happy": "happy", "surprise": "surprised",
    "fear": "fearful", "disgust": "disgust", "neutral": "neutral",
    "contempt": None,
}


class WavLMEngine:
    """Odyssey 2024 SER Challenge baseline (WavLM-Large, MIT license), trained
    on MSP-Podcast - natural spontaneous speech, the exact domain where
    emotion2vec+'s largely-acted training mix is weakest. Used as the second
    voice of the ensemble."""

    name = "Odyssey WavLM"

    def __init__(self):
        import torch
        from wavlm_ser import load_odyssey_ser
        self.torch = torch
        self.model, cfg = load_odyssey_ser()
        self.sr = int(cfg.get("sampling_rate", 16000))
        self.mean = float(cfg["mean"])
        self.std = float(cfg["std"])
        id2label = cfg.get("id2label", {
            0: "Angry", 1: "Sad", 2: "Happy", 3: "Surprise",
            4: "Fear", 5: "Disgust", 6: "Contempt", 7: "Neutral",
        })
        self.labels = [str(id2label[k]).lower()
                       for k in sorted(id2label, key=lambda x: int(x))]

    def predict(self, audio, sr):
        """audio: float32 speech-only samples. Returns probs over EMOTIONS."""
        audio = np.asarray(audio, dtype=np.float32)
        if sr != self.sr:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=self.sr)
        norm = (audio - self.mean) / (self.std + 1e-6)

        wavs = self.torch.from_numpy(norm).unsqueeze(0)
        mask = self.torch.ones(1, len(norm))
        with self.torch.no_grad():
            logits = self.model(wavs, mask)
        scores = self.torch.nn.functional.softmax(logits, dim=1)[0].tolist()

        probs = {e: 0.0 for e in EMOTIONS}
        for label, score in zip(self.labels, scores):
            target = WAVLM_MAP.get(label, None)
            if target is not None:
                probs[target] += float(score)

        vec = np.array([probs[e] for e in EMOTIONS], dtype=np.float64)
        total = vec.sum()
        if total <= 0:
            return np.full(len(EMOTIONS), 1.0 / len(EMOTIONS))
        return vec / total


# Ensemble blend: emotion2vec+ share (the rest goes to the WavLM model).
# The two disagree usefully - emotion2vec+ is sharper on acted-style
# delivery, the WavLM baseline was trained purely on spontaneous speech.
# Measured trade-off (eval/results, 2026-07-18): raising WavLM's share
# helps natural speech and costs acted speech - MELD accuracy 22.1/24.8/27.4
# vs CREMA-D 68.6/67.8/65.3 at e2v weights 1.0/0.65/0.5. Live mic audio is
# natural speech, so 0.5; raise toward 0.65 to favor expressive/acted
# delivery instead.
ENSEMBLE_E2V_WEIGHT = 0.5


def load_wavlm_engine():
    """Returns the MSP-Podcast WavLM engine or None (no transformers /
    checkpoint / network). The pipeline runs single-engine when None."""
    try:
        return WavLMEngine()
    except Exception as exc:
        print(f"[emotion-engine] Odyssey WavLM unavailable ({exc}); no ensemble")
        return None


class CnnFallbackEngine:
    name = "RAVDESS CNN (fallback)"

    def __init__(self, model, encoder_classes):
        self.model = model
        self.classes = [str(c) for c in encoder_classes]
        from extract_feature import extraction_from_audio
        self._extract = extraction_from_audio

    def predict(self, audio, sr):
        features = self._extract(audio, sr)
        raw = features[np.newaxis, ..., np.newaxis].astype(np.float32)
        out = self.model(raw, training=False).numpy()[0]
        # reorder to EMOTIONS (encoder order should already match, but be safe)
        probs = {c: float(p) for c, p in zip(self.classes, out)}
        vec = np.array([probs.get(e, 0.0) for e in EMOTIONS], dtype=np.float64)
        total = vec.sum()
        return vec / total if total > 0 else np.full(len(EMOTIONS), 1.0 / len(EMOTIONS))


# Classes emotion2vec is documented to recognize poorly (the EmoVoice paper,
# arXiv:2504.12867, excludes all three from evaluation for that reason).
# They are rare in real conversation, so an uncertain win by one of them is
# far more likely a mistake than a detection.
UNRELIABLE_CLASSES = frozenset({"disgust", "fearful", "surprised"})


def pick_headline(probs, confident_top=0.40, clear_lead=0.12):
    """Choose the emotion to display. Reliable classes may headline at any
    probability; an unreliable class must either clear `confident_top` or
    lead the best reliable class by `clear_lead` (ensembled distributions
    are flatter, so an absolute bar alone would veto clear relative wins).

    Returns (index, demoted): demoted=True means the raw argmax was an
    unreliable class that failed both bars - callers should cap certainty.
    """
    order = np.argsort(probs)[::-1]
    top = int(order[0])
    if EMOTIONS[top] not in UNRELIABLE_CLASSES or probs[top] >= confident_top:
        return top, False
    best_reliable = next((int(i) for i in order[1:]
                          if EMOTIONS[int(i)] not in UNRELIABLE_CLASSES), top)
    if probs[top] - probs[best_reliable] >= clear_lead:
        return top, False
    return best_reliable, True


def synthesize_calm(probs, arousal):
    """emotion2vec+ has no calm class: carve calm out of the neutral mass when
    the delivery is measurably flat. At arousal 0 up to 70% of neutral moves
    to calm; above 0.45 nothing does."""
    i_calm = EMOTIONS.index("calm")
    i_neutral = EMOTIONS.index("neutral")
    if probs[i_calm] > 0.01:      # engine already provided calm (CNN path)
        return probs
    share = 0.7 * max(0.0, (0.45 - arousal) / 0.45)
    moved = probs[i_neutral] * share
    probs = probs.copy()
    probs[i_neutral] -= moved
    probs[i_calm] += moved
    return probs


def load_engine(cnn_model=None, encoder_classes=None):
    """Try emotion2vec+, fall back to the CNN. Returns (engine, warmup_fn)."""
    try:
        engine = Emotion2VecEngine()
        return engine
    except Exception as exc:      # missing funasr, no checkpoint, no network
        print(f"[emotion-engine] emotion2vec+ unavailable ({exc}); using CNN fallback")
        if cnn_model is None:
            raise
        return CnnFallbackEngine(cnn_model, encoder_classes)
