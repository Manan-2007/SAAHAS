# Prompt: rebuild the SAHAAS frontend against the existing backend

Copy everything below the line into an AI coding agent (or hand it to a
developer). It is self-contained, but it expects `DESIGN_LANGUAGE.md` (in this
folder) to be provided alongside it - that file is the visual source of truth.

---

You are the lead product designer and senior frontend engineer for **SAHAAS**,
a trauma-informed support app for survivors of atrocities in India (Ministry of
Social Justice problem statement 26094). Build its complete frontend - a
survivor app and a counsellor dashboard - against the **existing FastAPI
backend**. The backend is finished and must not be changed; your job is to
use it well.

## 0. Before you write code

1. Read the backend's `backend/backend.md` (the frontend contract), `CLAUDE.md`
   (project rules) and `CHANGES.md` in the main repository
   (github.com/tzxh45dhff-art/SAAHAS). Where they disagree with this prompt on
   a backend detail, the backend docs win.
2. Read `DESIGN_LANGUAGE.md`. Every colour, size, radius, motion value,
   component and word choice in it is intentional. Follow it.
3. Run the backend, or the lightweight harness in §13, and try every
   endpoint you use before building a screen around it.
4. Never invent data. If the backend has nothing, show an empty state.

## 1. Non-negotiable product rules

- **Survivors never see a number about their mind:** no Distress Score, risk
  score, tier, severity band, model confidence, emotion probability, clinical
  label or chart that implies a diagnosis. Victim endpoints don't return them;
  don't derive them either. Trends become gentle sentences.
- **Survivors never see money amounts.** Entitlements are only "Did the support
  money arrive? Yes / Not yet / Not sure".
- **Crisis handling is never weakened.** Any `crisis: true` (chat, voice call,
  questionnaire, message to counsellor) immediately shows the helplines
  **112, 181, Tele-MANAS 14416** as one-tap `tel:` buttons plus a way to reach
  the counsellor, without scrolling. Keep a client-side keyword safety net for
  chat so the banner still appears when the chat model is offline.
- **Threats / pressure** (`safety: true`, or reporting a threat category) show a
  separate safety card: 112 and the atrocities helpline 14566, and "your
  counsellor has been told".
- **Quick Exit** is always visible, fixed top-right, discreet. It clears the
  session instantly and shows a neutral decoy page (and a neutral tab title).
  It must not call `/auth/logout` - it must be instant and leave no trace of a
  deliberate action. Before sign-in, "Leave" does
  `location.replace('https://www.google.com/search?q=weather+today')`.
- **Nothing persists on the phone:** the token lives in memory or
  `sessionStorage`, never `localStorage`. The same goes for language, theme and
  checklists. Quick Exit wipes `sessionStorage`.
- **No demo or mock data on real screens.** Missing data = empty state. (A
  dev-only harness is fine; mock data shipped in the app is not.)
- **Colour is an experience, never a status** on survivor screens (see the
  design language). Status colours exist only in the counsellor dashboard.
- **Honest states.** If voice or chat is offline, say so and offer the
  alternative. Never fake a model result.
- The chat companion says it is an AI companion, not a counsellor.

## 2. Stack and structure

- React 19, Vite 6, TypeScript, **Tailwind CSS v4** (tokens in `@theme`),
  `lucide-react` for survivor icons, Material Symbols for the dashboard.
  No component framework.
- Mobile-first; supports 360px phones to 1440px desktops.
- Suggested layout:

```
src/
  main.tsx               ThemeProvider > LanguageProvider > AuthGate > App
  App.tsx                role routing: counsellor -> AdminApp (lazy); else SurvivorApp; Quick Exit decoy
  theme.tsx              system / light / dark, sessionStorage only
  i18n/                  strings (en complete, hi + pa drafts, fall back to en), LanguageProvider
  lib/                   api.ts (REST + session), emotionApi.ts (/predict, /ws/predict, /chat),
                         converseApi.ts (/ws/converse), liveStream.ts (SSE)
  auth/                  AuthProvider (gate), AuthScreen (sign up / sign in), Onboarding, authStore
  survivor/
    SurvivorApp.tsx      context: route, crisis, counsellor card, helplines, one live stream
    navigation.ts        history-state routing (see §6)
    shell/ screens/ ui/ orbs/ illustrations/
    data/                the ONLY place screens reach the backend: survivorData.ts + session hooks
  admin/                 the counsellor dashboard (lazy-loaded)
```

