"""How the user sounded -> how the agent answers.

voice_summary()        emotion + vocal features of one user turn
describe()             the same, in words the chat model reads
reply_style()          delivery + speaking speed for the agent's voice
spoken_instructions()  tells the chat model to talk like a person on a call
"""

import re

TONE_WORDS = {
    "calm": "settled", "neutral": "steady", "happy": "warm", "sad": "heavy",
    "angry": "tense", "fearful": "uneasy", "disgust": "strained", "surprised": "stirred",
}

DELIVERY = {
    "gentle": ("Speak gently and unhurriedly: short, soft sentences, with small pauses where commas fit.", 0.9),
    "calm": ("Be calm and steady and grounding; don't match their intensity.", 0.92),
    "warm": ("Let some warmth and lightness come through.", 1.04),
    "steady": ("Keep it relaxed and natural, like a friend on the phone.", 1.0),
}

LANGUAGE_HINTS = {
    "en": "Reply in English.",
    "hi": "They are speaking Hindi: reply in simple, spoken Hindi written in Devanagari script.",
}


def voice_summary(analysis, emotions, pick_headline):
    """analysis: analyze_and_predict() result for one user turn."""
    probs = analysis["probs"]
    index, demoted = pick_headline(probs, 0.40)
    top = float(probs[index])
    second = max(float(p) for i, p in enumerate(probs) if i != index)
    certain = (not demoted and top >= 0.40 and top - second >= 0.12
               and analysis["voiced_seconds"] >= 2.0)
    p = analysis["prosody"]
    summary = {
        "emotion": emotions[index],
        "tone_word": TONE_WORDS[emotions[index]],
        "certainty": "high" if certain else "low",
        "arousal": p.get("arousal"),
        "valence": p.get("valence"),
        "pitch_hz": p.get("pitch_hz"),
        "pitch_var": p.get("pitch_var"),
        "speech_rate": p.get("speech_rate"),
        "voiced_seconds": analysis["voiced_seconds"],
    }
    summary["description"] = describe(summary)
    return summary


def describe(v):
    parts = [f"their voice sounded {v['tone_word']}" + (" (a soft guess)" if v["certainty"] == "low" else "")]
    manner = []
    rate, arousal, pitch_var, valence = v.get("speech_rate"), v.get("arousal"), v.get("pitch_var"), v.get("valence")
    if rate is not None and rate < 3:
        manner.append("slowly")
    elif rate is not None and rate > 5.5:
        manner.append("quickly")
    if arousal is not None and arousal < 0.3:
        manner.append("quietly, with little energy")
    elif arousal is not None and arousal > 0.65:
        manner.append("with a lot of intensity")
    if pitch_var is not None and pitch_var < 0.25:
        manner.append("in a flat, even pitch")
    if manner:
        parts.append("they spoke " + ", ".join(manner))
    if valence is not None and valence < 0.35:
        parts.append("the overall tone was low")
    elif valence is not None and valence > 0.65:
        parts.append("the overall tone was bright")
    return "In their last message " + "; ".join(parts) + "."


def reply_style(voice):
    """Co-regulation: meet distress with a slower, gentler voice rather than mirroring it.
    A low-certainty emotion guess doesn't change the delivery (a plain "hello" often reads as sad)."""
    if voice is None or voice.get("certainty") == "low":
        delivery = "steady"
    elif voice["emotion"] in ("sad", "fearful"):
        delivery = "gentle"
    elif voice["emotion"] in ("angry", "disgust"):
        delivery = "calm"
    elif voice["emotion"] in ("happy", "surprised"):
        delivery = "warm"
    else:
        delivery = "steady"
    speed = DELIVERY[delivery][1]
    arousal = voice.get("arousal") if voice else None
    if arousal is not None and arousal > 0.7 and delivery != "warm":
        delivery, speed = "calm", min(speed, 0.9)
    if arousal is not None and arousal < 0.25:
        speed = min(speed, 0.92)
    return {"delivery": delivery, "speed": round(min(max(speed, 0.85), 1.1), 2)}


def spoken_instructions(style, language):
    return ("This is a live spoken conversation. Talk the way a friend talks on a call: 1 to 3 short "
            "sentences, no lists, no headings, no emojis, no markdown, and at most one question. "
            f"{DELIVERY[style['delivery']][0]} {LANGUAGE_HINTS.get(language, LANGUAGE_HINTS['en'])}")


_MARKDOWN = re.compile(r"[*_#>`~\[\]]|\(https?://\S+\)")
_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️]")


def clean_for_speech(text):
    text = _EMOJI.sub("", _MARKDOWN.sub("", text))
    text = re.sub(r"^\s*(?:[-•]|\d+[.)])\s+", "", text)
    return re.sub(r"\s+", " ", text).strip()
