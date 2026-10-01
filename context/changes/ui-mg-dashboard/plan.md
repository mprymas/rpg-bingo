# MG dashboard Vintage Paper — Implementation Plan

## Overview

Restyle `/dashboard` (Panel MG) onto the existing Vintage Paper token contract, wire shared React `Button` islands for primary and sign-out actions, add a branded 503 list-load error path, gate visuals with a production-blocked kitchen-sink, and extend the literal-scan / agent-rule guard. Do **not** redeposit tokens, fonts, or dark mode — those landed in `ui-new-session-board`.

## Current State Analysis

- Tokens + dark-only Layout already live: `src/styles/global.css` (`:root` / `.dark` → `@theme inline`); `Layout.astro` uses `<html class="dark">`.
- Create-session path already reads role classes; dashboard still uses cosmic/glass + palette literals (`src/pages/dashboard.astro`).
- Pre-audit: **20** hardcoded-value hits on the dashboard view; `scripts/check-ui-literals.mjs` `SCOPED_FILES` excludes it.
- `listSessionsForGm` throws on DB error (`sessions.service.ts:102`); page has no Layout error / 503 path (unlike `sessions/new/index.astro`).
- Research: `context/changes/ui-mg-dashboard/research.md` (charges C1–C5).

### Key Discoveries

- Astro cannot keep both `dashboard.astro` and `dashboard/kitchen-sink.astro`; relocate to `dashboard/index.astro` first (same pattern as create-session).
- `Button` exports `asChild` (`button.tsx`) — user chose a React island over `buttonVariants` class strings.
- Lesson: branded data-load errors must set non-2xx (e.g. 503), not HTTP 200.

## Desired End State

Logged-in MG opens `/dashboard` and sees Vintage Paper dark styling from role tokens. CTA and Wyloguj use shared `Button` focus rings. Session-list load failure stays inside Layout with Polish copy and HTTP 503. Dev kitchen-sink at `/dashboard/kitchen-sink` shows named states for screenshots. Dashboard view files are in `SCOPED_FILES`; agent rules point at both kitchen sinks. Other cosmic pages remain deferred.

## What We're NOT Doing

- Redepositing Vintage Paper tokens, fonts, or changing dark-only Layout.
- Restyling auth, `[id]`, Welcome, Topbar, BoardGrid.
- Removing `bg-cosmic` from `global.css` (other pages still use it).
- Adding shadcn Badge or incomplete-board feature work.
- Client-side loading skeleton for the list (blocking SSR → mark N/A).
- Playwright / screenshot CI; aligning unreachable config-missing raw-500 with middleware.
- Changing `listSessionsForGm` API semantics beyond catching errors on the page.

## Implementation Approach

`/10x-ui` order with deposit/dark skipped: **one view** (relocate + tokens + Button island + C3) → **states** (kitchen-sink) → **guard** (SCOPED_FILES + rules). Preserve Polish copy, session list links, sign-out `POST /api/auth/signout`.

## Critical Implementation Details

**Routing:** Move `src/pages/dashboard.astro` → `src/pages/dashboard/index.astro` before adding the sink so `/dashboard` URL stays stable.

**Button island (decision 2B):** New React component under `src/components/dashboard/` (preferred) or `src/components/sessions/`. Primary: `Button asChild` wrapping `<a href="/sessions/new">`. Sign-out: `Button type="submit" variant="outline"` preserving form POST to `/api/auth/signout`. Mount with `client:load`.

**List-load error (decision 3A):** Catch failures from `listSessionsForGm`; set `Astro.response.status = 503`; render Layout + `text-destructive` Polish message mirroring `sessions/new/index.astro` catalog error. Do not leave branded error on HTTP 200.

**Kitchen-sink prod gate:** If `import.meta.env.PROD`, return 404. Route stays under `/dashboard` → middleware auth still applies in DEV.

**Status labels:** Keep plain text (`Aktywna` / `Zamknięta`) — no Badge in this change.

**7-state matrix:** default, hover/focus, empty, error shown in sink; **disabled** and **loading** marked N/A with reasons (no disabled controls on happy path; blocking SSR list).

