# SAHAAS: frontend instructions

What the frontend needs to add, change or remove to use the backend. This file
is updated with every backend change; see **Update log** at the bottom for what's new.

**Run the backend while you work:**
```bash
cd backend && ./start.sh                        # http://127.0.0.1:8000 (models take ~3 min to load)
./venv/bin/python manage.py seed-demo           # demo counsellor + 4 demo victims, prints their tokens
```
Interactive API docs: http://127.0.0.1:8000/docs

---

## 1. Setup

- [ ] **Add the new routes to the Vite proxy** (`frontend/vite.config.ts`), next to
      `/health`, `/predict`, `/chat` and `/ws`: add `/auth`, `/me`, `/questionnaires`
      and `/counsellor`.
- [ ] **Send the sign-in token on every request:** header
      `Authorization: Bearer <token>` on `/chat`, `/predict` and all `/me/*` and
      `/counsellor/*` calls. For live voice, add it to the first WebSocket config
      frame: `{"sampleRate": 48000, "transcribe": true, "token": "<token>"}`.
      Without a token the app still works, but nothing is saved.
- [ ] **Store the token in memory or `sessionStorage`, never `localStorage`.**
      Quick Exit must clear it (`sessionStorage.clear()`), because victims may share phones.

## 2. Victim screens

- [ ] **Sign-up + consent screen.** It needs: name, language (`en` / `hi` / `pa`), and consent
      toggles. The first toggle is required; the other two are optional.
      `POST /auth/register`
      ```json
      {"name": "Sunita", "language": "hi", "phone": null, "case_ref": null,
       "consent": {"data_storage": true, "voice_analysis": true, "store_messages": false}}
      ```
      → `{"user_id", "token", "role": "victim", "counsellor": "Dr. Ananya Sharma"}`
      Returns 400 if `data_storage` is false. In that case offer anonymous use instead.
