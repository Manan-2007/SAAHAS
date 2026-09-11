# SAHAAS: project context for Claude

Read this first, then `CHANGES.md` (what's been done and why) and
`backend/backend.md` (what the frontend must do, plus the models). Keep all three
up to date when you change something.

## What this project is

SAHAAS is a trauma-informed support app for victims of atrocities in India, built
for the Ministry of Social Justice and Empowerment's problem statement 26094:
*AI-Powered Dynamic Mental Health Monitoring and Distress Prediction System for
Victims of Atrocities*. It keeps in touch with victims through chat, voice and short
questionnaires, turns what it sees into a **Dynamic Distress Score** with trends,
and alerts their counsellor when someone needs help.

- **Victims:** use the app in English, Hindi or Punjabi. They see gentle, non-clinical
  language only.
- **Counsellors:** see scores, trends, alerts and case events, and follow up.
- **Team split:** jais owns `backend/`, a teammate owns `frontend/`.
  `backend/backend.md` is the handoff between the two.

## Layout

```
backend/                 FastAPI + local ML (Python 3.12, Apple Silicon for the MLX parts)
  main.py                app, routes: /ws/predict /predict /distress /chat /ws/converse /health
  monitoring/            accounts + consent, questionnaires, Distress Score, alerts, case events (/auth /me /questionnaires /counsellor)
  chat_engine.py         chat model (Qwen3-4B, MLX) + crisis keywords (English, Hindi, Hinglish)
  translation.py         Hindi <-> English around the chat model
  distress_engine.py     serves the trained distress classifier
  voice_agent/           live voice call (/ws/converse): speech-to-text, emotion, streaming reply, speech
  analysis.py, emotion_engine.py, dimensional.py, ...   voice emotion pipeline
  chat_training/         optional chat fine-tuning + system_prompt.txt (the chat's behaviour)
  distress_training/     distress model training (./train_distress.sh)
  tests/                 pytest suite (no model downloads needed)
  data/                  SQLite DB + encryption key - personal data, git-ignored, NEVER commit
  backend.md             frontend instructions + models (update with every backend change)
frontend/                React + Vite + Tailwind (from Google AI Studio)
start.sh / start.bat     run backend + frontend together
train_all.sh             download data + train the distress model (--with-chat also fine-tunes the chat)
```

## Running

```bash
./start.sh                                   # backend :8000 + frontend :3000
cd backend && ./venv/bin/uvicorn main:app --port 8000     # backend only (~3 min to load models)
cd backend && ./venv/bin/python manage.py seed-demo       # demo counsellor + victims, prints tokens
cd backend && ./venv/bin/python -m pytest -q tests        # must pass before committing backend work
```

- API docs: http://127.0.0.1:8000/docs
- `/health` shows which models loaded, including `chat.translation.hindi`.
- The first run downloads several GB of models from Hugging Face.
- English → Hindi translation (IndicTrans2) is gated: log in to Hugging Face on the
  machine and accept the terms at
  huggingface.co/ai4bharat/indictrans2-en-indic-dist-200M. Without it, the chat model
  writes Hindi itself.

## Rules

**Safety and product**
- Never show victims numbers, scores, severities or clinical labels. Victim endpoints
  don't return them; keep the UI that way.
- Crisis handling must never be weakened. Any `crisis: true` (chat, questionnaire,
  voice call) shows the helpline banner (112, 181, Tele-MANAS 14416) and a "call your
  counsellor" button. Crisis checks run on the person's original words, using keywords
  OR the distress model.
- The chat agent says it's an AI if asked, never claims credentials or a personal life,
  and doesn't diagnose or give legal or medical instructions.
- Chat tone lives in `backend/chat_training/system_prompt.txt`: a friend for everyday
  messages, therapist-style listening only when something is hard. Edits apply without
  a restart.

**Privacy**
- Personal data is encrypted at rest (`monitoring/crypto.py`).
- Never commit `backend/data/`, `.env*`, the Python environment, datasets or trained models.
- Frontend: keep the token in memory or `sessionStorage`, never `localStorage`. Quick
  Exit clears it.

**Engineering**
- Every backend change: update `backend/backend.md` (the frontend instructions and the
  **Update log**) and add a line to `CHANGES.md`.
- Trained models are precious. Test and benchmark runs never write to live model
  folders: `--quick` goes to `model_quick/`, and full runs keep the old model in
  `model_previous/`. Don't delete trained models.
- Before training, check nothing else is training
  (`ps -axo command | grep -E "train\.py|lora"`). Stop the backend during distress
  training (it needs ~12–14 GB), and run it with
  `PYTORCH_MPS_HIGH_WATERMARK_RATIO=1.7 PYTORCH_MPS_LOW_WATERMARK_RATIO=0.6 ./train_distress.sh`.
- MLX work (chat model, Kokoro, Whisper turbo) must stay on the thread that loaded it.
  ChatEngine runs everything on one worker thread.
- The installed transformers is **v5**. Older helper packages and remote-code models
  often break (IndicTransToolkit, the Odyssey WavLM remote code). Prefer native
  implementations. If `trust_remote_code` is unavoidable, pin the revision.
- Safari: create the `AudioContext` inside the tap handler, or it captures silence.

## Decisions already made (don't redo without new evidence)

- **Chat model: Qwen3-4B-Instruct.**
  - Tested against 8B: 8B was 0.7 s slower per reply and only slightly better in Hindi,
    with serious errors of its own. Hindi quality comes from translation instead.
  - Thinking mode is off, so Qwen3 hybrid models can be dropped in.
- **Chat fine-tuning is ON, on distilled data** (was off). The earlier failure was the
  data, not the idea: 7.9% of assistant turns in the old prepared set pushed breathing,
  grounding or "you're not alone", so training amplified it. Now 0.1%. The set is 584
  conversations written by gemma-4-26b-a4b as an offline teacher
  (`chat_training/distil.py`) plus filtered public data; the counselling transcripts
  (esconv, MentalChat16K) sit in `chat_training/datasets_disabled/`.
  The active adapter is the **iter-600** checkpoint, not the final one: validation loss
  bottomed at 600 (1.527) and rose by 800 (1.675). Measured against the base model on
  `chat_training/eval_tone.py` - stock phrases 3/17 -> 0/17, template empathy 6/17 -> 2/17.
  `./train_chat.sh revert` undoes it. Counsellor-written conversations are still the
  thing that would beat this.
- **Distress model: MuRIL, fine-tuned** on 5 openly licensed datasets (30,868 messages).
  It catches 94% of high-risk messages; macro-F1 0.91.
- **Distress Score: fixed, documented weights** (`monitoring/scoring.py`), not clinically
  validated. Fit them to pilot data later. Five components since 2026-09-11:
  questionnaires 0.40, text 0.22, voice 0.13, engagement 0.13, **case_pressure 0.12**.
- **`case_pressure` exists because the calendar is the stressor.** For a victim of
  an atrocity most distress comes from hearing dates, adjournments, bail
  applications and relief that never arrives, not from something internal
  (Nayar 2025; Hoyle & Zedner 2007). Court dates are known ahead, so the score
  forecasts instead of only reacting - that is what 26094 means by *prediction*.
  Relief amounts and their stage splits are the real Annexure-I table
  (`monitoring/relief_schedule.json`, G.S.R. 424(E) of 14 April 2016). The split
  is **not** a flat 25/50/25 - it varies by offence, and a test pins the awkward
  rows against the Gazette. TAME is due in 3 days, and s.15A notice before a bail
  hearing is mandatory (*Hariram Bhambhi*, 2021).
- **Quote law from the Gazette, not from memory.** The first draft of
  `backend.md` stated a flat 25/50/25 split as though it were the rule. It is not,
  and a victim told they are owed money on the wrong date is the exact harm this
  project exists to avoid. Check the notification before writing a number down.
- **Translation:** opus-mt for Hindi → English; IndicTrans2 for English → Hindi, because
  opus-mt and mBART were too literal ("hearing" became "listening").

## Known gaps and open work

- Threats from other people ("they threatened my family") aren't flagged by the model
  or the keywords. (A counsellor can now log the case-side of this as a
  `bail_hearing`/`adjournment` event, but the chat model still misses it.)
- The Hindi strings for the case calendar and entitlements
  (`monitoring/service.py`, `VICTIM_EVENT_LABELS` / `ENTITLEMENT_LABELS`) are
  drafts and need a native reviewer; Punjabi falls back to English.
- `case_pressure` weights and the 14-day ramp are guesses, like the rest of the
  scoring weights. Nothing about them is clinically or empirically validated.
- Hinglish isn't translated, and Punjabi isn't translated or in the questionnaires.
- ⚠ **The crisis reply often asks OR points, not both.** `SAFETY_INSTRUCTION` asks the
  model to check whether they are safe right now *and* encourage reaching emergency help
  or their counsellor. Measured on `eval_tone.py`, the base model and both trained
  adapters fail 2 of 2 safety cases on that two-part test ("I don't want to live anymore"
  -> "I hear you... What are you feeling right now?"). Pre-existing, not caused by
  training. The crisis banner and helplines still fire from `crisis: true`, so the person
  does see help - but the model's own words should carry it too.
- ⚠ **Punjabi crisis text is missed entirely.** `CRISIS_RE` has no Gurmukhi patterns
  and the distress model doesn't flag Punjabi as high risk ("ਮੇਰਾ ਹੁਣ ਜੀਣ ਦਾ ਮਨ ਨਹੀਂ ਕਰਦਾ"
  scores 65.8, high_risk false), so neither half of the crisis check fires. Hindi is
  covered only because the keywords catch it - the model misses it too (66.5, false).
  Gurmukhi keywords need a native speaker's review before they go in.
- `detect_language()` only separates Devanagari from English, so Punjabi (Gurmukhi)
  and Hinglish are both read as English and never reach translation.
- The Hindi questionnaire stems, answer labels and PC-PTSD-5 wording are drafts that
  need clinical review.
- IndicTrans2 hasn't been tested on this stack yet; that waits on the terms.
- Voice-call emotion adaptation hasn't been tested with real (non-synthetic) voices.
- The voice call screen is built (`frontend/src/components/VoiceCall.tsx` +
  `lib/converseApi.ts`). It hasn't been tried on Safari or on a phone yet, and
  barge-in on laptop speakers still depends on the browser's echo cancellation.
  The other open boxes in `backend/backend.md` are small.
- Not built: messaging a counsellor from the app, reassigning cases, SMS/IVRS outreach,
  NHAA 14566 / Integrated Portal integration, and a knowledge base for legal questions.
  Where the UI offers these, it says they aren't available rather than faking them.
- Frontend rule: no mock data on real screens. Anything the backend doesn't measure
  shows "—" (see `frontend/src/admin/data/live.ts`).
- ⚠ Non-commercial licenses: the audeering arousal/valence model, and the ESConv and
  EmpatheticDialogues chat data.
