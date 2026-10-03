---
date: 2026-10-03T10:36:17+02:00
researcher: Marcin
git_commit: ef4a8401c7012f0c1b735847781508d9aff7df5f
branch: master
repository: rpg-bingo
topic: "What exists and what is missing for a player to join by code and nickname and see the shared board"
tags: [research, codebase, sessions, board, rls, anon, player-join]
status: complete
last_updated: 2026-10-03
last_updated_by: Marcin
last_updated_note: Initial research for roadmap slice S-02
---

# Research: Player join shared board

**Date**: 2026-10-03T10:36:17+02:00
**Researcher**: Marcin
**Git Commit**: ef4a8401c7012f0c1b735847781508d9aff7df5f
**Branch**: master
**Repository**: rpg-bingo

Citations are working-tree `file:line` anchors. HEAD is `ef4a8401c7012f0c1b735847781508d9aff7df5f` on `master`. `git status` listed uncommitted edits on `BoardGrid.astro` and `src/pages/sessions/[id].astro`; `git diff --numstat` for those paths printed no hunks, so the sections read below matched the index. These are local anchors, not commit permalinks.

## Research Question

Roadmap slice S-02 (`player-join-shared-board`): what is already in this repo, and what is missing, for a player to join an active session with a code and a nickname, without an account, and see the shared board — current cell state, and which cells offer which reward?

## Summary

On the inspected paths, a logged-in Game Master can open `/sessions/{uuid}` and see the 6-character code, each cell phrase, and a reward label when `reward_id` is set. An unauthenticated visitor cannot. `PROTECTED_ROUTES` is `["/dashboard", "/sessions"]` (`src/middleware.ts:4`), and any path that `startsWith` one of those two prefixes redirects to `/auth/signin` when `locals.user` is null (`src/middleware.ts:18-21`).

`getSessionWithCells` loads one session by UUID and `gm_id` (`src/lib/services/sessions.service.ts:106-124`). The two SQL migrations on disk grant `anon` `SELECT` on `phrases` and `rewards`, and grant `sessions` / `board_cells` `SELECT` and `INSERT` to `authenticated` where `gm_id = auth.uid()`. Those migrations contain no `anon` policy on `sessions` or `board_cells`, no `players` table, and no nickname or claim columns. A search of `src/**/*.{ts,tsx,astro}` for `nickname`, `player`, `joinByCode`, and `getSessionByCode` returned no matches.

The SSR client is built with `SUPABASE_URL` and `SUPABASE_KEY` (`src/lib/supabase.ts:3-10`). `astro.config.mjs:21-22` declares those two secrets and no service-role name. README documents `SUPABASE_KEY` as the anon public key (`README.md:124`). A board read through this client is subject to RLS.

Settled for this slice: join without an account by code plus nickname (PRD FR-002, `context/foundation/prd.md:68`); show which cells carry which reward from the start (FR-010, `prd.md:88-89`); hide the board from someone without a valid code (`prd.md:137`). Claim, undo, and regenerate stay on later slices. How the nickname survives a refresh, which URL is public, and whether the 10-second refresh ships in S-02 or with the first claim writer (S-03) are open for `/10x-plan`.

## Detailed Findings

### Product contract this slice inherits

- S-02 outcome, as written: a player joins an active session by code and nickname without an account, and sees the shared board with current cell state and which cells offer which reward (`context/foundation/roadmap.md:124-128`). PRD refs on that slice are US-01, FR-002, FR-008, FR-010 (`roadmap.md:128`). Status in the roadmap table is `proposed` (`roadmap.md:51`). Prerequisite S-01 is `done` (`roadmap.md:50`).
- FR-002: join by code and nickname, no account, must-have (`context/foundation/prd.md:68`).
- FR-008: see the shared board and who occupies which cell, must-have (`prd.md:84`).
- FR-010: see which cells offer a reward and which reward, from the start, must-have (`prd.md:88-89`, repeated in business logic at `prd.md:121`).
- Access control for Gracz: no account; code plus nickname; identity lives inside that session; can see the shared board (`prd.md:133`). A person without a valid session code does not see the board (`prd.md:137`).
- The same Gracz row also lists marking a cell (`prd.md:133`). That action is S-03 (FR-009, FR-011), not this slice (`roadmap.md:137-143`).
- Non-goal: no player statistics or history across sessions, because there is no account (`prd.md:142`).
- NFR on this path: an outsider guessing codes hits an active session fewer than 1 time per 100,000 attempts (`prd.md:111`); a cell-state change is visible to other participants within 10 seconds without a manual refresh (`prd.md:112`); a 5×5 board is readable on a ~6 inch phone in portrait without zoom or scroll (`prd.md:113`); the session stays reachable by code for at least 8 hours from creation, across page refreshes and network drops (`prd.md:114`).
- Live push is a non-goal. The 10-second window stands in its place, and FR-013 stays nice-to-have outside the MVP (`prd.md:148`, parked at `roadmap.md:208`). `context/foundation/tech-stack.md:24` names polling as the refresh mechanism and leaves Supabase Realtime off unless FR-013 is promoted.
- US-01 acceptance and the S-03 outcome both say other people see an occupied cell after a refresh (`prd.md:60`, `roadmap.md:140`). That wording does not name polling. The polling sentence is in `tech-stack.md:24`.