- Presentation components never call `fetch`. Put reads/writes and the
  "backend value -> gentle words" mapping in the data layer.

## 3. Backend contract

**Dev proxy** (`vite.config.ts`, target `BACKEND_URL`, default
`http://127.0.0.1:8000`): `/health`, `/predict`, `/chat`, `/ws` (ws: true),
`/auth`, `^/me(/|$|\?)` (not plain `/me` - it would catch `/metadata.json`),
`/questionnaires`, `/counsellor`, `/ivrs`. For a separately hosted backend use
`VITE_API_URL`.

**Session:** send `Authorization: Bearer <token>` on every call. A 401 on a
call made with the current token means "signed out": drop the token and return
to sign-in (except the two endpoints where 401 means "wrong current password").
Sign-up registers, then logs in to get a *session* token (so it expires, shows
in "where I'm signed in", and logout ends it). Map backend errors to plain
sentences; only show the backend's own message for deliberate refusals
(400 / 409 / 422 / 429).

### Accounts
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `{name, language, consent, username, password, gender, phone}`; 409 username taken; 400 without `data_storage` |
| POST | `/auth/login` | `{username, password}` -> `{token, user_id, role}`; 401 wrong; 429 locked out |
| POST | `/auth/logout` | `{all_devices:false}` (normal sign-out only) |
| GET | `/me` | `{user_id, role, name, language, consent, counsellor, username, has_password, profile, gender, ui_style, phone}`; `profile === null` means onboarding not done |
| PUT | `/me/profile` | `{display_name, language, coping, low_time, channel, baseline_mood, comfort}` - **replaces the whole profile**, so resend existing answers when only changing language |
| PATCH | `/me/consent` | any of `voice_analysis, store_messages, store_recordings, share_insights, ivrs_calls`; turning `store_messages` off erases stored conversation |
| PATCH | `/me/settings` | `{gender?, ui_style?: 'warm'|'calm', phone?, clear_phone?}` |
| PUT | `/me/credentials` | add username+password to a token-only account (409 taken) |
| POST | `/me/password` | `{current_password, new_password}`; 401 = wrong current; other devices signed out |
| GET / DELETE | `/me/sessions`, `/me/sessions/{id}` | "where I'm signed in" |
| DELETE | `/me` | erase everything, then clear the token |

Consent keys: `data_storage` (required for an account), `voice_analysis`,
`store_messages`, `store_recordings`, `share_insights` (on unless explicitly
false), `ivrs_calls` (needs a phone number). Roles: `victim`, `counsellor`;
plus a client-only **guest** (no account, nothing saved - chat and voice still
work).