---

## Phase 1: One view — tokens + Button island + C3

### Overview

Relocate the page, restyle onto role classes, mount shared `Button` actions, and add branded 503 list-load error UI.

### Changes Required

#### 1. Relocate dashboard route

**File**: `src/pages/dashboard.astro` → `src/pages/dashboard/index.astro`

**Intent**: Free the `dashboard/` directory for a sibling kitchen-sink without changing `/dashboard`.

**Contract**: Same URL and middleware protection; delete the old flat `dashboard.astro` after the move.

#### 2. Tokenized page shell + list/empty

**File**: `src/pages/dashboard/index.astro`

**Intent**: Close C1 — replace cosmic/glass/palette with the create-session shell language so Panel MG matches Nowa sesja.

**Contract**: Outer `bg-background min-h-screen`; inner `border-border bg-card text-foreground`; title `text-foreground` (no blue/purple gradient); empty/list use `border-border`, `text-muted-foreground`, `divide-border`, `hover:bg-accent`; row links get visible `focus-visible` via ring tokens. Zero palette / `bg-cosmic` / arbitrary px|rem literals on this view.

#### 3. Dashboard actions React island

**Files**: new island under `src/components/dashboard/` (e.g. `DashboardActions.tsx`); import from `index.astro`

**Intent**: Close C2 — primary and sign-out use shared `Button` focus/hover variants instead of hand-rolled purple/glass controls.

**Contract**: `Button` from `@/components/ui/button` with `asChild` for the new-session link; outline (or equivalent) submit for sign-out; `client:load`; preserve `POST /api/auth/signout`.

#### 4. List-load error path (C3)

**File**: `src/pages/dashboard/index.astro` (and only if needed, thin helper — prefer page-local catch)

**Intent**: Close C3 — MG sees Polish error inside Layout when the sessions query fails, with non-2xx status per lessons.

