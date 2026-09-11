"""Speech-to-text (Whisper large-v3-turbo) and text-to-speech (Kokoro-82M).

Each engine owns one worker thread: MLX GPU streams belong to the thread that
created them, so a model must be loaded and used on the same thread. Both
load in the background at startup.
"""

import importlib.util
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import yaml

HERE = Path(__file__).resolve().parent
SUPPORTED = ("en", "hi")


def load_config():
    with open(HERE / "config.yaml") as f:
        return yaml.safe_load(f)


def _status(future):
    if not future.done():
        return "loading"
    return f"failed: {future.exception()}" if future.exception() else "ready"


class ASREngine:
    def __init__(self, cfg):
        self.model_id = cfg["asr"]["model"]
        self._worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="asr-mlx")
        self._loading = self._worker.submit(self._warm_up)

    def _warm_up(self):
        import mlx_whisper
        mlx_whisper.transcribe(np.zeros(16000, dtype=np.float32), path_or_hf_repo=self.model_id, language="en")

    def _transcribe(self, audio16, language):
        import mlx_whisper
        options = dict(path_or_hf_repo=self.model_id, temperature=0.0, condition_on_previous_text=False)
        result = mlx_whisper.transcribe(audio16, language=language, **options)
        detected = language or result.get("language")
        if detected not in SUPPORTED:
            # Whisper often labels Hindi speech as Urdu (in Urdu script); other
            # languages have no voice to answer in yet, so fall back to English
            detected = "hi" if detected == "ur" else "en"
            result = mlx_whisper.transcribe(audio16, language=detected, **options)
        return {"text": result["text"].strip(), "language": detected}

    def transcribe(self, audio16, language=None):
        """audio16: float32 mono at 16 kHz. language: 'en' / 'hi', or None to detect."""
        return self._worker.submit(self._transcribe, np.asarray(audio16, dtype=np.float32), language)

    def status(self):
        return _status(self._loading)


class TTSEngine:
    def __init__(self, cfg):
        tts = cfg["tts"]
        self.model_id = tts["model"]
        self.voices = tts["voices"]
        self.lang_codes = tts["lang_codes"]
        self.sample_rate = int(tts["sample_rate"])
        self.model = None
        self._worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="tts-mlx")
        self._loading = self._worker.submit(self._load)

    def _load(self):
        from mlx_audio.tts.utils import load_model
        self.model = load_model(self.model_id)
        self.sample_rate = int(getattr(self.model, "sample_rate", self.sample_rate))
        self._synthesize("Hello.", "en", 1.0)          # warm both language pipelines
        self._synthesize("नमस्ते।", "hi", 1.0)

    def _synthesize(self, text, language, speed):
        language = language if language in self.voices else "en"
        chunks = [np.asarray(segment.audio, dtype=np.float32).reshape(-1)
                  for segment in self.model.generate(text, voice=self.voices[language], speed=speed,
                                                     lang_code=self.lang_codes[language])]
        audio = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32)
        return (np.clip(audio, -1.0, 1.0) * 32767).astype("<i2")

    def synthesize(self, text, language="en", speed=1.0):
        """Returns a Future of int16 mono PCM at self.sample_rate."""
        return self._worker.submit(self._synthesize, text, language, speed)

    def status(self):
        return _status(self._loading)


class VoiceAgent:
    def __init__(self):
        self.cfg = load_config()
        self.asr = ASREngine(self.cfg)
        self.tts = TTSEngine(self.cfg)

    def status(self):
        return {"asr": self.asr.status(), "tts": self.tts.status()}


def load_voice_agent():
    missing = [p for p in ("mlx_whisper", "mlx_audio", "misaki") if importlib.util.find_spec(p) is None]
    if missing:
        print(f"[voice-agent] missing {', '.join(missing)} (Apple Silicon only); /ws/converse disabled")
        return None
    print("[voice-agent] loading speech-to-text and text-to-speech in the background")
    return VoiceAgent()
