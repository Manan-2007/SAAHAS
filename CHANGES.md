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

### Not in the repo yet (local changes on jais's machine)
- Frontend wiring: `App.tsx`, `SafeChat.tsx`, `VoiceCompanion.tsx`, `emotionApi.ts`,
  `vite.config.ts`, `voiceReflection.ts`. The frontend teammate should review and
  merge these.
- Root `README.md` updates and `train_all.sh`.

### Commits
- `2a47028` initial commit.
- `65259e0` backend: monitoring, distress model, voice call.
- Next: translation, prompt fixes, and these docs.
