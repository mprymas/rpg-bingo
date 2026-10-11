# Threshold & Row/Column Rewards Implementation Plan

## Overview

Add two optional reward rules next to the existing per-field rewards: a **threshold reward** ("nagroda za N pÃÂ³l") earned by every player who holds at least N claimed fields, and **line rewards** for completed rows and columns, earned by the player who claimed the last free field of the line. The GM picks, per rule, a multi-select list of catalog rewards to draw from; nothing selected = rule off. Concrete rewards are pre-drawn (per line at board generation, per player at join), and earned state is **derived from current claims**, so GM undo revokes automatically. Players see their progress (X/N) and their earned list; the GM roster shows what each player earned. Roadmap S-02 (north star of M-2).

## Current State Analysis

- Rewards exist only per field: nullable `board_cells.reward_id` set at create (`src/lib/services/sessions.service.ts:129-134`). There is no ledger of earned rewards Ã¢ÂÂ a grant *is* cell occupancy (`claimed_by_player_id`, `claimed_at`), pair-checked (`supabase/migrations/20261003140000_session_players_and_claims.sql:31-40`).
- Claim is first-wins via a conditional `UPDATE` in `claim_board_cell` (`supabase/migrations/20261003190000_player_claim_token.sql:118-221`); the API returns `{ cell }` (`src/pages/api/play/claim.ts:65`).
- GM undo clears occupancy and keeps `reward_id` (`supabase/migrations/20261003200000_undo_board_cell.sql`), so the field returns to mystery and can be reclaimed Ã¢ÂÂ FR-012 semantics (`context/archive/2026-10-03-gm-undo-field-claim/plan-brief.md`).
- Layout is a flat `position` 0Ã¢ÂÂ¦sizeÃÂ²Ã¢ÂÂ1, row-major; sizes 3/4/5 (`src/types.ts:10-12`). No row/column derivation exists yet.
- Player colours repeat after 8 seats (`join_session_player`, `20261003190000_player_claim_token.sql:104`), so "my" identity must come from `claim_token` (cookie, `src/lib/player-cookie.ts`), never from colour.
- Session creation: `generateBoard` (injectable `random`, `src/lib/services/board-generator.ts:49-56`) Ã¢ÂÂ insert `sessions` Ã¢ÂÂ insert `board_cells` with the GM's RLS client (`sessions.service.ts:102-141`). Validation in `createSessionSchema` (`src/lib/schemas/session.ts:17-48`). Regenerate prefills size + per-field reward counts (`src/lib/services/session-prefill.ts`, `src/pages/sessions/new/index.astro:31-39`).
- Player hidden-info rule: unclaimed rewarded cells expose only `hasReward`; reward type is revealed after claim (`src/types.ts:68-78`, `get_active_board_by_code`).
- UI: `NewSessionForm.tsx` (size radio, phrases, per-reward counts); `PlayerBoard.tsx` (5 s poll, claim Ã¢ÂÂ flip, roster nick/colour); `GmBoard.tsx` (5 s poll, undo confirm, roster nick/colour at ~L308-321). Primitives available: `checkbox`, `input`, `label`, `badge` in `src/components/ui/`.

## Desired End State

- On `/sessions/new` the GM sees two new sections: **"Nagroda za wiersz/kolumnÃÂ"** (multi-select catalog checklist, nothing selected by default) and **"Nagroda za [N] pÃÂ³l"** (number input defaulting to the board size + multi-select catalog checklist, nothing selected by default). Empty selection = that rule is off.
- When line rewards are on, every row and every column of the board has one reward pre-drawn (with replacement) from the selected list. When the threshold rule is on, each player gets one reward pre-drawn from the threshold list when they first take a seat.
- A line is **complete** when all its fields are claimed (by anyone); its reward goes to the player who claimed the line's field with the latest `claimed_at`. Each completed line is a separate reward. The threshold reward is earned once per player when their claimed count Ã¢ÂÂ¥ N; every such player earns it.
- Undo of any field automatically revokes a broken line and a threshold the player no longer meets; reclaiming restores the same pre-drawn reward (to the new completer, for lines).
- Player and GM boards show **line rewards on the board edges** (`BoardWithLineSlots` / `lineSlots`): mystery until the line is complete, then the completer's colour + reward label. Threshold progress is shown on the shared roster (`PlayerRosterList`) as X/N for every seat; when a seat earns the threshold, its reward label is visible to all players (mystery tile until then). Updated from the claim response and on each poll.
- Sessions without rules (all existing ones, and new ones with nothing selected) behave exactly as today; per-field rewards unchanged.

