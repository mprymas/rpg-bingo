---
change_id: gm-create-session-board
title: Gm create session board
status: impl_reviewed
created: 2026-09-27
updated: 2026-09-27
archived_at: null
---

## Notes

- **Phase 1 adaptation (user):** No DB RPC / no BL in Postgres. `create_session_with_cells` removed from the migration. Phase 2 `sessions.service` will insert `sessions` then `board_cells` via supabase-js. No owner `DELETE` policy (still deferred to S-05); a failed cell insert after session insert can leave a rare orphan session with 0 cells.
- Migration: `20260927143000_sessions_and_board_cells.sql` applied via human-approved `npx supabase db push` (never reset).
- Types: `npx supabase gen types typescript --linked --schema public` → `src/db/database.types.ts` (eslint-ignored as generated).
- RLS/anon checks: SELECT returns `[]`; INSERT rejected with `42501`.

### Schema apply & types (hosted)

- Apply migrations with human-approved `npx supabase db push` against the linked project. **Never** `supabase db reset` on hosted (wipe risk).
- After every migration: `npx supabase gen types typescript --linked --schema public > src/db/database.types.ts`.
- Anon RLS sanity: unauthenticated SELECT on `sessions` / `board_cells` → `[]`; INSERT → Postgres `42501`.

### Smoke (create flow)

- `scripts/smoke.mjs` covers: anonymous `POST /api/sessions` → 401; anonymous `GET /sessions/new` → 302 `/auth/signin`; signed-in create → 201 with 6-char code charset; owner `GET /sessions/:id` → 200; after sign-out → 302 `/auth/signin`.

### Decision summary

- Single `sessions` entity (no separate board table); join code 6 chars from alphabet without ambiguous glyphs; guaranteed phrases via checkbox; board sizes 3–5; default seed includes Inspiracja ×3; session lifecycle via `status` only; UI Polish everywhere.

### Known gaps (MVP)

- RLS on `board_cells` INSERT is ownership-only; `position` has no upper bound vs `sessions.size`. The app path (`generateBoard` + service) is the intended writer. An authenticated client could still insert odd cells on own sessions via PostgREST until a later CHECK/trigger lands.
