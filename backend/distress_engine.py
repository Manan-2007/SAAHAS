"""SAHAAS distress model: rates a message 0 none / 1 low / 2 moderate / 3 high
(see distress_training/). Loads lazily and hot-reloads after retraining;
until a model is trained, score() returns None and chat crisis detection
relies on keywords alone.
"""

import threading
from pathlib import Path

import yaml

TRAIN_DIR = Path(__file__).resolve().parent / "distress_training"
LEVELS = ["none", "low", "moderate", "high"]


class DistressEngine:
    def __init__(self):
        with open(TRAIN_DIR / "config.yaml") as f:
            cfg = yaml.safe_load(f)
        self.model_dir = TRAIN_DIR / cfg.get("model_dir", "model")
        self.max_length = int(cfg["training"]["max_length"])
        self.high_risk_threshold = float(cfg["serving"]["high_risk_threshold"])
        self._lock = threading.Lock()
        self._model = self._tok = None
        self._mtime = None

    def _weights_mtime(self):
        f = self.model_dir / "config.json"
        return f.stat().st_mtime if f.is_file() else None

    def _ensure_loaded(self):
        mtime = self._weights_mtime()
        if mtime is None or mtime == self._mtime:
            return
        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            tok = AutoTokenizer.from_pretrained(self.model_dir)
            model = AutoModelForSequenceClassification.from_pretrained(self.model_dir).eval()
        except Exception as exc:        # mid-swap during retraining: keep the current model
            print(f"[distress] could not load model yet ({exc})")
            return
        self._tok, self._model, self._mtime = tok, model, mtime
        print(f"[distress] model loaded from {self.model_dir}")

    def score(self, text):
        import torch
        with self._lock:
            self._ensure_loaded()
            if self._model is None:
                return None
            enc = self._tok(text, truncation=True, max_length=self.max_length, return_tensors="pt")
            with torch.no_grad():
                probs = torch.softmax(self._model(**enc).logits[0].float(), dim=-1).tolist()
        level = max(range(4), key=probs.__getitem__)
        return {
            "level": level,
            "label": LEVELS[level],
            "score": round(sum(i * p for i, p in enumerate(probs)) / 3 * 100, 1),   # 0-100
            "high_risk": probs[3] >= self.high_risk_threshold,
            "probabilities": {LEVELS[i]: round(p, 4) for i, p in enumerate(probs)},
        }

    def status(self):
        with self._lock:
            self._ensure_loaded()
            return {"ready": self._model is not None}
