"""ASR + text-emotion branch: what is said, fused with how it is said.

Valence-type distinctions (happy vs sad vs angry at similar arousal) are
carried largely by linguistic content - the INTERSPEECH 2025 naturalistic
SER challenge measured ~10% relative macro-F1 gain from adding a text
branch over the best audio-only system. This module transcribes a
finalized utterance locally (faster-whisper, CPU int8) and scores the
transcript with j-hartmann/emotion-english-distilroberta-base, whose seven
classes map 1:1 onto this project's set (minus calm).

Fusion is self-gating: lexical evidence is one-directional. Emotional words
are evidence; their absence is not evidence of neutral delivery. The
effective fusion weight is scaled by (1 - P_text(neutral)), so a transcript
with no emotional content simply leaves the audio verdict alone.
"""

import numpy as np
import librosa

from emotion_engine import EMOTIONS

ASR_SR = 16000
WHISPER_MODEL = "base"          # tiny/base/small: latency vs transcript quality
TEXT_MODEL_ID = "j-hartmann/emotion-english-distilroberta-base"

# Text share of the fused distribution BEFORE self-gating by
# (1 - P_text(neutral)); the realized weight is usually much lower.
# MEASURED (eval/results, 2026-07-18): at 0.35 the text branch gained
# nothing on MELD (27.4 -> 27.4) and cost 4pts on CREMA-D (65.3 -> 61.0) -
# whisper-base transcripts of noisy speech plus a zero-shot text classifier
# (sarcasm, lexically-misleading phrases) are too weak to fuse. Default 0:
# transcription still runs and is reported in the API, but does not touch
# the emotion scores. Revisit with an emotion-tuned text model.
TEXT_FUSION_WEIGHT = 0.0

MIN_WORDS = 3                   # shorter transcripts are too noisy to score

# text model label -> project label
TEXT_MAP = {"anger": "angry", "disgust": "disgust", "fear": "fearful",
            "joy": "happy", "neutral": "neutral", "sadness": "sad",
            "surprise": "surprised"}


class TextEmotionEngine:
    name = "whisper-" + WHISPER_MODEL + " + distilroberta"

    def __init__(self):
        import torch
        from faster_whisper import WhisperModel
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        self.torch = torch
        self.asr = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
        self.tokenizer = AutoTokenizer.from_pretrained(TEXT_MODEL_ID)
        self.classifier = AutoModelForSequenceClassification.from_pretrained(TEXT_MODEL_ID)
        self.classifier.eval()
        id2label = self.classifier.config.id2label
        self.labels = [str(id2label[k]).lower() for k in sorted(id2label, key=int)]

    def transcribe(self, audio, sr):
        audio = np.asarray(audio, dtype=np.float32)
        if sr != ASR_SR:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=ASR_SR)
        segments, _ = self.asr.transcribe(audio, language="en", beam_size=1,
                                          vad_filter=False, without_timestamps=True)
        return " ".join(s.text.strip() for s in segments).strip()

    def score_text(self, text):
        """Returns probs over EMOTIONS from the transcript."""
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        with self.torch.no_grad():
            logits = self.classifier(**inputs).logits[0]
        scores = self.torch.softmax(logits, dim=-1).tolist()

        probs = {e: 0.0 for e in EMOTIONS}
        for label, score in zip(self.labels, scores):
            target = TEXT_MAP.get(label)
            if target is not None:
                probs[target] += float(score)
        vec = np.array([probs[e] for e in EMOTIONS], dtype=np.float64)
        total = vec.sum()
        return vec / total if total > 0 else np.full(len(EMOTIONS), 1.0 / len(EMOTIONS))

    def analyze(self, audio, sr):
        """Transcribe + score. Returns (transcript, probs-or-None).
        probs is None when the transcript is too short to trust."""
        transcript = self.transcribe(audio, sr)
        if len(transcript.split()) < MIN_WORDS:
            return transcript, None
        return transcript, self.score_text(transcript)


def fuse_text(audio_probs, text_probs, base_weight=None):
    """Blend the text distribution into the audio one, self-gated by how
    much actual emotional content the text carries."""
    if text_probs is None:
        return audio_probs
    if base_weight is None:
        base_weight = TEXT_FUSION_WEIGHT
    i_neutral = EMOTIONS.index("neutral")
    weight = base_weight * (1.0 - float(text_probs[i_neutral]))
    return (1.0 - weight) * audio_probs + weight * text_probs


def load_text_engine():
    """Returns the engine or None (missing deps / no network on first run)."""
    try:
        return TextEmotionEngine()
    except Exception as exc:
        print(f"[text-emotion] unavailable ({exc}); audio-only fusion")
        return None