### Survivor data
| Method | Path | Notes |
|---|---|---|
| GET | `/me/wellbeing` | `{stress, energy, fatigue, message, has_data}`; trends are `Improving / Stable / Elevated / Rest needed`; `message` is already gentle and translated |
| GET | `/me/case` | `{upcoming:[{id, kind, date, days_until, label}], entitlements:[{id, stage, label, due_on, status}]}` - `kind` is coarse (`court_date, date_changed, case_step, support, counselling`), `label` pre-softened and translated; fall back to `/me/events` |
| POST | `/me/entitlements/{id}` | `{status: received | not_received | unknown}` |
| GET | `/me/due` | which questionnaire is due (`phq9, gad7, pcptsd5, phq4`) |
| GET | `/questionnaires/{instrument}?lang=` | `{stem, items:[{number,text}], options:[{value,label}]}` (no auth) |
| POST | `/me/questionnaires/{instrument}` | `{answers:[...]}` -> `{saved, crisis, crisis_message, wellbeing}` |
| POST | `/me/mood` | `{mood}` - accepts only `calm, okay, tired, anxious, low, reflective` |
| GET | `/me/progress` | `{days_active_7d, checkins_14d, conversations_7d}` (warm style's gentle wins) |
| GET / DELETE | `/me/conversation` | stored chat + voice turns (only with `store_messages`) |
| GET / DELETE | `/me/recordings`, `/me/recordings/{id}`; GET `/me/recordings/{id}/audio` | fetch audio **with** the auth header, play from an object URL |
| GET | `/me/support` | `{counsellor:{name, phone, hours}|null, unread_messages, requests, helplines}` |
| POST | `/me/contact-requests` | `{kind:'callback', preferred_time: asap|morning|afternoon|evening, note}` |
| GET / POST | `/me/messages` | secure thread with the counsellor; POST returns `{message, crisis, crisis_message, safety}` |
| GET | `/me/issues/categories`; GET / POST `/me/issues` | report a case problem `{category, note}`; threat categories: `threat, pressure_to_compromise, boycott_harassment` |
| GET | `/me/checkin-call`; POST `/me/checkin-call/reschedule` | missed check-in call (IVRS): `{option: '1'|'2'}`, limited moves |

### Chat and voice
- `POST /chat` `{messages:[{role, content}] (last 16 real turns, never on-screen notices), tone}` ->
  `{reply, crisis, crisis_message, recorded, safety}`. `tone` is the emotion of
  the voice note being answered, sent once.
- `GET /health` -> null/404 means voice is offline.
- `POST /predict` multipart `file` (.wav/.mp3) -> `{Emotion, Confidence, Probabilities, Prosody, VoicedSeconds, Transcript}`.
- **`WS /ws/predict`** (60-second check-in and chat voice notes): first frame JSON
  `{sampleRate, transcribe, token?}`, then raw Float32 mono PCM frames
  (ScriptProcessor 4096). Server sends `{status:'ok', emotion, certainty, probabilities, prosody, voiced_seconds, transcript, segment: interim|final}` or `{status:'silence'}`.
  Client may send `{transcribe:bool}`. On stop, stream real-time silence for up
  to 4s so the last utterance finalises.
- **`WS /ws/converse`** (live spoken conversation): first frame
  `{type:'start', sampleRate, language: en|hi|auto, barge_in, greet, token?}`;
  then Float32 PCM. Server messages: `state {listening|thinking|speaking}`,
  `user_turn {transcript, language, voice:{tone_word, certainty}}`,
  `agent_text {text}`, `agent_audio {sampleRate, samples}` followed by exactly
  one binary Int16 frame, `agent_done`, `interrupted`, `crisis {message}`,
  `error {detail}`. Client sends `playback_done` when its queue drains,
  `interrupt`, `end`. Schedule sentences back-to-back on one AudioContext;
  on `interrupted` stop every source. **"Speaking" must follow local
  playback, not the server's state** (it says listening ~0.3s in). Punjabi
  has no voice pipeline: send `auto` and say so on screen.
- Safari: create the `AudioContext` inside the tap handler, before any await.
- Echo cancellation, noise suppression and auto gain on `getUserMedia`.
- Only surface a tone word when `certainty === 'high'`, as a sentence
  ("You sound a little heavy."), never as numbers.

### Live updates (SSE)
`GET /me/stream` and `GET /counsellor/stream`, read with `fetch` streaming
(EventSource can't send the auth header, and the token must never be in a
URL). `data:` lines are JSON with a `type` (`message, contact_request, issue,
reading, alert, insight, outreach, …`). Reconnect with backoff; a 401 ends it.
Open one stream per app and share it.

### Counsellor endpoints
`GET /counsellor/victims` (caseload with score, tier, trend, next event,
latest reading, peak 24h, open issues/messages/requests) ·
`GET /counsellor/forecast` · `GET /counsellor/victims/{id}` (+ `/timeline?days=30`,
`/readings`, `/insights`, `POST /insights/flush`, `/recordings`, `/entitlements`,
`POST /relief {section}`, `/issues`, `/messages`, `POST /events`) ·
`GET /counsellor/alerts?status=` (+ `/acknowledge`, `/resolve {note}`) ·
`DELETE /counsellor/events/{id}` · `PATCH /counsellor/entitlements/{id}` ·
`GET /counsellor/relief-schedule` · `GET /counsellor/feed` ·
`GET /counsellor/legal-actions` · `GET/PATCH /counsellor/issues` ·
`GET /counsellor/contact-requests` + `POST /{id} {status, response}` ·
`GET /counsellor/messages` (inbox) · `GET /counsellor/outreach` ·
`POST /ivrs/simulate` · `GET/PUT /counsellor/me/contact`.

## 4. Entry flow

1. **Welcome:** a window-seat illustration, serif line "a quiet place, whenever
   you need it.", language (English / हिन्दी / ਪੰਜਾਬੀ, each in its own script),
   **Get started**, **I already have an account**, **Continue without an
   account** ("chat and voice work, and nothing is saved"). Top bar: wordmark,
   a light/dark toggle, **Leave**.
2. **Sign up in three steps** with a progress bar: (1) a name you feel safe with
   + how you identify; (2) **consent on its own screen**, one big switch card
   per consent with a plain hint; turning off `data_storage` explains there's
   no account and offers guest mode; (3) username, password, optional phone
   (required if check-in calls were chosen). Send the chosen language.
3. **Sign in:** username + password, or an access token.
4. **Onboarding**, one question per screen, auto-advancing: name + language;
   what helps when things feel heavy; hardest time of day; speaking or
   writing; how the past week felt (Steady … Very heavy - words, no numbers);
   what helps you feel safe. Saved with `PUT /me/profile`.
5. Counsellors go straight to the dashboard. The project's pitch page, which
   explains the Distress Score, must never be a survivor's first screen; if
   kept, put it at `/?about` and lazy-load it.

## 5. Survivor app

Navigation: **Home · Chat · Voice (floating lilac button) · Wellbeing ·
Support**. Top bar: wordmark (home), a leaf button (Breathe), **Exit ×**.
Check-in and Breathe are focused screens without the bottom nav.

- **Home** - not a dashboard. "good evening, asha" + serif "take your time."
  (warm style: a daily affirmation instead). One yellow hero card with a sprout
  illustration: "how are things feeling today?" → **check in**. Then "today":
  Talk (lilac) and Write (iris) tiles, a Breathe row (sage). Then only if
  present: the next date (prefer a court date) as "Something is coming up" with
  "Here's what to expect"; one unanswered "Did the support money arrive?"; a
  missed-check-in-call card (check in now, or move the call within limits); a
  guest notice.
- **Check-in** - "What feels closest right now?" with seven chunky choices:
  okay, tired, restless, heavy, hopeful, disconnected, unsure. Map them to the
  backend's moods: restless→anxious, heavy→low, disconnected→low,
  hopeful→calm, unsure→reflective. Reply gently. Then, only if `/me/due` has a
  questionnaire, offer "A few more gentle questions?" (Yes / Not today); ask
  one item per screen with a progress bar and a back button; submit at the
  end; show the crisis banner on `crisis: true`. Finish with "thank you for
  checking in." and Breathe / Talk it through / Back home. No scores, ever.
- **Chat** - private conversation. Header: "Chat", a privacy line built from
  consent ("private · your words aren't saved"), icons for blur (discreet
  mode), talk to your counsellor, clear this screen. Empty state: notebook
  illustration, serif "what's been sitting with you?", four gentle starters,
  and "SAHAAS is an AI companion, not a counsellor." Resume the stored
  conversation for signed-in victims. Large bubbles (yours in iris), a calm
  composer above the nav (mic for voice notes, auto-growing text box, send).
  Offline: "SAHAAS couldn't answer that one" + a notice pointing to Support -
  never improvised advice.
- **Voice** - the listening orb fills the screen. Idle: serif "i'm here when
  you're ready." + Start talking; a "Let me interrupt" switch (barge-in, with a
  headphones hint). Live: one status line (listening / thinking / speaking),
  Stop talking + End, collapsible captions with "hide my words". Offline:
  "Voice is taking a little break." + Try again / Use chat instead. Link to the
  60-second check-in.
