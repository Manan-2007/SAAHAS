"""SAHAAS chat model: an MLX base model plus the LoRA adapter produced by
./train_chat.sh (see chat_training/). Apple Silicon only - elsewhere, or
before mlx-lm is installed, /chat reports unavailable and the frontend
falls back to its scripted replies.
"""

import importlib.util
import re
from concurrent.futures import ThreadPoolExecutor
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
        return {"reply": text, "crisis": crisis, "crisis_message": self.crisis_message if crisis else None}

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


class ChatEngine:
    """Runs all MLX work on one dedicated thread - MLX GPU streams belong to
    the thread that created them, so loading and generating must share one."""

    def __init__(self):
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="chat-mlx")
        self._model = None
        self._loading = self._executor.submit(self._load_model)

    def _load_model(self):
        self._model = ChatModel()
        self._model.translator.ready("hi")     # load the Hindi translators now, not on the first Hindi message

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
        return self._executor.submit(self._reply, messages, tone, at_risk)

    def submit_stream(self, messages, on_text, should_stop, **kwargs):
        """kwargs: at_risk, voice_context, spoken, max_tokens, reply_language (see ChatModel.stream)."""
        return self._executor.submit(self._stream, messages, on_text, should_stop, kwargs)

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
    # find_spec, not import: mlx must first be imported on the engine thread
    if importlib.util.find_spec("mlx_lm") is None:
        print("[chat] mlx-lm not installed (Apple Silicon only); /chat disabled")
        return None
    engine = ChatEngine()
    print("[chat] loading chat model in the background")
    return engine
