"""Standard screening questionnaires - the ground truth behind the Distress Score.

  phq9     PHQ-9      depression (0-27), every 14 days
  gad7     GAD-7      anxiety (0-21), every 14 days
  pcptsd5  PC-PTSD-5  trauma-related stress (0-5, positive at 3+), every 14 days
  phq4     PHQ-4      quick pulse: PHQ-2 + GAD-2 (0-12), every 3 days

PHQ-9, GAD-7 and PHQ-4 are free to use; PC-PTSD-5 is public domain (US VA).
Hindi item wording for PHQ-9/GAD-7 is the standard Hindi translation (as
distributed in the CC BY 4.0 MindBridge dataset). Hindi stems, answer labels
and the PC-PTSD-5 Hindi text are drafts - get them reviewed before clinical use.
"""

FREQ_OPTIONS = {
    "en": ["Not at all", "Several days", "More than half the days", "Nearly every day"],
    "hi": ["बिल्कुल नहीं", "कई दिन", "आधे से ज़्यादा दिन", "लगभग हर दिन"],
}
YES_NO_OPTIONS = {"en": ["No", "Yes"], "hi": ["नहीं", "हाँ"]}

TWO_WEEK_STEM = {
    "en": "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
    "hi": "पिछले 2 हफ़्तों में, आप कितनी बार इनमें से किसी समस्या से परेशान रहे हैं?",
}

PHQ9_ITEMS = [
    {"en": "Little interest or pleasure in doing things",
     "hi": "कुछ करने में बहुत कम दिलचस्पी या मज़ा आना"},
    {"en": "Feeling down, depressed, or hopeless",
     "hi": "उदास, अवसादग्रस्त या निराश महसूस करना"},
    {"en": "Trouble falling or staying asleep, or sleeping too much",
     "hi": "नींद आने या सोये रहने में परेशानी, या फिर बहुत अधिक सोना"},
    {"en": "Feeling tired or having little energy",
     "hi": "थकान महसूस करना या बहुत कम ऊर्जा होना"},
    {"en": "Poor appetite or overeating",
     "hi": "भूख कम लगना या ज्यादा खाना"},
    {"en": "Feeling bad about yourself - or that you are a failure or have let yourself or your family down",
     "hi": "अपने बारे में बुरा महसूस करना - या ऐसा महसूस करना कि आप नाकाम इंसान हैं और आपने ख़ुद को और अपने परिवार को नीचा दिखाया है"},
    {"en": "Trouble concentrating on things, such as reading the newspaper or watching television",
     "hi": "अखबार पढ़ने या टेलीविज़न देखने जैसी चीज़ों पर ध्यान देने में परेशानी"},
    {"en": "Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety "
           "or restless that you have been moving around a lot more than usual",
     "hi": "इतना धीमे चलना-फिरना या बोलना कि लोगों का ध्यान जाये? या इसका उल्टा - इतना अस्थिर या बेचैन होना कि "
           "आप सामान्य से काफ़ी ज्यादा हिलते-डुलते और चलते-फिरते रहे हैं"},
    {"en": "Thoughts that you would be better off dead, or of hurting yourself in some way",
     "hi": "ऐसे विचार कि आप मर जाते तो अच्छा होता या किसी ढंग से ख़ुद को नुक्सान पहुंचाना"},
]

GAD7_ITEMS = [
    {"en": "Feeling nervous, anxious or on edge", "hi": "बेचैनी, चिंता या तनाव महसूस करना"},
    {"en": "Not being able to stop or control worrying", "hi": "चिंता रोकने या नियंत्रित कर सकने में असफल रहना"},
    {"en": "Worrying too much about different things", "hi": "विभिन्न चीज़ों के लिए बहुत ज्यादा चिंता करना"},
    {"en": "Trouble relaxing", "hi": "आराम करने में परेशानी"},
    {"en": "Being so restless that it is hard to sit still", "hi": "इतनी ज्यादा बेचैनी, कि स्थिर बैठना मुश्किल हो जाता है"},
    {"en": "Becoming easily annoyed or irritable", "hi": "आसानी से चिढ़ना या खिजना"},
    {"en": "Feeling afraid as if something awful might happen", "hi": "डर महसूस होना कि शायद कुछ बहुत बुरा हो सकता है"},
]

