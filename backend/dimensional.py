"""Learned arousal / dominance / valence from raw audio.

Wraps audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim (Wagner et al.,
"Dawn of the transformer era in speech emotion recognition", IEEE TPAMI 2023):
a 12-layer pruned wav2vec2-large fine-tuned on MSP-Podcast v1.7 - natural
podcast speech, not acted studio clips. Outputs are in ~0..1.

This replaces the hand-tuned pitch/energy/speech-rate arousal heuristic,
which measurably misreads delivery (it scored a sad CREMA-D clip at arousal
0.65). Valence additionally separates happy from angry at equal arousal -
something no arousal-only signal can do.

License note: the checkpoint is CC-BY-NC-SA 4.0 (research / non-commercial).
"""

import numpy as np
import librosa
import torch
import torch.nn as nn
from transformers import Wav2Vec2Processor
from transformers.models.wav2vec2.modeling_wav2vec2 import (
    Wav2Vec2Model,
    Wav2Vec2PreTrainedModel,
)

DIM_SR = 16000
MODEL_ID = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"


class RegressionHead(nn.Module):
    """Dense + tanh + projection head, as published in audeering/w2v2-how-to."""

    def __init__(self, config):
        super().__init__()
        self.dense = nn.Linear(config.hidden_size, config.hidden_size)
        self.dropout = nn.Dropout(config.final_dropout)
        self.out_proj = nn.Linear(config.hidden_size, config.num_labels)

    def forward(self, features):
        x = self.dropout(features)
        x = torch.tanh(self.dense(x))
        x = self.dropout(x)
        return self.out_proj(x)


class EmotionModel(Wav2Vec2PreTrainedModel):
    def __init__(self, config):
        super().__init__(config)
        self.config = config
        self.wav2vec2 = Wav2Vec2Model(config)
        self.classifier = RegressionHead(config)
        self.post_init()   # transformers v5: init_weights() alone skips required setup

    def forward(self, input_values):
        hidden_states = self.wav2vec2(input_values)[0]
        pooled = torch.mean(hidden_states, dim=1)
        return self.classifier(pooled)


class DimensionalEngine:
    name = "audeering w2v2 MSP-Dim"

    def __init__(self):
        self.processor = Wav2Vec2Processor.from_pretrained(MODEL_ID)
        self.model = EmotionModel.from_pretrained(MODEL_ID)
        self.model.eval()

    def predict(self, audio, sr):
        """audio: float32 speech samples. Returns {arousal, dominance, valence} in 0..1."""
        audio = np.asarray(audio, dtype=np.float32)
        if sr != DIM_SR:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=DIM_SR)
        inputs = self.processor(audio, sampling_rate=DIM_SR, return_tensors="pt")
        with torch.no_grad():
            logits = self.model(inputs.input_values)[0]
        arousal, dominance, valence = (float(np.clip(v, 0.0, 1.0)) for v in logits.tolist())
        return {"arousal": arousal, "dominance": dominance, "valence": valence}


def load_dimensional_engine():
    """Returns an engine or None (no transformers / no checkpoint / no network).
    Callers fall back to the heuristic prosody arousal when this is None."""
    try:
        return DimensionalEngine()
    except Exception as exc:
        print(f"[dimensional] audeering model unavailable ({exc}); heuristic arousal only")
        return None
