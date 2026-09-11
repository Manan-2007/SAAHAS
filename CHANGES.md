## Case-aware distress: the calendar as a stressor (2026-09-11)

The Distress Score used to read only what a person said and how they sounded.
Both of the sources behind this change point the other way: for a victim of an
atrocity most distress is produced by the justice system's own calendar -
hearing dates, adjournments, a bail application, relief money that never
arrives. Nayar (2025), *Justice or Re-traumatization*, calls this secondary
victimization; Hoyle and Zedner (2007) describe the same collateral harm.

That matters because problem statement 26094 asks for a distress **prediction**
system and SAHAAS only reacted. Court dates are known in advance, so the
distress around them can be forecast.

- **Fifth score component, `case_pressure`** (`monitoring/scoring.py`): a 14-day
  ramp towards the next hearing, plus adjournments in the last 90 days, plus
  relief the person says never arrived. Weights are now questionnaires 0.40,
  text 0.22, voice 0.13, engagement 0.13, case_pressure 0.12.
- **Forecast**: `scoring.forecast()` holds every other signal still and moves
  only the calendar term to its day-of maximum, so the number means "today, plus
  the hearing getting closer" and not a claim about someone's mood.
- **Entitlement tracker**, built on the real Annexure-I schedule as notified in
  G.S.R. 424(E) of 14 April 2016 (`monitoring/relief_schedule.json`, 48 rows).
  A counsellor gives the section and the backend creates the whole staged set
  with the amounts worked out. Victims are rarely told any of this; counsellors
  see the amounts, victims only ever see the question and three buttons.
  An earlier draft of this file claimed relief is always staged 25/50/25. It is
  not, and the difference matters: dumping excreta is 10/50/40, assault on a
  woman pays 50% at FIR, rape pays 50% only after the medical report, murder 50%
  after the post-mortem, and a social boycott is paid in full at charge sheet.
  A test asserts each of those against the Gazette, and it caught one row that
  had been entered wrongly.
- **s.15A watchdog**: notice to the victim before a bail or parole hearing is
  mandatory and its absence voids the order (*Hariram Bhambhi v. Satyanarayan*,
  2021). A missing or unrecorded notice inside 7 days raises a `high` alert.
- Four new alert reasons, four new event kinds, `GET /me/case`,
  `GET /counsellor/forecast`, and entitlement routes. Full API in
  `backend/backend.md` section 5.

Victim-facing rules are unchanged and now tested: `/me/case` carries no score,
tier or amount, and the victim-side `kind` is coarsened so the word "bail" never
reaches the screen.

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

### Team merge: auth, storage and the frontend wired together
- Merged Swagat's `feat/backend-auth` (username + password sign-in, sessions,
  lockout, encrypted usernames) and `feat/recordings-storage` (encrypted audio
  behind a `store_recordings` consent, off by default) with Manan's frontend revamp.
- Fixed in the merge: `PUT /me/credentials` replaced a password without the current
  one (account takeover from an unlocked phone); `/predict` read whole uploads before
  the 25 MB check; the bucket's escape check was a string prefix. New encrypted
  `PUT /me/profile` for onboarding answers.
- Frontend sign-in was a local mock (accounts and password hashes in `localStorage`).
  It now uses `/auth`, keeps only the token in `sessionStorage`, signs out on 401,
  and Quick Exit wipes it. Sign-up has plain-language consent toggles and a
  "continue without an account" path.
- Wired: token on chat/voice notes/live voice, real questionnaires with the crisis
  banner, home well-being rows, case dates and next check-in, and a Privacy & account
  panel (consent, devices, recordings, password, delete everything).
- Counsellors sign in to the Command Centre with their real caseload, alerts,
  score history and recordings. Victims can no longer open it (it shows scores).
- Removed things that pretended: a simulated counsellor call (now real helplines,
  incl. NHAA 14566), invented counsellor chat replies, the demo chat history sent
  to the model, a fake-PIN lock, a fake audit ledger, made-up KPIs and clinical
  notes, "end-to-end encrypted" claims, and settings sliders that did nothing.

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
- Voice call screen ("Talk with SAHAAS", `backend/backend.md` 3b): a live spoken
  conversation over `/ws/converse`. `src/lib/converseApi.ts` streams the mic as
  Float32 PCM, plays the agent's sentences back-to-back on one AudioContext, and
  drops the queue on `interrupted`; `src/components/VoiceCall.tsx` is the screen
  (orb, captions, gentle tone line, Stop, End call, crisis banner). Reached from
  the Voice tab and a home-dashboard card.
  - The server calls itself `listening` again ~0.3 s in, while ~3 s of audio is
    still playing, so the orb state and the Stop button follow the local playback
    queue instead. Otherwise Stop is disabled for the whole time the agent is
    audibly talking.
  - Punjabi has no voice pipeline yet, so `pa` falls back to language detection and
    the screen says so.