Verify: `npm run test:unit`, `npm run test:integration` (new suite), `npm run lint`, `npx astro check`, `npm run build`; manual walkthrough on the kitchen sinks and a 3ÃÂ3 table run.

### Key Discoveries:

- Grant = occupancy pattern makes derivation natural; no undo RPC change needed (`20261003200000_undo_board_cell.sql`).
- Row-major positions: `row = floor(pos / size)`, `column = pos % size` (`PlayerBoard.tsx` grid ordering by `position`).
- Colours are not unique (`20261003190000_player_claim_token.sql:104`) Ã¢ÂÂ key progress on `claim_token`.
- `generateBoard` already takes an injectable `random` for deterministic unit tests (`board-generator.ts:54-56`; cookbook `context/foundation/test-plan.md` ÃÂ§6).
- Test-plan risk #7 (undo looks free but grant wrong) is the integration layer for this change (`context/foundation/test-plan.md:48,63`).

## What We're NOT Doing

- Diagonals or other patterns (full board, corners) Ã¢ÂÂ rows and columns only.
- Per-player-owned lines (all fields by one player) or team-wide line rewards Ã¢ÂÂ completer rule only.
- Repeated threshold rewards (every multiple of N) Ã¢ÂÂ threshold pays once per player.
- Drawing rewards at the moment of earning or a grant ledger Ã¢ÂÂ rewards are pre-drawn, state is derived.
- New claim animations, banners, toasts or confetti Ã¢ÂÂ satisfaction comes from visible edge/roster progress (existing flip stays).
- Forcing rules onto existing sessions or migrating them; changing per-field reward behaviour, undo RPC, or join-by-code flow.
- E2E (Playwright) coverage for this change Ã¢ÂÂ unit + integration only.
- Custom (non-catalog) rewards or catalog changes.

## Implementation Approach

Store **rules and pre-drawn rewards**, derive **earned state**. One pure TypeScript function `deriveRewardProgress` computes counts, completed lines, completers and threshold earnings from claim data; both the GM snapshot (RLS-scoped reads) and the player snapshot (new SECURITY DEFINER RPC keyed by `claim_token`) feed it. The player RPC only reveals a line reward once the line is fully claimed and the player's threshold reward once they hold Ã¢ÂÂ¥ N fields, preserving the existing mystery rule. Line-edge UI is fed by `line_slots` on the same RPC (mystery `slug`/`label` until complete). Order: schema → pure logic → create/regenerate → boards.

### Addendum (2026-10-11, impl-review F1 + F2)

Accepted after Phase 4:

1. **Board-edge line rewards** replace the originally planned under-board "Twoje nagrody" list (`BoardWithLineSlots`, `lineSlots`). Supporting migrations beyond the Phase 1 file: `20261011171000_player_reward_inputs_has_line_rules.sql`, `20261011172000_player_reward_inputs_field_rewards.sql`, `20261011173000_player_reward_inputs_line_slots.sql`, `20261011180000_session_players_threshold_roster.sql`. Shipped in `457c9b1`.
2. **Peer threshold visibility on the player board** is accepted: `get_session_players_by_code` returns per-seat claimed counts and earned threshold labels; `PlayerRosterList` on the player board shows every seat's X/N and earned label (mystery until earned). Unearned assigned rewards stay hidden from players; GM still uses `revealAssigned`.
3. **`field_rewards` on the player RPC** may still be returned for enrichment when threshold/line rules are on, but per-field Pole alone does **not** make `progress` non-null (impl-review F6 Fix B). Rule-less sessions reveal Pole only on the claimed cell.

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
- `sessions.threshold_count smallint NULL` Ã¢ÂÂ CHECK `threshold_count IS NULL OR threshold_count BETWEEN 1 AND size*size`. NULL = threshold rule off.
- `session_reward_pool (session_id uuid FK sessions ON DELETE CASCADE, kind text CHECK IN ('line','threshold'), reward_id uuid FK rewards, PRIMARY KEY (session_id, kind, reward_id))` Ã¢ÂÂ the GM's selections (source for regenerate prefill and join draw).
- `board_lines (session_id uuid FK sessions ON DELETE CASCADE, axis text CHECK IN ('row','column'), index smallint CHECK >= 0, reward_id uuid NOT NULL FK rewards, PRIMARY KEY (session_id, axis, index))` Ã¢ÂÂ rows exist only when line rewards are on (2ÃÂsize rows).
- `session_players.threshold_reward_id uuid NULL FK rewards`.
- RLS enabled on both new tables: `SELECT` and `INSERT` for `authenticated` where the session's `gm_id = auth.uid()`; no UPDATE/DELETE policies; no `anon` policies (players read via RPC).

