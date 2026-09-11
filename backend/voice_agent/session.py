"""One live voice conversation over the /ws/converse WebSocket.

You speak; a pause ends your turn. The turn is transcribed (Whisper) while
the emotion models read how it sounded; the chat model streams a reply
shaped by both, and each sentence is spoken (Kokoro) as soon as it's ready,
at a pace matched to you. Speaking over the agent interrupts it (barge-in).

Protocol
  client -> server
    text   {"type": "start", "sampleRate": 48000, "language": "auto"|"en"|"hi",
            "token"?: "...", "barge_in"?: true, "greet"?: true}
    binary Float32 mono PCM from the microphone, continuously
    text   {"type": "interrupt"}       stop the agent now (e.g. a button)
    text   {"type": "playback_done"}   the client finished playing agent audio
    text   {"type": "end"}
  server -> client
    {"type": "ready", "sampleRate": 24000, "barge_in": true}
    {"type": "state", "state": "listening" | "thinking" | "speaking"}
    {"type": "user_turn", "transcript", "language", "voice": {emotion, tone_word, certainty, arousal, ...}}
    {"type": "crisis", "message"}
    {"type": "agent_text", "text"}                        one sentence, just before its audio
    {"type": "agent_audio", "index", "sampleRate", "samples"}, then one binary frame:
                                                          int16 mono PCM of that sentence
    {"type": "agent_done", "reply", "interrupted"}
    {"type": "interrupted"}                               stop playback immediately
    {"type": "error", "detail"}
"""

import asyncio
import json
import re
import threading
import time

import librosa
import numpy as np
from starlette.concurrency import run_in_threadpool
from starlette.websockets import WebSocketDisconnect

from . import style

ASR_SR = 16000
MAX_HISTORY = 16
VAD_STEP_S = 0.25            # how often the turn detector looks at new audio
PLAYBACK_MARGIN_S = 0.3
SENTENCE_END = re.compile(r"(?<=[.!?।…])\s+|\n+")
GREETINGS = {
    "en": "Hi! It's good to hear your voice. How's your day going?",
    "hi": "नमस्ते! आपकी आवाज़ सुनकर अच्छा लगा। आज आपका दिन कैसा रहा?",
}


