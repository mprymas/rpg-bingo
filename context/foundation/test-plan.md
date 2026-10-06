# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-06

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "<the
   team is worried about X, and the failure would surface somewhere in
   <area>>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src`, `supabase/migrations`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|--------------------------------|
| 1 | MG creates a session whose board is incomplete or invalid (missing cells/phrases, reward that does not exist) and the table plays on a broken board | High | High | interview Q1; PRD Business Logic / FR-004–005; hot-spot dir `src/lib/services` (12 commits/30d) |
| 2 | API failure is returned as HTTP 200 (or otherwise treated as success), so the client commits a bad state | High | High | interview Q2; AGENTS.md (smoke-only gate, no suite); provider/limit errors folded here |
| 3 | Two players claim the same free cell nearly together; both believe they own it / both get a reward | High | Medium | PRD Guardrails + US-01 AC; roadmap S-03 done; hot-spot dir `src/pages/api` (17 commits/30d) |
| 4 | Board view / claim path regresses so a player cannot mark a free cell or see the post-claim reward | High | High | interview Q3; PRD US-01 / FR-009–011; hot-spot dirs `src/pages/sessions`, `src/pages/play`, `src/components/sessions` |
| 5 | Stale client/persisted data leaves the app stuck until the user clears storage/cache | Medium | Medium | interview Q2 |
| 6 | Abuse: outsider with a guessed/leaked code (or forged player identity) joins or claims on someone else’s session | High | Medium | PRD Access Control + NFR code-guessing; FR-002 join-by-code |
| 7 | MG undo frees the cell visually but leaves the reward (or ownership) intact | Medium | Medium | PRD FR-012; roadmap S-04 done |
| 8 | Abuse: unauthenticated user reaches MG-protected surfaces (create board, board list, board preview as MG) and sees or acts as MG | High | Medium | user correction to test plan; PRD Access Control; AGENTS.md PROTECTED_ROUTES + auth smoke |
| 9 | MG creates a board with custom phrases marked guaranteed; create succeeds, but one or more guaranteed phrases never appear on the generated board | High | Medium | user concern (test-plan correction); archive S-01 create-session AC (guaranteed customs always appear); PRD FR-004–005; hot-spot dir `src/lib/services` |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Create-session never persists a board with wrong cell count, empty phrase, or unknown reward id | "Generate returned OK ⇒ board is playable" | create inputs → persisted board shape → reward catalog contract | integration (API + DB assert) | assert only HTTP 200 / mirror generator internals |
| #2 | Non-success paths use non-2xx (or explicit error body the client treats as failure); client does not advance on error | "Any JSON body means success" | status mapping on play/session APIs; client success gate | contract / API integration | snapshot full response bodies; happy-path only |
| #3 | Second concurrent claim loses; only one owner; loser sees occupied-by | "Sequential tests prove race safety" | claim RPC/constraint + response to loser | DB/integration with parallel requests | single-threaded double-click simulation only |
| #4 | Free cell claim updates ownership + shows reward; refresh still shows claim | "Rendering the grid proves claim works" | claim → board snapshot → reward reveal rule | integration (+ thin e2e only if UI-only bug) | kitchen-sink / pixel snapshots |
| #5 | After refresh/rejoin with valid cookie/code, app recovers without manual cache clear | "localStorage wipe is an acceptable fix" | player cookie / rejoin contract | integration smoke for rejoin | brittle timing e2e |
| #6 | Claim/undo require valid session player (or MG) identity; invalid code cannot see board | "Logged-in ⇒ can touch any session" | join token/cookie vs session ownership | API authz integration | full e2e login theater |
| #7 | After undo: cell free, previous reward invalidated, other players’ view consistent | "Undo only clears the cell label" | undo side effects on claim + reward | integration | UI-only undo click without DB assert |
| #8 | Unauthenticated request to MG create / list / board-preview surfaces is denied (redirect or 401/403) with no protected board content | "Auth-flow smoke ⇒ every MG-protected route is closed" | PROTECTED_ROUTES / middleware vs create, list, MG preview entry points | route-guard / integration (anonymous GET/POST) | full e2e login theater; kitchen-sink only |
| #9 | After successful create with ≥1 guaranteed custom, every guaranteed phrase text appears among persisted board cells (trim/normalize per product rules) | "`guaranteed: true` in request + HTTP 201 ⇒ phrase is on the board" | create command guaranteed flag → persisted board phrase set; how guaranteed vs pool draw is supposed to behave | integration (create → GM board membership) and/or pure unit on generator with fixed RNG | assert only cell count/uniqueness; mirror shuffle internals; oracle = generator’s own output list |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Runner bootstrap + board integrity | Install cheapest runner; prove create never ships invalid boards; prove guaranteed customs appear on success; lock non-success HTTP contract on core APIs | #1, #2, #9 | runner setup, integration, contract | done | testing-runner-bootstrap-board-integrity |
| 2 | Play-path claim & undo | Protect unique claim, reward reveal, undo invalidation, rejoin without cache clear | #3, #4, #5, #7 | integration (+ optional thin e2e if research requires UI) | not started | — |
| 3 | Abuse & join identity | Unauthorized claim/undo and invalid code denied; unauthenticated access to MG create/list/preview denied | #6, #8 | API authz / integration, route-guard | not started | — |
| 4 | Quality-gates wiring | Extend smoke/CI so regressions fail the PR; document cookbook | cross-cutting (locks #1–#9 floor) | smoke expansion, CI gates, cookbook | done | testing-runner-bootstrap-board-integrity |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.
Recommendations in this section must be grounded in local manifests/configs
plus the MCP/tools actually exposed in the current session.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest (`vitest.config.ts` projects `unit` / `integration`) | ^5.0.3 | Scripts: `npm run test:unit`, `npm run test:integration`, `npm test`. Naming: `*.test.ts`. Unit: `src/**/*.test.ts` (and `tests/unit/` if needed). Integration: `tests/integration/**/*.test.ts`; needs preview URL (`PREVIEW_BASE_URL` preferred — Vite may overwrite `BASE_URL`) |
| API / HTTP contract | Vitest integration + `tests/helpers/http.ts` | same | Assert status + side effects / error shape; no full-body snapshots. Helpers mirror smoke cookie-jar + Origin |
| e2e | none yet — see §3 Phase 2 | — | Add only if research shows a UI-only failure mode for Risks #4/#5 |
| Existing smoke | `scripts/smoke.mjs` via `npm run smoke` | n/a | Auth-flow smoke; CI `smoke` job runs smoke then `test:integration` against preview + local Supabase |
| accessibility | none planned | — | PRD non-goal: full WCAG AA out of MVP |
| AI-native | none planned | — | Cost × signal: deterministic integration preferred; browser MCP is manual only |

**Stack grounding tools (current session):**
- Docs: none — no Context7 / framework-docs MCP in session; checked: 2026-10-06
- Search: Cursor WebSearch — available for stack setup verification during Phase 1; checked: 2026-10-06
- Runtime/browser: cursor-ide-browser — manual/dev verification only, not a suite; checked: 2026-10-06
- Provider/platform: none for this project — Azure DevOps MCP explicitly excluded; checked: 2026-10-06

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase \<N\>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + `astro check` + build | local + CI | required (today) | syntactic / type / build drift |
| `npm run smoke` | CI (`smoke` job) + local against running server | required (today) | auth-flow / environment wiring breaks |
| unit + integration suite | local + CI (`test:unit` in `ci`; `test:integration` in `smoke`) | required (today) | board integrity + guaranteed-phrase membership + HTTP success-contract regressions |
| play-path integration (+ thin e2e if added) | local + CI | required after §3 Phase 2 | claim race, undo, rejoin stuck-state |
| authz / abuse API checks | local + CI | required after §3 Phase 3 | unauthorized claim/join; unauthenticated MG create/list/preview |
| expanded smoke / CI test job wiring | CI on PR (`smoke` then Vitest integration) | required (today) | floor stays green on every PR |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase \<N\>."

### 6.1 Adding a unit test

1. Put the file next to the module as `src/**/<name>.test.ts` (or under `tests/unit/` if colocating is awkward).
2. Import from `vitest` (`describe` / `it` / `expect`). Use the `@/` alias for `src` imports.
3. Prefer pure functions with fixed inputs (e.g. inject `random` for generators). No network, no Supabase, no preview.
4. Run: `npm run test:unit`.

Reference: `src/lib/services/board-generator.test.ts` (fixed `random`, asserts cell count / uniqueness / non-empty phrases).

### 6.2 Adding an integration test

1. Add `tests/integration/<name>.test.ts`.
2. Use `createHttpClient` / `hasBaseUrl` / `requireBaseUrl` / `resolveTestCredentials` from `tests/helpers/http.ts`.
3. Gate suites with `describe.skipIf(!hasBaseUrl())` (and credentials when auth is required) so local `npm test` without preview does not fail.
4. Assert **HTTP status** and **observable side effects** (follow-up GET, membership, error field presence). Do **not** snapshot full response bodies; do **not** treat any JSON as success.
5. Env: `PREVIEW_BASE_URL` (preferred) or absolute `BASE_URL`; signed-in cases need `SMOKE_EMAIL`/`SMOKE_PASSWORD` or `TEST_EMAIL`/`TEST_PASSWORD`.
6. Run against a healthy preview: `PREVIEW_BASE_URL=http://localhost:4321 npm run test:integration` (CI sets the same after `npm run smoke`).

