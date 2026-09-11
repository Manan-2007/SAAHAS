"""Voice conversation tests with stand-in models: turn-taking, the protocol,
emotion-aware styling, crisis handling and barge-in - no GPU needed."""

import json
import sys
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402
from fastapi import FastAPI, WebSocket  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from chat_engine import CRISIS_RE  # noqa: E402
from emotion_engine import EMOTIONS, pick_headline  # noqa: E402
from speaker_session import SpeakerSession  # noqa: E402
from voice_agent import engines, style  # noqa: E402
from voice_agent.session import ConversationSession  # noqa: E402

SR = 16000
CHUNK = 4000                     # 0.25 s per frame
TTS_SR = 24000


def done(value):
    f = Future()
    f.set_result(value)
    return f


def energy_segments(audio, sr):
    """Stand-in VAD: 10 ms frames louder than 0.05 are speech."""
    frame = sr // 100
    loud = [np.abs(audio[i:i + frame]).mean() > 0.05 for i in range(0, len(audio), frame)]
    segments, start = [], None
    for i, is_loud in enumerate(loud + [False]):
        if is_loud and start is None:
            start = i
        elif not is_loud and start is not None:
            segments.append((start * frame, min(i * frame, len(audio))))
            start = None
    return segments, sum(e - s for s, e in segments) / sr


def sad_analysis(audio, sr, *_):
    probs = np.array([0.02, 0.05, 0.03, 0.10, 0.02, 0.18, 0.55, 0.05])   # sad
    return {"status": "speech", "probs": probs, "voiced_seconds": 2.5,
            "prosody": {"arousal": 0.2, "valence": 0.25, "pitch_hz": 170.0, "pitch_var": 0.2, "speech_rate": 2.4}}


class FakeChat:
    def __init__(self, pieces):
        self.pieces = pieces
        self.calls = []
        self.pool = ThreadPoolExecutor(max_workers=1)

    def submit_stream(self, messages, on_text, should_stop, **kwargs):
        self.calls.append({"messages": messages, **kwargs})

        def run():
            text = ""
            for piece in self.pieces:
                if should_stop():
                    break
                text += piece
                on_text(piece)
                threading.Event().wait(0.01)
            return {"reply": text, "crisis": kwargs["at_risk"], "crisis_message": None}
        return self.pool.submit(run)


def build(transcript, pieces, tts_seconds=0.2):
    chat = FakeChat(pieces)
    agent = SimpleNamespace(
        cfg=engines.load_config(),
        asr=SimpleNamespace(transcribe=lambda audio, lang: done({"text": transcript, "language": "en"})),
        tts=SimpleNamespace(sample_rate=TTS_SR,
                            synthesize=lambda text, lang, speed: done(np.zeros(int(TTS_SR * tts_seconds), "<i2"))))
    deps = SimpleNamespace(
        analyze=sad_analysis, speech_segments=energy_segments, chat=chat,
        distress=SimpleNamespace(score=lambda text: {"score": 10.0, "high_risk": False}),
        crisis_re=CRISIS_RE, crisis_message=lambda: "Emergency 112", record_chat=lambda *a: None,
        record_voice=lambda *a: None, user_for_token=lambda token: None,
        emotions=EMOTIONS, pick_headline=pick_headline, SpeakerSession=SpeakerSession)
    app = FastAPI()

    @app.websocket("/ws/converse")
    async def converse(ws: WebSocket):
        await ws.accept()
        await ConversationSession(ws, agent, deps).run()

    return TestClient(app), chat


def speech(seconds):
    t = np.arange(int(SR * seconds)) / SR
    return (0.5 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


def silence(seconds):
    return np.zeros(int(SR * seconds), dtype=np.float32)


def send_audio(ws, audio):
    for i in range(0, len(audio), CHUNK):
        ws.send_bytes(audio[i:i + CHUNK].tobytes())


def collect(ws, until):
    events = []
    while True:
        msg = ws.receive()
        if msg.get("bytes") is not None:
            events.append({"type": "_audio_bytes", "size": len(msg["bytes"])})
            continue
        event = json.loads(msg["text"])
        events.append(event)
        if event["type"] == until:
            return events


def start(ws, **extra):
    ws.send_text(json.dumps({"type": "start", "sampleRate": SR, "greet": False, **extra}))
    assert collect(ws, "ready")[-1]["sampleRate"] == TTS_SR


def test_one_full_turn_hears_emotion_and_speaks_back():
    client, chat = build("I just feel so tired of everything.", ["I hear how tired you are. ", "I'm right here."])
    with client.websocket_connect("/ws/converse") as ws:
        start(ws)
        send_audio(ws, np.concatenate([speech(1.2), silence(1.0)]))
        events = collect(ws, "agent_done")
    types = [e["type"] for e in events]
    turn = next(e for e in events if e["type"] == "user_turn")
    assert turn["transcript"] == "I just feel so tired of everything."
    assert turn["voice"]["emotion"] == "sad" and turn["voice"]["tone_word"] == "heavy"
    assert types.index("user_turn") < types.index("agent_text") < types.index("agent_done")
    assert [e["text"] for e in events if e["type"] == "agent_text"] == ["I hear how tired you are.", "I'm right here."]
    assert sum(e["type"] == "_audio_bytes" for e in events) == 2
    call = chat.calls[0]
    assert "heavy" in call["voice_context"] and "slowly" in call["voice_context"]
    assert "gently" in call["spoken"]


def test_short_noise_is_not_a_turn():
    client, chat = build("hm", ["ok."])
    with client.websocket_connect("/ws/converse") as ws:
        start(ws)
        send_audio(ws, np.concatenate([speech(0.2), silence(1.5)]))
        ws.send_text(json.dumps({"type": "end"}))
    assert chat.calls == []


def test_crisis_turn_warns_and_puts_agent_in_safety_mode():
    client, chat = build("मुझे अब जीने का मन नहीं करता", ["मैं आपके साथ हूँ।"])
    with client.websocket_connect("/ws/converse") as ws:
        start(ws)
        send_audio(ws, np.concatenate([speech(1.2), silence(1.0)]))
        events = collect(ws, "agent_done")
    assert any(e["type"] == "crisis" and "112" in e["message"] for e in events)
    assert chat.calls[0]["at_risk"] is True


def test_speaking_over_the_agent_interrupts_it():
    client, chat = build("Can you help me calm down?", ["Let's breathe together. "] * 3, tts_seconds=3.0)
    with client.websocket_connect("/ws/converse") as ws:
        start(ws)
        send_audio(ws, np.concatenate([speech(1.2), silence(1.0)]))
        collect(ws, "agent_audio")
        send_audio(ws, speech(1.0))               # user talks over the agent
        events = collect(ws, "interrupted")
    assert events[-1]["type"] == "interrupted"


def test_reply_style_meets_distress_gently():
    sad = {"emotion": "sad", "arousal": 0.2}
    assert style.reply_style(sad) == {"delivery": "gentle", "speed": 0.9}
    assert style.reply_style({"emotion": "angry", "arousal": 0.85})["delivery"] == "calm"
    assert style.reply_style({"emotion": "happy", "arousal": 0.6})["speed"] > 1.0
    assert style.reply_style(None) == {"delivery": "steady", "speed": 1.0}
    assert "Devanagari" in style.spoken_instructions({"delivery": "steady"}, "hi")


def test_clean_for_speech_strips_markdown_and_emoji():
    assert style.clean_for_speech("**You're safe** here 💛") == "You're safe here"
    assert style.clean_for_speech("1. Breathe in slowly") == "Breathe in slowly"
