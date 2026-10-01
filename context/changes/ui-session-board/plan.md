# Session board Vintage Paper — Implementation Plan

## Overview

Restyle `/sessions/[id]` (generated bingo board) onto the existing Vintage Paper token contract, introduce shadcn `Badge` for status / legend / cell rewards, brand invalid-UUID / missing-session (Layout + 404) and query-throw (Layout + 503) paths, gate visuals with a PROD-blocked kitchen-sink at `/sessions/board/kitchen-sink`, and extend the literal-scan / agent-rule guard. Do **not** redeposit tokens, fonts, or dark mode.

## Current State Analysis

- Tokens + dark-only Layout already live (`global.css`, `Layout.astro` `html.dark`).
- `[id].astro` + `BoardGrid.astro` still use cosmic/glass + palette (~25 literal hits); not in `SCOPED_FILES`.
- Invalid UUID / null session → raw `Response` 404; `getSessionWithCells` throws with no try/catch (unlike dashboard / create-session).
- No kitchen-sink for this view; CLAUDE/AGENTS name only create-session + dashboard sinks.
- Research: `context/changes/ui-session-board/research.md` (C1–C5). Closest prior plan: `ui-mg-dashboard` (3 phases).

### Key Discoveries

- No page relocate needed — sink goes under `sessions/board/kitchen-sink.astro` (no clash with `[id]`).
- Lesson: branded data-load errors must set non-2xx (`lessons.md`).
- Presentational `Badge` can SSR from Astro without `client:*`; prefer that (or `badgeVariants` on spans) so the grid does not hydrate per cell.
- Do not revive palette `LibBadge.astro`.

## Desired End State

MG opens a tokenized board matching create-session / dashboard chrome. Status, legend, and rewards use shared `Badge`. Bad id / missing session → Layout + Polish + HTTP 404. Query failure → Layout + Polish + HTTP 503. Incomplete board → destructive copy. Closed = same chrome, Badge label only. Dev sink at `/sessions/board/kitchen-sink`; scoped files fail lint on palette/`bg-cosmic` regression.

## What We're NOT Doing

- Redepositing tokens / fonts / dark wiring; removing `bg-cosmic` from `global.css`
- Restyling auth, Welcome, Topbar, or other deferred cosmic pages
- Closed-session muted grid or banner; incomplete-board dashboard badge (feature debt)
- Playwright CI; loading skeleton; aligning unreachable config-missing raw-500
- Changing `getSessionWithCells` service semantics beyond page-level catch
- Reviving `LibBadge.astro`

## Implementation Approach

Skip deposit. Phase order mirrors dashboard: **one view** (Badge + tokens + C3) → **kitchen-sink** → **guard**. Preserve Polish copy, back link to `/dashboard`, board/legend behavior.

## Critical Implementation Details

**Badge:** `npx shadcn@latest add badge`. Use SSR `<Badge>` (no `client:*`) or `badgeVariants` on native elements in Astro — especially in `BoardGrid` (up to 25 cells). Do not mount per-cell islands.

**C3 errors:** Invalid UUID and null session → render Layout + Polish “Nie znaleziono sesji” (or equivalent) with `Astro.response.status = 404` (replace raw `Response`). Wrap `getSessionWithCells` in try/catch → Layout + destructive Polish + `Astro.response.status = 503`. Auth redirect and unreachable config-500 left as today.

**Incomplete:** Keep existing Polish recreate copy; style with destructive role (`text-destructive`, dashed `border-border` or equivalent) — not amber palette, not muted-empty.

**Closed:** Same shell/grid; only Badge label differs (`Zamknięta` vs `Aktywna`).

**Tracking:** Replace `tracking-[0.35em]` with `tracking-widest` (dashboard pattern).

**Kitchen-sink:** `import.meta.env.PROD` → 404. Path `/sessions/board/kitchen-sink` stays under `/sessions` → middleware auth in DEV. Fixture complete / incomplete / closed / focus (back link) / error (404+503 markup); disabled + loading N/A with reasons.

---

## Phase 1: One view — tokens + Badge + C3

### Overview

