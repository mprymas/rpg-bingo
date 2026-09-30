# Vintage Paper create-session board — Implementation Plan

## Overview

Deposit the Vintage Paper motif into the existing shadcn token contract, force dark mode on every page, and restyle `/sessions/new` onto semantic tokens plus shared Input/Label/Checkbox/RadioGroup. Fix catalog-load Layout error (C4) and empty-catalog copy (C5, submit still allowed). Gate visuals with a production-blocked kitchen-sink route.

## Current State Analysis

- Token source: `src/styles/global.css` (`:root` / `.dark` → `@theme inline`). Body already uses `bg-background text-foreground`; screens ignore it via `bg-cosmic` and palette classes.
- Create view: `src/pages/sessions/new.astro` + `src/components/sessions/NewSessionForm.tsx` — cosmic glass/purple one-offs; Button overridden with `bg-purple-600`.
- UI kit on disk: `src/components/ui/button.tsx`, `LibBadge.astro` only. No Input/Label/Checkbox/RadioGroup.
- Layout (`src/layouts/Layout.astro`): bare `<html lang="pl">`, no `.dark`, no font links.
- C4: rewards query error returns raw `Response` without Layout (`new.astro:16-18`). C5: `rewards: []` renders blank Nagrody; submit remains allowed (archive: empty rewards array is valid).
- Motif deposit: `context/changes/ui-new-session-board/motif-vintage-paper.json`. Research: `context/changes/ui-new-session-board/research.md`.

### Key Discoveries

- `@custom-variant dark (&:is(.dark *));` requires a `.dark` ancestor — force `class="dark"` on `<html>`.
- Astro cannot keep both `sessions/new.astro` and `sessions/new/kitchen-sink.astro`; relocate to `sessions/new/index.astro` first.
- `components.json` aliases `hooks` → `@/hooks` while repo hooks live under `src/components/hooks/` — do not let shadcn generate hooks into the wrong path; add only UI primitives.
- Other `bg-cosmic` pages (dashboard, auth, `[id]`, Welcome) stay deferred; forced dark still changes body/button tokens behind cosmic wrappers.

## Desired End State

Logged-in MG opens `/sessions/new` and sees Vintage Paper dark (brown-ink) styling from tokens and shared primitives. Catalog load failure stays inside Layout with Polish error. Empty catalog shows Polish empty copy; Generuj remains enabled. Kitchen-sink at `/sessions/new/kitchen-sink` works in dev only and shows named states for screenshots. Other cosmic pages are explicitly deferred.

## What We're NOT Doing

- Restyling dashboard, auth, session detail, Welcome, Topbar, BoardGrid (deferred cosmic drift).
- Light theme UI or a theme toggle (app is dark-only).
- Motif shadow / tracking / spacing extras beyond colors, radius, fonts.
- Changing create-session API rules, board generation, or blocking submit on empty catalog.
- Installing Playwright / screenshot CI; gate is manual kitchen-sink screenshots.
- Force-fitting auth `FormField` / `SubmitButton` into this island.
- Removing `bg-cosmic` utility from `global.css` (other pages still use it).

## Implementation Approach

`/10x-ui` order: deposit values + force dark → add primitives via `npx shadcn@latest add` → restyle one view + C4/C5 → kitchen-sink visual gate. Preserve Polish copy, 5×5 default, Inspiracja ×3, live counters, over-limit disable, `ServerError` for API errors.

## Critical Implementation Details

**Routing:** Before adding the sink, move `src/pages/sessions/new.astro` → `src/pages/sessions/new/index.astro` so `/sessions/new` URL is unchanged and `/sessions/new/kitchen-sink` can exist as a sibling page.

**Dark-only:** Always render `<html lang="pl" class="dark">`. Still map motif light vars into `:root` and dark into `.dark` (deposit contract); the app never runs without `.dark`.

**Fonts:** Self-host Libre Baskerville, Lora, and IBM Plex Mono (e.g. `@fontsource` packages) and wire `--font-sans` / `--font-serif` / `--font-mono` through `:root`/`.dark` and `@theme inline` so `font-sans` works on `body`. Do not rely on a runtime-only Google Fonts CDN as the sole path on Cloudflare Workers.

**Kitchen-sink prod gate:** If `import.meta.env.PROD`, return 404 (or redirect away). Route remains under `/sessions*`, so middleware auth still applies in dev.

**Empty catalog copy (C5):** Polish explanation under Nagrody; do not disable submit. Suggested copy direction: catalog has no rewards; board can still be generated without rewards.

---

## Phase 1: Token deposit + fonts + force dark

### Overview

Replace starter values in `global.css` with Vintage Paper colors/radius/fonts; load fonts; force `.dark` on `<html>`.

### Changes Required

#### 1. Global token contract

**File**: `src/styles/global.css`

