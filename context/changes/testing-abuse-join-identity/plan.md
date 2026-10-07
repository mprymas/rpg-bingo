# Abuse & join identity test coverage Implementation Plan

## Overview

Add Vitest preview-HTTP integration coverage for test-plan Phase 3 Risks **#6** (forged / wrong-session player claim; logged-in GM cannot act on another GM’s session) and **#8** (anonymous MG surfaces denied with no protected board content). Prove protection at the HTTP status + follow-up GET layer — no e2e login theater or kitchen-sink-only checks.

## Current State Analysis

Claim writes require an httpOnly `rpg_player` entry for the request `code` and RPC `claim_token` binding (`src/pages/api/play/claim.ts:36-52`). The contract matrix covers forged cookie on **unknown** code → claim **404**; there is no live-session forge with board-unchanged proof.

Cookie identity is looked up **per session code**; a cross-session token in another code’s slot yields claim **401** and no cell write. Join with a stolen token from session A against B creates a **new** seat (302) — not a hijack — so write-identity abuse is proven at claim, not join.

GM board and undo require Supabase auth plus `gm_id` ownership; wrong owner surfaces **404** (not 403). CI provisions only one GM (`SMOKE_*` / `resolveTestCredentials()`).

Anonymous MG APIs return **401** JSON; pages under `/sessions` and `/dashboard` redirect via middleware. Smoke covers anon redirects; systematic live-session-id no-leak on GM board API and session page is missing.

Harness: `tests/helpers/http.ts` (`joinPlayer`, `createActiveSession`); `forgePlayerCookie` is local to `tests/integration/http-contract-matrix.test.ts`.

### Key Discoveries:

- Claim deny mapping: `src/pages/api/play/claim.ts:37-72`
- Public code-gated board poll (not a #6 failure): `src/pages/api/play/board.ts:15-31`
- GM ownership filter: `src/lib/services/sessions.service.ts:148-174`, undo RPC `gm_id = auth.uid()`
- Matrix forged/anon negatives: `tests/integration/http-contract-matrix.test.ts:43-108`
- Play-path board follow-up pattern: `tests/integration/play-path-claim-undo.test.ts`
- Phase 2 deferred abuse to Phase 3: `context/changes/testing-play-path-claim-undo/plan.md` exclusions

## Desired End State

A dedicated integration file `tests/integration/abuse-join-identity.test.ts` proves live forged claim deny, cross-code claim deny, cross-owner GM board/undo **404**, and anonymous live MG board + session page guards with no protected payload. Shared `forgePlayerCookie` and `resolveSecondTestCredentials()` live in `tests/helpers/http.ts`. CI admin-provisions a second GM (`TEST_EMAIL_B` / `TEST_PASSWORD_B`). Cookbook §6.6 documents the pattern; test-plan Phase 3 is marked done. Smoke remains single-GM.

Verification: `PREVIEW_BASE_URL=… npm run test:integration` greens the abuse cases with primary + second creds against local Supabase + preview; CI integration job exports both credential pairs.

## What We're NOT Doing

- Thin Playwright e2e or kitchen-sink-only #8 proof
- Treating valid active code on `GET /api/play/board` as a regression (product join model)
- Join-stolen-token abuse case (creates new seat only; out of scope per plan interview)
- Expanding `http-contract-matrix` into full abuse coverage (test-plan §6.4)
- NFR brute-force code guessing; RLS / PostgREST bypass
- Dashboard HTML scrape for session list rows; two-GM smoke expansion
- Hosted `supabase db reset` (lessons.md)

## Implementation Approach

Helpers and CI second GM first, then the dedicated abuse suite reusing play-path board oracles locally, then cookbook §6.6 and Phase 3 status. Matrix keeps thin status rows; imports shared forge helper.

## Critical Implementation Details

Cross-owner GM board and undo must assert **404** “session not found”, not **403**. For cross-code claim, place player A’s `claimToken` in `byCode[codeB]` (or rely on cookie with only A’s entry → pre-RPC **401**); always follow with player board GET showing session B cell unchanged. Cross-owner cases require both credential pairs — use `describe.skipIf` when second creds are unset locally; CI must always provide both.

## Phase 1: Second GM + shared helpers

### Overview

Provision a second admin-confirmed GM in CI, document env vars, and centralize forge + second-credential resolution for abuse and matrix tests.

### Changes Required:

#### 1. Second GM env documentation

**File**: `.env.example`

**Intent**: Let local integration runs use two distinct GMs without inventing ad hoc env names.

**Contract**: Document `TEST_EMAIL_B` and `TEST_PASSWORD_B` (example: `mg.other@rpgbingo.test` + distinct password). Note integration abuse suite prefers these for cross-owner cases; primary remains `TEST_*` / `SMOKE_*`.

#### 2. CI second user

**File**: `.github/workflows/ci.yml`

**Intent**: Guarantee cross-owner #6 proofs green in CI without signup theater.

**Contract**: After existing “Create smoke user” admin API step, add a second admin `POST …/auth/v1/admin/users` with `email_confirm: true`. Export `TEST_EMAIL_B` and `TEST_PASSWORD_B` on the step that runs `npm run test:integration`. Smoke job may stay single-GM.

#### 3. Shared HTTP helpers

**File**: `tests/helpers/http.ts`

**Intent**: Single forge helper and second-credential resolver reused by matrix and abuse suite.

**Contract**:
- `resolveSecondTestCredentials(): { email, password } | null` — reads `TEST_EMAIL_B` / `TEST_PASSWORD_B` only (no SMOKE fallback)
- `forgePlayerCookie(code, overrides?)` — same well-formed UUID shape as today’s matrix local helper
- Do not move board assertion oracles into this file

#### 4. Matrix import

**File**: `tests/integration/http-contract-matrix.test.ts`

**Intent**: Avoid duplicate forge logic drifting from abuse tests.

**Contract**: Import `forgePlayerCookie` from `tests/helpers/http.ts`; remove local duplicate.

### Success Criteria:

#### Automated Verification:

- Second-creds helper and `forgePlayerCookie` export and typecheck with existing `HttpClient` patterns
- Matrix compiles using shared forge (no local duplicate)
- CI workflow creates second admin user and passes `TEST_EMAIL_B` / `TEST_PASSWORD_B` to integration
- `.env.example` documents the B credential pair

#### Manual Verification:

- With both pairs in local env, two `createHttpClient()` instances can `signIn` as different users

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 2: Abuse integration suite

### Overview

One Vitest integration file proves Risks #6 and #8 with live sessions and follow-up board GETs.

### Changes Required:

#### 1. New integration file

**File**: `tests/integration/abuse-join-identity.test.ts`

**Intent**: Cover live-session forged claim, cross-code claim, cross-owner GM APIs, and anonymous live MG no-leak — without duplicating matrix unknown-id-only rows.

**Contract**:
- Gate GM-bootstrap cases with `describe.skipIf(!hasBaseUrl() || !resolveTestCredentials())`; cross-owner block also requires `resolveSecondTestCredentials()`
- Fresh `createActiveSession` per case; `#6` / `#8` prefixes in test titles
- File-local `fetchPlayerBoard` / cell oracle pattern from `play-path-claim-undo.test.ts` (extract only if duplication hurts)
- **#6 live forge claim**: active session → `forgePlayerCookie(realCode)` → `POST /api/play/claim` → **401** → player board cell still free
- **#6 cross-code claim**: player A joins session 1; claim on session 2 with A’s token in B’s cookie slot → **401** → session 2 board unchanged
- **#6 cross-owner GM**: owner creates session; other GM `GET /api/sessions/{id}/board` and `POST …/undo-claim` → **404**; owner `GET …/board` → **200** (proves row exists)
- **#8 anon live board**: anon `GET /api/sessions/{id}/board` → **401**; body must not expose cells/phrases/session code (error JSON / absent board fields)
- **#8 anon session page**: anon `GET /sessions/{id}` without following redirects → **302** with `Location` to `/auth/signin`
- Do not treat matrix unknown-code forge **404**, anon create **401**, or smoke redirects as sole #8 evidence

### Success Criteria:

#### Automated Verification:

- Suite file exists with the five cases above
- `PREVIEW_BASE_URL=<preview> npm run test:integration` passes abuse cases with primary + second creds
- CI integration job with both users greens the suite

#### Manual Verification:

- Spot-check one case by temporarily wrong expected status to confirm the assert is live, then restore

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: Cookbook + Phase 3 status

### Overview

Document abuse coverage for contributors and close the rollout row.

### Changes Required:

#### 1. Test-plan cookbook and phase status

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.6 placeholder; record Phase 3 completion and authz gate satisfaction.

**Contract**:
- §6.6: suite path, case list, second-GM env + CI note, rule that matrix stays thin (dedicated file per §6.4)
- §3 table: Phase 3 Status → `done`; Change folder `testing-abuse-join-identity`
- §8 freshness ledger / quality-gate rows referencing Phase 3 authz abuse updated as needed
- Smoke remains single-GM

### Success Criteria:

#### Automated Verification:

- §6.6 is non-placeholder and references `abuse-join-identity.test.ts`
- Phase 3 rollout row status is `done`

#### Manual Verification:

- A contributor can run the suite using §6.6 alone without the planning chat

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human.

---

## Testing Strategy

### Unit Tests:

- None required for helpers/YAML unless a pure slug-style helper is added (not expected).

### Integration Tests:

- Live forged claim deny + board unchanged (#6)
- Cross-code claim deny + board unchanged (#6)
- Cross-owner GM board/undo **404** (#6)
- Anonymous live GM board **401** without protected payload (#8)
- Anonymous session page **302** to sign-in (#8)

### Manual Testing Steps:

1. Local: second Supabase user matching `.env.example` B pair, preview, `npm run test:integration`
2. Confirm CI logs show second user created before integration
3. Optional: wrong-owner board GET returns 404 in browser network tab

## Migration Notes

- Local: create second GM via Supabase admin or dashboard matching documented B credentials.
- CI: second admin user curl only; no schema migration.
- Matrix behavior unchanged except forge import path.

## References

- Related research: `context/changes/testing-abuse-join-identity/research.md`
- Prior suite shape: `context/changes/testing-play-path-claim-undo/plan.md`
- Test plan Phase 3 / §6.4 / §6.6: `context/foundation/test-plan.md`
- Lessons: never hosted `db reset` — `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Second GM + shared helpers

#### Automated

- [x] 1.1 Second-creds helper and `forgePlayerCookie` export and typecheck with existing HttpClient patterns — c353fd1
- [x] 1.2 Matrix imports shared forge (no local duplicate) — c353fd1
- [x] 1.3 CI creates second admin user and exports TEST_EMAIL_B / TEST_PASSWORD_B to integration — c353fd1
- [x] 1.4 .env.example documents the B credential pair — c353fd1

#### Manual

- [x] 1.5 Locally, two clients can sign in with A and B credentials

### Phase 2: Abuse integration suite

#### Automated

- [x] 2.1 Suite file `tests/integration/abuse-join-identity.test.ts` exists with #6/#8 cases — ed6a7da
- [x] 2.2 Live forge claim → 401 + board unchanged — ed6a7da
- [x] 2.3 Cross-code claim → 401 + board unchanged — ed6a7da
- [x] 2.4 Cross-owner board/undo → 404; owner board still 200 — ed6a7da
- [x] 2.5 Anon live GM board → 401 without protected payload; anon GET /sessions/{id} → 302 sign-in — ed6a7da
- [x] 2.6 `npm run test:integration` greens with preview URL + both creds (CI included) — ed6a7da

#### Manual

- [x] 2.7 Spot-check that a deliberately wrong assert fails the live case, then restore

### Phase 3: Cookbook + status

#### Automated

- [x] 3.1 test-plan.md §6.6 documents suite, cases, second GM, matrix boundary — 52b2619
- [x] 3.2 Phase 3 rollout status / ledger marked done — 52b2619

#### Manual

- [x] 3.3 §6.6 alone is enough to run the suite