Install Badge, restyle page + BoardGrid onto role classes, brand 404/503 paths, incomplete as destructive.

### Changes Required

#### 1. Add shadcn Badge

**File**: `src/components/ui/badge.tsx` (via `npx shadcn@latest add badge`)

**Intent**: Shared chip primitive for status, legend, and cell rewards (C2).

**Contract**: New-york kit Badge with variants usable from Astro SSR or via `badgeVariants`; do not use `LibBadge.astro`.

#### 2. Tokenized session page shell + meta

**File**: `src/pages/sessions/[id].astro`

**Intent**: Close C1 on the page shell — match create-session / dashboard surfaces.

**Contract**: Outer `bg-background min-h-screen`; inner `border-border bg-card text-foreground` (drop glass/`backdrop-blur-xl`); back link `text-primary` + visible `focus-visible` ring; code `text-foreground` + `tracking-widest`; meta `text-muted-foreground`; status via `Badge`; legend heading muted, items via `Badge`; incomplete destructive. Zero palette / `bg-cosmic` / arbitrary px|rem on this file.

#### 3. Tokenized BoardGrid

**File**: `src/components/sessions/BoardGrid.astro`

**Intent**: Close C1 on cells — grid matches card language; rewards use Badge.

**Contract**: Cells `border-border bg-card text-foreground` with scale tokens (`text-xs`, not arbitrary `text-[9px]`/`text-[10px]`); reward chip = Badge / `badgeVariants` without per-cell hydration.

#### 4. Branded not-found + query error (C3)

**File**: `src/pages/sessions/[id].astro`

**Intent**: Close C3 — bad id / missing session / DB throw stay in app chrome with correct HTTP status.

**Contract**: Invalid UUID + null session → Layout + Polish + status 404; catch around `getSessionWithCells` → Layout + destructive Polish + status 503; success and incomplete paths unchanged in behavior.

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- `npx astro check` passes
- `npm run build` passes
- Hardcoded-value scan on `[id].astro` + `BoardGrid.astro` reports **0** hits

#### Manual Verification

- Desktop + one mobile width: complete board tokenized (no cosmic purple glass)
- Status / legend / rewards use Badge; closed vs active differs by label only
- Incomplete board shows destructive recreate copy
- Back link focus ring visible
- Invalid UUID and missing session: Layout + Polish + HTTP 404
- Forced query failure: Layout + Polish + HTTP 503
- Dashboard back-link still works

**Implementation Note**: Pause for human confirmation of manual checks before Phase 2.

---

## Phase 2: Kitchen-sink + visual gate

### Overview

Dev-only gallery of board states for screenshot review (C4).

### Changes Required

#### 1. Kitchen-sink page

**File**: `src/pages/sessions/board/kitchen-sink.astro`

**Intent**: Screenshot default / incomplete / closed / focus / error without live data failures.

**Contract**: PROD 404 via `import.meta.env.PROD`. Sections: complete board + legend, incomplete destructive, closed status label, focus-demo on back link, error markup for 404 and 503; disabled + loading N/A with reasons. Reuse BoardGrid + same shell/Badge markup so sink cannot drift.

#### 2. Screenshots

**Files**: under `context/changes/ui-session-board/screenshots/` (desktop + one mobile width)

**Intent**: Visual gate evidence for review.

**Contract**: Capture kitchen-sink at two widths; no Playwright requirement.

### Success Criteria

#### Automated Verification

- Kitchen-sink file exists with PROD 404 gate
- `npm run lint` and `npx astro check` pass

#### Manual Verification

- DEV (authenticated): `/sessions/board/kitchen-sink` shows named states; every 7-state cell shown or N/A-with-reason
- Desktop + mobile screenshots captured
- Preview/PROD: sink not usable as board UI

**Implementation Note**: Phase complete after screenshots reviewed against tokens + charges C1–C4.

---

## Phase 3: Guard — SCOPED_FILES + agent rules

### Overview

Make the contract stick for the next agent (C5).

### Changes Required

#### 1. Literal scan scope

**File**: `scripts/check-ui-literals.mjs`

**Intent**: Fail CI/lint if palette/`bg-cosmic` returns on cleaned board files.

