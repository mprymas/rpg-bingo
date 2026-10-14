# Fix MG tile reward typography + ellipsis Implementation Plan

## Overview

Na kafelku pola w widoku MG etykieta nagrody jest za duża względem hasła, a przy długim tekście komórka ucina początek i koniec (wyśrodkowany overflow). Naprawiamy rozmiar (ten sam `clamp` co hasło), zachowujemy chip `Badge` na wolnym polu i wymuszamy single-line end-ellipsis (widoczny początek + `…`).

## Current State Analysis

Production MG board mounts interactive `GmBoard` from `src/pages/sessions/[id].astro` (not legacy `BoardGrid.astro`).

- **Wolne pole z nagrodą:** `Badge variant="secondary"` with `mt-1 max-w-full truncate` in `GmBoard.tsx`. Badge base (`badge.tsx`) uses `inline-flex w-fit shrink-0 … text-xs whitespace-nowrap`. The chip refuses to shrink below content width; the cell has `overflow: hidden` and centers children, so long labels clip on **both** sides instead of ellipsizing.
- **Zajęte pole z nagrodą:** `span.player-board-cell-reward` in `global.css` already declares `text-overflow: ellipsis` + `white-space: nowrap` + the target `clamp`, but a default `span` (inline) often does not apply ellipsis without `display: block` / `inline-block`.
- **Hasło:** `player-board-cell-phrase` uses `clamp(0.55rem, 12cqmin, 0.75rem)` — the agreed size target for reward labels.
- **Kitchen-sink:** `/sessions/board/kitchen-sink` exercises `GmBoard` with short labels only (`Inspiracja`, `Doświadczenie`); no long-label visual gate.

## Desired End State

MG field tiles show reward labels at phrase-matched fluid size. Short labels remain fully readable. Long labels show the **start** of the text with an end ellipsis — never a centered bilateral clip. Unclaimed rewards keep the secondary Badge chrome; claimed rewards keep the existing reward span look. A kitchen-sink section proves both free and claimed long-label states.

### Key Discoveries:

- Root cause of bilateral clip: Badge `shrink-0` / `w-fit` + cell `overflow: hidden` + centered flex — `src/components/ui/badge.tsx:8`, `src/components/sessions/GmBoard.tsx:270,302`, `src/styles/global.css:199-204`
- Shared claimed utility already intends ellipsis: `src/styles/global.css:236-246` — needs a display model that makes `text-overflow` effective
- Do not edit global `badge.tsx` — other Badges must keep current sizing; override only on the MG tile instance
- `GmBoard.tsx` is in `scripts/check-ui-literals.mjs` `SCOPED_FILES` — no hex / palette / arbitrary values in the view

## What We're NOT Doing

- Line-slot row/column reward typography
- Roster threshold tile typography
- Changing catalog seeds, API, or DB label length limits
- Global changes to all `Badge` instances
- Legacy `BoardGrid.astro` presentational path
- A separate player-board feature change (claimed cells share `player-board-cell-reward`; display/ellipsis fix on that utility is an accepted shared side-effect)

## Implementation Approach

Add or tighten tokenized `@utility` classes in `global.css` so both free (Badge) and claimed (span) field rewards share the phrase `clamp` and a bounded single-line end-ellipsis contract. Wire only the MG free-cell Badge in `GmBoard` to the new Badge utility (override `text-xs` / `shrink-0` / `w-fit` locally). Add a kitchen-sink `GmBoard` fixture with intentionally long `reward.label` on free and claimed cells as the visual gate.

## Critical Implementation Details

Badge base `shrink-0` and `w-fit` plus flex item `min-width: auto` defeat parent `max-w-full`/`truncate`; the cell then clips the centered overflow. The Badge utility must force `min-width: 0`, a width bound (`max-width: 100%` and effective shrink), and the shared `clamp` — without changing `badge.tsx`. For the claimed span, set an explicit non-inline display so `text-overflow: ellipsis` applies.

## Phase 1: CSS + GmBoard

### Overview

Fix the shared claimed-reward ellipsis contract and introduce a Badge-scoped utility so free-cell MG rewards match phrase size and end-ellipsis without bilateral clipping.