### GM board that exists today

- After a 201 from create, the browser assigns `/sessions/${data.id}` using the session UUID (`src/components/hooks/useCreateSession.ts:19-22`). The dashboard list links to `/sessions/${session.id}` (`src/components/dashboard/DashboardPanel.astro:51-52`).
- When `Astro.params.id` fails the UUID regex, `[id].astro:16-18` sets HTTP 404 and does not enter the branch that queries Supabase.
- The page redirects to `/auth/signin` when `Astro.locals.user` is missing (`[id].astro:25-28`), then calls `getSessionWithCells(supabase, id, user.id)` (`[id].astro:31`). A null result is HTTP 404 (`[id].astro:32-35`). A thrown error sets HTTP 503 and the copy `Nie udało się wczytać sesji` (`[id].astro:36-38`), which matches the lesson at `context/foundation/lessons.md:12-16` on this page.
- The success shell shows `session.code` with `aria-label="Kod sesji"` (`[id].astro:110-115`), size, a status badge, and a created timestamp (`[id].astro:116-122`), then `BoardGrid` when the cell count equals `size²`.
- `BoardGrid.astro:20-27` renders `cell.phrase` and, when `cell.reward` is set, `cell.reward.label`. The component has no claimant text and no click handler.
- `SessionWithCells` is the session row plus cells with `reward: { slug, label } | null` (`src/types.ts:45-49`). Generated `board_cells.Row` fields in `src/db/database.types.ts` are `id`, `phrase`, `position`, `reward_id`, `session_id`.
- `src/pages/sessions/board/kitchen-sink.astro:6-8` returns HTTP 404 when `import.meta.env.PROD`, and the file includes a `closed` fixture (`kitchen-sink.astro:89`, `kitchen-sink.astro:121-124`). When `locals.user` is null, middleware redirects that `/sessions/...` path to `/auth/signin` before the page runs (`src/middleware.ts:18-21`).

### Auth and the client that would read a board

- Middleware builds the SSR client, sets `locals.user` from `getUser()`, and redirects unauthenticated requests whose pathname starts with `/dashboard` or `/sessions` (`src/middleware.ts:4-21`).
- `POST /api/sessions` returns 401 `{ error: "Wymagane logowanie" }` when `locals.user` is missing (`src/pages/api/sessions/index.ts:21-25`). Smoke expects that 401 and expects `GET /sessions/new` from an anonymous client to 302 to `/auth/signin` (`scripts/smoke.mjs:98-107`).
- `createClient` returns null when either env value is missing, otherwise `createServerClient` with the cookie header (`src/lib/supabase.ts:6-21`). No second client and no service-role argument appear in that file.
- Env schema secrets in this config are `SUPABASE_URL` and `SUPABASE_KEY` (`astro.config.mjs:21-22`). README labels `SUPABASE_KEY` as the anon public key (`README.md:124`). This pass did not read `.env` or Workers secrets, so the deployed key value was not confirmed against the README label.
- Catalog `SELECT` for `anon` is granted: `rewards_select_anon` and `phrases_select_anon` use `USING (true)` (`supabase/migrations/20260927134220_phrases_and_rewards.sql:23-39`). A nested `reward:rewards(slug, label)` still requires the parent `sessions` / `board_cells` row to be visible. Those parent policies are `TO authenticated` (`20260927143000_sessions_and_board_cells.sql:29-65`).

### Schema and query shape

`public.sessions` columns in the S-01 migration: `id`, `gm_id`, `code` (unique, check `^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$`), `size` (3–5), `status` (`active` or `closed`, default `active`), `created_at` (`20260927143000_sessions_and_board_cells.sql:4-10`).

`public.board_cells` columns in that same file: `id`, `session_id`, `position` (`>= 0`), `phrase`, `reward_id` (`sql:16-23`). Unique pairs are `(session_id, position)` and `(session_id, phrase)`.

Policies in that file, each `TO authenticated`: `sessions_select_authenticated` and `sessions_insert_authenticated` with `gm_id = auth.uid()` (`sql:29-39`); `board_cells_select_authenticated` and `board_cells_insert_authenticated` with an `EXISTS` on the owning session (`sql:41-65`). The file header says there is no anon policy and no `UPDATE` or `DELETE` policy (`sql:1-2`). A search of `supabase/**/*.sql` for `CREATE POLICY` returned eight policies: those four, plus `phrases_select_anon`, `phrases_select_authenticated`, `rewards_select_anon`, and `rewards_select_authenticated`.