#### 2. Join draws threshold reward

**File**: same migration (`CREATE OR REPLACE FUNCTION public.join_session_player(text, text, uuid)`)

**Intent**: When a new seat is inserted and the session has a threshold pool, set `threshold_reward_id` to a random pool entry (`ORDER BY random() LIMIT 1`); rebind path unchanged.

**Contract**: Signature, return columns, errors and grants unchanged; body copied from `20261003190000_player_claim_token.sql:36-111` plus the draw in the insert branch.

#### 3. Player progress inputs RPC

**File**: same migration

**Intent**: Give the server everything `deriveRewardProgress` needs for one player without leaking undrawn/unearned rewards.

**Contract**: `get_player_reward_inputs(p_code text, p_claim_token uuid) RETURNS jsonb`, SECURITY DEFINER, `GRANT EXECUTE TO anon, authenticated`; works for active and closed sessions (like `get_active_board_by_code`). Returns NULL when the code is unknown or the token is not a seat of that session. Shape: `{ size, threshold_count, threshold_reward: {slug,label} | null (only when the player's claimed count Ã¢ÂÂ¥ threshold_count), cells: [{ position, claimed_at, is_mine }] (claimed cells only), lines: [{ axis, index, slug, label }] (only lines whose every cell is claimed) }`.

#### 4. Types

**Files**: `src/db/database.types.ts` (regenerated), `src/types.ts`

**Intent**: Regenerate DB types; add DTOs shared by services and islands.

**Contract** (new/extended in `src/types.ts`):
- `RewardRef = Pick<Reward, "slug" | "label">`; `LineAxis = "row" | "column"`
- `EarnedLineReward { axis: LineAxis; index: number; reward: RewardRef }`
- `PlayerRewardProgress { claimedCount: number; thresholdCount: number | null; thresholdReward: RewardRef | null; lines: EarnedLineReward[] }`
- `SessionRewardRules { thresholdCount: number | null; thresholdRewardIds: string[]; lineRewardIds: string[] }`
- `CreateSessionCommand` + `lineRewardIds: string[]`, `thresholdRewardIds: string[]`, `thresholdCount: number | null`
- `PlayerBoard` + `progress: PlayerRewardProgress | null` (null = no identity or session without threshold/line rules; per-field Pole alone does not open progress)
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

**Contract**: `drawLineRewards(input: { size: number; lineRewardIds: string[]; random?: () => number }): GeneratedLine[]` with `GeneratedLine { axis: LineAxis; index: number; rewardId: string }` (in `src/types.ts`); returns `[]` when the list is empty, else exactly `2 ÃÂ size` entries (rows 0Ã¢ÂÂ¦sizeÃ¢ÂÂ1, columns 0Ã¢ÂÂ¦sizeÃ¢ÂÂ1).

#### 2. Derivation

**File**: `src/lib/services/reward-progress.ts` (new)

**Intent**: Single source of truth for "who earned what", used by GM and player snapshots.

**Contract**:
`deriveRewardProgress(input: { size: number; cells: { position: number; claimedBy: string | null; claimedAt: string | null }[]; lines: { axis: LineAxis; index: number; reward: RewardRef }[]; thresholdCount: number | null; thresholdRewardByPlayer: Map<string, RewardRef | null> }): Map<string, PlayerRewardProgress>`
- `claimedBy` is an opaque player key (GM: player id; player path: `"me"` / `"other"`).
- Line membership: row r = positions `r*size Ã¢ÂÂ¦ r*size+size-1`; column c = positions `c, c+size, Ã¢ÂÂ¦`.
- Line complete Ã¢ÂÂ every member cell claimed; completer = latest `claimedAt`, tie Ã¢ÂÂ higher `position`.
- Threshold earned Ã¢ÂÂ `thresholdCount != null` and `claimedCount >= thresholdCount` and player has a drawn reward; earned once.
- Every key with Ã¢ÂÂ¥ 1 claim or a threshold entry appears in the result.

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

