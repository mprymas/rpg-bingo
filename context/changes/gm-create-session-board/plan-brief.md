# GM Create Session Board — Plan Brief

> Full plan: `context/changes/gm-create-session-board/plan.md`

## What & Why

A signed-in Mistrz Gry creates a bingo session — board size, custom phrases (each optionally guaranteed a spot), reward types with counts — the system draws an N×N board from the seeded catalog plus the MG's phrases, persists it, and hands back a 6-character session code with a board preview. This is roadmap slice S-01: the first slice that writes application data and the prerequisite for players joining (S-02), claiming cells (S-03) and regenerating boards (S-05).

## Starting Point

Auth works end to end and the F-01 catalogs (`phrases` ×32, `rewards` ×6) sit on the hosted Supabase project, but nothing in `src/` reads the database: no `src/types.ts`, no services, no non-auth API route, English starter copy throughout. The hosted project is the only database; CI smoke boots a local Supabase that applies migrations + seed.

## Desired End State

Dashboard → **Nowa sesja** → form with defaults (5×5, Inspiracja ×3) → **Generuj planszę** → `/sessions/<id>` showing a big code like `K7MX4P`, the grid with phrases and reward badges, and a legend. The dashboard lists the MG's sessions. `sessions` and `board_cells` rows exist and are readable only by their owner. Every screen is Polish. `npm run smoke` covers the create flow.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Entity model | One `sessions` row = one board + one code; cells as rows in `board_cells`; S-05 regenerate creates a new session | Per-cell rows let S-03 claim atomically; no campaign grouping surfaces in MVP |
| Session code | 6 uppercase chars from a 32-symbol alphabet without `0/O/1/I`, Web Crypto | ~1e9 codes meets the < 1/100 000 guessing NFR with margin and reads aloud unambiguously |
| Custom phrases | Each custom phrase has a "gwarantowane na planszy" checkbox; checked ones always land on the board (max = cells of chosen size), unchecked join the random pool with predefined | MG controls which tonight's phrases must appear without losing catalog surprise |
| Board sizes | 3×3, 4×4, 5×5 (default 5×5); pool shortage → validation error naming the missing count | 32 seeded phrases always cover 25 cells; the error is a safety net (PRD Open Q2 stays open for larger boards) |
| Default rewards | Inspiracja ×3, all others ×0 | Mirrors the PRD's core case; 3 rewards on 25 cells keeps them scarce |
| "Active" session | `status` column (`active`/`closed`), default `active`, no expiry; nothing closes it in S-01 | Trivially satisfies the ≥ 8 h NFR; explicit state for S-05 |
| MG view | `/sessions/<id>` with code, board preview, legend; dashboard gets "Nowa sesja" + session list | MG sanity-checks the board before reading the code aloud; page becomes the S-03/S-04 control surface |
| UI language | Polish everywhere, including existing auth/landing screens; Supabase error strings pass through | Polish table, Polish catalog; one consistent app |
| Verification | Extend `scripts/smoke.mjs` (no unit runner) + manual board review | Runs in CI against real Supabase with zero new tooling |
| Atomic insert (plan-derived) | `SECURITY INVOKER` RPC `create_session_with_cells` inserts session + cells in one transaction; retry on code collision | No orphan sessions and no `DELETE` policy needed |
| API shape (plan-derived) | JSON `POST /api/sessions` validated with zod → `201 { id, code }`; React island posts and shows errors inline | Dynamic rows + checkboxes need an island; inline errors keep the MG's input |

## Scope

**In scope:**
- Migration: `sessions`, `board_cells`, owner-only RLS for `authenticated`, RPC; pushed to hosted (human-approved)
- `src/db/database.types.ts`, `src/types.ts`, `zod` dependency
- `session-code.ts`, `board-generator.ts`, `sessions.service.ts`, `schemas/session.ts`, `POST /api/sessions`
- `/sessions/new` (island form), `/sessions/[id]` (board preview), dashboard list, `/sessions` protected
- Polish copy across layout, landing, topbar, auth pages/forms, API messages
- Smoke steps for the create flow; runbook in `change.md`

**Out of scope:**
- Player join / any `anon` read path (S-02), claims (S-03), undo (S-04), regenerate or `UPDATE`/`DELETE` policies (S-05)
- Session TTL, sizes > 5×5, free centre cell, team/custom rewards, category filters, admin UI
- Persisting MG custom phrases for reuse; translating Supabase-originated errors; adding a unit-test runner; CI workflow changes

## Architecture / Approach

Browser island (`NewSessionForm`) → JSON `POST /api/sessions` → zod → `sessions.service.createSession` (reads `phrases`/`rewards`, runs pure `generateBoard`, draws a code) → `supabase.rpc("create_session_with_cells")` as the signed-in user (RLS `gm_id = auth.uid()`) → `201 { id, code }` → `/sessions/<id>` renders session + cells (joined with reward labels) via static Astro. Middleware protects `/sessions/*`; the API checks `locals.user` itself.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema, RPC & types | Migration on hosted, generated DB types, `src/types.ts`, `zod` | Hosted is production: SQL must be reviewed before push; types can only be generated after push |
| 2. Generation domain & API | Code + board generators, service, validated `POST /api/sessions` | Dedupe/guaranteed/reward rules mis-encoded — checked by SQL counts and manual board review |
| 3. MG UI | Create form island, session page, dashboard list, route protection | 5×5 grid readability on a phone; dynamic Tailwind grid classes |
| 4. Polish copy, smoke & runbook | All screens Polish, smoke covers create flow, runbook notes | Copy changes must not alter routes/field names smoke relies on |

**Prerequisites:** F-01 catalogs present on hosted (done); Supabase CLI linked and logged in for `db push` / `gen types`; human approval for the push.
**Estimated effort:** ~4–5 after-hours sessions, one per phase (Phase 3 may take two).

## Open Risks & Assumptions

- Guaranteed-phrase cap is interpreted as "cells of the chosen size" (25 / 16 / 9), not a flat 25 — confirm if a flat 25 was intended.
- `supabase gen types --linked` needs a logged-in CLI; if unavailable at implement time, hand-write the `Database` type for the four tables + RPC and note it.
- S-02 will need a player read path for `sessions`/`board_cells`; this plan deliberately adds no `anon` policies, so S-02 must add its own (policy or function by `code`).
- `POOL_TOO_SMALL` is unreachable with today's catalog at ≤ 5×5; it is verified by code review, not by a live case.
- Polish copy pass touches auth components; smoke depends only on routes, field names and redirect targets, which stay unchanged.

## Success Criteria (Summary)

- An MG can go from dashboard to a generated 5×5 board with a 6-character code in one form submit, using only defaults.
- Guaranteed custom phrases always appear; phrases on a board are unique; rewards land on exactly Σcount cells; another MG gets `404` for the session.
- `npm run smoke` passes with the new create-flow steps, and every screen the MG sees is in Polish.
