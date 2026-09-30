# SAHAAS design language

> **SAHAAS is a quiet room with colourful objects in it.**
>
> Darkness creates safety. Colour creates humanity. Illustration creates warmth.
> Typography creates clarity. Motion creates presence. Simplicity creates control.

SAHAAS is a trauma-informed companion for survivors of atrocities in India, with
a separate dashboard for the counsellors who look after them. This document is
the design language both are built on: the principles, the tokens, the
components and the words. The values here are the ones in the code
(`src/index.css`, `src/survivor/`, `src/admin/`); if you change one, change both.

Working name for the style: **Quiet Brutalism × Emotional Illustration** -
a calm canvas, flat tactile objects, editorial illustration, and extremely
clear UX.

---

## 1. Principles

1. **Quiet first.** Every screen should survive the question "what can I
   remove?" Negative space is part of the design, not leftover room. One
   invitation per screen, one question per step.
2. **Presence, not positivity.** Nothing performs happiness. People in the
   illustrations sit, read, rest and keep each other company. Copy
   acknowledges; it doesn't cheer.
3. **Colour is an experience, never a status.** Yellow means *checking in*,
   not *warning*. No green-is-good, red-is-bad on survivor screens - ever.
4. **No numbers about a person's mind.** Survivors never see a score, tier,
   severity, risk word, model confidence or clinical label. Trends become
   sentences. Amounts of money are never shown to survivors.
5. **Safety is one reach away.** Quick Exit is always top-right. Crisis lines
   are always one tap, never behind a scroll. Breathing is one tap from
   anywhere.
6. **Honest states.** When something is offline or empty, say so plainly and
   offer the next best thing. Never fake a result.
7. **Objects you can press.** Buttons and cards are physical: boxy, slightly
   rounded, with a lip that flattens when pressed. Not pills, not glass.

It should feel **safe, human, calm, private, simple, slightly playful,
emotionally intelligent - serious without being clinical.**
It should never feel like a hospital, a SaaS dashboard, a meditation app, a
children's app, cyberpunk, an AI robot therapist, or a glassmorphism template.

---

## 2. Two faces

| | Survivor app | Counsellor Command Centre |
|---|---|---|
| Purpose | A private place to check in, talk, breathe, find help | Notice who needs help first, and act |
| Density | Very low: one thing at a time | Medium: scannable, but never crowded |
| Numbers | None about the person | Scores, trends, forecasts are allowed |
| Status colour | Never | Yes, from its own palette (§3.4) |
| Voice | Lowercase, gentle, short | Plain, professional, no jargon |
| Layout | Phone-first single column | Sidebar + content column |

Both share the canvas, surfaces, ink, type, radii and motion. Admin
information architecture never leaks into the survivor app.

---

## 3. Colour

### 3.1 Surfaces and ink

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `canvas` | `#111111` | `#f6f2ea` | page background |
| `surface` | `#1a1a1a` | `#fffdf9` | cards |
| `raised` | `#222222` | `#f1ece2` | inner panels, hover, selected rows |
| `soft` | `#282725` | `#e9e2d5` | avatars, tracks, subtle fills |
| `ink` | `#f5f1e8` | `#2a2622` | primary text; the "solid" button fill |
| `ink-2` | `#a9a59d` | `#665f55` | secondary text (≥ 5.5:1) |
| `ink-3` | `#68655f` | `#a39b8f` | decorative and placeholder only (< 4.5:1) |
| `line` | cream / ink at 10% | | hairline borders |
| `line-strong` | cream / ink at 18% | | selected borders, dividers that matter |
| `on-accent` | `#141414` | `#1f1b17` | text on any accent fill |