- The conversation is remembered instead of restarting every time. Both sides of
  every exchange are stored encrypted in a new `messages` table, and read back as
  context: `/ws/converse` seeds a call from it (so a second call knows the first),
  `/chat` keeps the reply as well as the message, and Safe Chat loads it on mount.
  Chat and voice share one conversation - what you said out loud shows up in the
  chat as ordinary bubbles.
  - Only with the `store_messages` consent. Guests keep nothing; turning the
    consent off erases what was kept; `DELETE /me/conversation` is the manual
    version, and deleting the account cascades.
  - New: `GET /me/conversation`, `DELETE /me/conversation`.
- Chat tone (`chat_training/system_prompt.txt`): the boundaries were a footnote at
  the end and the model walked past them. Asked "what are you up to", it invented a
  life and even shared memories ("remember when we went to that little café?",
  "I miss our chats") in 6 of 6 samples. "What you are" now sits above the tone
  rules, with worked examples for being asked about itself, and 6 of 6 samples are
  clean. Also added: answer the thing that was actually said rather than its
  category, don't moralise at someone who says they hurt another person, and
  "you're not alone" joins the list of stock phrases to avoid.
- Measured, for the record: Qwen3-8B answers a serious disclosure with the same
  template empathy as the 4B, so size is not what is missing there.
  gemma-4-26b-a4b handles it properly but peaks at 15 GB and 15.6 tok/s, which
  does not fit beside Whisper and Kokoro on a 24 GB machine, and it leaks a
  `<|channel>thought` preamble that `_result` does not strip.
- Training data added (downloaded, not yet trained on):
  - chat: `Abhishekcr448/Hinglish-Everyday-Conversations-1M` (MIT) for everyday
    register, capped to 3000 in `config.yaml` - uncapped, 980k rows of small talk
    would be 98% of the set and teach only small talk. Plus
    `ZahrizhalAli/mental_health_conversational_dataset` (MIT, 106 usable).
  - distress: `Hate-speech-CNERG/hatexplain` (CC BY 4.0, 15,383 train) for the
    "someone threatened me" gap. It still needs an adapter in `prepare.py`: these
    are the aggressor's words, not the victim's, so the label mapping is a
    judgement call, not a mechanical one.
  - `distress_training/fetch.py` learned to read Hugging Face's auto-converted
    parquet branch, for datasets still published as a loading script (the
    `datasets` library dropped script support, which is why hatexplain failed).
  - Licensing note: after this, `thu-coai/esconv` (CC BY-NC) is the single largest
    contributor to the chat set - 8000 of 14,954 examples. That needs resolving
    before anything trained on it ships.
- **Chat fine-tuning is back on, with different data.** The old run failed because
  the data was the problem: 7.9% of assistant turns in the prepared set pushed
  breathing, grounding or "you're not alone", so training amplified exactly the
  register we wanted gone. Now 0.1%.
  - `chat_training/distil.py` (new): writes SAHAAS conversations with
    gemma-4-26b-a4b as an offline teacher - the only local model that answered a
    serious disclosure without reaching for a template. 584 dialogues / 1,058
    training turns across everyday talk, hard moments, case and legal worries,
    serious disclosures, questions about itself, and crisis. The teacher reasons
    in a `<|channel>thought` block and would spend its whole budget restating the
    brief, so the prompt closes that channel and prefills the first speaker.
  - `chat_training/eval_tone.py` (new): the gate. 17 cases scored for stock
    phrases, template empathy, invented personal life, casual reply length and
    intact safety. It applies `SAFETY_INSTRUCTION` exactly as `chat_engine` does,
    otherwise the crisis cases are judged against a prompt production never uses.
  - ⚠ Crisis dialogues are generated under their own rules. Written with the
    ordinary "talk like a person" rules, the teacher answered "I don't want to
    live anymore" with a curious follow-up and never mentioned safety or help.
    14 such dialogues were generated and removed before training; the rest are
    produced with the runtime safety rule and must mention safety or where to
    turn, or they are rejected.
  - Data: esconv and MentalChat16K moved to `datasets_disabled/` (counselling
    transcripts, the tic source). Hinglish-1M parked there too for this run - it
    teaches register in romanized Hindi and the goal here was English.
    `drop_phrases` in `config.yaml` filters the stock phrases from whatever
    remains; `min_reply_chars` 40 -> 20 so short natural replies survive.
  - `training_system_prompt` no longer says "trauma-informed emotional support
    companion", which was itself a nudge towards the counselling register.
  - Result, `eval_tone.py`, 17 cases, three runs each:
    stock phrases 3/17 -> 0/17, template empathy 6/17 -> 2-4/17, invented life 0/17
    throughout, casual replies ~14 words. iter-600 and iter-1000 are a wash on the
    battery, so the published adapter is **iter-600** (lower validation loss, so it
    should generalise better beyond these 17 cases). iter-1000 is kept at
    `chat_training/adapters_training/final_iter1000_backup.safetensors`.
    Caveat: the template-empathy regex counts "That sounds like a lovely evening" as a
    hit, so that column over-reports on casual replies.
- Still to do on the frontend: the monitoring screens (sign-up, questionnaires,
  counsellor dashboard). See `backend/backend.md`.

### Commits
- `2a47028` initial commit.
- `65259e0` backend: monitoring, distress model, voice call.
- `8eb17b5` Hindi via translation, friendlier chat, CLAUDE.md + CHANGES.md.
- Next: frontend wiring, root README and train_all.sh.
