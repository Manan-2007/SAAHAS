"""Chat replies from an Azure OpenAI deployment instead of the local MLX model.

Selected with CHAT_BACKEND=azure (backend/.env). It has the same interface as
chat_engine.ChatEngine, so /chat, the voice call and the conversation insights
use it unchanged, and it never loads the local model.

⚠ With this backend the person's messages leave the machine: they are sent to
the Azure deployment. The crisis check still runs locally, on the original words,
before anything is sent (main.py), and the safety pointer is still guaranteed by
code (ensure_points_to_help), not left to the model.

Settings (environment):
  AZURE_OPENAI_API_KEY      the key
  AZURE_OPENAI_ENDPOINT     the full chat-completions URL, including ?api-version=
  AZURE_OPENAI_DEPLOYMENT   shown in /health (e.g. gpt-4o)
  AZURE_OPENAI_API_VERSION  used only when the endpoint URL has no api-version
"""

import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

from chat_engine import (CRISIS_RE, MAX_HISTORY, POINTS_TO_HELP, SAFETY_FALLBACK, TONE_WORDS,
                         VOICE_HINT_RULE, load_config)

TRAIN_DIR = Path(__file__).resolve().parent / "chat_training"
PROMPT_FILE = TRAIN_DIR / "system_prompt_azure.txt"
TIMEOUT = httpx.Timeout(30.0, connect=10.0)
MAX_TOKENS = 300

SAFETY_TURN = ("\n\nThis turn: their last message may signal risk of harm. In this reply, ask calmly whether they "
               "are safe right now AND urge them to call 112 or their counsellor right now.")
LANGUAGE_RULE = {"hi": "\n\nReply in Hindi (Devanagari).", "en": "\n\nReply in English."}

# Replies when the service can't answer (network, quota, or Azure's content
# filter refusing a message about self-harm or violence - exactly the messages
# that most need a reply). Never an error in the person's face.
FALLBACK = "I'm here and listening. Tell me a bit more about what's going on?"
SAFETY_REPLY = ("I'm really glad you told me. Are you safe right now? Please call 112 or your counsellor "
                "right now - you should not have to hold this on your own.")