- [ ] **Check-in questionnaires** (replace the mocked 3-question "Quick Daily
      Check-in" in `WellBeingTracker.tsx`):
      1. `GET /me/due` → `[{instrument, name, due, next_due_at}]`. Show the items where `due: true`.
      2. `GET /questionnaires/{instrument}?lang=hi` →
         `{stem, items: [{number, text}], options: [{value, label}]}`. Show the
         stem once, then one question per screen with the options as buttons.
      3. `POST /me/questionnaires/{instrument}` with `{"answers": [0, 2, 1, ...]}`
         (one `value` per item, in order) →
         `{saved, crisis, crisis_message, wellbeing}`.
      4. If `crisis: true`, show the crisis banner with `crisis_message` and the
         "Call your counsellor" button (same banner as in Safe Chat).
      Instruments: `phq9` (9 questions), `gad7` (7), `pcptsd5` (5, yes/no),
      `phq4` (4, the quick pulse). The backend decides which are due.
- [ ] **Home dashboard well-being rows** (replace `INITIAL_WELLBEING_METRICS`):
      `GET /me/wellbeing` → `{stress, energy, fatigue, message, has_data}`.
      `stress`, `energy` and `fatigue` use the trend words the UI already has
      (`Improving`, `Stable`, `Rest needed`, `Elevated`). Show `message` as the card's
      subtitle. When `has_data` is false, show an invitation to check in.
- [ ] **Upcoming events** (replace the mock `SCHEDULED_EVENTS`): `GET /me/events` →
      `[{id, date, kind, title, days_until}]`. `kind` is one of
      `hearing | fir | chargesheet | compensation | counselling | other`.
- [ ] **Settings screen:** consent toggles with `PATCH /me/consent`
      (`{"voice_analysis": false}`) and a "Delete all my data" button
      (`DELETE /me`, then clear the token and go to the start screen).
- [ ] **Saved indicator (optional):** `/chat` returns `recorded` and `/predict`
      returns `Recorded` (true or false). A small "saved to your journey" tick is enough.
      Voice check-ins with less than 2 seconds of speech are not saved.
- [ ] **Safe Chat: send only the real conversation to `/chat`.** Don't include
      the demo messages from `INITIAL_CHAT_MESSAGES` in `messages`. They're
      about court anxiety and grounding breaths, and the model carries that tone
      into every reply (even "hi"). Start the history empty, or show the demo
      messages on screen only.
- [ ] **Never show victims numbers, scores, severities or clinical labels.** The
      victim endpoints don't return them; keep it that way in the UI too.

## 3. Counsellor Command Centre

Replace the mock clients in `CounsellorCommandCentre.tsx` with real data.

- [ ] **Login:** for now, a field to paste a counsellor token (from
      `manage.py create-counsellor "Name"` or `seed-demo`).
- [ ] **Caseload list:** `GET /counsellor/victims`, already sorted most urgent
      first. Per row: `name`, `case_ref`, `score` (0–100), `tier`, `crisis`,
      `trend.direction` + `trend.change_7d`, `open_alerts`, `last_contact_at`, `next_event`.
- [ ] **Client page:** `GET /counsellor/victims/{id}` for the profile, `latest`
      (score, tier, crisis, `components`: questionnaires / text / voice /
      engagement, each 0–100), `questionnaires` (with answers), `events` and `alerts`.
- [ ] **Charts:** `GET /counsellor/victims/{id}/timeline?days=30` →
      `scores: [{at, score, tier, crisis}]` for the main line chart,
      `questionnaires: [{at, instrument, total}]` as markers, and
      `signals.text_distress / voice_distress: [{date, mean}]` as smaller lines.
- [ ] **Alert queue:** `GET /counsellor/alerts?status=open` →
      `[{id, victim_name, at, level, reason, message, status}]`, with buttons for
      `POST /counsellor/alerts/{id}/acknowledge` and
      `POST /counsellor/alerts/{id}/resolve` (`{"note": "Called, she is safe"}`).
      Show `level: crisis` in red at the top.
- [ ] **Case events:** an add form on the client page,
      `POST /counsellor/victims/{id}/events` with
      `{"kind": "hearing", "date": "2026-09-14", "title": "District court"}`, and
      delete with `DELETE /counsellor/events/{id}`.

**Values to design for**

| Field | Values |
|---|---|
| `tier` | `stable`, `watch`, `elevated`, `high` (plus `crisis: true/false`) |
| `trend.direction` | `rising`, `falling`, `steady`, `not_enough_data` |
| alert `level` | `crisis`, `high`, `watch` |
| alert `reason` | `crisis_signal`, `high_distress`, `rising_distress`, `gone_quiet`, `upcoming_event` |
| alert `status` | `open`, `acknowledged`, `resolved` |

## 3b. Voice call screen ("Talk with SAHAAS")

A live, one-on-one spoken conversation. You talk, the agent answers out loud
with a voice that adapts to how you sound, and you can talk over it to interrupt.

- [ ] **Connect** to `ws://<host>/ws/converse`. It's already covered by the
      existing `/ws` proxy entry.
- [ ] **Microphone:** capture exactly like the Voice Companion does
      (`getUserMedia` with `echoCancellation`, `noiseSuppression` and
      `autoGainControl` all true), and send raw Float32 mono PCM as binary frames,
      continuously. On Safari, create the `AudioContext` inside the tap handler.
- [ ] **First frame** (text):
      ```json
      {"type": "start", "sampleRate": 48000, "language": "auto", "token": "<token>",
       "barge_in": true, "greet": true}
      ```
      - `sampleRate`: pass your `audioCtx.sampleRate`.
      - `language`: `"en"`, `"hi"`, or `"auto"` (detect per turn). Use the app's language setting.
      - `token` is optional: with it, the conversation is saved to the victim's journey.
      - `greet: true`: the agent says hello first.
- [ ] **Play the agent's voice.** Each `{"type": "agent_audio", "sampleRate": 24000,
      "samples": N}` message is followed by **one binary frame** of Int16 mono
      PCM. Convert it (`int16 / 32768` → Float32), put it in an `AudioBuffer` at
      24 kHz, and schedule the buffers back-to-back on one `AudioContext`: keep a
      `nextStartTime` so sentences flow without gaps. When the queue runs dry,
      send `{"type": "playback_done"}`.
- [ ] **Interruptions:** on `{"type": "interrupted"}`, stop every scheduled
      source immediately and clear the queue. The server already stopped talking.
      Add a "Stop" button that sends `{"type": "interrupt"}`.
- [ ] **States for the orb:** `{"type": "state", "state": "listening" | "thinking" | "speaking"}`.
- [ ] **Captions (optional):** `user_turn.transcript` (respect the "show my words"
      toggle) and each `agent_text.text` sentence, which arrives just before its audio.
- [ ] **How you sounded (optional, gentle):** `user_turn.voice.tone_word`
      (`settled`, `steady`, `warm`, `heavy`, `tense`, `uneasy`, `strained`, `stirred`).
      Something like "You sound a little heavy" is fine. No numbers, and nothing when
      `voice.certainty` is `"low"`.
- [ ] **Crisis:** on `{"type": "crisis", "message"}`, show the crisis banner with
      the "Call your counsellor" button, the same as in chat.
- [ ] **End call:** send `{"type": "end"}`, then close the socket.
- [ ] **Echo:** if the agent keeps interrupting itself on laptop speakers,
      suggest headphones or start with `"barge_in": false`. Then the mic is
      ignored while the agent talks, until you send `playback_done`.
- Expect the agent's first words about 3 s after you stop speaking (measured 3.0–3.2 s on an M4 Pro).

## 4. Remove or reword

- [ ] "Zero Cloud Traces", "Ephemeral Audio · Never saved", "No interaction
      data… stored" are **no longer true for signed-in users.** Keep them only for
      anonymous mode, or change them to "Private & encrypted · delete everything anytime".
- [ ] Remove the mock data you replace: `INITIAL_WELLBEING_METRICS`,
      `SCHEDULED_EVENTS`, and the mock clients in the Command Centre.

---

## Models: what we use and what we train

### Used as-is (pretrained, not trained by us)

| Job | Model | Notes |
|---|---|---|
| Detect speech vs silence | Silero VAD | Splits live audio into utterances |
| Voice emotion (main) | emotion2vec+ base | Speech-emotion model trained on 42,500 h of speech; 8 emotions |
| Voice emotion (second opinion) | Odyssey 2024 WavLM | Trained on natural podcast speech; blended with emotion2vec+ on finished utterances |
| Arousal / valence in the voice | audeering wav2vec2 MSP-Dim | ⚠ Licensed non-commercial (CC BY-NC-SA) |
| Speech → text | faster-whisper base | Voice check-ins; English only for now |
| Speech → text (voice call) | Whisper large-v3-turbo (MLX) | Hindi + English, language detected per turn |
| Agent's voice (voice call) | Kokoro-82M | English + Hindi voices, ~8x faster than real time; speaking speed and wording adapt to how you sound |
| Backup voice emotion | RAVDESS CNN | Used only if the main models can't load |
| Chat replies | Qwen3-4B-Instruct (4-bit, runs on the Mac with MLX) | Behaviour set by a trauma-informed system prompt; Apple Silicon only |

### Trained by us

**Distress model: rates a message 0 none / 1 low / 2 moderate / 3 high risk.**
- It powers crisis detection in chat and part of the Distress Score.
- Base model: MuRIL (Google), which understands Hindi, Punjabi, Hinglish and 14
  more Indian languages.
- Training data: 34,292 messages from 5 openly licensed datasets, each mapped onto
  the 4 levels:

  | Dataset | What it gives | License |
  |---|---|---|
  | Suicide vs non-suicide posts (Ram07) | high-risk vs none | MIT |
  | C-SSRS-rated posts (av9ash) | suicide-risk levels | CC BY 4.0 |
  | Depression posts (hugginglearners) | moderate vs none | CC0 |
  | GoEmotions (Google) | sadness/fear vs calm | Apache 2.0 |
  | MindBridge Hindi PHQ-9 answers | Hindi examples at every level | CC BY 4.0 |

- How: the whole model is fine-tuned for 2 passes over the data. It updates on 32
  messages at a time (in batches of 16 to save memory), and the rarer levels
  count more. The best pass is kept.
- It's judged by macro-F1 and, most importantly, by **how many high-risk messages it catches**.
- Command: `cd backend && ./train_distress.sh`. About 35–45 minutes and up to ~14 GB of
  memory on a 24 GB M4 Pro, so close other heavy apps and stop the backend while it runs. The running backend picks up the new model by itself.
- Status: **trained and live** (2026-09-11: 30,868 messages, 2 passes). On
  3,424 held-out test messages:

  | Level | Precision | Recall |
  |---|---|---|
  | none | 0.94 | 0.90 |
  | low | 0.81 | 0.90 |
  | moderate | 0.95 | 0.94 |
  | high | 0.92 | **0.94** (628 of 670 high-risk messages caught) |

  Overall macro-F1 is 0.91. The model it replaced is kept in
  `distress_training/model_previous/`.
- ⚠ **Known gaps (safety):**
  - Hindi and Hinglish statements of not wanting to live ("मुझे अब जीने का मन
    नहीं करता", "mujhe ab jeene ka mann nahi karta") are rated *moderate*, not
    *high*. Direct statements ("मैं ख़ुद को ख़त्म कर देना चाहती हूँ") are caught.
    The crisis keyword list does catch these phrasings, so chat and voice calls
    still raise `crisis`; only the model's own score is too low.
  - Threats from other people ("They threatened my family again") are rated
    *low*: the model detects self-harm risk, not danger from others, and the
    keyword list doesn't cover threats either. Not flagged anywhere yet.
- Add your own labelled data: see `distress_training/datasets/README.md`.

**Chat model fine-tuning (optional, off by default)**
- Method: LoRA, which trains a small add-on (0.4% of the model) instead of the
  whole Qwen3-4B.
- Data: 12,740 support-conversation replies from ESConv, MentalChat16K,
  EmpatheticDialogues and a small FAQ set. ⚠ ESConv and EmpatheticDialogues are non-commercial.
- Command: `cd backend && ./train_chat.sh` (~75 minutes). It prints untrained vs trained
  replies side by side; `./train_chat.sh revert` undoes it.
- **Not used right now:** on these public datasets, fine-tuning made replies
  shorter and less empathetic than the untrained model with our prompt. It's
  worth redoing with counsellor-written SAHAAS conversations.

**Distress Score (not a trained model)**
- A 0–100 score per victim combining questionnaires, chat distress, voice tone
  and whether they've gone quiet.
- It uses fixed, documented weights for now. Once real pilot data exists, it can be
  trained to predict the next questionnaire result.

---

## Update log (what changed for the frontend)

**2026-09-11**
- New: sign-up, questionnaires, well-being summary, events, and all
  `/counsellor/*` routes → sections 2 and 3.
- `/chat`, `/predict` and `/ws/predict` accept the token and save check-ins
  for signed-in victims → section 1.
- `/chat` response: new fields `distress` and `recorded`. `/predict`: new field `Recorded`.
- `/health` now also reports `chat`, `distress`, `voice_agent` and `monitoring`.
- New: live voice call over `/ws/converse` → section 3b.
- Chat replies now match the moment: casual answers to everyday messages, and
  therapist-style listening only when something is hard. The voice call's
  greeting is casual too. No frontend change needed, except the Safe Chat
  history item in section 2.