- **60-second voice check-in** - orb, a countdown, rotating gentle prompts,
  "your voice sounds heavy, maybe" while speaking, optional live words, or
  upload a .wav/.mp3. The result is **only** the gentle reflection sentence
  (and what was heard) - never probabilities or percentages.
- **Wellbeing** - serif "lately". The backend `message`, then three sentences
  (energy, fatigue, stress) mapped from trend words, then "that's okay." if any
  are heavy. Empty: resting illustration + "Nothing to reflect back yet."
  Warm style also shows gentle wins from `/me/progress`. Tools: check in,
  60-second voice check-in, breathe, ground.
- **Breathe / Ground** - the breathing orb, words above ("breathe in"), a
  count below, gentle 4·4·6 or 4·7·8, "I feel a little calmer" after a round.
  Ground: 5-4-3-2-1, one step at a time with a big number.
- **Support** - "need someone?" (serif), a two-people-on-a-bench illustration,
  doorways: Talk to your counsellor (with name/hours and an unread badge), Call
  a helpline (sheet of every line, one tap each), Find legal support, Prepare
  for what's coming, Something wrong with your case?, then Privacy, language &
  account. After any crisis in the session, the crisis banner leads the page.
- **Counsellor** - contact card with Call (`tel:`) when a number exists;
  request a call back (time + note) or see its status; the secure message
  thread, live.