`getSessionWithCells` filters `.eq("id", id)` and `.eq("gm_id", gmId)` and embeds `board_cells` plus `rewards ( slug, label )` (`src/lib/services/sessions.service.ts:111-124`). A search of `src/**/*.{ts,tsx,astro}` for `.eq("code"` returned no matches. The same glob search for `nickname`, `player`, `joinByCode`, and `getSessionByCode` also returned no matches.

`createSession` inserts the session row, then the cell rows, through the user-scoped client (`sessions.service.ts:60-84`). That file contains no `.rpc(` call. `status: "closed"` appears in `src/` as a TypeScript union (`src/types.ts:8`) and as kitchen-sink fixtures (`dashboard/kitchen-sink.astro:23`, `sessions/board/kitchen-sink.astro:89`). No `.update(` call and no `status: "closed"` write showed up in `src/**/*.{ts,tsx,astro}` outside those fixtures.

### Code space versus the guessing NFR

Inputs on the inspected generator: `SESSION_CODE_ALPHABET` is the 32-character string `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`src/lib/services/session-code.ts:3`); `SESSION_CODE_LENGTH` is 6 (`src/types.ts:12`); each byte is reduced with `byte & 31` (`session-code.ts:11-12`). A uniform byte has 256 values and 256 is divisible by 32, so `byte & 31` is uniform on 0..31 and matches that alphabet length.

Distinct codes under those inputs: 32^6 = 1,073,741,824 (32^4 = 1,048,576, and 1,048,576 × 1,024 = 1,073,741,824).

The NFR counts successes, not the size of the space: fewer than 1 hit per 100,000 attempts (`prd.md:111`). For exactly one active code, and for guesses that are independent and uniform over that 1,073,741,824-code set, the expected number of hits in 100,000 attempts is 100,000 / 1,073,741,824, which is less than 1. For N distinct active codes under the same guess model, the expected count is N × 100,000 / 1,073,741,824. That product stays below 1 for N ≤ 10,737 (10,737 × 100,000 = 1,073,700,000, which is less than 1,073,741,824) and is at least 1 for N = 10,738 (1,073,800,000). This is arithmetic from the alphabet and the NFR text. This pass did not measure live guess traffic or count active rows on hosted Supabase.

## Code References

- `src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard", "/sessions"]`
- `src/middleware.ts:18-21` — unauthenticated prefix redirect to `/auth/signin`
- `src/pages/sessions/[id].astro:9-38` — UUID gate, auth redirect, 404, 503
- `src/pages/sessions/[id].astro:110-127` — code, meta, `BoardGrid`
- `src/components/sessions/BoardGrid.astro:20-27` — phrase and reward label
- `src/lib/services/sessions.service.ts:60-84` — two-step insert, no RPC
- `src/lib/services/sessions.service.ts:106-124` — read by UUID and `gm_id`
- `src/lib/services/session-code.ts:3-14` — 32-symbol alphabet, length 6
- `src/lib/supabase.ts:6-21` — cookie SSR client, two env vars
- `supabase/migrations/20260927143000_sessions_and_board_cells.sql:4-65` — tables and four authenticated policies
- `supabase/migrations/20260927134220_phrases_and_rewards.sql:35-39` — `rewards_select_anon`
- `src/pages/api/sessions/index.ts:21-25` — anonymous POST returns 401
- `context/foundation/prd.md:68` — FR-002
- `context/foundation/prd.md:84` — FR-008
- `context/foundation/prd.md:88-89` — FR-010
- `context/foundation/prd.md:111-114` — guessing, 10 s, phone, 8 h
- `context/foundation/roadmap.md:124-128` — S-02 outcome

## Architecture Insights

The GM page is static Astro SSR. `BoardGrid` is presentational and already shows phrase plus reward label, which is the FR-010 content. It does not know about a player.

The read path is owner-scoped in two places: RLS `gm_id = auth.uid()` and `.eq("gm_id", gmId)` in the service. Dropping the service filter would still hide rows from an `anon` client, because the inspected `sessions` and `board_cells` policies are `TO authenticated`.

S-01 left the player read as a later choice of policy or function keyed by `code` (`context/archive/2026-09-27-gm-create-session-board/plan.md:385`, `plan-brief.md:68`). The current server client cannot skip RLS: it uses the anon-key client (`src/lib/supabase.ts:10`, `README.md:124`) and the env schema has no service-role field (`astro.config.mjs:21-22`). A player read therefore needs a new `anon`-executable policy or function, or a new privileged client that this app does not have.

Any new public URL under `/sessions` is caught by `startsWith("/sessions")` (`src/middleware.ts:18`). A join page on that prefix redirects anonymous users before the page runs.