References: `tests/integration/create-session-board.test.ts`, `tests/integration/http-contract-matrix.test.ts`.

**Phase 1 exclusions / known gap:** blank catalog and RLS-bypass scenarios are out of Phase 1 scope. Orphan 0-cell session after failed cell insert (create returns 500; row may remain) is a **known deferred gap** — document only; no red test and no transactional rewrite in Phase 1 (see change notes for `testing-runner-bootstrap-board-integrity`).

### 6.3 Adding an e2e test

TBD — see §3 Phase 2 (only if research proves a UI-only failure for board claim / rejoin). Never kitchen-sink.

### 6.4 Adding a test for a new API endpoint

1. Prefer a Vitest integration case in `tests/integration/` using `tests/helpers/http.ts`.
2. Cover the failure classes that matter: unauthenticated → expected deny status; bad input → 4xx + `{ error: string }`; happy path → success status **and** a side-effect check (not body shape alone).
3. Extend or mirror `tests/integration/http-contract-matrix.test.ts` for status-contract rows; keep assertions status-first.
4. Authz / unauthenticated MG route breadth beyond Phase 1 create/board guards belongs in §3 Phase 3 — do not expand the matrix into full abuse coverage here.

### 6.5 Adding a test for board create / claim / undo

**Create (Phase 1 — in place):**
1. Sign in via `http.signIn`, `POST /api/sessions` with a typed body.
2. Expect create status (`201` success / `400` validation / `401` anonymous).
3. On success, `GET /api/sessions/{id}/board` as GM and assert playable invariants: `size²` cells, positions `0..n-1`, non-empty unique phrases, reward ids null or from the request set.
4. For guaranteed customs: oracle = request guaranteed texts (normalized with product `normalizePhrase`); every guaranteed phrase must appear on the board. Do not oracle against the generator’s own output list.
5. Reference: `tests/integration/create-session-board.test.ts`.

**Claim / undo / rejoin:** TBD — see §3 Phase 2 (uniqueness, reward reveal, undo invalidation, rejoin without cache clear).

### 6.6 Per-rollout-phase notes

(Filled as phases ship.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Kitchen-sink pages** — visual/dev state galleries; high churn, low product signal. Re-evaluate only if kitchen-sink becomes the sole render path for a production screen. (Source: Phase 2 interview Q5.)
- **Pixel / snapshot UI for marketing-style or form chrome** — brittle; does not catch board integrity or claim races. Prefer API/DB assertions. (Source: cost × signal + Q5.)
- **Provider capacity / rate-limit avoidance itself** — observability and quotas, not a product assertion; do test that limit/provider failures are not treated as success (Risk #2). (Source: interview Q2 challenger pass.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-06 (Risk #9 added: guaranteed custom phrase missing from board; Phase 1 status → done; stack + cookbook §6.1/6.2/6.4/6.5 filled)
- Stack versions last verified: 2026-10-06 (Vitest ^5.0.3)
- AI-native tool references last verified: 2026-10-06 (none planned)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
