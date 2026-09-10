"""Voice analysis engine for the live emotion pipeline.

Three responsibilities:
1. Voice activity detection via Silero VAD (neural, MIT-licensed, ~2MB,
   <1ms per chunk). Replaced the original energy/pitch heuristic, which
   required strong syllabic energy modulation (rms CV > 0.40) and therefore
   silently rejected flat, quiet deliveries - i.e. exactly how sad speech
   sounds (30% of sad clips in the CREMA-D eval sample were dropped).
   Silero also yields proper speech segments with pause boundaries instead
   of a frame-level energy mask.
2. Prosody feature extraction (pitch level & variability, energy modulation,
   speech rate) - the "how it is said" parameters.
3. Arousal scoring + probability reweighting: the classifier scores the
   spectral shape, prosody scores the delivery; emotions whose expected
   arousal does not match the measured delivery get downweighted.
"""

import threading

import numpy as np
import librosa
import torch
from silero_vad import load_silero_vad, get_speech_timestamps

TARGET_SR = 22050
FRAME = 2048
HOP = 512

MIN_SPEECH_SECONDS = 0.7  # min voiced audio before predicting
RECENT_WINDOW_S = 1.2     # speech must exist in this trailing slice
NORM_RMS = 0.05           # loudness the model sees, regardless of mic gain

# Silero VAD runs at 16 kHz; segment boundaries are scaled back to TARGET_SR.
VAD_SR = 16000
VAD_THRESHOLD = 0.5
VAD_MIN_SILENCE_MS = 300  # industry-standard pause that closes a segment
VAD_SPEECH_PAD_MS = 150   # keep consonant onsets at segment edges
VAD_MIN_SPEECH_MS = 250

_vad_model = load_silero_vad()
_vad_lock = threading.Lock()  # JIT model keeps LSTM state; serialize calls

# Expected arousal per emotion (0 = flat/low energy, 1 = highly activated)
AROUSAL_TARGETS = {
    "angry": 0.85, "surprised": 0.80, "happy": 0.70, "fearful": 0.65,
    "disgust": 0.50, "neutral": 0.35, "calm": 0.25, "sad": 0.20,
}
AROUSAL_SIGMA = 0.30
AROUSAL_STRENGTH = 1.2    # exponent on the reweighting factor
SOFTEN_T = 2.0            # temperature that tames overconfident softmax

# Expected valence per emotion (0 = negative, 1 = positive). Applied only
# when a learned valence is available, and gently: the audeering paper notes
# valence is carried largely by linguistic content, so the acoustic estimate
# is weaker than arousal (CCC .638 vs .745) and gets a wider sigma and a
# smaller exponent.
VALENCE_TARGETS = {
    "angry": 0.20, "disgust": 0.25, "fearful": 0.30, "sad": 0.25,
    "neutral": 0.50, "calm": 0.60, "surprised": 0.55, "happy": 0.80,
}
VALENCE_SIGMA = 0.40
VALENCE_STRENGTH = 0.5


def speech_segments(audio, sr):
    """Run Silero VAD. Returns (segments at `sr` sample indices, voiced seconds).

    Segments are [(start, end), ...] scaled from the 16 kHz VAD timeline back
    to the caller's sample rate.
    """
    audio16 = audio if sr == VAD_SR else librosa.resample(audio, orig_sr=sr, target_sr=VAD_SR)
    with _vad_lock:
        stamps = get_speech_timestamps(
            torch.from_numpy(np.ascontiguousarray(audio16, dtype=np.float32)),
            _vad_model,
            sampling_rate=VAD_SR,
            threshold=VAD_THRESHOLD,
            min_silence_duration_ms=VAD_MIN_SILENCE_MS,
            speech_pad_ms=VAD_SPEECH_PAD_MS,
            min_speech_duration_ms=VAD_MIN_SPEECH_MS,
        )
    scale = sr / VAD_SR
    segments = [(int(t["start"] * scale), min(int(t["end"] * scale), len(audio)))
                for t in stamps]
    voiced_seconds = sum(t["end"] - t["start"] for t in stamps) / VAD_SR
    return segments, voiced_seconds


