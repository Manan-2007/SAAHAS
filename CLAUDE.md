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
- **Chat fine-tuning is off.** On public datasets it made replies shorter and less
  empathetic. Redo it only with counsellor-written SAHAAS conversations
  (`./train_chat.sh`, `revert` undoes).
- **Distress model: MuRIL, fine-tuned** on 5 openly licensed datasets (30,868 messages).
  It catches 94% of high-risk messages; macro-F1 0.91.
- **Distress Score: fixed, documented weights** (`monitoring/scoring.py`), not clinically
  validated. Fit them to pilot data later.
- **Translation:** opus-mt for Hindi → English; IndicTrans2 for English → Hindi, because
  opus-mt and mBART were too literal ("hearing" became "listening").

## Known gaps and open work

- Threats from other people ("they threatened my family") aren't flagged by the model
  or the keywords.
- Hinglish isn't translated, and Punjabi isn't translated or in the questionnaires.
- The Hindi questionnaire stems, answer labels and PC-PTSD-5 wording are drafts that
  need clinical review.
- IndicTrans2 hasn't been tested on this stack yet; that waits on the terms.
- Voice-call emotion adaptation hasn't been tested with real (non-synthetic) voices.
- The frontend isn't wired to the monitoring features yet: see `backend/backend.md`
  sections 1–4.
- Not built: SMS/IVRS outreach, NHAA 14566 / Integrated Portal integration, real
  counsellor login (tokens are pasted for now), and a knowledge base for legal questions.
- ⚠ Non-commercial licenses: the audeering arousal/valence model, and the ESConv and
  EmpatheticDialogues chat data.