### Changes Required:

#### 1. Board cell reward utilities

**File**: `src/styles/global.css`

**Intent**: Make `player-board-cell-reward` reliably ellipsize on claimed cells, and add a companion utility for the free-cell Badge that applies the same `clamp`, width bounds, and end-ellipsis while leaving other Badges untouched.

**Contract**: Keep `font-size: clamp(0.55rem, 12cqmin, 0.75rem)` on both utilities. `player-board-cell-reward` must use a display model that supports `text-overflow: ellipsis` (e.g. `display: block`). New utility (e.g. `player-board-cell-reward-badge`) must override Badge `text-xs` / `w-fit` / `shrink-0` effects for this use only: `min-width: 0`, `max-width: 100%`, single-line end-ellipsis. No hex/palette/arbitrary values.

#### 2. MG free-cell Badge wiring

**File**: `src/components/sessions/GmBoard.tsx`

**Intent**: Apply the new Badge utility on the unclaimed reward chip so long labels ellipsize inside the tile at phrase-matched size.

**Contract**: Free-cell reward remains `Badge variant="secondary"`. Class list uses the new utility (and any minimal Tailwind needed that utility does not cover, e.g. `mt-1`); drop redundant `truncate`/`max-w-full` if the utility fully owns the overflow contract. Do not change claimed-cell markup beyond continuing to use `player-board-cell-reward`. Do not edit `badge.tsx`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (ESLint + ui-literals on scoped files including `GmBoard.tsx`)

#### Manual Verification:

- On MG board (live or preview): short reward label fully visible; long label shows start + end ellipsis, no bilateral clip; reward type size reads similar to the phrase on free cells; claimed reward label still readable with ellipsis when long

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Kitchen-sink long-label gate

### Overview

Add a visual fixture so agents and humans can verify free and claimed long-label behavior without hunting for a live long catalog entry.

### Changes Required:

#### 1. Board kitchen-sink fixture

**File**: `src/pages/sessions/board/kitchen-sink.astro`

**Intent**: Expose at least one `GmBoard` section/state with an intentionally long `reward.label` on both a free and a claimed cell.

**Contract**: Keep existing short-label sections intact. New or extended fixture uses a long Polish (or mixed) label that overflows a phone-width tile. Remains DEV-only kitchen-sink (PROD 404 unchanged).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes

#### Manual Verification:

- `/sessions/board/kitchen-sink` long-label section shows free Badge and claimed span both with start-visible end-ellipsis and phrase-matched sizing

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding further.

---

## Testing Strategy

### Unit Tests:

- None required — pure CSS/class wiring; no new pure functions.

### Integration Tests:

- None required — no API or SSR contract change.

### Manual Testing Steps:

1. Open MG session board with a short reward — label fully visible, Badge chrome present on free cells.
2. Open kitchen-sink long-label section (or a session with a long catalog label) — free and claimed cells show start + `…`, no centered bilateral clip.
3. Spot-check that other Badges (legend, dashboard, auth) still use default `text-xs` sizing.

## Performance Considerations

None — static CSS utilities and className changes only.

## Migration Notes

None — no schema or data migration.

## References

- Agreed Cursor plan: conversation `/10x-plan` for `gm-tile-reward-typography`
- Prior ellipsis intent (player claim): `context/archive/2026-10-03-player-claim-field-reward/plan-brief.md`
- MG Badge history: `context/archive/2026-10-01-ui-session-board/plan.md`
- Code: `src/components/sessions/GmBoard.tsx`, `src/styles/global.css`, `src/components/ui/badge.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: CSS + GmBoard

#### Automated

- [x] 1.1 npm run lint passes (ESLint + ui-literals on scoped files including GmBoard.tsx)

#### Manual

- [ ] 1.2 On MG board short reward fully visible; long label start + end ellipsis, no bilateral clip; size similar to phrase; claimed long label ellipsizes

### Phase 2: Kitchen-sink long-label gate

#### Automated

- [ ] 2.1 npm run lint passes

#### Manual

- [ ] 2.2 /sessions/board/kitchen-sink long-label section shows free Badge and claimed span with start-visible end-ellipsis and phrase-matched sizing
