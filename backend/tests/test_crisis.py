import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

from chat_engine import CRISIS_RE  # noqa: E402

CRISIS = [
    "I don't want to live anymore",
    "I keep thinking about ending it all",
    "I want to kill myself",
    "मुझे अब जीने का मन नहीं करता।",
    "मैं मर जाना चाहती हूँ",
    "कभी कभी लगता है मरना चाहता हूँ",
    "मैं ख़ुदकुशी कर लूँगी",
    "मैं खुदकुशी कर लूँगी",
    "आत्महत्या के ख़याल आते हैं",
    "मैं ख़ुद को ख़त्म कर दूँगी",
    "सोचती हूँ अपनी जान दे दूँ",
    "mujhe ab jeene ka mann nahi karta",
    "main khudkushi kar lungi",
    "mar jana chahti hoon",
    "khud ko khatam kar dungi",
]

SAFE = [
    "I finally slept well last night",
    "I want to live peacefully with my kids",
    "मुझे आज थोड़ा अच्छा लग रहा है",
    "कोर्ट की तारीख़ से डर लगता है",
    "mujhe court se darr lagta hai",
    "aaj mann thoda halka hai",
]


@pytest.mark.parametrize("text", CRISIS)
def test_crisis_phrases_are_flagged(text):
    assert CRISIS_RE.search(text), text


@pytest.mark.parametrize("text", SAFE)
def test_ordinary_messages_are_not_flagged(text):
    assert not CRISIS_RE.search(text), text
