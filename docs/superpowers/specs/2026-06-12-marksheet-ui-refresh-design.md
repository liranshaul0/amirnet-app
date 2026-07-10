# Marksheet — Amirnet UI refresh design

Date: 2026-06-12
Status: Approved (concept + gold accent). **Evolved same-day into "Midnight Amber"** per the user's master refactor prompt — see addendum at the end.

## Context & goal

The Amirnet app ([index.html](../../../index.html)) is a single-file, RTL Hebrew study tool for the Israeli AMIRNET English placement exam. Today it uses a generic dark-glassmorphism look (violet accent, heavy blur). The user wants a **refresh of the design language** — same screens and behavior, a noticeably more premium and distinctive UI — and chose the **"Marksheet" concept with a gold accent**.

The concept is grounded in what the app actually is: a **bilingual exam instrument**. The design borrows from the exam itself — the OMR answer sheet (the A/B/C/D bubble you fill is the signature interaction), monospace numerals for anything measured (score, clock, days-left), a deliberate bilingual type pairing, and the real **placement ladder** (טרום בסיסי → פטור) as a progress spine instead of a generic XP bar.

This is a **visual refresh only** — no study logic, scoring, SRS, or data changes.

## Design tokens

Replace the `:root` block (index.html ~line 15) and the font `@import` (~line 13).

**Color** — cool charcoal ink field, single warm accent:
| Token | Value | Use |
|---|---|---|
| `--ink` | `#0F1117` | page background |
| `--paper` | `#191C24` | cards |
| `--paper2` | `#232631` | elevated surfaces, inputs |
| `--line` | `rgba(255,255,255,0.07)` | hairline borders |
| `--text` | `#EAEDF4` | primary text |
| `--muted` | `#98A0B3` | secondary text |
| `--faint` | `#6A7186` | tertiary/hints |
| `--accent` (`--mk`) | `#F6B53D` | brand gold (active bubble, primary buttons, current rung) |
| `--accent-soft` | `rgba(246,181,61,0.14)` | gold tints/fills |
| `--accent-ink` | `#0F1117` | text on gold |
| `--good` | `#2FBF8F` | correct answer (mint) |
| `--bad` | `#F2584E` | wrong answer (coral) |

Correctness colors stay **separate from the brand** so "selected" (gold) never reads as "correct" (mint).

**Type** — three roles via Google Fonts:
- `Space Grotesk` (400/500/700) — everything *measured*: score, exam clock, days-left, level, bubble letters, section numbers, stat values.
- `Heebo` (400/500/700) — Hebrew UI.
- `Inter` (400/500/700) — English items and reading passages.

Map onto existing `--font` / `--font-he` variables plus a new `--font-mono`. Keep `--font` = Inter/Heebo stack, `--font-he` = Heebo, `--font-mono` = Space Grotesk.

**Radius / motion**: tighten radii for an instrument feel — `--radius:16px`, `--radius-sm:12px`, `--radius-xs:10px` (down from 20/14/10). Reduce/remove heavy blur (`--blur`). Micro-interactions: bubble fill (~120ms), option press lift, ladder current-rung subtle pulse — all wrapped in `@media (prefers-reduced-motion: reduce)` to disable.

## Component language

1. **OMR option bubble** — the existing `.opt .letter` element is already a 32px circle; restyle it into the answer bubble (hairline ring → fills gold when the row is selected/hovered, mint on `.opt.correct`, coral on `.opt.wrong`). Mostly CSS on existing markup; the letter stays in `--font-mono`. Applies in both practice (`renderQuestion`) and mock (`renderMockQuestion`) since both emit `.opt`.
2. **Placement ladder spine** — new home component: the five `PLACEMENT_LEVELS` bands rendered bottom-up, current band lit in gold, פטור as an open target ring above. Rendered by a new `renderLadder()` (uses `getPlacement()` + the predicted score from `computePredictedAmirnetScore()`), injected into a container in the home card / `renderHomePro`.
3. **Buttons** (`.btn`, `.btn.primary`) — flat; primary = gold fill + ink text; secondary = transparent + hairline.
4. **Cards / tiles / chips / mItem / cockpit** — flat `--paper` surfaces, hairline borders, new radii; active nav (`.sbBtn.active`, `.bbBtn.active`) = gold.
5. **Numerals → mono** — apply `--font-mono` to value elements: `#lvlText`, `#daysText`, `#accText`, `#xpText/#xpNext`, `#timerEl`, predicted-score displays, stat numbers.

## Per-screen application

Because screens share component classes, the token + component changes cascade. Targeted touches:
- **Home** — ladder spine, mono predicted score, reskinned mission / word-of-day / daily-challenge / quick-action tiles / goals (incl. the exam-date row added earlier).
- **Practice & Mock** — OMR bubbles, mono clock, difficulty shown as dots, reskinned explanation/why-wrong panel.
- **Exam Center** — reskin cards, mock history list, mistake heatmap.
- **Vocab** — lexicon-style cards (the enriched definition/example/mnemonic already render); reskin SRS card, browse, search.
- **Games / Mistakes / Stats** — reskin via shared tokens; recolor radar/history charts (`drawRadar`, `drawHistoryChart`) and confetti to gold/mint.

