"""Hindi <-> English around the chat model: the 4B thinks and answers in English,
where it's strong, and the person reads and hears natural Hindi.

  Hindi -> English   Helsinki-NLP/opus-mt-hi-en (Apache-2.0, ~300 MB)
  English -> Hindi   ai4bharat/indictrans2-en-indic-dist-200M (MIT, ~1 GB). Gated:
                     accept its terms once on Hugging Face with the account this
                     machine is logged in to. It runs its own model code, so the
                     revision is pinned below.

If English -> Hindi can't load, nothing is translated and the chat model writes
Hindi itself, as before. Only Hindi (Devanagari) is handled so far.
"""

import re
import time
from collections import OrderedDict

HI_EN_MODEL = "Helsinki-NLP/opus-mt-hi-en"
EN_INDIC_MODEL = "ai4bharat/indictrans2-en-indic-dist-200M"
EN_INDIC_REVISION = "173b94239f7c38886b2747b8d4a5db771a7e1232"
INDIC_TAGS = {"hi": "hin_Deva"}
RETRY_SECONDS = 600            # retry a failed load (e.g. terms accepted later) at most this often
CACHE_SIZE = 1024

EN_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
ANY_SENTENCE_END = re.compile(r"(?<=[.!?।॥])\s+")


def detect_language(text):
    """"hi" when at least 30% of the letters are Devanagari, else "en"."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return "en"
    devanagari = sum(1 for c in letters if "ऀ" <= c <= "ॿ")
    return "hi" if devanagari / len(letters) >= 0.3 else "en"


def translate_history(messages, language, translator):
    """Copies the conversation with every turn in `language` turned into English."""
    return [{**m, "content": translator.to_english(m["content"])} if detect_language(m["content"]) == language
            else m for m in messages]


class StreamingTranslator:
    """Collects streamed English text and returns each sentence, translated,
    as soon as it's complete, so speech can start before the reply finishes."""

    def __init__(self, translate):
        self._translate = translate
        self._pending = ""

    def feed(self, piece):
        self._pending += piece
        *done, self._pending = EN_SENTENCE_END.split(self._pending)
        return [self._translate(s) for s in done if s.strip()]

    def flush(self):
        rest, self._pending = self._pending.strip(), ""
        return [self._translate(rest)] if rest else []


def indic_detokenize(text):
    """Undoes the model's tokenized spacing ("क्या हाल है ?" -> "क्या हाल है?")."""
    text = re.sub(r"\s+([।॥,.?!:;%)\]}”’])", r"\1", text)
    text = re.sub(r"([(\[{“‘])\s+", r"\1", text)
    return re.sub(r"\s{2,}", " ", text).strip()


class Translator:
    """Loads lazily in whichever thread first uses it; ChatModel keeps all
    calls on its one chat thread."""

    def __init__(self):
        self._to_en = None                 # (tokenizer, model)
        self._from_en = None
        self._from_en_error = None
        self._from_en_tried_at = 0.0
        self._cache = OrderedDict()

    # ---- loading
    def _load_to_en(self):
        from transformers import MarianMTModel, MarianTokenizer
        return MarianTokenizer.from_pretrained(HI_EN_MODEL), MarianMTModel.from_pretrained(HI_EN_MODEL).eval()

    def _load_from_en(self):
        from sacremoses import MosesPunctNormalizer, MosesTokenizer
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        tok = AutoTokenizer.from_pretrained(EN_INDIC_MODEL, revision=EN_INDIC_REVISION, trust_remote_code=True)
        model = AutoModelForSeq2SeqLM.from_pretrained(EN_INDIC_MODEL, revision=EN_INDIC_REVISION,
                                                      trust_remote_code=True).eval()
        self._en_norm, self._en_tok = MosesPunctNormalizer(lang="en"), MosesTokenizer(lang="en")
        return tok, model

    def ready(self, language):
        """True when replies can be translated into `language`; may load models (slow, first time)."""
        if language not in INDIC_TAGS:
            return False
        if self._from_en is None and time.time() - self._from_en_tried_at >= RETRY_SECONDS:
            self._from_en_tried_at = time.time()
            try:
                self._from_en = self._load_from_en()
                if self._to_en is None:
                    self._to_en = self._load_to_en()
                self._from_en_error = None
                print("[translation] Hindi <-> English ready")
            except Exception as exc:
                self._from_en, self._from_en_error = None, f"{type(exc).__name__}: {exc}"
                print(f"[translation] English -> Hindi unavailable ({self._from_en_error[:200]}); "
                      "the chat model will write Hindi itself")
        return self._from_en is not None and self._to_en is not None

    def loaded(self, language):
        """Like ready() but never loads - safe to call from the event loop."""
        return language in INDIC_TAGS and self._from_en is not None and self._to_en is not None

    def status(self):
        if self.loaded("hi"):
            return {"hindi": "ready"}
        if self._from_en_error:
            return {"hindi": "unavailable", "error": self._from_en_error[:300]}
        return {"hindi": "not loaded yet"}

    # ---- cache
    def _cached(self, key, compute):
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        value = compute()
        self._cache[key] = value
        if len(self._cache) > CACHE_SIZE:
            self._cache.popitem(last=False)
        return value

    def remember(self, translated, english):
        """So a reply we translated maps back to our own English next turn."""
        self._cache[("to_en", translated)] = english

    # ---- translation
    def to_english(self, text):
        def compute():
            import torch
            tok, model = self._to_en
            parts = [p for p in ANY_SENTENCE_END.split(text.strip()) if p.strip()]
            if not parts:
                return text
            with torch.no_grad():
                out = model.generate(**tok(parts, return_tensors="pt", padding=True, truncation=True),
                                     num_beams=4, max_new_tokens=256)
            return " ".join(tok.batch_decode(out, skip_special_tokens=True)).strip()
        return self._cached(("to_en", text), compute)

    def from_english(self, text, language="hi"):
        def compute():
            import torch
            tok, model = self._from_en
            parts = [p for p in EN_SENTENCE_END.split(text.strip()) if p.strip()]
            if not parts:
                return text
            tags = f"eng_Latn {INDIC_TAGS[language]}"
            batch = [f"{tags} {' '.join(self._en_tok.tokenize(self._en_norm.normalize(p), escape=False))}"
                     for p in parts]
            with torch.no_grad():
                out = model.generate(**tok(batch, return_tensors="pt", padding="longest", truncation=True),
                                     num_beams=5, max_length=256, use_cache=True)
            return " ".join(indic_detokenize(s) for s in tok.batch_decode(out, skip_special_tokens=True,
                                                                          clean_up_tokenization_spaces=True))
        return self._cached(("from_en", language, text), compute)