**Intent**: Map motif CSS variables from `motif-vintage-paper.json` into existing `:root` / `.dark` slots (colors + radius + font family vars). Publish font roles via `@theme inline`. Keep `bg-cosmic` utility for deferred pages.

**Contract**: Same variable names already consumed by `@theme inline` (`--background`, `--primary`, `--ring`, `--radius`, …). Add `--font-sans`, `--font-serif`, `--font-mono` to both layers and `@theme inline`. Do not invent a second palette block.

#### 2. Font packages + Layout dark class

**Files**: `package.json` (deps), `src/layouts/Layout.astro`

**Intent**: Ship the three motif fonts with the app and force dark mode on every page so `.dark` tokens activate.

**Contract**: `<html lang="pl" class="dark">`. Import font CSS once (Layout or `global.css`) so `body` `@apply … font-sans` uses Libre Baskerville. No theme toggle.

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npx astro check` passes
- `npm run build` passes

#### Manual Verification

- With `npm run dev`, any Layout page has `html.dark` and body uses Vintage Paper dark background/foreground (behind cosmic wrappers where present)
- Libre Baskerville (or configured sans) is applied on body text

**Implementation Note**: Pause for human confirmation of manual checks before Phase 2.

---

## Phase 2: Shared primitives

### Overview

Add shadcn Input, Label, Checkbox, RadioGroup under `src/components/ui/`.

### Changes Required

#### 1. Install primitives

**Files**: `src/components/ui/{input,label,checkbox,radio-group}.tsx` (names as emitted by shadcn), `package.json` as needed for Radix peers

**Intent**: Provide token-based controls so the create form can drop one-off shells (charge C3).

**Contract**: `npx shadcn@latest add input label checkbox radio-group` with existing `components.json` (new-york, cssVariables). Primitives must use semantic classes (`border-input`, `ring-ring`, etc.), not palette one-offs. Do not add unused Card. Do not generate hooks into a wrong alias path.

### Success Criteria

#### Automated Verification

- Four primitive modules exist under `src/components/ui/` and typecheck via `npx astro check`
- `npm run lint` passes

#### Manual Verification

- No runtime import errors when briefly importing each primitive in a throwaway render or the upcoming form work

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Create-session view + C4/C5

### Overview

Restyle `/sessions/new` onto tokens/primitives; fix catalog error Layout path and empty-catalog copy; tokenize `ServerError`.

### Changes Required

#### 1. Page shell + C4

**File**: `src/pages/sessions/new/index.astro` (relocated from `new.astro`)

**Intent**: Drop cosmic/glass one-offs for role classes (`bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-primary` / muted). On rewards query failure, render Layout with Polish error UI instead of a raw text Response.

**Contract**: Success and error paths both wrap in `Layout`. Preserve rewards query shape and ordering. Relocate file so Phase 4 sink can sit beside it; `/sessions/new` URL unchanged.

#### 2. Form restyle + C5

**File**: `src/components/sessions/NewSessionForm.tsx`

**Intent**: Replace `inputClass` and purple/white shells with Input, Label, Checkbox, RadioGroup, and untinted Button variants. Show Polish empty state when `rewards.length === 0`; keep submit enabled. Preserve size/phrase/reward behavior, counters, over-limit disable, pending label, `useCreateSession` payload.

**Contract**: Size via RadioGroup; phrase text via Input; guaranteed via Checkbox; reward counts via Input `type="number"`; submit via `Button` without `bg-purple-*` overrides. Focus uses `ring-ring`. Over-limit counters use `text-destructive` (or muted+destructive), not `text-red-300`.

#### 3. ServerError tokens

**File**: `src/components/auth/ServerError.tsx`

**Intent**: Make the API error banner use destructive/border tokens so the form error state matches the motif (needed for visual gate).

**Contract**: Same props API (`message?: string | null`); null still renders nothing. Classes use `destructive` / `border` roles, not `red-*` palette.

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npx astro check` passes
- `npm run build` passes

#### Manual Verification

- `/sessions/new` shows Vintage Paper dark create form (no purple/cosmic glass)
- Size, custom phrases, rewards, counters, over-limit disable, and successful create still work
- Simulated/forced catalog error shows Layout + Polish error (not bare text)
- With empty rewards prop, Nagrody shows empty copy and Generuj remains clickable (subject to other validation)
- Keyboard focus rings follow `--ring`

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Kitchen-sink + visual gate

### Overview

Dev-only route rendering named states; screenshot desktop + one mobile width.

### Changes Required

#### 1. Kitchen-sink page

**File**: `src/pages/sessions/new/kitchen-sink.astro`

**Intent**: Production-blocked gallery of create-session UI states for `/10x-ui` visual gate.

