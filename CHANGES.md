# Changes

What's been built and why, newest first within each area. Add a line here for
every notable change. Backend changes also go in `backend/backend.md` → Update log.

## 2026-09-11

### Project setup
- The backend from the voice-emotion-detection research project moved into
  `backend/`, next to the SAHAAS React app in `frontend/`. `start.sh` runs both. Vite
  proxies `/health`, `/predict`, `/chat` and `/ws` to the backend.
- Two portability fixes for running the backend inside another project: `static/` is
  optional, and CORS origins are configurable (`CORS_ORIGINS`).
- Root `.gitignore` rewritten so `git add .` only picks up code: personal data,
  secrets, envs, datasets, trained models and audio are all skipped. The 356 MELD
  eval clips (`backend/eval/data/`) are no longer tracked; `eval/download_eval_set.py`
  re-downloads them.

### Monitoring: the core of the problem statement
- Victim accounts with consent. Personal data is encrypted at rest; `DELETE /me`
  erases everything.
- Screening questionnaires with the backend deciding what's due: PHQ-9, GAD-7,
  PC-PTSD-5, and a PHQ-4 quick pulse. English + Hindi; PHQ-9/GAD-7 Hindi item text is
  the standard translation, the rest are drafts.
- **Dynamic Distress Score** (0–100) from questionnaires, chat distress, voice tone
  and going quiet. It comes with trends, alerts (crisis, high distress, rising, gone
  quiet, upcoming hearing) and case events.
- Counsellor API: caseload, client page, timeline, alerts, events. `manage.py`:
  `create-counsellor`, `seed-demo`, `recompute-all`. Scores are recomputed in the
  background so going quiet is noticed.
- `/chat`, `/predict` and `/ws/predict` save check-ins when a victim's token is sent.

### Distress model (message → none / low / moderate / high risk)
- Training pipeline: `./train_distress.sh`, with datasets in
  `distress_training/datasets/`. Base model MuRIL, trained on 5 openly licensed
  datasets.
- Full training run: 30,868 messages. It catches 94% of high-risk messages
  (628 of 670); macro-F1 0.91.
- Crisis keywords now cover Hindi and Hinglish too ("jeene ka mann nahi karta"),
  because the model under-rates those.
- An earlier full model was overwritten by a quick test run. Quick runs now go to
  `model_quick/`, and full runs keep the replaced model in `model_previous/`.
- Memory: an uncapped run took ~19 GB and pushed the Mac into swap. Use the soft limit
  (`PYTORCH_MPS_HIGH_WATERMARK_RATIO=1.7 PYTORCH_MPS_LOW_WATERMARK_RATIO=0.6`).

### Chat
- `/chat` runs a local Qwen3-4B (MLX) with a trauma-informed system prompt, a crisis
  banner (112, 181, Tele-MANAS 14416), and scripted replies when the model is offline.
- The distress model backs up the keyword crisis check. High risk puts the model in
  safety mode.
- Prompt rewritten: the old one answered even "hi" with "I'm here for you… let's
  breathe". It's now a friend for everyday messages and a therapist-style listener
  only when something is hard. No emojis. Prompt edits apply without a restart.
- 4B vs 8B, compared side by side on Hindi/Hinglish/English: 8B was 0.7 s slower and
  only slightly better in Hindi, so we stayed on 4B. Thinking mode is off for Qwen3
  hybrid models.
- Hindi via translation (`translation.py`): Hindi → English (opus-mt) → 4B →
  English → Hindi (IndicTrans2), sentence by sentence in voice calls. English → Hindi
  switches on once the IndicTrans2 terms are accepted on Hugging Face; until then the
  4B writes Hindi itself. opus-mt and mBART were tested for English → Hindi and
  rejected as too literal.
- Chat fine-tuning pipeline built (`./train_chat.sh`, LoRA) but off: on public
  datasets it made replies worse.
- Replies were still empathetic to "hello". Causes: Safe Chat re-sent an old voice
  note's tone with every later message, the voice call passed unsure emotion guesses
  ("sounded heavy") plus "talk like a caring person" every turn, and the offline
  fallback was always therapy-speak. Now the tone applies once, voice is framed as a
  soft hint (words decide casual vs supportive), unsure guesses are dropped, and the
  fallback just says it can't connect.

### Voice
- Live voice call `/ws/converse`:
  - speech-to-text with Whisper large-v3-turbo (Hindi + English)
  - emotion + arousal/valence of each turn
  - a streaming chat reply shaped by how the person sounded
  - Kokoro voice (English/Hindi) whose speed adapts to the person
  - talking over the agent (barge-in) interrupts it
- Measured ~3 s from the end of your speech to the agent's first words. Greeting
  made casual.
- Voice check-ins (Voice Companion) stream to `/ws/predict`; voice notes go to `/predict`.

### Frontend
- Safe Chat uses `/chat` for SAHAAS AI replies (scripted replies if the backend is
  down). Its mic records real voice notes through the emotion model, and replies take
  the tone into account. Messages that suggest risk show a crisis banner with
  helplines and a "call your counsellor" button.
- Voice Companion streams the mic to `/ws/predict` for a live tone read, accepts
  `.wav`/`.mp3` voice notes (`/predict`), writes a gentle reflection, and updates the
  dashboard's Stress/Energy/Fatigue rows. Summary logic shared in
  `src/lib/voiceReflection.ts`.
- Vite proxies `/chat` too. Root `README.md` covers running both halves, and
  `train_all.sh` downloads data and trains the distress model (`--with-chat` also
  fine-tunes the chat).
- Still to do on the frontend: the monitoring screens (sign-up, questionnaires,
  counsellor dashboard, voice call). See `backend/backend.md`.

### Commits
- `2a47028` initial commit.
- `65259e0` backend: monitoring, distress model, voice call.
- `8eb17b5` Hindi via translation, friendlier chat, CLAUDE.md + CHANGES.md.
- Next: frontend wiring, root README and train_all.sh.
