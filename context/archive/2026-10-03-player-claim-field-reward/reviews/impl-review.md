<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Player claim field reward

- **Plan**: context/changes/player-claim-field-reward/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-10-03
- **Verdict**: REJECTED
- **Findings**: 1 critical 4 warnings 1 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Public player IDs enable claim impersonation

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261003170000_session_players_by_code.sql:6-16; src/lib/services/sessions.service.ts:213-218; src/pages/api/play/board.ts:27-31; src/pages/api/play/claim.ts:37-52; src/lib/player-cookie.ts:134-175
- **Detail**: `get_session_players_by_code` (comment: "nick + color only") still returns every `session_players.id`. `GET /api/play/board` exposes those ids to anyone with the session code. Claim auth is only that UUID inside an unsigned, forgeable `rpg_player` cookie (httpOnly blocks XSS theft, not attacker-controlled `Cookie` headers). Flow: poll board → copy victim `playerId` → forge cookie → `POST /api/play/claim` (and join rebind) as them. S-02 deferred cookie sensitivity until claims bind; claims now bind without integrity or secrecy of the id.
- **Fix A ⭐ Recommended**: Strip `id` from the player-facing roster RPC/DTO immediately (nick/color/`created_at` only; React keys from nick+color+created_at), and treat `playerId` as a secret capability — signed/HMAC cookie or a per-player secret issued only at join and required by `claim_board_cell`.
  - Strength: Closes the public-id leak today and hardens claim auth so a leaked UUID alone is not enough; matches the deferred S-02 threat note.
  - Tradeoff: Needs a small migration (RPC return shape) + cookie/claim contract change; existing cookies may need re-join.
  - Confidence: HIGH — exploit path is direct from current code; GM path can keep ids for claimer→color mapping.
  - Blind spot: Exact signed-cookie vs join-secret design not prototyped in this review.
- **Fix B**: Strip public roster ids only (minimal patch); leave UUID-in-cookie claim auth as-is for MVP.
  - Strength: Fastest stopgap against casual impersonation via poll.
  - Tradeoff: Claim still trusts a forgeable UUID if the id leaks any other way (logs, SSR props, future endpoints).
  - Confidence: MEDIUM — reduces exposure surface but does not fix capability-token weakness.
  - Blind spot: Whether SSR `PlayerBoard` props or other responses still leak ids after RPC change.
- **Decision**: FIXED via Fix A

### F2 — Unbounded session_players growth

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261003180000_player_colors_8.sql:13-80; src/lib/services/sessions.service.ts:197-218
- **Detail**: `join_session_player` has no max-players or rate limit. Cleared cookies or spam POSTs create unbounded rows; every ~5s poll loads the full roster for player and GM boards.
- **Fix**: Cap joins per session (e.g. soft max aligned with product table size) and reject with a clear error; optionally document that cookie clear creates a new seat.
  - Strength: Bounds poll payload and DB growth without changing claim semantics.
  - Tradeoff: Need a product number and UX for “stół pełny”.
  - Confidence: HIGH — growth path is unbounded today.
  - Blind spot: Whether abuse is realistic for MVP table play with shared codes.
- **Decision**: FIXED — cap 10 players per session (`session_full` → `error=full`)

### F3 — Null RPC data can throw in getActiveBoardByCode

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/sessions.service.ts:197-218
- **Detail**: After RPC success, Supabase may still yield `data === null` / `playersData === null`. Code calls `data.length` and `playersData.map` without null guards → uncaught throw → generic 500 on play board/SSR.
- **Fix**: Treat null like empty / explicit throw before `.length` / `.map`.
- **Decision**: FIXED — `rpcRows()` widens typed RPC data so null is handled without eslint false positives

### F4 — Color cycle narrowed 16→8 without plan contract update

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20261003180000_player_colors_8.sql; src/lib/player-cookie.ts:36-38; src/styles/global.css; plan Critical Implementation Details (1–16)
- **Detail**: Plan contracts `color = ((join_ordinal - 1) % 16) + 1` and tokens 1–16. Shipped migration remaps to 1–8; cookie/CSS/types match 8. Runtime is internally consistent; plan/product prose still describes 16 in places (roadmap/plan). Intentional Vintage Paper palette narrow, but undocumented vs plan.
- **Fix**: Add a short plan addendum (and any PRD/roadmap color mentions) stating the locked palette is 1–8 so future agents do not re-expand the CHECK.
- **Decision**: FIXED — plan Addendum A + Critical Details + plan-brief lock colors to 1–8

### F5 — Conflict feedback implemented as toast overlay

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/play/PlayerBoard.tsx:111-118, 217-226
- **Detail**: Phase 4 contract said “no toast/modal” for the player board. Conflict uses `showConflictToast` and a floating auto-dismiss banner; kitchen-sink labels it “toast”. NOT DOING “blocking toast/modal **reward** UX” is still respected (reward is cell flip/label). Soft wording clash, not a reward-UX violation.
- **Fix A ⭐ Recommended**: Document as accepted conflict feedback (inline/status banner, non-blocking) in a plan addendum; keep current UX.
  - Strength: Matches shipped smoke/manual behavior; conflict still visible as required.
  - Tradeoff: Plan’s “no toast/modal” line becomes nuanced.
  - Confidence: HIGH — reward path is not toast-based.
  - Blind spot: None significant.
- **Fix B**: Replace overlay with persistent inline status under the grid (no toast naming/positioning).
  - Strength: Literal match to Phase 4 wording.
  - Tradeoff: UX churn for little product gain.
  - Confidence: MEDIUM — subjective whether current overlay counts as “toast”.
  - Blind spot: Kitchen-sink copy would need a rename either way.
- **Decision**: FIXED via Fix A — plan Addendum B accepts non-blocking conflict banner

### F6 — Roadmap S-03 still in-progress / refresh wording

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md:52, 140, 148
- **Detail**: Progress marks all phases done and polling ships occupancy within ~10s, but roadmap S-03 remains `in-progress` and outcome text still says “po odświeżeniu”. Expected until archive/roadmap closeout, but stale for anyone reading roadmap as truth.
- **Fix**: When archiving this change (or now), set S-03 to done and update outcome wording to polling (~10s), not manual refresh.
- **Decision**: FIXED — S-03 status `done`; outcome/table wording uses ~10s poll