The dark canvas is warm near-black, not blue-black. The light theme is the
same room by day: warm off-white (a nod to SAHAAS's original beige), white
cards, soft warm hairlines.

### 3.2 Accents - one per experience

| Token | Hex | Experience | Where it appears |
|---|---|---|---|
| `sun` | `#f4c95d` | **Check in** | Home hero card, check-in choices, sign-up primary |
| `iris` | `#6f8fe8` | **Chat / write** | Write tile, your chat bubbles, send button |
| `lilac` | `#9a82c4` | **Voice** | Voice FAB, listening orb, voice buttons |
| `sage` | `#7dba83` | **Breathe / ground** | Breathe card and orb, grounding steps, consent switches |
| `coral` | `#ef765a` | **Reach a person** | Support doorways, counsellor, crisis call buttons |
| `rose` | `#e58aae` | **What's coming up** | Dates, "did the support money arrive?", prepare checklist |

Rules:

- **Use them as objects.** A filled tile, a key icon, a button - with
  `on-accent` text on top. An accent is a thing you can touch.
- **If everything is colourful, nothing is.** A screen has one coloured hero
  at most; everything else is surface + ink with small coloured keys.
- **As text, accents get deeper.** In light mode `text-sun`, `text-rose` etc.
  switch to deeper shades (e.g. sun → `#8f6300`) because pastel type on white
  can't be read. For inline styles use `--color-sun-ink`.
- **Never as status.** Not for good/bad, not for severity, not for "urgent".

### 3.3 Survivor-side "alert" colour

There isn't one. Errors are plain `Notice`s on `raised` with an icon. The
crisis banner uses **coral** (reach a person), with a coral left edge - it
means "people are here", not "danger".

### 3.4 Counsellor status colours (admin only)

| Token | Dark | Light | Meaning |
|---|---|---|---|
| `danger` | `#f06a64` | `#c23b33` | crisis signal, open serious alert, unreachable |
| `warn` | `#eea04a` | `#a35a08` | rising, moderate, needs follow-up |
| `ok` | `#74c287` | `#2e7a45` | resolved, completed, stabilising |
| `info` | `#8ea7f0` | `#3d5fc0` | informational series (e.g. chat line on a chart) |

Tints are the same colour at 15-16% (`bg-danger/15`). Light values are deep
enough to be text on white *and* fills under light text. These never appear
on survivor screens.

### 3.5 Themes

- Dark is the default mood; light is equally supported.
- Default preference: **match the phone** (`prefers-color-scheme`).
- Survivors choose in Privacy → Appearance (Match my phone / Light / Dark), or
  the sun/moon button on the entry screens; counsellors via the header toggle.
- The choice lives in **sessionStorage only** - nothing about SAHAAS stays on a
  shared phone, and Quick Exit wipes it. `index.html` applies it before first
  paint so there's no flash.
- Components never branch on theme: `:root[data-theme="light"]` redefines the
  same tokens. Anything hard-coded (hex in JSX) won't follow the theme - don't.

---

## 4. Typography

**Plus Jakarta Sans** for everything. **Fraunces italic (light)** for the
occasional emotional line - "take your time.", "lately", "need someone?" - and
never for UI chrome or long text. Hindi and Punjabi use **Noto Sans
Devanagari / Gurmukhi** in the same stack.

| Role | Survivor | Counsellor |
|---|---|---|
| Emotional headline (serif) | 34-44px, leading 1.05-1.15 | - |
| Question / hero title | 26-32px semibold | - |
| Page / screen title | 20-22px semibold | 24px semibold |
| Card title | 17px semibold | 16-20px semibold |
| Body | 15-17px | 13-14px |
| Meta / caption | 13-15px `ink-2` | 12-13px `ink-2` |
| Eyebrow | 13px semibold lowercase `ink-2` | 11px uppercase tracked (nav groups only) |

- Survivor headings are **lowercase and short** ("good evening, asha" /
  "take your time.").
- Serif lines use `text-wrap: balance` so no word is stranded.
- **Devanagari and Gurmukhi never go italic** (a slanted script reads as
  broken); they get line-height 1.6.
- Numbers that matter use tabular figures.
- Never lay out around English string lengths: wrap, don't truncate, except
  in dense admin tables.

---

## 5. Shape, depth and tactility

| Token | Value | Use |
|---|---|---|
| `rounded-tile` | 14px | buttons, inputs, choices, small cards |
| `rounded-card` | 18px | cards, panels |
| `rounded-sheet` | 24px | bottom sheets |

- **Tactile lip:** filled objects carry `box-shadow: inset 0 -3px 0 rgb(0 0 0 / .22)`;
  on press it becomes `-1px` and the object moves down 1px. That's the whole
  "physical" effect - no drop shadows on dark.
- Quiet objects (`tactile-quiet`) lift to `raised` on hover and press down 1px.
- In light mode, cards get the faintest warm lift
  (`0 1px 2px` / `0 4px 12px -8px`, brown at 4-10%).
- **Not everything is a pill.** Round is reserved for the Voice FAB, avatars,
  icon buttons and tiny counters.
- **Touch targets:** 48px minimum, primary actions 56px, the Voice FAB 62px.

---

## 6. Layout

**Survivor (phone first, 360-430px):**
- Single column, max 560px, 16px gutters (24px from `sm`).
- Top bar (64px): wordmark left; breathe leaf + **Quick Exit** right.
- Bottom nav: Home · Chat · **Voice** · Wellbeing · Support, with Voice as a
  62px lilac button floating above the bar. Labels always under icons.
- Focused screens (check-in, breathe) hide the nav; Quick Exit stays.
- Desktop: a 248px rail (Voice first, as a lilac button) beside a centred
  680px column - never a phone stretched to 1440px.

**Counsellor:**
- 256px sidebar on `canvas`: wordmark, nav in labelled groups, settings,
  then your name + sign-out at the foot.
- 64px header: live status left; lock, theme, alerts icons right.
- Content column max 1152px, generous top padding.
- Every page opens with the same `PageHeader`: title, one sentence, ≤ 2 actions.

**Spacing rhythm:** 4px base. Blocks in a screen sit 16-24px apart; inside a
card 12-20px; the survivor app prefers the larger end.

---

## 7. Illustration

Original flat vector scenes (`src/survivor/illustrations/scenes.tsx`):

- **Geometric and flat.** Big fields of colour, no gradients, no outlines, no
  texture. Heads are circles; limbs are round-capped strokes; faces are left
  to the reader.
- **Everyday rooms.** Windows, plants, armchairs, benches, lamps, tea, books,
  notebooks, calendars, a tote bag.
- **Human, not cheerful.** People sit, read, rest, write, sit beside someone.
  Varied brown skin tones (`#8a5a3c`, `#b07a55`, `#6b4330`), dark hair.
- **Themed rooms.** Walls, floor, wood and window frames come from CSS
  variables (`--scene-room`, `--scene-floor`, …) so scenes follow light/dark.
  Set themed paints through `style`, not SVG attributes.
- Always decorative (`aria-hidden`).
- Never copy reference illustrations; draw in this vocabulary.

| Scene | Used on |
|---|---|
| Window seat (person in armchair, tea, night window, plant) | Welcome |
| Sprout in the light (drawn for a yellow card) | Home check-in hero |
| Two people on a bench | Support |
| Desk with calendar, bottle, tote bag | Prepare, empty dates |
| Resting with a book under a lamp | Wellbeing empty state |
| Writing in a notebook | Chat empty state |

No stock photography. No "happy therapist".

---

## 8. The two orbs

**Listening orb** (voice) - flat lilac layers: halo, a softly deforming ring,
a core, and a lighter "shine". Redrawn on animation frames with refs, not
state. It feels like *something quietly listening*, never a neon AI.

| State | Behaviour |
|---|---|
| idle | small, a very slow breath (7s) |
| connecting | soft pulse |
| listening | slow breathing expansion (4.5s) |
| you're speaking | swells and trembles with mic amplitude |
| thinking | the outer ring turns slowly |
| SAHAAS speaking | a softer, slower wave from the outside in, driven by playback level |
| finished | settles and stops |
| offline | warm grey, still |

**Breathing orb** - a flat sage disc that fills over the in-breath, waits on
the hold and empties over the out-breath; the transition lasts exactly as long
as the breath. Words sit above ("breathe in"), the count below; nothing inside
the disc. Patterns: gentle 4·4·6 (default) and 4·7·8.

Under reduced motion both orbs stand still and the words carry the state.

---

## 9. Motion

Motion should feel like breathing.

- **Durations:** 180-400ms for UI; breath-length for breathing.
- **Easing:** `ease-soft` `cubic-bezier(.22,.61,.36,1)`; `ease-breath`
  `cubic-bezier(.45,0,.55,1)` for anything that loops.
- **Entrances:** blocks *settle* - rise 6px and fade over 380ms, staggered 60ms.
- **Sheets** rise 24px; banners fade.
- **Typing dots** ripple slowly, never bounce.
- **Never:** parallax, bounce, confetti, flashy gradients, constant movement,
  anything that loops for attention.
- **`prefers-reduced-motion`:** entrances, pulses and orbs switch off.

---

## 10. Components

### Survivor (`src/survivor/ui`)

| Component | Notes |
|---|---|
| `Button` | `accent` (coloured object) · `solid` (cream on dark / ink on light) · `quiet` (surface + hairline) · `ghost` (text). md 48px, lg 56px. Busy state. `href` renders a link. |
| `IconButton` | 48px round, required label. |
| `ActionCard` | `hero` (whole coloured object + illustration + CTA) · `tile` (half-width, coloured key) · `row` (full-width doorway with chevron). |
| `Choice` / `ChoiceGroup` | Chunky radio options (moods, answers). Selected = accent fill. |
| `ProgressIndicator` | Segmented bar with `role="progressbar"`. |
| `ScreenHeader` | Back button + title, for sub-screens. |
| `Stack` | Staggers children's entrance. |
| `Serif` / `Eyebrow` | The emotional line; the small lowercase label. |
| `CrisisBanner` | Title, backend message, 112 / 181 / 14416 as one-tap coral buttons, then the counsellor (a real `tel:` or a call-back request). |
| `SafetyCard` | For threats/pressure: 112 and 14566, "your counsellor has been told". |
| `ConsentCard` | Plain title + hint + real switch; never small print. |
| `LanguageSwitcher` / `ThemeSwitcher` | Each language written in itself; Match my phone / Light / Dark. |
| `TextField` / `TextArea` | 56px, label always visible, show/hide password. |
| `Sheet` | Bottom sheet on phones, centred panel on desktop; focus trap, Esc, restores focus. |
| `Notice` | Calm inline message (info / error / offline) with an optional action. |
| `EmptyState` / `Placeholder` | Illustration + title + hint + action; a hushed shape while loading. |
| `ReflectionCard` | Serif sentences, one per line (Wellbeing). |
| `UpcomingCard` / `EntitlementCard` | A date said gently; "Did the support money arrive?" with Yes / Not yet / Not sure. |
| Shell | `AppShell`, `TopBar` + `QuickExit`, `BottomNav` + Voice FAB, `SideNav`, `HelplineSheet`. |

### Counsellor (`src/admin/components`)

| Component | Notes |
|---|---|
| `PageHeader` | Title (24px), one sentence, ≤ 2 actions. |
| `PrimaryButton` / `QuietButton` | 36px, one filled button per area. |
| Stat strip | One card split by hairlines: big number + label. No icon boxes, no progress bars. |
| Caseload table | One row per person; the whole row opens the case. |
| Person panel | Name + status line, three facts, "why they're here", what the score is made of, three actions. |
| Underline tabs | One row, text only, scrolls if it must. |
| Status line | A 6px dot + text in the status colour; never a badge wall. |

---

## 11. Voice and words

Survivor copy is **lowercase, short, warm, non-clinical**. It speaks *with*,
not *at*.

**Use:** okay · tired · restless · heavy · hopeful · disconnected · unsure ·
take your time · you have support · something is coming up · whenever you're
ready · you don't have to explain everything · that's okay.

**Avoid:** score · risk · severity · symptoms · diagnosis · patient ·
disorder · "you should" · exclamation marks · emoji soup · "I'm here for you"
on every line · anything that sounds like an AI brand.

Translations of what the system knows:

| System | Survivor sees |
|---|---|
| energy: Rest needed | "your body seems to be asking for more rest." |
| stress: Elevated | "things may have felt a little heavier." |
| fatigue: Improving | "tiredness seems to be easing." |
| any heavy trend | followed by "that's okay." |
| bail hearing / parole | "A court date about your case" |
| adjournment | "The date has moved." |
| relief stage | "Did the support money arrive?" (never an amount) |
| voice model offline | "Voice is taking a little break. You can try again, or use chat instead." |
| backend unreachable | "We couldn't reach SAHAAS right now. Your privacy and safety come first." |
| no messages | "Whenever you're ready, you can start here." |
| no dates | "Nothing coming up right now." |

The companion says it's an AI companion, not a counsellor, and that a real
person is one tap away.

Counsellor copy is plain and professional: "Today", "Caseload", "Care plans",
"Need you first". No "Human-in-the-Loop", "Closed-Loop Verification",
"Human-Certified", "AI-generated decision support indicators".

Languages: **English, हिन्दी, ਪੰਜਾਬੀ**. Hindi avoids gendered verb forms
("आज मन कैसा है?"). Hindi and Punjabi strings are drafts until a native
reviewer signs them off; missing keys fall back to English.

---

## 12. Safety patterns

- **Quick Exit:** a small "Exit ×" in the top-right on every survivor screen,
  out of the thumb arc, discreet (surface + hairline, not red). It clears the
  session, shows a neutral weather/news decoy, and renames the browser tab.
  Before sign-in, "Leave" replaces the page with an ordinary search.
- **Crisis:** any `crisis: true` shows the banner; Support leads with the lines
  for the rest of the session. The three lines are always visible without
  scrolling. It is never softened or hidden behind a tap.
- **Threats and pressure** get the safety card (protection, not self-harm help).
- **Privacy line** under chat and voice says exactly what's kept, from the
  person's consent.
- **Back button** walks back through screens but the URL never names one.
- **Nothing on the phone:** token, language, theme and checklists live in
  sessionStorage only; never localStorage.

---

## 13. Accessibility

- Contrast: body ≥ 4.5:1 (ink-2 is 5.5+:1), accents with `on-accent` ≥ 5.7:1;
  `ink-3` is decorative only.
- Visible focus: 2px ring in `ink`, 3px offset, following the shape.
- Semantic HTML; radiogroups for choices, `role="switch"` for consents,
  `role="alert"` for crisis, `aria-live` for chat, captions and questions.
- Focus moves to each new question and each new screen; a skip link exists.
- 48px targets, icon + text labels, no colour-only meaning.
- `lang` set on the document and on each language option.
- Zoom is never disabled.

---

## 14. Do and don't

| Do | Don't |
|---|---|
| One coloured object per screen | Colour every card |
| Sentences about how things have been | Meters, percentages, gauges |
| A flat illustration of a room | Stock photos, 3D blobs, gradients |
| "check in →" on a chunky button | `( Start )` pills |
| Say it's offline and offer chat | Fake a reply or a result |
| Put Quick Exit in the same place always | Move it, enlarge it, colour it red |
| Remove three things before adding one | Put every idea on every screen |