class AzureChatEngine:
    def __init__(self):
        self.api_key = os.environ["AZURE_OPENAI_API_KEY"]
        endpoint = os.environ["AZURE_OPENAI_ENDPOINT"]
        if "api-version=" not in endpoint:
            version = os.environ.get("AZURE_OPENAI_API_VERSION", "2025-01-01-preview")
            endpoint += ("&" if "?" in endpoint else "?") + f"api-version={version}"
        self.url = endpoint
        self.deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "azure")
        cfg = load_config()
        self.crisis_message = " ".join(str(cfg.get("safety", {}).get("crisis_message", "")).split())
        self.temperature = float(cfg.get("generation", {}).get("temperature", 0.7))
        self._client = httpx.Client(timeout=TIMEOUT, headers={"api-key": self.api_key,
                                                             "Content-Type": "application/json"})
        # Network-bound, so several at once is fine (no MLX single-thread rule here).
        self._pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix="azure-chat")
        self._last_foreground = 0.0
        self._prompt, self._prompt_mtime = "", None
        self._last_error = None

    # ---------------------------------------------------------------- prompt

    def _system_prompt(self):
        mtime = PROMPT_FILE.stat().st_mtime
        if mtime != self._prompt_mtime:          # edits apply without a restart
            self._prompt = PROMPT_FILE.read_text(encoding="utf-8").strip()
            self._prompt_mtime = mtime
        return self._prompt

    def _messages(self, messages, tone=None, at_risk=False, voice_context=None, spoken=None, reply_language=None):
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        crisis = at_risk or bool(CRISIS_RE.search(last_user))
        system = self._system_prompt()
        if voice_context:
            system += f"\n\nVoice context (a soft hint only): {voice_context}" + VOICE_HINT_RULE
        elif tone in TONE_WORDS:
            system += (f"\n\nVoice context (a soft hint only): in their latest voice note they sounded "
                       f"{TONE_WORDS[tone]}." + VOICE_HINT_RULE)
        if spoken:
            system += "\n\n" + spoken
        if reply_language in LANGUAGE_RULE:
            system += LANGUAGE_RULE[reply_language]
        if crisis:
            system += SAFETY_TURN
        turns = [{"role": m["role"], "content": m["content"]} for m in messages[-MAX_HISTORY:]]
        return [{"role": "system", "content": system}] + turns, crisis

    def _result(self, text, crisis):
        text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()
        if not text:
            text = SAFETY_REPLY if crisis else FALLBACK
        if crisis and not POINTS_TO_HELP.search(text):
            text = f"{text.rstrip()} {SAFETY_FALLBACK}"
        return {"reply": text, "crisis": crisis, "crisis_message": self.crisis_message if crisis else None}

    # ---------------------------------------------------------------- HTTP

    def _body(self, messages, max_tokens, temperature, stream=False):
        return {"messages": messages, "max_tokens": max_tokens, "temperature": temperature,
                "top_p": 0.9, "stream": stream}

    def _post(self, messages, max_tokens=MAX_TOKENS, temperature=None):
        """One completion. Returns text, or None when the service refused or failed."""
        body = self._body(messages, max_tokens, self.temperature if temperature is None else temperature)
        for attempt in range(2):
            try:
                r = self._client.post(self.url, json=body)
            except httpx.HTTPError as exc:
                self._last_error = f"network: {exc}"
                continue
            if r.status_code in (429, 500, 502, 503, 504) and attempt == 0:
                time.sleep(min(float(r.headers.get("retry-after", 1) or 1), 5))
                continue
            if r.status_code != 200:
                self._last_error = f"{r.status_code}: {_error_code(r)}"
                return None
            choice = r.json()["choices"][0]
            if choice.get("finish_reason") == "content_filter":
                self._last_error = "content_filter"
                return None
            self._last_error = None
            return (choice.get("message") or {}).get("content") or ""
        return None

    def _stream_post(self, messages, on_text, should_stop, max_tokens):
        """Streams tokens to on_text. Returns the full text, or None if it failed before any text."""
        body = self._body(messages, max_tokens, self.temperature, stream=True)
        text = ""
        try:
            with self._client.stream("POST", self.url, json=body) as r:
                if r.status_code != 200:
                    r.read()
                    self._last_error = f"{r.status_code}: {_error_code(r)}"
                    return None
                for line in r.iter_lines():
                    if should_stop():
                        break
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except ValueError:
                        continue
                    for choice in chunk.get("choices") or []:
                        piece = (choice.get("delta") or {}).get("content")
                        if piece:
                            text += piece
                            on_text(piece)
                        if choice.get("finish_reason") == "content_filter":
                            self._last_error = "content_filter"
        except httpx.HTTPError as exc:
            self._last_error = f"network: {exc}"
            return text or None
        self._last_error = None if text else self._last_error
        return text

    # ---------------------------------------------------------------- the ChatEngine interface

    def _reply(self, messages, tone, at_risk):
        prompt, crisis = self._messages(messages, tone, at_risk)
        return self._result(self._post(prompt), crisis)

    def _stream(self, messages, on_text, should_stop, kwargs):
        prompt, crisis = self._messages(messages, None, kwargs.get("at_risk", False), kwargs.get("voice_context"),
                                        kwargs.get("spoken"), kwargs.get("reply_language"))
        text = self._stream_post(prompt, on_text, should_stop, kwargs.get("max_tokens") or MAX_TOKENS)
        if not text and not should_stop():
            text = SAFETY_REPLY if crisis else FALLBACK
            on_text(text)
        result = self._result(text, crisis)
        if result["reply"] != (text or "").strip() and not should_stop():
            on_text(" " + SAFETY_FALLBACK)       # the appended safety pointer is spoken too
        return result

    def submit(self, messages, tone=None, at_risk=False):
        self._last_foreground = time.time()
        return self._pool.submit(self._reply, messages, tone, at_risk)

    def submit_stream(self, messages, on_text, should_stop, **kwargs):
        self._last_foreground = time.time()
        return self._pool.submit(self._stream, messages, on_text, should_stop, kwargs)

    def complete_background(self, messages, max_tokens=256):
        """Internal notes (conversation insights): cooler sampling for parseable JSON."""
        return self._pool.submit(lambda: self._post(messages, max_tokens, temperature=0.2) or "")

    def busy(self):
        return time.time() - self._last_foreground < 5

    def translation_ready(self, language):
        return False          # gpt-4o writes Hindi itself; no local translators are loaded

    @property
    def model_name(self):
        return f"Azure OpenAI {self.deployment}"

    def status(self):
        return {"ready": True, "model": self.model_name, "backend": "azure", "fine_tuned": False,
                "last_error": self._last_error, "translation": {"hindi": "model writes Hindi itself"}}


def _error_code(response):
    try:
        err = response.json().get("error", {})
        return err.get("code") or err.get("message", "")[:120]
    except ValueError:
        return response.text[:120]