**Contract**: `lineRewardIds: uuid[]` (default `[]`, unique), `thresholdRewardIds: uuid[]` (default `[]`, unique), `thresholdCount: int | null` (optional). `superRefine`: when `thresholdRewardIds` is non-empty, `thresholdCount` is required and in `1Ã¢ÂÂ¦sizeÃÂ²`; when empty, `thresholdCount` is normalised to `null`.

#### 2. Service

**File**: `src/lib/services/sessions.service.ts` (`createSession`)

**Intent**: Validate all selected ids against the catalog (same `UNKNOWN_REWARD`-style error as per-field rewards Ã¢ÂÂ 400), store `threshold_count` on the session insert, then insert `session_reward_pool` rows and `drawLineRewards` output into `board_lines` after `board_cells`.

**Contract**: Same RLS client and sequential-insert pattern as `board_cells` (`sessions.service.ts:112-141`); errors propagate as today.

#### 3. API

**File**: `src/pages/api/sessions/index.ts`

**Intent**: Pass the new parsed fields into `createSession`; no response change.

**Contract**: `POST /api/sessions` body gains the three optional fields; 201 `CreateSessionResponse` unchanged.

#### 4. Form

**Files**: `src/components/sessions/NewSessionForm.tsx` (optionally a new `RewardRulesFields.tsx` beside it), `src/components/hooks/useCreateSession.ts`

**Intent**: Two sections after the per-field rewards: "Nagroda za wiersz/kolumnÃÂ" (catalog checklist using `Checkbox` + `Label`, none checked) and "Nagroda za [N] pÃÂ³l" (number `Input`, default = board size, follows size changes until the GM edits it, clamped 1Ã¢ÂÂ¦sizeÃÂ²; catalog checklist, none checked). Helper text: nothing selected = no reward of this kind; several selected = drawn randomly.

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

**Intent**: See Testing Strategy Ã¢ÂÂ create cases.

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

**Intent**: `getPlayerRewardSnapshot` / `getPlayerRewardProgress` call `get_player_reward_inputs`, map `is_mine` → `"me"`/`"other"`, run `deriveRewardProgress`, return the `"me"` entry, or `null` when the RPC returns NULL or the session has no threshold/line rules (`threshold_count` null and `has_line_rules` false). Per-field Pole alone does not open progress.

**Contract**: Returns `PlayerRewardProgress | null` (+ `lineSlots`); RPC errors propagate.

#### 2. Player APIs

**Files**: `src/pages/api/play/board.ts`, `src/pages/api/play/claim.ts`

**Intent**: Board GET reads the player cookie (`readPlayerIdentity`) and attaches `progress` and `lineSlots` (null/empty without a valid identity — board itself still served). Claim success attaches both after the claim so the player sees them immediately.

**Contract**: `PlayerBoard.progress` + `lineSlots`, `ClaimSuccessResponse.progress` + `lineSlots`; status codes and conflict body unchanged. A progress failure is reported via `reportError` and omits `progress` / `lineSlots` on the claim response (claim still 200) so the client keeps prior UI state.

#### 3. GM snapshot

**File**: `src/lib/services/sessions.service.ts` (`getSessionWithCells`)

**Intent**: Also read `threshold_count`, `session_reward_pool`, `board_lines` (+ reward), players' `threshold_reward_id` (+ reward); run `deriveRewardProgress` with player ids; fill `rewardRules`, `lineRewards` / edge slots (GM reveals incomplete), and each roster entry's threshold progress.

**Contract**: `SessionWithCells.rewardRules` + line-edge inputs; roster threshold progress; GM sees all lines/thresholds (GM already sees all rewards).

#### 4. Player UI

**Files**: `src/components/play/PlayerBoard.tsx`, `src/components/play/BoardWithLineSlots.tsx`, `src/components/play/PlayerRosterList.tsx`, `src/lib/services/line-slots.ts`

