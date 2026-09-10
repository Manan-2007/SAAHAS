"""Native port of 3loi/SER-Odyssey-Baseline-WavLM-Categorical (MIT).

The Odyssey 2024 SER Challenge baseline: WavLM-Large -> attentive statistics
pooling -> MLP head -> 8 emotion logits, trained on MSP-Podcast. The hub
repo's trust_remote_code implementation targets transformers v4 and cannot
load under v5 (it calls AutoModel.from_pretrained inside __init__, which
collides with v5's meta-device initialization), so the architecture is
replicated here 1:1 from the repo's pipeline_utils.py and the published
checkpoint weights are loaded directly. No remote code execution.
"""

import json

import torch
import torch.nn as nn
import torch.nn.functional as F
from huggingface_hub import hf_hub_download
from transformers import AutoConfig, WavLMModel

MODEL_ID = "3loi/SER-Odyssey-Baseline-WavLM-Categorical"


class AttentiveStatisticsPooling(nn.Module):
    """Attentive Statistics Pooling (Okabe et al., 2018), as in the repo."""

    def __init__(self, input_size):
        super().__init__()
        self.sap_linear = nn.Linear(input_size, input_size)
        self.attention = nn.Parameter(torch.FloatTensor(input_size, 1))

    @staticmethod
    def compute_length_from_mask(mask):
        wav_lens = torch.sum(mask, dim=1)
        feat_lens = torch.div(wav_lens - 1, 16000 * 0.02, rounding_mode="floor") + 1
        return feat_lens.int().tolist()

    def forward(self, xs, mask):
        feat_lens = self.compute_length_from_mask(mask)
        pooled_list = []
        for x, feat_len in zip(xs, feat_lens):
            x = x[:feat_len].unsqueeze(0)
            h = torch.tanh(self.sap_linear(x))
            w = torch.matmul(h, self.attention).squeeze(dim=2)
            w = F.softmax(w, dim=1).view(x.size(0), x.size(1), 1)
            mu = torch.sum(x * w, dim=1)
            rh = torch.sqrt((torch.sum((x ** 2) * w, dim=1) - mu ** 2).clamp(min=1e-5))
            pooled_list.append(torch.cat((mu, rh), 1).squeeze(0))
        return torch.stack(pooled_list)


class EmotionRegression(nn.Module):
    def __init__(self, input_dim, hidden_dim, num_layers, output_dim, dropout=0.5):
        super().__init__()
        self.fc = nn.ModuleList([nn.Sequential(
            nn.Linear(input_dim, hidden_dim), nn.LayerNorm(hidden_dim),
            nn.ReLU(), nn.Dropout(dropout),
        )])
        for _ in range(num_layers - 1):
            self.fc.append(nn.Sequential(
                nn.Linear(hidden_dim, hidden_dim), nn.LayerNorm(hidden_dim),
                nn.ReLU(), nn.Dropout(dropout),
            ))
        self.out = nn.Sequential(nn.Linear(hidden_dim, output_dim))
        self.inp_drop = nn.Dropout(dropout)

    def forward(self, x):
        h = self.inp_drop(x)
        for fc in self.fc:
            h = fc(h)
        return self.out(h)


class OdysseySER(nn.Module):
    def __init__(self, ssl_config, num_classes, hidden_size, classifier_layers, dropout):
        super().__init__()
        self.ssl_model = WavLMModel(ssl_config)
        self.pool_model = AttentiveStatisticsPooling(hidden_size)
        self.ser_model = EmotionRegression(
            hidden_size * 2, hidden_size, classifier_layers, num_classes, dropout=dropout)

    def forward(self, x, mask):
        ssl = self.ssl_model(x, attention_mask=mask).last_hidden_state
        pooled = self.pool_model(ssl, mask)
        return self.ser_model(pooled)


def load_odyssey_ser():
    """Downloads config + weights from the hub and returns (model, config dict).

    The config dict carries sampling_rate, mean, std, and id2label.
    """
    with open(hf_hub_download(MODEL_ID, "config.json")) as f:
        cfg = json.load(f)

    ssl_config = AutoConfig.from_pretrained(cfg.get("ssl_type", "microsoft/wavlm-large"))
    model = OdysseySER(
        ssl_config,
        num_classes=cfg.get("num_classes", 8),
        hidden_size=cfg.get("hidden_size", 1024),
        classifier_layers=cfg.get("classifier_hidden_layers", 1),
        dropout=cfg.get("classifier_dropout_prob", 0.5),
    )

    try:
        from safetensors.torch import load_file
        state = load_file(hf_hub_download(MODEL_ID, "model.safetensors"))
    except Exception:
        state = torch.load(hf_hub_download(MODEL_ID, "pytorch_model.bin"),
                           map_location="cpu", weights_only=True)

    missing, unexpected = model.load_state_dict(state, strict=False)
    # The classifier head MUST load fully; backbone may differ in harmless
    # buffers (e.g. masked_spec_embed) across transformers versions.
    head_missing = [k for k in missing if not k.startswith("ssl_model.")]
    if head_missing or len(missing) > 10:
        raise RuntimeError(f"checkpoint mismatch: missing={missing[:5]} unexpected={unexpected[:5]}")

    model.eval()
    return model, cfg
