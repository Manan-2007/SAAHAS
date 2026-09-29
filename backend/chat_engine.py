"""SAHAAS chat model: an MLX base model plus the LoRA adapter produced by
./train_chat.sh (see chat_training/). Apple Silicon only - elsewhere, or
before mlx-lm is installed, /chat reports unavailable and the frontend
falls back to its scripted replies.
"""

import importlib.util
import itertools
import queue
import re
import threading
import time
from concurrent.futures import Future
from pathlib import Path

import yaml

from translation import StreamingTranslator, Translator, detect_language, translate_history

TRAIN_DIR = Path(__file__).resolve().parent / "chat_training"
MAX_HISTORY = 16

TONE_WORDS = {
    "calm": "settled", "neutral": "steady", "happy": "warm", "sad": "heavy",
    "angry": "tense", "fearful": "uneasy", "disgust": "strained", "surprised": "stirred",
}

_KH = "(?:ख़|ख़?)"   # ख / ख़ (both spellings)
_ZA = "(?:ज़|ज़?)"   # ज / ज़

CRISIS_RE = re.compile(
    # English
    r"\b(?:suicid\w*|kill(?:ing)? myself|end(?:ing)? (?:my life|it all)|want(?:ed)? to die|wanna die|"
    r"don'?t want to (?:live|be alive|be here)|better off dead|no reason to live|"
    r"self[- ]?harm\w*|hurt(?:ing)? myself|cut(?:ting)? myself|overdos\w*|"
    r"(?:going|gonna|trying) to (?:kill|hurt) me|not safe (?:at home|right now|here)|in danger)\b"
    # Hindi (Devanagari has no reliable \b, so no word boundaries here)
    r"|आत्महत्या|" + _KH + r"ुदकुशी|मर(?:ना| जाना) चाह|मर जाऊ[ँं]|जीने का मन नहीं|जीना नहीं चाह|"
    r"जीने की (?:इच्छा|चाह) नहीं|" + _KH + r"ुद को (?:" + _KH + r"(?:त्म|तम)|नुक़?सान|मार)|"
    r"अपनी जान (?:ले|दे)|" + _ZA + r"ि(?:ं|न्)दगी " + _KH + r"(?:त्म|तम) कर"
    # Hinglish (romanized Hindi)
    r"|\b(?:khud\s?kushi|aa?tmahatya|mar(?:na|\s+jana)\s+chaht[ai]|mar\s+jaa?(?:u|un|oon)|"
    r"jee?ne\s+ka\s+(?:mann?|dil)\s+nahi|jee?na\s+nahi\s+chaht|"
    r"khud\s+ko\s+(?:khatam|khatm|nuksaa?n|maar)|apni\s+jaan\s+(?:le|de)|zindagi\s+(?:khatam|khatm)\s+kar)",
    re.I)

SAFETY_INSTRUCTION = (
    "\n\nSafety: their last message may signal risk of harm. Respond calmly and warmly, take it seriously, "
    "gently ask whether they are safe right now, and encourage reaching emergency help or their counsellor "
    "immediately. Do not list phone numbers; they are shown separately.")

# Does the reply name any route to help? Deliberately broad: it is a check for
# "did it point anywhere", not a check for particular wording.
POINTS_TO_HELP = re.compile(
    r"\b(counsellor|counselor|emergency|helpline|help ?line|ambulance|police|"
    r"someone you trust|call someone|get help|reach out to|112|181|14416)\b", re.I)
SAFETY_FALLBACK = ("Please reach out to your counsellor or emergency help right now - "
                   "you should not have to hold this on your own.")

VOICE_HINT_RULE = (
    " Their words decide what kind of reply this is: if the words are casual, reply casually. Let the voice "
    "shape only your pacing; never announce, label or ask about their emotions because of it.")

TRANSLATION_INSTRUCTION = (
    "\n\nLanguage: the person writes in Hindi. You see their messages translated into English. Reply only "
    "in English, in short, simple sentences; your reply is translated into Hindi before they see it.")


def load_config():
    with open(TRAIN_DIR / "config.yaml") as f:
        return yaml.safe_load(f)