class ConversationSession:
    def __init__(self, ws, agent, deps):
        self.ws, self.agent, self.deps = ws, agent, deps
        self.turn_cfg = agent.cfg["turn"]
        self.max_tokens = agent.cfg["reply"]["max_tokens"]
        self.sr = 48000
        self.language = "auto"
        self.barge_in = True
        self.user = None
        self.buffer = np.zeros(0, dtype=np.float32)
        self.checked = 0
        self.history = []
        self.turn_analyses = []
        self.agent_task = None
        self.cancel = threading.Event()
        self.playback_until = 0.0
        self.was_speaking = False
        self.speaker = deps.SpeakerSession()
        self._send_lock = asyncio.Lock()

    # ------------------------------------------------------------ plumbing

    async def send_json(self, data):
        async with self._send_lock:
            await self.ws.send_json(data)

    async def send_audio(self, meta, pcm):
        async with self._send_lock:
            await self.ws.send_json(meta)
            await self.ws.send_bytes(pcm.tobytes())

    def agent_active(self):
        """Talking, or its audio is still playing on the client."""
        busy = self.agent_task is not None and not self.agent_task.done()
        return busy or time.monotonic() < self.playback_until

    async def run(self):
        try:
            while True:
                message = await self.ws.receive()
                if message["type"] == "websocket.disconnect":
                    break
                if message.get("text") is not None:
                    if await self._on_control(message["text"]) == "end":
                        break
                elif message.get("bytes"):
                    await self._on_audio(message["bytes"])
        except WebSocketDisconnect:
            pass
        finally:
            self.cancel.set()
            if self.agent_task is not None:
                self.agent_task.cancel()
            if self.user is not None and self.turn_analyses:
                try:
                    await run_in_threadpool(self.deps.record_voice, self.user, self.turn_analyses)
                except Exception as exc:
                    print(f"[voice-agent] could not save the conversation's voice check-in: {exc}")

    # ------------------------------------------------------------ input

    async def _on_control(self, text):
        try:
            msg = json.loads(text)
        except ValueError:
            return None
        kind = msg.get("type")
        if kind == "start":
            self.sr = int(msg.get("sampleRate", self.sr))
            language = msg.get("language", "auto")
            self.language = language if language in ("auto", "en", "hi") else "auto"
            self.barge_in = bool(msg.get("barge_in", True))
            if msg.get("token"):
                found = await run_in_threadpool(self.deps.user_for_token, str(msg["token"]))
                self.user = found if found and found["role"] == "victim" else None
                if self.user is None:
                    await self.send_json({"type": "error", "detail": "Invalid token - this conversation will not be saved"})
            await self.send_json({"type": "ready", "sampleRate": self.agent.tts.sample_rate, "barge_in": self.barge_in})
            if msg.get("greet", True):
                self.agent_task = asyncio.create_task(self._greet())
            else:
                await self.send_json({"type": "state", "state": "listening"})
        elif kind == "interrupt":
            await self._interrupt()
        elif kind == "playback_done":
            if self.agent_task is None or self.agent_task.done():
                self.playback_until = 0.0
        elif kind == "end":
            return "end"
        return None

    async def _on_audio(self, data):
        active = self.agent_active()
        if active and not self.cancel.is_set():
            self.was_speaking = True
        elif not active and self.was_speaking:
            # The agent just finished: what the mic heard meanwhile was its own
            # voice (echo) or a backchannel, not a new turn
            self.was_speaking = False
            self.buffer = self.buffer[-int(PLAYBACK_MARGIN_S * self.sr):]
            self.checked = 0
        if active and not self.barge_in:
            return

        self.buffer = np.concatenate([self.buffer, np.frombuffer(data, dtype=np.float32)])
        if len(self.buffer) - self.checked < int(VAD_STEP_S * self.sr):
            return
        self.checked = len(self.buffer)
        segments, voiced = await run_in_threadpool(self.deps.speech_segments, self.buffer.copy(), self.sr)
        if not segments:
            keep = int(0.5 * self.sr)
            self.buffer = self.buffer[-keep:]
            self.checked = len(self.buffer)
            return

        if active:
            if not self.cancel.is_set() and voiced * 1000 >= self.turn_cfg["barge_in_ms"]:
                await self._interrupt()
            return        # keep listening; the turn ends once the agent has stopped

        tail_ms = (len(self.buffer) - segments[-1][1]) / self.sr * 1000
        too_long = len(self.buffer) / self.sr >= self.turn_cfg["max_turn_s"]
        if voiced * 1000 >= self.turn_cfg["min_speech_ms"] and (tail_ms >= self.turn_cfg["end_silence_ms"] or too_long):
            end = segments[-1][1]
            audio = self.buffer[:end].copy()
            self.buffer = self.buffer[end:]
            self.checked = 0
            self.agent_task = asyncio.create_task(self._respond(audio))

    async def _interrupt(self):
        if not self.agent_active():
            return
        self.cancel.set()
        self.playback_until = 0.0
        self.was_speaking = False
        await self.send_json({"type": "interrupted"})

    # ------------------------------------------------------------ one turn

    async def _respond(self, audio):
        self.cancel = cancel = threading.Event()
        deps = self.deps
        try:
            await self.send_json({"type": "state", "state": "thinking"})
            audio16 = await run_in_threadpool(librosa.resample, audio, orig_sr=self.sr, target_sr=ASR_SR)
            hint = None if self.language == "auto" else self.language
            heard, analysis = await asyncio.gather(
                asyncio.wrap_future(self.agent.asr.transcribe(audio16, hint)),
                run_in_threadpool(deps.analyze, audio, self.sr, False, True, self.speaker, False))
            text = heard["text"]
            if not text or cancel.is_set():
                await self.send_json({"type": "state", "state": "listening"})
                return
            language = heard["language"] if heard["language"] in style.LANGUAGE_HINTS else "en"
            voice = None
            if analysis.get("status") == "speech":
                voice = style.voice_summary(analysis, deps.emotions, deps.pick_headline)
                analysis["transcript"] = text
                self.turn_analyses.append(analysis)

            distress = await run_in_threadpool(deps.distress.score, text)
            crisis = bool(deps.crisis_re.search(text) or (distress and distress["high_risk"]))
            await self.send_json({"type": "user_turn", "transcript": text, "language": language,
                                  "voice": {k: v for k, v in (voice or {}).items() if k != "description"} or None})
            if crisis:
                await self.send_json({"type": "crisis", "message": deps.crisis_message()})
            if self.user is not None:
                await run_in_threadpool(deps.record_chat, self.user, text, distress, crisis)

            self.history = (self.history + [{"role": "user", "content": text}])[-MAX_HISTORY:]
            await self._reply(cancel, language, voice, crisis)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await self.send_json({"type": "error", "detail": f"Could not answer that turn: {exc}"})
            await self.send_json({"type": "state", "state": "listening"})

    async def _reply(self, cancel, language, voice, crisis):
        loop = asyncio.get_running_loop()
        sentences = asyncio.Queue()
        pending = [""]
        tone = style.reply_style(voice)

        def post(item):                              # chat model thread -> event loop
            try:
                loop.call_soon_threadsafe(sentences.put_nowait, item)
            except RuntimeError:                     # the connection (and its loop) is already gone
                pass

        def on_text(piece):
            pending[0] += piece
            parts = SENTENCE_END.split(pending[0])
            for sentence in parts[:-1]:
                post(sentence)
            pending[0] = parts[-1]

        def on_finished(_future):
            post(pending[0])
            post(None)

        # Hindi: the model answers in English and each sentence is translated
        translate = language != "en" and self.deps.chat.translation_ready(language)
        job = self.deps.chat.submit_stream(
            list(self.history), on_text, cancel.is_set,
            # only a confident read of their voice reaches the chat model
            voice_context=voice["description"] if voice and voice["certainty"] == "high" else None,
            spoken=style.spoken_instructions(tone, "en" if translate else language),
            at_risk=crisis, max_tokens=self.max_tokens,
            reply_language=language if translate else None)
        job.add_done_callback(on_finished)

        spoken = await self._speak(sentences, cancel, language, tone["speed"])
        try:
            result = await asyncio.wrap_future(job)
        except Exception as exc:
            await self.send_json({"type": "error", "detail": f"Chat model failed: {exc}"})
            result = None
        reply = " ".join(spoken) if cancel.is_set() or result is None else result["reply"]
        if reply:
            self.history = (self.history + [{"role": "assistant", "content": reply}])[-MAX_HISTORY:]
        await self.send_json({"type": "agent_done", "reply": reply, "interrupted": cancel.is_set()})
        await self.send_json({"type": "state", "state": "listening"})

    async def _speak(self, sentences, cancel, language, speed):
        """Speaks sentences as they arrive; returns what was actually said."""
        spoken, index = [], 0
        while True:
            sentence = await sentences.get()
            if sentence is None:
                return spoken
            sentence = style.clean_for_speech(sentence)
            if cancel.is_set() or not sentence:
                continue
            pcm = await asyncio.wrap_future(self.agent.tts.synthesize(sentence, language, speed))
            if cancel.is_set():
                continue
            if index == 0:
                await self.send_json({"type": "state", "state": "speaking"})
            await self._send_speech(sentence, pcm, index)
            spoken.append(sentence)
            index += 1

    async def _send_speech(self, sentence, pcm, index):
        sr = self.agent.tts.sample_rate
        await self.send_json({"type": "agent_text", "text": sentence})
        await self.send_audio({"type": "agent_audio", "index": index, "sampleRate": sr, "samples": len(pcm)}, pcm)
        self.playback_until = max(self.playback_until, time.monotonic()) + len(pcm) / sr + PLAYBACK_MARGIN_S

    async def _greet(self):
        self.cancel = cancel = threading.Event()
        language = self.language if self.language in GREETINGS else "en"
        text = GREETINGS[language]
        pcm = await asyncio.wrap_future(self.agent.tts.synthesize(text, language, 1.0))
        if not cancel.is_set():
            await self.send_json({"type": "state", "state": "speaking"})
            await self._send_speech(text, pcm, 0)
            self.history.append({"role": "assistant", "content": text})
        await self.send_json({"type": "agent_done", "reply": text, "interrupted": cancel.is_set()})
        await self.send_json({"type": "state", "state": "listening"})