**Intent**: Wrap the board in `BoardWithLineSlots` fed by `lineSlots` (mystery until complete; then completer colour + label). Below the board, `PlayerRosterList` shows **every seat's** threshold X/N and earned reward label when earned (mystery tile until then — peers included). Update `progress` / `lineSlots` from the claim response and each poll. No under-board "Twoje nagrody" list; no new animation/banner.

**Contract**: Token/role classes only; edge slots and threshold chrome hidden when the session has no line/threshold rules.

#### 5. GM UI

**Files**: `src/components/sessions/GmBoard.tsx`, `src/components/play/BoardWithLineSlots.tsx`, `src/components/play/PlayerRosterList.tsx`

**Intent**: Same edge-slot board with incomplete line rewards revealed; roster via `PlayerRosterList` with GM `revealAssigned` for threshold tiles. After a successful undo, trigger an immediate snapshot refresh so revocations show without waiting for the poll.

**Contract**: Nothing extra rendered for sessions without rules.

#### 6. Kitchen sinks

**Files**: `src/pages/play/kitchen-sink.astro`, `src/pages/sessions/board/kitchen-sink.astro`

**Intent**: Player: edge slots (mystery / earned), roster threshold below N / earned, no rules. GM: edges revealed incomplete, roster with assigned/earned threshold, roster without rules.

**Contract**: Static demo data; existing non-rules sections untouched.

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

- 3×3 session with both rules, two browsers: completing a row reveals the edge slot for the completer immediately; reaching N updates the roster threshold tile; GM board shows both
- GM undo of a field in the completed line revokes the edge slot / roster state at once on GM and within one poll on the player board
- An existing (pre-change) session plays exactly as before; no edge slots or threshold roster chrome
- Kitchen sinks for player board and GM board render new edge/roster states token-clean on a phone-width viewport

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `deriveRewardProgress`: row/column membership for sizes 3, 4, 5; completer = latest `claimedAt` (row claimed A, A, then B Ã¢ÂÂ B); tie Ã¢ÂÂ higher position; one claim completing a row and a column at once Ã¢ÂÂ 2 line rewards; two completed rows by one player Ã¢ÂÂ 2 entries; threshold at exactly N and above Ã¢ÂÂ earned once; below N Ã¢ÂÂ not earned; `thresholdCount` null Ã¢ÂÂ never; no lines Ã¢ÂÂ `lines: []`; player without drawn reward Ã¢ÂÂ no threshold.
- `drawLineRewards`: empty list Ã¢ÂÂ `[]`; `2 ÃÂ size` entries with ids from the list; deterministic with fixed RNG.
- Prefill helper returns rules from source rows.

### Integration Tests:

- Create: rules stored (`board_lines` = 2ÃÂsize with selected ids, pool rows, `threshold_count`); unknown reward id Ã¢ÂÂ 400; threshold ids with `thresholdCount` 0 or > sizeÃÂ² Ã¢ÂÂ 400; body without new fields Ã¢ÂÂ rule-less session (backward compat).
- Join: player on threshold session gets `threshold_reward_id` from the pool; rejoin via token keeps it.
- Claim 3ÃÂ3, threshold N = 2: A claims 0, 1; B claims 2 Ã¢ÂÂ B earns row 0, A earns threshold, B no threshold; claim response `progress` matches.
- GM undo position 1 Ã¢ÂÂ A loses threshold, B loses row 0 (player board + GM snapshot).
- A reclaims 1 Ã¢ÂÂ A is completer of row 0 with the same reward; A threshold restored.
- Hidden info: before the line is complete, `progress` holds no line rewards; before N, `thresholdReward` is null.
- Rule-less session: `progress` null, roster `earned` empty, per-field reward reveal unchanged.

### Manual Testing Steps:

1. Create a 3ÃÂ3 session selecting two line rewards and one threshold reward with N = 3; join with two phones.
2. Complete a row with the second player claiming the last field; check both boards and GM roster.
3. Undo a field in that row as GM; confirm revocation, then reclaim.
4. Open an old session from the dashboard and play a claim Ã¢ÂÂ no new UI.

## Performance Considerations

Derivation is O(sizeÃÂ²) per snapshot (Ã¢ÂÂ¤ 25 cells, Ã¢ÂÂ¤ 10 lines) on every 5 s poll Ã¢ÂÂ negligible. The player board poll adds one RPC call; acceptable at table scale (Ã¢ÂÂ¤ 10 players).