Cell phrases are copied onto `board_cells.phrase` (`sql:20`). Showing the board does not require `anon` access to `phrases`. Reward labels do require the parent row to be visible; `rewards` itself is already readable by `anon`.

## Historical Context (from prior changes)

Each claim is scored against the files read in this pass.

- **Supported.** S-01 out of scope lists player join and any `anon` read of `sessions` / `board_cells` (`context/archive/2026-09-27-gm-create-session-board/plan-brief.md:43-44`, `plan.md:32`). The migration still has no `anon` policy on those tables (`20260927143000_sessions_and_board_cells.sql:29-65`).
- **Supported.** S-02 must add its own read path by `code`; S-01 adds none (`plan-brief.md:68`, `plan.md:385`). No by-code query was found in `src/` under the search above.
- **Supported.** Session code is 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`plan-brief.md:22`, migration check at `sql:7`, generator at `session-code.ts:3-5`).
- **Supported as an order of magnitude, for one active code.** `plan-brief.md:22` says ~1e9 codes meets the `< 1/100 000` NFR. The exact space on the current alphabet and length is 1,073,741,824. The single-active-code expectation is below 1 hit per 100,000 uniform attempts, as calculated above. The plan sentence does not state the multi-session bound (N ≤ 10,737 under that same model).
- **Contradicted.** `plan.md:50` and `plan.md:378` describe create as one `SECURITY INVOKER` RPC `create_session_with_cells`. `sessions.service.ts:60-84` inserts `sessions` and then `board_cells` with the supabase client, and the file has no `.rpc(` call. The archive `change.md` already records that adaptation; the plan paragraphs were not updated. Treat the two inserts as the current writer.
- **Supported as a document, not re-run.** Archive `change.md` records anon `SELECT` on `sessions` / `board_cells` returning `[]` and `INSERT` rejected with `42501`. This pass did not open a database connection, so that hosted result is not re-verified. The migration text is consistent with a deny for `anon`.
- **Partial, and the pixels have moved.** `context/archive/2026-10-01-ui-session-board/research.md` says `[id].astro` and `BoardGrid.astro` still use the cosmic palette and that no board kitchen-sink exists. Current `BoardGrid.astro:20-26` and `[id].astro:101-102` use role classes (`border-border`, `bg-card`, `bg-background`), and `src/pages/sessions/board/kitchen-sink.astro:6-8` exists with a production 404. The older audit describes the tree before that UI change.
- **Supported as a warning, thin as a rule.** `context/foundation/lessons.md:5-8` warns that `supabase db reset` on the linked project drops `auth.users`. The **Rule** and **Applies to** lines in that entry are empty. The non-2xx branded-error lesson (`lessons.md:12-16`) is already applied on the GM session page (`[id].astro:32-38`).

## Related Research

- `context/archive/2026-10-01-ui-session-board/research.md` — GM board UI audit. Visual charges in that file do not describe the current `BoardGrid` / `[id].astro` classes; see Historical Context.
- `context/archive/2026-09-27-gm-create-session-board/` — plan, plan-brief, change, impl-review. No `research.md` in that folder.
- No other `research.md` under `context/changes/` besides this file.

## Open Questions

These are product or design choices. The code evidence above does not pick them.

1. **Nickname across refresh.** FR-002 and the access-control row give the player a nickname that exists inside one session (`prd.md:68`, `prd.md:133`). The 8-hour NFR says the board stays reachable by code across refreshes (`prd.md:114`). No column, cookie, or local store for a nickname exists in the inspected schema or `src/`. Where that nickname is kept is undecided.
2. **Public URL versus the `/sessions` prefix.** When `locals.user` is null and `pathname.startsWith("/sessions")`, middleware returns a redirect to `/auth/signin` and does not call `next()` (`src/middleware.ts:4`, `src/middleware.ts:18-21`). A join page on that prefix therefore does not run for an anonymous player unless that predicate changes. The concrete path is undecided.
3. **Who occupies a cell, and the 10-second refresh.** FR-008 is in the S-02 refs (`roadmap.md:128`) and asks who occupies which cell (`prd.md:84`). The inspected `board_cells` columns have no claimant (`sql:16-21`). `plan.md:385` assigns claim columns to S-03. Until those columns and a writer exist, a refresh rereads the same phrases and rewards. `tech-stack.md:24` names polling, not websockets, for the 10-second NFR (`prd.md:112`). Whether that loop is built in S-02 or with S-03 is undecided.
4. **Closed sessions.** `status` allows `closed` (`sql:9`), and the GM page labels it (`[id].astro:42`). This inspected app has no `UPDATE` policy and no writer that sets `closed`. What a join does when `status` is `closed` is unspecified.
5. **Hosted schema drift.** Findings are from the two migration files and the generated types in the working tree. This pass did not query the linked database.
