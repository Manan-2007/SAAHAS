"""Per-session speaker calibration.

Different voices have different resting registers: one person's relaxed
delivery reads as arousal 0.5 to a population-trained model, another's as
0.2. Cross-corpus SER work consistently finds per-speaker normalization
among the highest-value adaptations (speaker z-norm; EMO-TTA-style online
statistics). This module implements a bounded, label-guided version for the
live stream:

- Utterances the pipeline itself classifies as neutral/calm (with decent
  confidence and enough voiced audio) contribute to a running baseline of
  the speaker's resting arousal/valence.
- Once the baseline has enough samples, the dimensional signal fed to the
  fusion is recentered so THIS speaker's resting register maps to the
  population's neutral expectation.
- The correction is capped: a session that is genuinely angry throughout
  contributes no neutral-labeled samples, so it never normalizes itself
  away - and even a poisoned baseline can shift arousal by at most the cap.
"""

from collections import deque

import numpy as np

# Population reference points the baseline is recentered against
AROUSAL_REF = 0.35        # matches AROUSAL_TARGETS["neutral"] in analysis.py
VALENCE_REF = 0.50

MIN_SAMPLES = 3           # baseline engages after this many neutral utterances
MAX_SAMPLES = 8           # rolling window; adapts if the speaker's register drifts
AROUSAL_CAP = 0.20        # max recentering shift
VALENCE_CAP = 0.15

# An utterance feeds the baseline only if the pipeline called it
# neutral/calm at this confidence with this much voiced audio
UPDATE_MIN_PROB = 0.35
UPDATE_MIN_VOICED = 1.5


class SpeakerSession:
    """One instance per live connection (or per simulated session in eval)."""

    def __init__(self):
        self._arousal = deque(maxlen=MAX_SAMPLES)
        self._valence = deque(maxlen=MAX_SAMPLES)

    @property
    def active(self):
        return len(self._arousal) >= MIN_SAMPLES

    def offsets(self):
        """(arousal_offset, valence_offset) - what to subtract, capped."""
        if not self.active:
            return 0.0, 0.0
        a = float(np.clip(np.median(self._arousal) - AROUSAL_REF, -AROUSAL_CAP, AROUSAL_CAP))
        v = 0.0
        if len(self._valence) >= MIN_SAMPLES:
            v = float(np.clip(np.median(self._valence) - VALENCE_REF, -VALENCE_CAP, VALENCE_CAP))
        return a, v

    def adjust(self, arousal, valence):
        """Recenter the dimensional signal against this speaker's baseline."""
        off_a, off_v = self.offsets()
        arousal = float(np.clip(arousal - off_a, 0.0, 1.0))
        if valence is not None:
            valence = float(np.clip(valence - off_v, 0.0, 1.0))
        return arousal, valence

    def update(self, emotion, top_prob, arousal, valence, voiced_seconds):
        """Feed one finalized utterance's outcome back into the baseline."""
        if (emotion in ("neutral", "calm")
                and top_prob >= UPDATE_MIN_PROB
                and voiced_seconds >= UPDATE_MIN_VOICED):
            self._arousal.append(float(arousal))
            if valence is not None:
                self._valence.append(float(valence))