## Migration Notes

Additive only: nullable column, nullable FK, two new tables. Existing sessions have no rules and keep working; no backfill. Rollback of code leaves the extra schema unused (backward-compatible by one version, per `CLAUDE.md` deployment rules). Apply locally only; hosted schema changes need human approval.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-02)
- PRD: `context/foundation/prd-v2.md` (Scope ÃÂ§Nagrody, Business Logic Changes, Constraints)
- Claim RPC: `supabase/migrations/20261003190000_player_claim_token.sql:118-221`
- Undo RPC: `supabase/migrations/20261003200000_undo_board_cell.sql`
- Board generator: `src/lib/services/board-generator.ts:49-125`
- Create flow: `src/lib/services/sessions.service.ts:75-145`, `src/lib/schemas/session.ts:17-48`
- Prior undo semantics: `context/archive/2026-10-03-gm-undo-field-claim/plan-brief.md`
- Test cookbook: `context/foundation/test-plan.md` ÃÂ§6

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` Ã¢ÂÂ <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model & RPCs

#### Automated

- [x] 1.1 Migration applies on local Supabase: `npx supabase migration up --local` Ã¢ÂÂ 956b324
- [x] 1.2 Regenerated types compile: `npx astro check` Ã¢ÂÂ 956b324
- [x] 1.3 Lint passes: `npm run lint` Ã¢ÂÂ 956b324
- [x] 1.4 Existing integration suite still green (join, claim, undo, delete cascade): `npm run test:integration` Ã¢ÂÂ 956b324

#### Manual

- [x] 1.5 In local Supabase Studio, as `anon`, direct `SELECT` on `board_lines` / `session_reward_pool` returns no rows; `get_player_reward_inputs` with a foreign token returns NULL — 457c9b1

### Phase 2: Pure reward logic

#### Automated

- [x] 2.1 Unit tests pass: `npm run test:unit` Ã¢ÂÂ 1406e05
- [x] 2.2 Type check passes: `npx astro check` Ã¢ÂÂ 1406e05
- [x] 2.3 Lint passes: `npm run lint` Ã¢ÂÂ 1406e05

#### Manual

- [x] 2.4 Reviewer reads the test names and confirms they match the agreed rules (completer, once-threshold, each line counts, rows/columns only) — 457c9b1

### Phase 3: Create session & regenerate

#### Automated

- [x] 3.1 Unit tests pass (incl. prefill): `npm run test:unit` â bed253c
- [x] 3.2 Integration create cases pass: `npm run test:integration` â bed253c
- [x] 3.3 Type check: `npx astro check` â bed253c
- [x] 3.4 Lint incl. UI literals: `npm run lint` â bed253c
- [x] 3.5 Build: `npm run build` â bed253c

#### Manual

- [x] 3.6 `/sessions/new/kitchen-sink` rules sections render in all states, token-clean, keyboard-focusable — 457c9b1
- [x] 3.7 Changing board size updates the default N until it is edited manually — 457c9b1
- [x] 3.8 Regenerating a session with rules prefills both checklists and N — 457c9b1

### Phase 4: Progress on player & GM boards

#### Automated

- [x] 4.1 Unit tests pass: `npm run test:unit` — d55a189
- [x] 4.2 Integration suite passes (new + existing claim/undo/join): `npm run test:integration` — d55a189
- [x] 4.3 Type check: `npx astro check` — d55a189
- [x] 4.4 Lint incl. UI literals: `npm run lint` — d55a189
- [x] 4.5 Build: `npm run build` — d55a189
- [x] 4.6 Smoke passes against preview: `npm run smoke` — d55a189

#### Manual

- [x] 4.7 3×3 session with both rules, two browsers: completing a row shows the line reward for the completer immediately; reaching N shows the threshold reward; GM roster shows both — 457c9b1
- [x] 4.8 GM undo of a field in the completed line removes the line reward on GM roster at once and on the player board within one poll — 457c9b1
- [x] 4.9 An existing (pre-change) session plays exactly as before; no progress section shown — 457c9b1
- [x] 4.10 Kitchen sinks for player board and GM board render new states token-clean on a phone-width viewport — 457c9b1