class ChatModel:
    """Base model + adapter (if trained). Not thread-safe: ChatEngine keeps
    every call on one thread."""

    def __init__(self, cfg=None, use_adapter=True):
        from mlx_lm import load
        from mlx_lm.sample_utils import make_sampler
        self._load = load
        self.use_adapter = use_adapter
        self.cfg = cfg or load_config()
        self._prompt_file = TRAIN_DIR / "system_prompt.txt"
        self._prompt_mtime = None
        self._load_prompt()
        self.translator = Translator()
        gen = self.cfg.get("generation", {})
        self.max_tokens = int(gen.get("max_tokens", 400))
        self.sampler = make_sampler(temp=float(gen.get("temperature", 0.7)),
                                    top_p=float(gen.get("top_p", 0.9)))
        self.crisis_message = " ".join(str(self.cfg.get("safety", {}).get("crisis_message", "")).split())
        self.adapter_dir = TRAIN_DIR / self.cfg.get("adapter_path", "adapters")
        self._adapter_mtime = None
        self.load()

    @property
    def adapter_file(self):
        return self.adapter_dir / "adapters.safetensors"

    def _load_prompt(self):
        """Re-reads system_prompt.txt when it changes, so edits apply without a restart."""
        mtime = self._prompt_file.stat().st_mtime
        if mtime != self._prompt_mtime:
            self.system_prompt = self._prompt_file.read_text(encoding="utf-8").strip()
            self._prompt_mtime = mtime

    def load(self):
        trained = self.use_adapter and self.adapter_file.is_file()
        self.model, self.tokenizer = self._load(
            self.cfg["base_model"], adapter_path=str(self.adapter_dir) if trained else None)
        self._adapter_mtime = self.adapter_file.stat().st_mtime if trained else None
        self.fine_tuned = trained

    def reload_if_retrained(self):
        self._load_prompt()
        if not self.use_adapter:
            return
        mtime = self.adapter_file.stat().st_mtime if self.adapter_file.is_file() else None
        if mtime != self._adapter_mtime:
            self.load()

    @property
    def name(self):
        base = self.cfg["base_model"].rsplit("/", 1)[-1]
        return f"{base} + SAHAAS adapter" if self.fine_tuned else f"{base} (not fine-tuned yet)"

    def _prompt(self, messages, tone=None, at_risk=False, voice_context=None, spoken=None, translated_from=None):
        """voice_context: a sentence describing how the user sounded (live voice
        conversations); tone: just the emotion of their latest voice note."""
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        crisis = at_risk or bool(CRISIS_RE.search(last_user))

        system = self.system_prompt
        # The voice is only a hint: their words decide whether the reply is casual or supportive
        if voice_context:
            system += f"\n\nVoice context (a soft hint only): {voice_context}" + VOICE_HINT_RULE
        elif tone in TONE_WORDS:
            system += (f"\n\nVoice context (a soft hint only): in their latest voice note this person's "
                       f"tone sounded {TONE_WORDS[tone]}." + VOICE_HINT_RULE)
        if spoken:
            system += "\n\n" + spoken
        if translated_from:
            system += TRANSLATION_INSTRUCTION
        if crisis:
            system += SAFETY_INSTRUCTION

        chat = [{"role": "system", "content": system}] + messages[-MAX_HISTORY:]
        # enable_thinking=False: Qwen3 hybrid models (8B, 14B) otherwise reason silently
        # before every reply; templates without a thinking mode ignore it
        return self.tokenizer.apply_chat_template(chat, add_generation_prompt=True, tokenize=False,
                                                  enable_thinking=False), crisis

    def _result(self, text, crisis):
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
        return {"reply": self._ensure_points_to_help(text, crisis), "crisis": crisis,
                "crisis_message": self.crisis_message if crisis else None}

    def _ensure_points_to_help(self, text, crisis):
        """On a crisis turn, guarantee the reply points somewhere.

        Training makes this likely; it does not make it certain, and a model that
        asks "are you safe?" and then stops has left the person holding it alone.
        Measured on eval_tone.py, both the base model and the trained one did
        exactly that. So the ask is the model's job and the pointer is the code's:
        if the reply names no route to help, one warm sentence is appended. No
        phone numbers - those ride in `crisis_message`, which the app shows
        separately."""
        if not crisis or not text or POINTS_TO_HELP.search(text):
            return text
        return f"{text.rstrip()} {SAFETY_FALLBACK}"

    def _translation_plan(self, messages, language, at_risk):
        """(messages for the model, at_risk, language to translate the reply into or None)."""
        if not language or language == "en" or not self.translator.ready(language):
            return messages, at_risk, None
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        at_risk = at_risk or bool(CRISIS_RE.search(last_user))     # judge the original words, not a translation
        return translate_history(messages, language, self.translator), at_risk, language

    def reply(self, messages, tone=None, at_risk=False):
        """at_risk: the distress model flagged the last message as high risk.
        Hindi messages are answered in English by the model and translated back."""
        from mlx_lm import generate
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        messages, at_risk, target = self._translation_plan(messages, detect_language(last_user), at_risk)
        prompt, crisis = self._prompt(messages, tone, at_risk, translated_from=target)
        text = generate(self.model, self.tokenizer, prompt=prompt, max_tokens=self.max_tokens, sampler=self.sampler)
        result = self._result(text, crisis)
        if target:
            english = result["reply"]
            result["reply"] = self.translator.from_english(english, target)
            self.translator.remember(result["reply"], english)
        return result

    def complete(self, messages, max_tokens=256):
        """Raw completion with the caller's own system prompt - no persona, no
        safety wrapping - for internal notes, never for replies to a person.
        Hindi turns are read in English, like replies are, and the sampling is
        cooler so the JSON comes back parseable."""
        from mlx_lm import generate
        from mlx_lm.sample_utils import make_sampler
        if self.translator.loaded("hi"):
            messages = [m if m["role"] == "system" else {**m, "content": self._lines_to_english(m["content"])}
                        for m in messages]
        prompt = self.tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False,
                                                    enable_thinking=False)
        return generate(self.model, self.tokenizer, prompt=prompt, max_tokens=max_tokens,
                        sampler=make_sampler(temp=0.2, top_p=0.9))

    def _lines_to_english(self, text):
        """Translates Hindi line by line, keeping a "Speaker [tag]: " prefix as it is."""
        out = []
        for line in text.split("\n"):
            head, sep, body = line.partition(": ")
            if sep and detect_language(body) == "hi":
                out.append(f"{head}: {self.translator.to_english(body)}")
            elif not sep and detect_language(line) == "hi":
                out.append(self.translator.to_english(line))
            else:
                out.append(line)
        return "\n".join(out)

    def stream(self, messages, on_text, should_stop, at_risk=False, voice_context=None, spoken=None,
               max_tokens=None, reply_language=None):
        """Like reply(), but calls on_text(piece) as tokens arrive and stops
        early when should_stop() turns true (the user interrupted).
        reply_language="hi": the model answers in English and each finished
        sentence is translated before it's passed on."""
        from mlx_lm import stream_generate
        messages, at_risk, target = self._translation_plan(messages, reply_language, at_risk)
        prompt, crisis = self._prompt(messages, None, at_risk, voice_context, spoken, translated_from=target)
        sentences = StreamingTranslator(lambda s: self.translator.from_english(s, target)) if target else None
        text = ""

        def emit(piece):
            nonlocal text
            text += piece
            on_text(piece)

        for response in stream_generate(self.model, self.tokenizer, prompt=prompt,
                                        max_tokens=max_tokens or self.max_tokens, sampler=self.sampler):
            if should_stop():
                break
            if sentences is None:
                emit(response.text)
            else:
                for sentence in sentences.feed(response.text):
                    emit(sentence + " ")
        if sentences is not None and not should_stop():
            for sentence in sentences.flush():
                emit(sentence + " ")
        return self._result(text, crisis)


