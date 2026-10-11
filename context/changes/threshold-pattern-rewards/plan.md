# Threshold & Row/Column Rewards Implementation Plan

## Overview

Add two optional reward rules next to the existing per-field rewards: a **threshold reward** ("nagroda za N pól") earned by every player who holds at least N claimed fields, and **line rewards** for completed rows and columns, earned by the player who claimed the last free field of the line. The GM picks, per rule, a multi-select list of catalog rewards to draw from; nothing selected = rule off. Concrete rewards are pre-drawn (per line at board generation, per player at join), and earned state is **derived from current claims**, so GM undo revokes automatically. Players see their progress (X/N) and their earned list; the GM roster shows what each player earned. Roadmap S-02 (north star of M-2).

## Current State Analysis

- Rewards exist only per field: nullable `board_cells.reward_id` set at create (`src/lib/services/sessions.service.ts:129-134`). There is no ledger of earned rewards — a grant *is* cell occupancy (`claimed_by_player_id`, `claimed_at`), pair-checked (`supabase/migrations/20261003140000_session_players_and_claims.sql:31-40`).
- Claim is first-wins via a conditional `UPDATE` in `claim_board_cell` (`supabase/migrations/20261003190000_player_claim_token.sql:118-221`); the API returns `{ cell }` (`src/pages/api/play/claim.ts:65`).
- GM undo clears occupancy and keeps `reward_id` (`supabase/migrations/20261003200000_undo_board_cell.sql`), so the field returns to mystery and can be reclaimed — FR-012 semantics (`context/archive/2026-10-03-gm-undo-field-claim/plan-brief.md`).
- Layout is a flat `position` 0…size²−1, row-major; sizes 3/4/5 (`src/types.ts:10-12`). No row/column derivation exists yet.
- Player colours repeat after 8 seats (`join_session_player`, `20261003190000_player_claim_token.sql:104`), so "my" identity must come from `claim_token` (cookie, `src/lib/player-cookie.ts`), never from colour.
- Session creation: `generateBoard` (injectable `random`, `src/lib/services/board-generator.ts:49-56`) → insert `sessions` → insert `board_cells` with the GM's RLS client (`sessions.service.ts:102-141`). Validation in `createSessionSchema` (`src/lib/schemas/session.ts:17-48`). Regenerate prefills size + per-field reward counts (`src/lib/services/session-prefill.ts`, `src/pages/sessions/new/index.astro:31-39`).
- Player hidden-info rule: unclaimed rewarded cells expose only `hasReward`; reward type is revealed after claim (`src/types.ts:68-78`, `get_active_board_by_code`).
- UI: `NewSessionForm.tsx` (size radio, phrases, per-reward counts); `PlayerBoard.tsx` (5 s poll, claim → flip, roster nick/colour); `GmBoard.tsx` (5 s poll, undo confirm, roster nick/colour at ~L308-321). Primitives available: `checkbox`, `input`, `label`, `badge` in `src/components/ui/`.

## Desired End State

- On `/sessions/new` the GM sees two new sections: **"Nagroda za wiersz/kolumnę"** (multi-select catalog checklist, nothing selected by default) and **"Nagroda za [N] pól"** (number input defaulting to the board size + multi-select catalog checklist, nothing selected by default). Empty selection = that rule is off.
- When line rewards are on, every row and every column of the board has one reward pre-drawn (with replacement) from the selected list. When the threshold rule is on, each player gets one reward pre-drawn from the threshold list when they first take a seat.
- A line is **complete** when all its fields are claimed (by anyone); its reward goes to the player who claimed the line's field with the latest `claimed_at`. Each completed line is a separate reward. The threshold reward is earned once per player when their claimed count ≥ N; every such player earns it.
- Undo of any field automatically revokes a broken line and a threshold the player no longer meets; reclaiming restores the same pre-drawn reward (to the new completer, for lines).
- Player board shows "X/N pól" (threshold rule on) and "Twoje nagrody" with earned threshold/line rewards, updated straight from the claim response and on each poll. GM roster lists earned threshold/line rewards per player.
- Sessions without rules (all existing ones, and new ones with nothing selected) behave exactly as today; per-field rewards unchanged.

Verify: `npm run test:unit`, `npm run test:integration` (new suite), `npm run lint`, `npx astro check`, `npm run build`; manual walkthrough on the kitchen sinks and a 3×3 table run.

### Key Discoveries:

