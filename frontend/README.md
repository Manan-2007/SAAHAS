# SAHAAS frontend

Two faces, one React + Vite + Tailwind app:

- **Survivor app** (`src/survivor/`) - calm, private, mobile-first. Home, Chat,
  Voice, Check-in, Wellbeing, Breathe / Ground, Support (counsellor, helplines,
  rights, preparing for dates, reporting a problem) and Privacy.
- **Command Centre** (`src/admin/`) - the counsellor dashboard, on the same
  dark tokens. Lazy-loaded; survivors never download it. Sign in with a
  counsellor account and the app opens it instead of the survivor app.

Two companion docs:

- [`DESIGN_LANGUAGE.md`](DESIGN_LANGUAGE.md) - the design language: principles,
  tokens, type, illustration, motion, components, words, safety patterns.
- [`REBUILD_PROMPT.md`](REBUILD_PROMPT.md) - a self-contained prompt to rebuild
  this frontend against the SAHAAS backend.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
```

The dev server proxies `/health`, `/predict`, `/chat`, `/ws`, `/auth`, `/me`,
`/questionnaires`, `/counsellor` and `/ivrs` to the backend at `BACKEND_URL`
(default `http://127.0.0.1:8000`). The backend (FastAPI) lives in the main
SAHAAS repository, [tzxh45dhff-art/SAAHAS](https://github.com/tzxh45dhff-art/SAAHAS),
under `backend/`; its README covers setup, and its `start.sh` runs both halves.

Without the backend the app still opens at the welcome screen: signing in says
SAHAAS can't be reached, and a guest can use Breathe / Ground and every
helpline. A saved session that can't be restored shows an offline screen with
the emergency numbers. With the backend up but its models still loading,
Voice shows "Voice is taking a little break" and Chat says it couldn't answer.

`npm run build` for production; `npm run lint` type-checks. The pitch page for
demos lives at `/?about` - it explains the Distress Score, so it is never a
survivor's first screen.

## The survivor app

```
src/survivor/
  SurvivorApp.tsx     context (route, crisis, counsellor, live stream) + screen switch
  navigation.ts       screens as history entries with the SAME url (back works, the url never names a screen)
  shell/              AppShell, TopBar + QuickExit, BottomNav + floating Voice, SideNav (desktop), HelplineSheet
  screens/            one file per screen
  ui/                 Button, ActionCard, Choice, ProgressIndicator, CrisisBanner, SafetyCard,
                      ConsentCard, LanguageSwitcher, Sheet, UpcomingCard, EntitlementCard, ...
  orbs/               ListeningOrb (voice), BreathingOrb
  illustrations/      original flat SVG scenes
  data/               survivorData.ts (every read/write + the gentle wording),
                      useSafeChat / useVoiceCall / useVoiceCheckIn (session logic)
src/i18n/             en / hi / pa strings and LanguageProvider
src/lib/              backend clients (api.ts, emotionApi.ts, converseApi.ts, liveStream.ts)
```

### Rules the code keeps

- **No numbers on survivor screens.** No score, tier, severity, confidence or
  amount - the victim endpoints don't send them, and nothing here derives them.
  Trend words from `/me/wellbeing` become sentences in `survivorData.ts`
  (`LATELY`).
- **Colour is an experience, never a status.** `ui/accents.ts`: check-in
  yellow, chat blue, voice purple, breathe green, people coral, dates pink.
  Nothing is green for good or red for bad. Triage status colours
  (`danger`, `warn`, `ok`, `info`) exist for the Command Centre only
  (`src/admin/palette.ts`) and never appear on survivor screens.
- **Crisis is never weakened.** Any `crisis: true` shows 112 / 181 / 14416 as
  one-tap calls plus the counsellor; Support leads with them for the session.
- **No demo data** (see `CLAUDE.md` in the main repo). Missing data is an empty state.
- **Screens reach the backend only through `survivor/data/`.**
- The token stays in `sessionStorage` (never `localStorage`); Quick Exit wipes
  it and shows a neutral decoy.

### Design tokens

In `src/index.css` (`@theme`): `canvas #111`, `surface #1a1a1a`, `raised #222`,
`ink #f5f1e8`, `ink-2 #a9a59d`, the six accents, `rounded-tile` (14px),
`rounded-card` (18px). Type is Plus Jakarta Sans, with Fraunces italic for the
occasional emotional line (upright in हिन्दी / ਪੰਜਾਬੀ). Motion lives in
`src/survivor/survivor.css` and switches off under `prefers-reduced-motion`.

**Light and dark.** `:root[data-theme="light"]` in `src/index.css` redefines
the same tokens, so components never branch on theme. `src/theme.tsx` holds
the choice (match the phone / light / dark) in sessionStorage only, and
`index.html` sets `data-theme` before first paint. Use tokens, never hex: a
hard-coded colour won't follow the theme. In SVG, set themed paints through
`style` (`style={{ fill: 'var(--scene-room)' }}`), not the `fill` attribute.