**Contract**: Add `src/pages/sessions/[id].astro`, `src/components/sessions/BoardGrid.astro`, and `src/pages/sessions/board/kitchen-sink.astro` to `SCOPED_FILES`.

#### 2. Agent rule pointers

**Files**: `CLAUDE.md` (§ UI / design tokens), `AGENTS.md` (UI hard rule)

**Intent**: Point agents at all three kitchen sinks.

**Contract**: Extend kitchen-sink mention to include `/sessions/board/kitchen-sink`. Do not edit inside any `<!-- BEGIN @przeprogramowani/10x-cli -->` … `<!-- END -->` block.

### Success Criteria

#### Automated Verification

- `npm run lint` / `npm run lint:ui-literals` fails if a scoped board file reintroduces banned literals
- `npm run lint` passes on the clean tree

#### Manual Verification

- Rules mention token source, `src/components/ui`, no literals, and all three kitchen-sink routes

---

## Testing Strategy

### Unit Tests

- None (repo has no unit runner). Rely on lint, `astro check`, build.

### Integration / smoke

- Optional: `npm run smoke` after Phase 1 if auth flow still green; not the visual gate.

### Manual Testing Steps

1. Happy path: login → open session → tokenized complete board + legend Badges.
2. Incomplete: force wrong cell count → destructive recreate copy.
3. Closed: status Badge shows `Zamknięta`; grid otherwise identical.
4. C3: invalid UUID / missing id → Layout + 404; force query throw → Layout + 503.
5. Focus: Tab to back link — ring visible.
6. Kitchen-sink: named states + screenshots; confirm PROD 404.

## Performance Considerations

SSR Badge / `badgeVariants` only — do not hydrate the grid. No other perf budget.

## Migration Notes

No DB migrations. Rollback = revert commit(s). No URL relocate for the live board page.

## References

- Research: `context/changes/ui-session-board/research.md`
- Prior: `context/changes/ui-mg-dashboard/`, `context/changes/ui-new-session-board/`
- Siblings: `src/pages/sessions/new/index.astro`, `src/pages/dashboard/index.astro`
- Service: `src/lib/services/sessions.service.ts` (`getSessionWithCells`)
- Lessons: `context/foundation/lessons.md`
- `/10x-ui`: `.cursor/skills/10x-ui/SKILL.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: One view — tokens + Badge + C3

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 `npx astro check` passes
- [x] 1.3 `npm run build` passes
- [x] 1.4 Hardcoded-value scan on `[id].astro` + `BoardGrid.astro` reports 0 hits

#### Manual

- [x] 1.5 Desktop + mobile: complete board uses role tokens (no cosmic purple glass)
- [x] 1.6 Status / legend / rewards use Badge; closed vs active differs by label only
- [x] 1.7 Incomplete board shows destructive recreate copy
- [x] 1.8 Back link focus ring visible
- [x] 1.9 Invalid UUID / missing session: Layout + Polish + HTTP 404
- [x] 1.10 Forced query failure: Layout + Polish + HTTP 503
- [x] 1.11 Dashboard back-link still works

### Phase 2: Kitchen-sink + visual gate

#### Automated

- [ ] 2.1 Kitchen-sink exists with PROD 404 gate
- [ ] 2.2 `npm run lint` and `npx astro check` pass

#### Manual

- [ ] 2.3 DEV kitchen-sink shows complete, incomplete, closed, focus, error; disabled and loading N/A with reason
- [ ] 2.4 Desktop + one mobile-width screenshots captured for review
- [ ] 2.5 Preview/PROD: kitchen-sink not usable as board UI

### Phase 3: Guard — SCOPED_FILES + agent rules

#### Automated

- [ ] 3.1 Board files listed in `SCOPED_FILES`; `npm run lint:ui-literals` / `npm run lint` pass on clean tree
- [ ] 3.2 Introducing a banned literal in a scoped board file fails the check

#### Manual

- [ ] 3.3 CLAUDE.md / AGENTS.md mention tokens, `src/components/ui`, no literals, and `/sessions/board/kitchen-sink`