- Grant = occupancy pattern makes derivation natural; no undo RPC change needed (`20261003200000_undo_board_cell.sql`).
- Row-major positions: `row = floor(pos / size)`, `column = pos % size` (`PlayerBoard.tsx` grid ordering by `position`).
- Colours are not unique (`20261003190000_player_claim_token.sql:104`) — key progress on `claim_token`.
- `generateBoard` already takes an injectable `random` for deterministic unit tests (`board-generator.ts:54-56`; cookbook `context/foundation/test-plan.md` §6).
- Test-plan risk #7 (undo looks free but grant wrong) is the integration layer for this change (`context/foundation/test-plan.md:48,63`).

## What We're NOT Doing

- Diagonals or other patterns (full board, corners) — rows and columns only.
- Per-player-owned lines (all fields by one player) or team-wide line rewards — completer rule only.
- Repeated threshold rewards (every multiple of N) — threshold pays once per player.
- Drawing rewards at the moment of earning or a grant ledger — rewards are pre-drawn, state is derived.
- New claim animations, banners, toasts or confetti — satisfaction comes from visible progress and the earned list (existing flip stays).
- Showing other players' earned rewards on the player board; showing line-reward markers on the board edges.
- Forcing rules onto existing sessions or migrating them; changing per-field reward behaviour, undo RPC, or join-by-code flow.
- E2E (Playwright) coverage for this change — unit + integration only.
- Custom (non-catalog) rewards or catalog changes.

## Implementation Approach

Store **rules and pre-drawn rewards**, derive **earned state**. One pure TypeScript function `deriveRewardProgress` computes counts, completed lines, completers and threshold earnings from claim data; both the GM snapshot (RLS-scoped reads) and the player snapshot (new SECURITY DEFINER RPC keyed by `claim_token`) feed it. The player RPC only reveals a line reward once the line is fully claimed and the player's threshold reward once they hold ≥ N fields, preserving the existing mystery rule. Order: schema → pure logic → create/regenerate → boards.

## Critical Implementation Details

- **Completer tiebreak**: completer = cell with the latest `claimed_at` in the line; on equal timestamps pick the higher `position`, so the result is deterministic in tests.
- **Join draw only on new seat**: the threshold reward is drawn in the "insert new seat" branch of `join_session_player`; the claim-token rebind branch must keep the existing value, otherwise a rejoin re-rolls the reward.
- **Backward-compatible create body**: new fields in `createSessionSchema` default to empty/absent so existing clients and integration tests that omit them still create rule-less sessions.

## Phase 1: Data model & RPCs

### Overview