FOREGROUND, BACKGROUND = 0, 10


class _PriorityWorker:
    """One thread, a priority queue in front of it. MLX needs the single thread;
    the priorities make sure a person waiting for a reply is always served
    before background work (conversation insights) that nobody is waiting on."""

    def __init__(self, name):
        self._queue = queue.PriorityQueue()
        self._order = itertools.count()
        self._thread = threading.Thread(target=self._run, name=name, daemon=True)
        self._thread.start()

    def submit(self, fn, *args, priority=FOREGROUND):
        future = Future()
        self._queue.put((priority, next(self._order), future, fn, args))
        return future

    def pending(self, priority=FOREGROUND):
        return sum(1 for item in list(self._queue.queue) if item[0] <= priority)

    def _run(self):
        while True:
            _, _, future, fn, args = self._queue.get()
            if not future.set_running_or_notify_cancel():
                continue
            try:
                future.set_result(fn(*args))
            except BaseException as exc:          # delivered to whoever waits on it
                future.set_exception(exc)


class ChatEngine:
    """Runs all MLX work on one dedicated thread - MLX GPU streams belong to
    the thread that created them, so loading and generating must share one."""

    def __init__(self):
        self._executor = _PriorityWorker("chat-mlx")
        self._model = None
        self._last_foreground = 0.0
        self._loading = self._executor.submit(self._load_model)

    def _load_model(self):
        self._model = ChatModel()
        self._model.translator.ready("hi")     # load the Hindi translators now, not on the first Hindi message
        self._warm_up()

    def _warm_up(self):
        """Burn one throwaway generation so the first real message is not slow.

        Loading the weights is not enough: Metal compiles its compute kernels on
        the first forward pass, which cost ~50s on a cold server while the person
        sat watching the typing dots. Doing it here moves that onto startup,
        where nobody is waiting. Failure is not fatal - it is only a warm-up."""
        try:
            start = time.time()
            self._model.reply([{"role": "user", "content": "hi"}])
            print(f"[chat] kernels warm after {time.time() - start:.1f}s")
        except Exception as exc:
            print(f"[chat] warm-up skipped: {exc}")

    def _ready_model(self):
        if self._model is None:
            raise RuntimeError(f"chat model failed to load: {self._loading.exception()}")
        self._model.reload_if_retrained()
        return self._model

    def _reply(self, messages, tone, at_risk):
        return self._ready_model().reply(messages, tone, at_risk)

    def _stream(self, messages, on_text, should_stop, kwargs):
        return self._ready_model().stream(messages, on_text, should_stop, **kwargs)

    def submit(self, messages, tone=None, at_risk=False):
        self._last_foreground = time.time()
        return self._executor.submit(self._reply, messages, tone, at_risk)

    def submit_stream(self, messages, on_text, should_stop, **kwargs):
        """kwargs: at_risk, voice_context, spoken, max_tokens, reply_language (see ChatModel.stream)."""
        self._last_foreground = time.time()
        return self._executor.submit(self._stream, messages, on_text, should_stop, kwargs)

    def _complete(self, messages, max_tokens):
        return self._ready_model().complete(messages, max_tokens)

    def complete_background(self, messages, max_tokens=256):
        """A plain completion (the conversation-insight note) at background
        priority: any reply someone is waiting for goes first."""
        return self._executor.submit(self._complete, messages, max_tokens, priority=BACKGROUND)

    def busy(self):
        """Someone is being answered, or was a moment ago."""
        return self._executor.pending(FOREGROUND) > 0 or time.time() - self._last_foreground < 5

    def translation_ready(self, language):
        """Whether replies in `language` go through translation (never blocks)."""
        return self._model is not None and self._model.translator.loaded(language)

    @property
    def model_name(self):
        return self._model.name if self._model is not None else None

    def status(self):
        if not self._loading.done():
            return {"ready": False, "model": None}
        if self._loading.exception() is not None:
            return {"ready": False, "model": None, "error": str(self._loading.exception())}
        return {"ready": True, "model": self._model.name, "fine_tuned": self._model.fine_tuned,
                "translation": self._model.translator.status()}


def load_chat_engine():
    # CHAT_BACKEND=azure: replies come from an Azure OpenAI deployment and the
    # local model is never loaded (azure_chat.py). Default: the local MLX model.
    import os
    if os.environ.get("CHAT_BACKEND", "local").lower() == "azure":
        from azure_chat import AzureChatEngine
        try:
            engine = AzureChatEngine()
        except KeyError as exc:
            print(f"[chat] CHAT_BACKEND=azure but {exc} is not set; /chat disabled")
            return None
        print(f"[chat] using {engine.model_name} (local chat model not loaded)")
        return engine
    # find_spec, not import: mlx must first be imported on the engine thread
    if importlib.util.find_spec("mlx_lm") is None:
        print("[chat] mlx-lm not installed (Apple Silicon only); /chat disabled")
        return None
    engine = ChatEngine()
    print("[chat] loading chat model in the background")
    return engine
