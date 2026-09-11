from types import SimpleNamespace

from translation import StreamingTranslator, detect_language, indic_detokenize, translate_history


def test_detects_hindi_by_script():
    assert detect_language("मुझे डर लग रहा है") == "hi"
    assert detect_language("mujhe dar lag raha hai") == "en"     # Hinglish stays with the model
    assert detect_language("I'm scared") == "en"
    assert detect_language("123 !!") == "en"


def test_streaming_translator_emits_whole_sentences_only():
    st = StreamingTranslator(str.upper)
    assert st.feed("That sounds hard") == []
    assert st.feed(". What part worries") == ["THAT SOUNDS HARD."]
    assert st.feed(" you most?") == []
    assert st.flush() == ["WHAT PART WORRIES YOU MOST?"]
    assert st.flush() == []


def test_history_translates_only_hindi_turns():
    fake = SimpleNamespace(to_english=lambda t: f"EN({t})")
    out = translate_history([{"role": "assistant", "content": "Hi!"},
                             {"role": "user", "content": "मुझे डर लग रहा है"}], "hi", fake)
    assert out[0]["content"] == "Hi!"
    assert out[1] == {"role": "user", "content": "EN(मुझे डर लग रहा है)"}


def test_indic_detokenize_fixes_spacing():
    assert indic_detokenize("क्या आप ठीक हैं ?  मैं यहाँ हूँ ।") == "क्या आप ठीक हैं? मैं यहाँ हूँ।"