def analyze_window(audio, sr, require_recent=True):
    """Analyze one rolling window of raw client audio.

    require_recent: live streams demand speech near the end of the window
    (stops stale labels after the speaker goes quiet); uploaded files that
    legitimately end in silence should pass require_recent=False.

    Returns a dict:
      status: 'silence' | 'speech'
      voiced: np.float32 array of speech-only samples at TARGET_SR (speech only)
      voiced_seconds: seconds of detected speech (speech only) - the caller
        uses this to gate confidence (emotion2vec+ is unreliable under ~3s)
      prosody: dict of vocal tone parameters (speech only)
    """
    audio = np.asarray(audio, dtype=np.float32)
    if sr != TARGET_SR:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SR)
        sr = TARGET_SR

    segments, voiced_seconds = speech_segments(audio, sr)
    if not segments or voiced_seconds < MIN_SPEECH_SECONDS:
        return {"status": "silence"}

    # No prediction unless the *end* of the window still contains speech -
    # this is what stops stale utterances from producing labels after the
    # speaker goes quiet.
    recent_ok = segments[-1][1] >= len(audio) - int(RECENT_WINDOW_S * sr)
    if require_recent and not recent_ok:
        return {"status": "silence"}

    speech_audio = np.concatenate([audio[s:e] for s, e in segments])

    # Level-normalize so mic gain does not skew the classifier input
    speech_rms = float(np.sqrt(np.mean(speech_audio ** 2)))
    speech_audio = np.clip(speech_audio * (NORM_RMS / max(speech_rms, 1e-6)), -1.0, 1.0)

    prosody = _prosody(speech_audio, sr)

    return {
        "status": "speech",
        "voiced": speech_audio.astype(np.float32),
        "voiced_seconds": round(float(voiced_seconds), 2),
        "prosody": prosody,
    }


def _prosody(speech_audio, sr):
    duration = len(speech_audio) / sr

    # Pitch statistics from stable voiced frames only (the stability filter
    # also discards artifacts at segment splice points)
    f0 = librosa.yin(speech_audio, fmin=65, fmax=400, sr=sr,
                     frame_length=FRAME, hop_length=HOP)
    rel_jump = np.abs(np.diff(f0)) / np.maximum(f0[:-1], 1e-9)
    stable = np.concatenate([[False], rel_jump < 0.15]) & (f0 > 65) & (f0 < 380)
    voiced_f0 = f0[stable]
    pitch_mean = float(np.mean(voiced_f0)) if len(voiced_f0) else 0.0
    pitch_std = float(np.std(voiced_f0)) if len(voiced_f0) else 0.0

    # Energy modulation within speech (input is already speech-only)
    rms = librosa.feature.rms(y=speech_audio, frame_length=FRAME, hop_length=HOP)[0]
    energy_cv = float(rms.std() / max(rms.mean(), 1e-9))

    onset_env = librosa.onset.onset_strength(y=speech_audio, sr=sr, hop_length=HOP)
    onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=HOP)
    rate = float(len(onsets) / max(duration, 1e-6))

    # Normalized 0-1 views of each parameter
    pitch_var_n = float(np.clip(pitch_std / 80.0, 0.0, 1.0))
    energy_mod_n = float(np.clip((energy_cv - 0.15) / 0.9, 0.0, 1.0))
    rate_n = float(np.clip(rate / 6.0, 0.0, 1.0))

    arousal = float(np.clip(0.45 * pitch_var_n + 0.30 * energy_mod_n + 0.25 * rate_n, 0.0, 1.0))

    return {
        "pitch_hz": round(pitch_mean, 1),
        "pitch_var_hz": round(pitch_std, 1),
        "pitch_var": round(pitch_var_n, 3),
        "energy_mod": round(energy_mod_n, 3),
        "speech_rate": round(rate, 2),
        "speech_rate_norm": round(rate_n, 3),
        "arousal": round(arousal, 3),
    }


UNIFORM_BLEND = 0.12      # label smoothing: kills 99.9% spikes specifically

def calibrate(probs, temperature=SOFTEN_T, blend=UNIFORM_BLEND):
    """Temperature-soften an uncalibrated softmax so 99.9% spikes cannot
    steamroll the prosody evidence in the fusion step. The uniform blend
    floors every class so a single extreme spike loses its stranglehold
    while moderate distributions stay close to what the model produced."""
    p = (1.0 - blend) * probs + blend / len(probs)
    p = np.power(np.maximum(p, 1e-9), 1.0 / temperature)
    return p / p.sum()


def reweight_by_affect(probs, emotions, arousal, valence=None,
                       temperature=SOFTEN_T, blend=UNIFORM_BLEND,
                       strength=AROUSAL_STRENGTH):
    """Downweight emotions whose expected arousal (and, when a learned
    estimate is available, valence) contradicts the measured delivery, then
    renormalize. Words don't matter here - only tone does.

    Calibration is engine-specific: the RAVDESS CNN needs heavy smoothing
    (T=2.0, blend=0.12) because its softmax spikes to 99.9% on garbage;
    emotion2vec+ scores are already sane, so it gets a lighter touch."""
    probs = calibrate(probs, temperature=temperature, blend=blend)
    weights = np.array([
        np.exp(-((arousal - AROUSAL_TARGETS.get(e, 0.5)) ** 2) / (2 * AROUSAL_SIGMA ** 2))
        for e in emotions
    ]) ** strength
    if valence is not None and VALENCE_STRENGTH > 0:
        weights = weights * np.array([
            np.exp(-((valence - VALENCE_TARGETS.get(e, 0.5)) ** 2) / (2 * VALENCE_SIGMA ** 2))
            for e in emotions
        ]) ** VALENCE_STRENGTH
    adjusted = probs * weights
    total = adjusted.sum()
    if total <= 0:
        return probs
    return adjusted / total