## Implementation approach

Token-first, in the single file:
1. Swap font `@import`; rewrite `:root` tokens; soften `body` background (drop the heavy violet radial gradients for a restrained cool field, optional faint gold glow).
2. Restyle shared components (`.card`, `.btn`, `.opt`/`.letter`, `.tile`, `.chip`, `.cockpit`, `#sidebar`/`.sbBtn`, `#bottomBar`/`.bbBtn`, `.switch`, inputs) — watching selector specificity in the single `<style>` block (avoid `.section` vs element-selector padding clashes per frontend-design guidance).
3. Add `renderLadder()` + its home container; call it from `renderDashboard`/`renderHomePro`.
4. Add `--font-mono` to value elements (CSS classes or by id).
5. Recolor canvas charts.

No changes to study logic, scoring, SRS, storage, or question/dictionary data.

**Light mode**: the app has a light-mode toggle. Provide refreshed light tokens so it still works, but dark is the primary, fully-polished mode.

## Out of scope

- Deferred from earlier work (revisit after the refresh): finishing "smarter study tools" (mock-review per-distractor `whyWrong`, weak-spots panel), PWA + mobile polish.
- No new study content, no behavior changes.

## Verification

- Serve via the existing local static server and load each screen in the preview browser.
- Console clean; run the app's `runDiagnostics()` (debug mode).
- Walk: home (ladder + score), a practice question (bubble select → correct/wrong feedback colors), a mock + review, vocab SRS/search card, stats charts.
- Check RTL/LTR mixing intact and mobile width (375–390px) — bottom bar, tap targets, ladder.
- `prefers-reduced-motion` disables animations.
- Commit per logical chunk; offer to push when the user confirms.

---

## Addendum — "Midnight Amber" evolution (same day)

The user supplied a master refactor prompt evolving Marksheet into a premium-SaaS register. Implemented on top of the Marksheet base (all study logic/data retained — 444 questions, SRS, IRT theta/diff, authentic mock, 50–150 scoring):

- **Palette deepened**: bg `#08090f`, surface `#11131f`, borders `rgba(255,255,255,0.08)`; gold `#f6b53d` unchanged. Glassmorphism restored: `backdrop-filter: blur(16px)` + deep soft shadows on cards, cockpit, sidebar, bottom bar.
- **Bento dashboard**: home is a 4-column bento grid — Predicted Score (2×2, with placement ladder + mock CTAs), Daily Mission (2), Streak (1), Word of the Day (1), Daily Challenge (2), Mastery Rings (2); collapses to 2 columns under 760px.
- **Focus Mode ("Dojo")**: `stageActive`/`focus-mode-active` on body hides sidebar, cockpit, and bottom bar during practice/mock sessions.
- **Slim iconic sidebar** (104px, icon over tiny label; emoji split into `.sbIco`/`.sbLab` at init) and a **floating pill bottom bar** on mobile.
- **Global search**: Cmd/Ctrl+K opens the dictionary search from anywhere.
- **Micro-interactions**: success glow on the practice card + spring bounce on the correct option (correct answers only); fade + Y-slide view transitions on nav; haptics were already wired.
- **Architecture**: reactive `S` via Proxy — writes to xp/level/streak/accuracy keys auto-refresh the cockpit (debounced); `window.App = {State, Engine, UI, Nav}` module map; all `S` reassignment paths (`load`, `importData`, `resetAll`) wrap through `makeReactive`.
- Kept single-file `index.html` deliberately: GitHub Pages deploy + the retain-100%-of-logic requirement made an in-file modularization the safe call.

### Accent revision — "Midnight Indigo" (2026-07-10)
Seeing the gold live at full scale, the user rejected it emphatically ("the yellow — it's just vomit"). Accent swapped app-wide to electric indigo `#6E79F4` (hover `#5661E0`; light mode `#4953C8`), white text on accent. All remaining yellow/amber eliminated: warnings/streak-fire moved to warm orange `#E0784A`, the daily-challenge badge to indigo, the passage highlighter to soft cyan. Manifest icons recolored; SW cache bumped to `amirnet-v2`. **Standing rule: no yellow/gold anywhere in this app's UI.**

### Professional pass — de-emojification (2026-07-10)
The user rejected the overall look as childish/unprofessional, specifically the emojis ("מזעזע"). Every emoji was removed (hundreds of instances) in favor of a Feather-style inline SVG icon system (`ICONS` map + `ic()` + `hydrateIcons()`, stroke `currentColor`): sidebar/bottom-bar nav, quick-action tiles, cockpit stats, games hub, floating dictionary. Emoji-only buttons became clean text labels (השמע/רמז/סמן/נתח/יציאה/הוסף). Branding toned down: "AMIRNET" wordmark + "הכנה למבחן אמיר״ם" instead of "🎯 AMIRNET ELITE V7.0"; shimmer and bounce animations removed; font weights disciplined (1000→800, 900→700). **Standing rules: no emojis in UI — SVG icons or text only; restrained weights; no gamer-style branding.**