- **Legal support** - plain-language rights (collapsed cards), each with its
  legal basis and "This isn't happening for me" → report a problem. NALSA
  15100. "General information, not legal advice."
- **Prepare** - upcoming dates (gentle labels), what to expect, a "what you may
  want to bring" checklist (sessionStorage), "Your counsellor can help you
  prepare", and every pending entitlement question (answers can be changed).
- **Report a problem** - backend categories as choices, optional note, send;
  what you've told us, with plain statuses; the safety card for threats.
- **Privacy** - language (persist to the account via the full profile);
  appearance (Match my phone / Light / Dark); what SAHAAS keeps (switches);
  recordings (play / delete); where you're signed in (sign out others); you &
  the app (gender, warm or calm style, phone); add or change password; sign
  out; forget our conversation; delete all my data (with confirmation).
  Guests: "Nothing. Without an account, what you say isn't saved."

## 6. Behaviour details

- **Routing:** each screen change is `history.pushState` with the **same URL**
  and the route in `history.state`, so the back button works but the address
  bar and history never name a screen. The app always opens at Home. Scroll to
  top and move focus to the main region on every screen change.
- **Crisis state** is set only by a real signal and kept for the session.
- **One live stream** in the survivor app refreshes the unread badge and the
  counsellor thread.
- **Theme:** a pre-paint script in `index.html` applies the session's choice
  or the system preference; `ThemeProvider` keeps it in sync.
- **i18n:** all shell, home, check-in, breathe, support, crisis, entry and
  offline strings are keys. Hindi avoids gendered verbs. Missing keys fall back
  to English. Set `<html lang>`.
- **Loading** uses hushed placeholders shaped like the content; **errors** are
  calm notices with a retry.

## 7. Counsellor Command Centre

Same tokens as the survivor app, plus admin-only status colours (`danger`,
`warn`, `ok`, `info`). Calm, scannable, never a wall of badges.

- **Sidebar (256px):** SAHAAS wordmark + "counsellor"; **Today**; *People*:
  Caseload, This week, Case problems; *Contact*: Messages, Check-in calls, Live
  feed; *Review*: Care plans, Outcomes; then Settings & scoring; your name and
  sign-out at the foot. Quiet count badges (danger only for unreachable
  check-in calls). The case page is not in the nav.
- **Header:** "Live" status on the left; lock screen, light/dark, alerts
  (drawer) on the right.
