---
change_id: gm-create-session-board
title: Gm create session board
status: implementing
created: 2026-09-27
updated: 2026-09-27
archived_at: null
---

## Notes

- **Phase 1 adaptation (user):** No DB RPC / no BL in Postgres. `create_session_with_cells` removed from the migration. Phase 2 `sessions.service` will insert `sessions` then `board_cells` via supabase-js. No owner `DELETE` policy (still deferred to S-05); a failed cell insert after session insert can leave a rare orphan session with 0 cells.
- Migration: `20260927143000_sessions_and_board_cells.sql` applied via human-approved `npx supabase db push` (never reset).
- Types: `npx supabase gen types typescript --linked --schema public` → `src/db/database.types.ts` (eslint-ignored as generated).
- RLS/anon checks: SELECT returns `[]`; INSERT rejected with `42501`.