**Contract**: Path `/sessions/new/kitchen-sink`. If `import.meta.env.PROD`, respond 404 (or non-indexed redirect). In DEV, render Layout and the form (or form sections) for named states: **default**, **hover/focus**, **disabled** (over-limit and/or pending), **error** (ServerError), **empty** (zero rewards), **loading** (pending). Prefer a narrow `demoState` (or equivalent) prop on the form used only by this page — do not change production create behavior. Fixture rewards/phrases as needed so states are stable without DB tricks.

#### 2. Visual evidence

**Intent**: Capture screenshots as review evidence (desktop + one mobile width).

**Contract**: Store under `context/changes/ui-new-session-board/` (e.g. `screenshots/`) or attach in the implement review notes; do not add Playwright.

### Success Criteria

#### Automated Verification

- `npm run build` (PROD) does not expose a working kitchen-sink page (404/absent behavior verified by requesting the route against preview, or by static check that PROD branch returns 404)
- `npm run lint` and `npx astro check` pass

#### Manual Verification

- In DEV, logged-in visit to `/sessions/new/kitchen-sink` shows all named states
- Screenshots taken at desktop and one mobile width
- Production/preview: kitchen-sink not usable as a create UI

**Implementation Note**: Phase complete after screenshots reviewed against Vintage Paper dark + charges C1–C5 addressed or explicitly deferred.

---

## Testing Strategy

### Unit Tests

- None (repo has no unit runner). Rely on lint, `astro check`, build, smoke as needed.

### Integration / smoke

- Optional: `npm run smoke` against preview after Phase 3+ if auth flow still green; not a visual gate.

### Manual Testing Steps

1. Deposit + dark: inspect `html.dark` and fonts on `/sessions/new` and one other Layout page.
2. Happy path create: 5×5, Inspiracja ×3, generate, land on `/sessions/:id`.
3. Over-limit: raise rewards above N² — submit disabled, destructive counter.
4. Empty catalog: force `rewards={[]}` — copy visible, submit allowed.
5. C4: force query error — Layout error, not raw text.
6. Kitchen-sink: all states; screenshot; confirm PROD blocks route.

## Performance Considerations

Font packages add weight — load only the weights used (regular/bold as needed). No other perf budget for this UI change.

## Migration Notes

No DB migrations. Token deposit is global; expect visual shift on shared Button/ServerError and body behind cosmic pages. Rollback = revert the change commit(s).

## References

- Research: `context/changes/ui-new-session-board/research.md`
- Motif: `context/changes/ui-new-session-board/motif-vintage-paper.json`
- Prior feature archive: `context/archive/2026-09-27-gm-create-session-board/`
- `/10x-ui` skill: `.cursor/skills/10x-ui/SKILL.md`
- Tokens: `src/styles/global.css`
- View: `src/pages/sessions/new.astro` → `src/pages/sessions/new/index.astro`
- Form: `src/components/sessions/NewSessionForm.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Token deposit + fonts + force dark

#### Automated

- [x] 1.1 `npm run lint` passes — ba989f5
- [x] 1.2 `npx astro check` passes — ba989f5
- [x] 1.3 `npm run build` passes — ba989f5

#### Manual

- [x] 1.4 `html.dark` present and Vintage Paper dark body tokens visible on a Layout page — ba989f5
- [x] 1.5 Motif sans font applied on body text — ba989f5

### Phase 2: Shared primitives

#### Automated

- [x] 2.1 Input, Label, Checkbox, RadioGroup exist under `src/components/ui/` and `npx astro check` passes — a2120f1
- [x] 2.2 `npm run lint` passes — a2120f1

#### Manual

- [x] 2.3 Primitives import/render without runtime errors — a2120f1

### Phase 3: Create-session view + C4/C5

#### Automated

- [x] 3.1 `npm run lint` passes — 8d65b95
- [x] 3.2 `npx astro check` passes — 8d65b95
- [x] 3.3 `npm run build` passes — 8d65b95

#### Manual

- [x] 3.4 `/sessions/new` uses Vintage Paper dark tokens/primitives (no cosmic purple glass) — 8d65b95
- [x] 3.5 Create flow, counters, and over-limit disable still work — 8d65b95
- [x] 3.6 Catalog error path renders inside Layout with Polish error — 8d65b95
- [x] 3.7 Empty catalog shows Polish copy; submit remains allowed — 8d65b95
- [x] 3.8 Focus rings follow `--ring` — 8d65b95

### Phase 4: Kitchen-sink + visual gate

#### Automated

- [x] 4.1 PROD/preview blocks kitchen-sink (404 or equivalent)
- [x] 4.2 `npm run lint` and `npx astro check` pass

#### Manual

- [x] 4.3 DEV kitchen-sink shows default, hover/focus, disabled, error, empty, loading
- [x] 4.4 Desktop + one mobile-width screenshots captured for review