PCPTSD5_STEM = {
    "en": "Thinking about what happened to you, in the past month have you:",
    "hi": "आपके साथ जो हुआ, उसके बारे में सोचते हुए, पिछले एक महीने में क्या आपने:",
}
PCPTSD5_ITEMS = [
    {"en": "Had nightmares about it or thought about it when you did not want to?",
     "hi": "उसके बारे में बुरे सपने देखे हैं, या न चाहते हुए भी उसके बारे में सोचा है?"},
    {"en": "Tried hard not to think about it or went out of your way to avoid situations that reminded you of it?",
     "hi": "उसके बारे में न सोचने की बहुत कोशिश की है, या उसकी याद दिलाने वाले हालात से बचने के लिए ख़ास कोशिश की है?"},
    {"en": "Been constantly on guard, watchful, or easily startled?",
     "hi": "हर समय चौकन्ने या सतर्क रहे हैं, या आसानी से चौंक जाते हैं?"},
    {"en": "Felt numb or detached from people, activities, or your surroundings?",
     "hi": "लोगों, कामों या अपने आसपास से सुन्न या कटा हुआ महसूस किया है?"},
    {"en": "Felt guilty or unable to stop blaming yourself or others for what happened or any problems it may have caused?",
     "hi": "जो हुआ उसके लिए, या उससे हुई परेशानियों के लिए, अपराधबोध महसूस किया है या ख़ुद को या दूसरों को दोष देना बंद नहीं कर पाए हैं?"},
]

INSTRUMENTS = {
    "phq9": {
        "name": "PHQ-9", "measures": "depression", "stem": TWO_WEEK_STEM, "items": PHQ9_ITEMS,
        "options": FREQ_OPTIONS, "interval_days": 14,
        "bands": [(0, "minimal"), (5, "mild"), (10, "moderate"), (15, "moderately_severe"), (20, "severe")],
    },
    "gad7": {
        "name": "GAD-7", "measures": "anxiety", "stem": TWO_WEEK_STEM, "items": GAD7_ITEMS,
        "options": FREQ_OPTIONS, "interval_days": 14,
        "bands": [(0, "minimal"), (5, "mild"), (10, "moderate"), (15, "severe")],
    },
    "pcptsd5": {
        "name": "PC-PTSD-5", "measures": "trauma-related stress (PTSD symptoms)", "stem": PCPTSD5_STEM,
        "items": PCPTSD5_ITEMS, "options": YES_NO_OPTIONS, "interval_days": 14,
        "bands": [(0, "negative"), (3, "positive")],
    },
    "phq4": {
        "name": "PHQ-4", "measures": "quick pulse: depression + anxiety", "stem": TWO_WEEK_STEM,
        "items": [PHQ9_ITEMS[0], PHQ9_ITEMS[1], GAD7_ITEMS[0], GAD7_ITEMS[1]],
        "options": FREQ_OPTIONS, "interval_days": 3,
        "bands": [(0, "normal"), (3, "mild"), (6, "moderate"), (9, "severe")],
    },
}

LANGUAGES = ("en", "hi")      # Punjabi not translated yet - falls back to English


def _lang(lang):
    return lang if lang in LANGUAGES else "en"


def max_score(instrument):
    spec = INSTRUMENTS[instrument]
    return len(spec["items"]) * (len(spec["options"]["en"]) - 1)


def get(instrument, lang="en"):
    spec = INSTRUMENTS[instrument]       # KeyError for unknown instruments
    lang = _lang(lang)
    return {
        "id": instrument,
        "name": spec["name"],
        "measures": spec["measures"],
        "language": lang,
        "stem": spec["stem"][lang],
        "items": [{"number": i + 1, "text": item[lang]} for i, item in enumerate(spec["items"])],
        "options": [{"value": v, "label": label} for v, label in enumerate(spec["options"][lang])],
        "max_score": max_score(instrument),
        "interval_days": spec["interval_days"],
    }


def catalog(lang="en"):
    return [
        {"id": key, "name": spec["name"], "measures": spec["measures"],
         "item_count": len(spec["items"]), "interval_days": spec["interval_days"]}
        for key, spec in INSTRUMENTS.items()
    ]


def score(instrument, answers):
    spec = INSTRUMENTS[instrument]
    n_items = len(spec["items"])
    top = len(spec["options"]["en"]) - 1
    if len(answers) != n_items:
        raise ValueError(f"{spec['name']} needs {n_items} answers, got {len(answers)}")
    if any(not isinstance(a, int) or not 0 <= a <= top for a in answers):
        raise ValueError(f"Each {spec['name']} answer must be a whole number from 0 to {top}")
    total = sum(answers)
    severity = [name for cut, name in spec["bands"] if total >= cut][-1]
    flags = []
    if instrument == "phq9" and answers[8] >= 1:
        flags.append("self_harm_thoughts")
    return {"instrument": instrument, "name": spec["name"], "total": total,
            "max_score": max_score(instrument), "severity": severity, "flags": flags}