Persist rules and pre-drawn rewards, draw threshold rewards on join, and expose a hidden-info-safe player progress input RPC.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20261011170000_threshold_pattern_rewards.sql`

**Intent**: Add storage for the GM's selected reward lists, the per-line pre-drawn rewards, the threshold value and the per-player drawn threshold reward, with RLS matching `board_cells`.

**Contract**:
- `sessions.threshold_count smallint NULL` — CHECK `threshold_count IS NULL OR threshold_count BETWEEN 1 AND size*size`. NULL = threshold rule off.
- `session_reward_pool (session_id uuid FK sessions ON DELETE CASCADE, kind text CHECK IN ('line','threshold'), reward_id uuid FK rewards, PRIMARY KEY (session_id, kind, reward_id))` — the GM's selections (source for regenerate prefill and join draw).
- `board_lines (session_id uuid FK sessions ON DELETE CASCADE, axis text CHECK IN ('row','column'), index smallint CHECK >= 0, reward_id uuid NOT NULL FK rewards, PRIMARY KEY (session_id, axis, index))` — rows exist only when line rewards are on (2×size rows).
- `session_players.threshold_reward_id uuid NULL FK rewards`.
- RLS enabled on both new tables: `SELECT` and `INSERT` for `authenticated` where the session's `gm_id = auth.uid()`; no UPDATE/DELETE policies; no `anon` policies (players read via RPC).

#### 2. Join draws threshold reward

**File**: same migration (`CREATE OR REPLACE FUNCTION public.join_session_player(text, text, uuid)`)

**Intent**: When a new seat is inserted and the session has a threshold pool, set `threshold_reward_id` to a random pool entry (`ORDER BY random() LIMIT 1`); rebind path unchanged.

**Contract**: Signature, return columns, errors and grants unchanged; body copied from `20261003190000_player_claim_token.sql:36-111` plus the draw in the insert branch.

#### 3. Player progress inputs RPC

**File**: same migration

**Intent**: Give the server everything `deriveRewardProgress` needs for one player without leaking undrawn/unearned rewards.

**Contract**: `get_player_reward_inputs(p_code text, p_claim_token uuid) RETURNS jsonb`, SECURITY DEFINER, `GRANT EXECUTE TO anon, authenticated`; works for active and closed sessions (like `get_active_board_by_code`). Returns NULL when the code is unknown or the token is not a seat of that session. Shape: `{ size, threshold_count, threshold_reward: {slug,label} | null (only when the player's claimed count ≥ threshold_count), cells: [{ position, claimed_at, is_mine }] (claimed cells only), lines: [{ axis, index, slug, label }] (only lines whose every cell is claimed) }`.

#### 4. Types

**Files**: `src/db/database.types.ts` (regenerated), `src/types.ts`

**Intent**: Regenerate DB types; add DTOs shared by services and islands.

**Contract** (new/extended in `src/types.ts`):
- `RewardRef = Pick<Reward, "slug" | "label">`; `LineAxis = "row" | "column"`
- `EarnedLineReward { axis: LineAxis; index: number; reward: RewardRef }`
- `PlayerRewardProgress { claimedCount: number; thresholdCount: number | null; thresholdReward: RewardRef | null; lines: EarnedLineReward[] }`
- `SessionRewardRules { thresholdCount: number | null; thresholdRewardIds: string[]; lineRewardIds: string[] }`
- `CreateSessionCommand` + `lineRewardIds: string[]`, `thresholdRewardIds: string[]`, `thresholdCount: number | null`
- `PlayerBoard` + `progress: PlayerRewardProgress | null` (null = no identity or session without rules)
- `ClaimSuccessResponse` + `progress: PlayerRewardProgress | null`
- `SessionWithCells` + `rewardRules: SessionRewardRules`; roster entries + `earned: { claimedCount: number; thresholdReward: RewardRef | null; lines: EarnedLineReward[] }`

### Success Criteria:

#### Automated Verification:

- Migration applies on local Supabase: `npx supabase migration up --local`
- Regenerated types compile: `npx astro check`
- Lint passes: `npm run lint`
- Existing integration suite still green (join, claim, undo, delete cascade): `npm run test:integration`

#### Manual Verification:

- In local Supabase Studio, as `anon`, direct `SELECT` on `board_lines` / `session_reward_pool` returns no rows; `get_player_reward_inputs` with a foreign token returns NULL

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Pure reward logic

### Overview

Line-reward drawing and earned-state derivation as pure, unit-tested functions.

### Changes Required:

#### 1. Line reward draw

**File**: `src/lib/services/board-generator.ts`

**Intent**: Draw one reward per row and per column from the line list (with replacement) using the injected `random`.

**Contract**: `drawLineRewards(input: { size: number; lineRewardIds: string[]; random?: () => number }): GeneratedLine[]` with `GeneratedLine { axis: LineAxis; index: number; rewardId: string }` (in `src/types.ts`); returns `[]` when the list is empty, else exactly `2 × size` entries (rows 0…size−1, columns 0…size−1).

#### 2. Derivation

**File**: `src/lib/services/reward-progress.ts` (new)

**Intent**: Single source of truth for "who earned what", used by GM and player snapshots.

**Contract**:
`deriveRewardProgress(input: { size: number; cells: { position: number; claimedBy: string | null; claimedAt: string | null }[]; lines: { axis: LineAxis; index: number; reward: RewardRef }[]; thresholdCount: number | null; thresholdRewardByPlayer: Map<string, RewardRef | null> }): Map<string, PlayerRewardProgress>`
- `claimedBy` is an opaque player key (GM: player id; player path: `"me"` / `"other"`).
- Line membership: row r = positions `r*size … r*size+size-1`; column c = positions `c, c+size, …`.
- Line complete ⇔ every member cell claimed; completer = latest `claimedAt`, tie → higher `position`.
- Threshold earned ⇔ `thresholdCount != null` and `claimedCount >= thresholdCount` and player has a drawn reward; earned once.
- Every key with ≥ 1 claim or a threshold entry appears in the result.

#### 3. Unit tests

**Files**: `src/lib/services/reward-progress.test.ts` (new), `src/lib/services/board-generator.test.ts`

**Intent**: Pin the agreed rules (see Testing Strategy).

**Contract**: Vitest, fixed RNG, no I/O.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test:unit`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`

#### Manual Verification:

- Reviewer reads the test names and confirms they match the agreed rules (completer, once-threshold, each line counts, rows/columns only)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Create session & regenerate

### Overview

GM configures the rules on create; regenerate carries them over.

### Changes Required:

#### 1. Schema

**File**: `src/lib/schemas/session.ts`

**Intent**: Validate the new optional inputs.

**Contract**: `lineRewardIds: uuid[]` (default `[]`, unique), `thresholdRewardIds: uuid[]` (default `[]`, unique), `thresholdCount: int | null` (optional). `superRefine`: when `thresholdRewardIds` is non-empty, `thresholdCount` is required and in `1…size²`; when empty, `thresholdCount` is normalised to `null`.

#### 2. Service

**File**: `src/lib/services/sessions.service.ts` (`createSession`)

**Intent**: Validate all selected ids against the catalog (same `UNKNOWN_REWARD`-style error as per-field rewards → 400), store `threshold_count` on the session insert, then insert `session_reward_pool` rows and `drawLineRewards` output into `board_lines` after `board_cells`.

**Contract**: Same RLS client and sequential-insert pattern as `board_cells` (`sessions.service.ts:112-141`); errors propagate as today.

#### 3. API

**File**: `src/pages/api/sessions/index.ts`

**Intent**: Pass the new parsed fields into `createSession`; no response change.

**Contract**: `POST /api/sessions` body gains the three optional fields; 201 `CreateSessionResponse` unchanged.

#### 4. Form

**Files**: `src/components/sessions/NewSessionForm.tsx` (optionally a new `RewardRulesFields.tsx` beside it), `src/components/hooks/useCreateSession.ts`

**Intent**: Two sections after the per-field rewards: "Nagroda za wiersz/kolumnę" (catalog checklist using `Checkbox` + `Label`, none checked) and "Nagroda za [N] pól" (number `Input`, default = board size, follows size changes until the GM edits it, clamped 1…size²; catalog checklist, none checked). Helper text: nothing selected = no reward of this kind; several selected = drawn randomly.

**Contract**: Submit payload includes `lineRewardIds`, `thresholdRewardIds`, `thresholdCount` (null when no threshold rewards selected). Tokens/role classes only; `cursor-pointer` on interactive labels/buttons (lessons); any new file added to `SCOPED_FILES` in `scripts/check-ui-literals.mjs`.

#### 5. Regenerate prefill

**Files**: `src/lib/services/session-prefill.ts` (+ test), `src/pages/sessions/new/index.astro`

**Intent**: When `?from=` is set, prefill both checklists and N from the source session's `session_reward_pool` and `threshold_count`.

**Contract**: Prefill helper returns `SessionRewardRules` from source rows; form initial state accepts it.

#### 6. Kitchen sink

**File**: `src/pages/sessions/new/kitchen-sink.astro`

**Intent**: Show rules sections in default (nothing selected), selected (both rules on), and invalid-threshold states.

**Contract**: Uses existing `demoState` mechanism.

#### 7. Integration tests

**File**: `tests/integration/threshold-pattern-rewards.test.ts` (new; create-validation cases)

**Intent**: See Testing Strategy — create cases.

**Contract**: Follows `tests/integration/create-session-board.test.ts` setup.

### Success Criteria:

#### Automated Verification:

- Unit tests pass (incl. prefill): `npm run test:unit`
- Integration create cases pass: `npm run test:integration`
- Type check: `npx astro check`
- Lint incl. UI literals: `npm run lint`
- Build: `npm run build`

#### Manual Verification:

- `/sessions/new/kitchen-sink` rules sections render in all states, token-clean, keyboard-focusable
- Changing board size updates the default N until it is edited manually
- Regenerating a session with rules prefills both checklists and N

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Progress on player & GM boards

### Overview

Serve derived progress to players and earned rewards to the GM roster.

### Changes Required:

#### 1. Player progress service

**File**: `src/lib/services/sessions.service.ts`

**Intent**: `getPlayerRewardProgress(supabase, code, claimToken)` calls `get_player_reward_inputs`, maps `is_mine` → `"me"`/`"other"`, runs `deriveRewardProgress`, returns the `"me"` entry, or `null` when the RPC returns NULL or the session has no rules (`threshold_count` null and no lines).

**Contract**: Returns `PlayerRewardProgress | null`; RPC errors propagate.

#### 2. Player APIs

**Files**: `src/pages/api/play/board.ts`, `src/pages/api/play/claim.ts`

**Intent**: Board GET reads the player cookie (`readPlayerIdentity`) and attaches `progress` (null without a valid identity — board itself still served). Claim success attaches `progress` computed after the claim so the player sees it immediately.

**Contract**: `PlayerBoard.progress`, `ClaimSuccessResponse.progress`; status codes and conflict body unchanged. A progress failure is reported via `reportError` and yields `progress: null` rather than failing the claim.

#### 3. GM snapshot

**File**: `src/lib/services/sessions.service.ts` (`getSessionWithCells`)

**Intent**: Also read `threshold_count`, `session_reward_pool`, `board_lines` (+ reward), players' `threshold_reward_id` (+ reward); run `deriveRewardProgress` with player ids; fill `rewardRules` and each roster entry's `earned`.

**Contract**: `SessionWithCells.rewardRules`, roster `earned`; GM sees all lines/thresholds (GM already sees all rewards).

#### 4. Player UI

**File**: `src/components/play/PlayerBoard.tsx`

**Intent**: Under the board, when `progress` is non-null: "Zdobyte pola: X/N" (only if threshold rule on) and "Twoje nagrody" listing the threshold reward and each line ("Wiersz 2: Inspiracja", "Kolumna 1: Przedmiot", 1-based labels); empty state text when nothing earned yet. Update `progress` from the claim response and from each poll. No new animation/banner.

**Contract**: Token/role classes only; hidden when `progress` is null (old sessions unchanged).

#### 5. GM UI

**File**: `src/components/sessions/GmBoard.tsx`

**Intent**: Roster entry shows earned threshold/line rewards per player (e.g. small `Badge`s). After a successful undo, trigger an immediate snapshot refresh so revocations show without waiting for the poll.

**Contract**: Uses `SessionWithCells` roster `earned`; nothing extra rendered for sessions without rules.

#### 6. Kitchen sinks

**Files**: `src/pages/play/kitchen-sink.astro`, `src/pages/sessions/board/kitchen-sink.astro`

**Intent**: Player: progress below N, threshold earned, lines earned, no rules. GM: roster with earned rewards, roster without rules.

**Contract**: Static demo data; existing sections untouched.

#### 7. Integration tests

**File**: `tests/integration/threshold-pattern-rewards.test.ts`

**Intent**: Claim/undo/reclaim derivation and hidden-info cases (see Testing Strategy).

**Contract**: Uses the same helpers as `tests/integration/play-path-claim-undo.test.ts`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test:unit`
- Integration suite passes (new + existing claim/undo/join): `npm run test:integration`
- Type check: `npx astro check`
- Lint incl. UI literals: `npm run lint`
- Build: `npm run build`
- Smoke passes against preview: `npm run smoke`

#### Manual Verification:

- 3×3 session with both rules, two browsers: completing a row shows the line reward for the completer immediately; reaching N shows the threshold reward; GM roster shows both
- GM undo of a field in the completed line removes the line reward on GM roster at once and on the player board within one poll
- An existing (pre-change) session plays exactly as before; no progress section shown
- Kitchen sinks for player board and GM board render new states token-clean on a phone-width viewport

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `deriveRewardProgress`: row/column membership for sizes 3, 4, 5; completer = latest `claimedAt` (row claimed A, A, then B → B); tie → higher position; one claim completing a row and a column at once → 2 line rewards; two completed rows by one player → 2 entries; threshold at exactly N and above → earned once; below N → not earned; `thresholdCount` null → never; no lines → `lines: []`; player without drawn reward → no threshold.
- `drawLineRewards`: empty list → `[]`; `2 × size` entries with ids from the list; deterministic with fixed RNG.
- Prefill helper returns rules from source rows.

### Integration Tests:

- Create: rules stored (`board_lines` = 2×size with selected ids, pool rows, `threshold_count`); unknown reward id → 400; threshold ids with `thresholdCount` 0 or > size² → 400; body without new fields → rule-less session (backward compat).
- Join: player on threshold session gets `threshold_reward_id` from the pool; rejoin via token keeps it.
- Claim 3×3, threshold N = 2: A claims 0, 1; B claims 2 → B earns row 0, A earns threshold, B no threshold; claim response `progress` matches.
- GM undo position 1 → A loses threshold, B loses row 0 (player board + GM snapshot).
- A reclaims 1 → A is completer of row 0 with the same reward; A threshold restored.
- Hidden info: before the line is complete, `progress` holds no line rewards; before N, `thresholdReward` is null.
- Rule-less session: `progress` null, roster `earned` empty, per-field reward reveal unchanged.

### Manual Testing Steps:

1. Create a 3×3 session selecting two line rewards and one threshold reward with N = 3; join with two phones.
2. Complete a row with the second player claiming the last field; check both boards and GM roster.
3. Undo a field in that row as GM; confirm revocation, then reclaim.
4. Open an old session from the dashboard and play a claim — no new UI.

## Performance Considerations

Derivation is O(size²) per snapshot (≤ 25 cells, ≤ 10 lines) on every 5 s poll — negligible. The player board poll adds one RPC call; acceptable at table scale (≤ 10 players).

## Migration Notes

Additive only: nullable column, nullable FK, two new tables. Existing sessions have no rules and keep working; no backfill. Rollback of code leaves the extra schema unused (backward-compatible by one version, per `CLAUDE.md` deployment rules). Apply locally only; hosted schema changes need human approval.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-02)
- PRD: `context/foundation/prd-v2.md` (Scope §Nagrody, Business Logic Changes, Constraints)
- Claim RPC: `supabase/migrations/20261003190000_player_claim_token.sql:118-221`
- Undo RPC: `supabase/migrations/20261003200000_undo_board_cell.sql`
- Board generator: `src/lib/services/board-generator.ts:49-125`
- Create flow: `src/lib/services/sessions.service.ts:75-145`, `src/lib/schemas/session.ts:17-48`
- Prior undo semantics: `context/archive/2026-10-03-gm-undo-field-claim/plan-brief.md`
- Test cookbook: `context/foundation/test-plan.md` §6

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model & RPCs

#### Automated

- [x] 1.1 Migration applies on local Supabase: `npx supabase migration up --local` — 956b324
- [x] 1.2 Regenerated types compile: `npx astro check` — 956b324
- [x] 1.3 Lint passes: `npm run lint` — 956b324
- [x] 1.4 Existing integration suite still green (join, claim, undo, delete cascade): `npm run test:integration` — 956b324

#### Manual

- [ ] 1.5 In local Supabase Studio, as `anon`, direct `SELECT` on `board_lines` / `session_reward_pool` returns no rows; `get_player_reward_inputs` with a foreign token returns NULL

### Phase 2: Pure reward logic

#### Automated

- [x] 2.1 Unit tests pass: `npm run test:unit`
- [x] 2.2 Type check passes: `npx astro check`
- [x] 2.3 Lint passes: `npm run lint`

#### Manual

- [ ] 2.4 Reviewer reads the test names and confirms they match the agreed rules (completer, once-threshold, each line counts, rows/columns only)

### Phase 3: Create session & regenerate

#### Automated

- [ ] 3.1 Unit tests pass (incl. prefill): `npm run test:unit`
- [ ] 3.2 Integration create cases pass: `npm run test:integration`
- [ ] 3.3 Type check: `npx astro check`
- [ ] 3.4 Lint incl. UI literals: `npm run lint`
- [ ] 3.5 Build: `npm run build`

#### Manual

- [ ] 3.6 `/sessions/new/kitchen-sink` rules sections render in all states, token-clean, keyboard-focusable
- [ ] 3.7 Changing board size updates the default N until it is edited manually
- [ ] 3.8 Regenerating a session with rules prefills both checklists and N

### Phase 4: Progress on player & GM boards

#### Automated

- [ ] 4.1 Unit tests pass: `npm run test:unit`
- [ ] 4.2 Integration suite passes (new + existing claim/undo/join): `npm run test:integration`
- [ ] 4.3 Type check: `npx astro check`
- [ ] 4.4 Lint incl. UI literals: `npm run lint`
- [ ] 4.5 Build: `npm run build`
- [ ] 4.6 Smoke passes against preview: `npm run smoke`

#### Manual

- [ ] 4.7 3×3 session with both rules, two browsers: completing a row shows the line reward for the completer immediately; reaching N shows the threshold reward; GM roster shows both
- [ ] 4.8 GM undo of a field in the completed line removes the line reward on GM roster at once and on the player board within one poll
- [ ] 4.9 An existing (pre-change) session plays exactly as before; no progress section shown
- [ ] 4.10 Kitchen sinks for player board and GM board render new states token-clean on a phone-width viewport