- **Every page** opens with the same header: title, one sentence, ≤ 2 actions.
- **Today:** "Good morning, Dr. …" + one summary line ("1 person needs you
  first · 3 open alerts · 1 court date in the next 3 days"), a stat strip
  (people in your care, need you first, open alerts, messages & call-backs
  waiting), the caseload list (most urgent first, status as dot + text), and
  one person panel: name, status, distress score, voice, escalation risk, why
  they're here, what the score is made of, signal coverage, and **Open case /
  Schedule follow-up / Acknowledge alerts**, plus Case history. It must fit
  on one desktop screen. On narrow screens, picking a person scrolls to the
  panel.
- **Caseload:** a table - person, status, what's happening, score, voice - with
  filters (Everyone, Need you first, Gone quiet, Voice distress, Court date
  soon) and search. The whole row opens the case. "Need you first" uses one
  shared rule everywhere (crisis/alert status or high escalation risk).
- **Case page:** back to Caseload, name + one status line, Call / Schedule
  follow-up / History, then one row of underline tabs: Score, Summaries,
  Readings, Problems, Messages, Timeline, Relief, Alerts, Recordings, Consent.
  Relief shows amounts (counsellors only) from the Annexure-I schedule.
- **This week** (forecast), **Case problems** (with cited legal steps),
  **Messages** (call-backs + threads), **Check-in calls** (with the IVRS
  simulator), **Live feed** (per-message readings, never the words),
  **Care plans** (checklist; alert items resolve the real alert),
  **Outcomes**, **Settings & scoring** (contact card, weights, alert rules,
  a link to How scoring works).
- Live stream: toasts for crisis, new alert, message, call-back request,
  summary, unreachable client; refresh only the affected client, debounced.
- Plain words only: no "Human-in-the-Loop", "Closed-Loop Recovery
  Verification", "Human-Certified", "AI-generated decision support indicators".

## 8. Design system

Implement `DESIGN_LANGUAGE.md` exactly. The essentials:

- Tokens: `canvas #111111`, `surface #1a1a1a`, `raised #222222`, `soft #282725`,
  `ink #f5f1e8`, `ink-2 #a9a59d`, `ink-3 #68655f`, hairlines at 10% / 18%;
  accents `sun #f4c95d` (check in), `iris #6f8fe8` (chat), `lilac #9a82c4`
  (voice), `sage #7dba83` (breathe), `coral #ef765a` (people), `rose #e58aae`
  (dates), `on-accent #141414`. Light theme redefines the same tokens
  (`canvas #f6f2ea`, `surface #fffdf9`, `ink #2a2622`, …) and deepens accents
  used as text.
- Plus Jakarta Sans; Fraunces italic for occasional emotional lines (upright
  in हिन्दी / ਪੰਜਾਬੀ); Noto Sans Devanagari / Gurmukhi.
- Radii 14 / 18 / 24px; tactile lip `inset 0 -3px 0 rgb(0 0 0/.22)`; 48px
  minimum targets, 56px primary, 62px Voice FAB.
- Motion 200-400ms, `cubic-bezier(.22,.61,.36,1)`, staggered settle-in
  entrances, breathing orbs; all off under `prefers-reduced-motion`.
- Original flat SVG illustrations of people in everyday rooms, themed via
  CSS variables. No stock photos.

## 9. States to design (not just the happy path)

Loading, empty, offline and error for every screen. Required copy includes:
"Voice is taking a little break. You can try again, or use chat instead." ·
"Nothing coming up right now." · "Whenever you're ready, you can start here." ·
"We couldn't reach SAHAAS right now. Your privacy and safety come first." (with
112 and 14416) · "Nothing to reflect back yet."

## 10. Accessibility

Semantic HTML; radiogroups for choices; `role="switch"` for consents;
`role="alert"` for crisis; `aria-live` for chat, captions and new questions;
visible 2px focus rings; focus moves to new questions and screens; a skip
link; icon + text labels; no colour-only meaning; body contrast ≥ 4.5:1;
never disable zoom; long-string-safe layouts.

## 11. Things that are easy to get wrong

- Sending on-screen notices (welcome, "couldn't answer") to `/chat` as history.
- Driving "the agent is speaking" from the server's `state` instead of playback.
- Creating the AudioContext after an `await` (Safari records silence).
- Calling `PUT /me/profile` with only the language (it wipes onboarding answers).
- Sending the token in a URL (SSE, WebSocket query). Put it in the first frame
  or the header.
- Showing `probabilities` as percentages in the voice result.
- Using the word "bail" on the survivor side; the backend already coarsens it.
- Colouring anything red on the survivor side to mean "bad".
- Keeping anything in `localStorage`.

## 12. Deliverables

1. The app, runnable with `npm install && npm run dev` (port 3000) and
   `npm run build`, typechecking cleanly.
2. Survivor app + Command Centre as above, in dark and light, at 375px and
   1280px.
3. A README (run, structure, rules) and a short changelog entry.
4. A summary of what needs backend data you didn't have, and any backend gaps.

## 13. Developing without the ML models

The full backend downloads several GB of models. For UI work you can run just
the accounts/check-ins API (auth, `/me/*`, questionnaires, support,
counsellor) with a tiny harness - it needs only `fastapi uvicorn pydantic
cryptography numpy pyyaml python-multipart`:

```python
# devapi_app.py - run: SAHAAS_DATA_DIR=./devdata uvicorn devapi_app:app --port 8000
import sys; sys.path.insert(0, "path/to/SAAHAS/backend")
from fastapi import FastAPI
from monitoring import api, db
db.init()
app = FastAPI()
app.include_router(api.router)
```

`/health`, `/chat`, `/ws/*` and `POST /me/messages` are absent there, which
conveniently exercises the offline states. Create a counsellor with
`monitoring.service.create_counsellor(...)`; add dates and entitlements through
the counsellor endpoints - real data through the real API, never mocks in the app.

## 14. Definition of done

Walk every flow at phone and desktop width, in both themes, with the backend
up and down: welcome → sign up → onboarding → Home → check-in (with and
without a questionnaire) → chat (online, offline, crisis phrase) → voice
(offline) → Wellbeing → Breathe / Ground → Support → counsellor → rights →
prepare → report a problem → Privacy (every control) → Quick Exit → sign
back in; then the Command Centre: Today, Caseload, a case, every other page,
the follow-up dialog, the lock screen. No console errors. No number about a
survivor's mind anywhere on the survivor side.