**Contract**: On `listSessionsForGm` failure: `Astro.response.status = 503`, Layout + destructive message; success path unchanged. Empty array remains empty state, not error.

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npx astro check` passes
- `npm run build` passes
- Hardcoded-value scan on dashboard view + actions island files reports **0** hits

#### Manual Verification

- Desktop + one mobile width: empty and populated list look tokenized (no cosmic purple glass)
- Keyboard focus ring visible on CTA, sign-out, and session row links
- Forced list-load failure shows Layout + Polish error; response status is 503
- Create-session and sign-out still work from the panel

**Implementation Note**: Pause for human confirmation of manual checks before Phase 2.

---

## Phase 2: Kitchen-sink + visual gate

### Overview

Dev-only gallery of dashboard states for screenshot review (C4).

### Changes Required

#### 1. Kitchen-sink page

**File**: `src/pages/dashboard/kitchen-sink.astro`

**Intent**: One place to see default, empty, error, and focus affordances without waiting for live data failures.

**Contract**: PROD returns 404 via `import.meta.env.PROD`. Sections cover default (fixture sessions), empty, error, hover/focus (CTA/sign-out focus demo); disabled and loading labeled N/A with reasons. Reuse the same shell/actions markup (shared partial or props) so the sink cannot drift from production.

#### 2. Screenshots

**Files**: e.g. `context/changes/ui-mg-dashboard/screenshots/` (desktop + one mobile width)

**Intent**: Visual gate evidence for review.

**Contract**: Capture kitchen-sink (or equivalent state gallery) at two widths; no Playwright requirement.

### Success Criteria

#### Automated Verification

- Kitchen-sink file exists with PROD 404 gate
- `npm run lint` and `npx astro check` pass

#### Manual Verification

- In DEV (authenticated), `/dashboard/kitchen-sink` shows named states; every 7-state cell is shown or N/A-with-reason
- Desktop + mobile screenshots captured for review
- Preview/PROD: kitchen-sink not usable as a dashboard UI

**Implementation Note**: Phase complete after screenshots reviewed against tokens + charges C1–C4.

---

## Phase 3: Guard — SCOPED_FILES + agent rules

### Overview

Make the contract stick for the next agent (C5).

### Changes Required

#### 1. Literal scan scope

**File**: `scripts/check-ui-literals.mjs`

**Intent**: Fail CI/lint if palette/`bg-cosmic` returns on cleaned dashboard files.

**Contract**: Add `src/pages/dashboard/index.astro`, `src/pages/dashboard/kitchen-sink.astro`, and the new React actions module to `SCOPED_FILES`.

#### 2. Agent rule pointers

**Files**: `CLAUDE.md` (§ UI / design tokens), `AGENTS.md` (UI hard rule)

**Intent**: Point agents at both kitchen sinks and keep “no literals / use tokens / check `src/components/ui`” visible.

**Contract**: Extend kitchen-sink mention to include `/dashboard/kitchen-sink`. Do not edit inside any `<!-- BEGIN @przeprogramowani/10x-cli -->` … `<!-- END -->` block.

### Success Criteria

#### Automated Verification

- `npm run lint` / `npm run lint:ui-literals` fails if a scoped dashboard file reintroduces banned literals
- `npm run lint` passes on the clean tree

#### Manual Verification

- Rules mention token source, `src/components/ui`, no literals, and both kitchen-sink routes

---

## Testing Strategy

### Unit Tests

- None (repo has no unit runner). Rely on lint, `astro check`, build.

### Integration / smoke

- Optional: `npm run smoke` after Phase 1+ if auth flow still green; not the visual gate.

### Manual Testing Steps

1. Happy path: login → `/dashboard` tokenized shell; open a session; “Nowa sesja”; Wyloguj.
2. Empty: GM with no sessions — empty copy visible.
3. C3: force list query failure — Layout error, status 503.
4. Focus: Tab through CTA, rows, sign-out — ring visible.
5. Kitchen-sink: all named states; screenshots; confirm PROD 404.

## Performance Considerations

One small React island for actions is acceptable; do not hydrate the whole list unless needed for the sink. No other perf budget.

## Migration Notes

No DB migrations. Rollback = revert the change commit(s). Relocate is URL-stable.

## References

- Research: `context/changes/ui-mg-dashboard/research.md`
- Prior UI change: `context/changes/ui-new-session-board/`
- Tokenized sibling: `src/pages/sessions/new/index.astro`
- Kitchen-sink pattern: `src/pages/sessions/new/kitchen-sink.astro`
- Button: `src/components/ui/button.tsx`
- Lessons: `context/foundation/lessons.md`
- `/10x-ui` skill: `.cursor/skills/10x-ui/SKILL.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: One view — tokens + Button island + C3

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 `npx astro check` passes
- [x] 1.3 `npm run build` passes
- [x] 1.4 Hardcoded-value scan on dashboard view + actions island reports 0 hits

#### Manual

- [x] 1.5 Desktop + mobile: empty and populated list use role tokens (no cosmic purple glass)
- [x] 1.6 Focus rings visible on CTA, sign-out, and session row links
- [x] 1.7 Forced list-load failure shows Layout + Polish error at HTTP 503
- [x] 1.8 Create-session and sign-out still work from the panel

### Phase 2: Kitchen-sink + visual gate

#### Automated

- [ ] 2.1 Kitchen-sink exists with PROD 404 gate
- [ ] 2.2 `npm run lint` and `npx astro check` pass

#### Manual

- [ ] 2.3 DEV kitchen-sink shows default, hover/focus, empty, error; disabled and loading N/A with reason
- [ ] 2.4 Desktop + one mobile-width screenshots captured for review
- [ ] 2.5 Preview/PROD: kitchen-sink not usable as a dashboard UI

### Phase 3: Guard — SCOPED_FILES + agent rules

#### Automated

- [ ] 3.1 Dashboard files listed in `SCOPED_FILES`; `npm run lint:ui-literals` / `npm run lint` pass on clean tree
- [ ] 3.2 Introducing a banned literal in a scoped dashboard file fails the check

#### Manual

- [ ] 3.3 CLAUDE.md / AGENTS.md mention tokens, `src/components/ui`, no literals, and `/dashboard/kitchen-sink`
