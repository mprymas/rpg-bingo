# Seed Phrase Reward Catalog Implementation Plan

## Overview

Land the F-01 data contract: predefined RPG phrase pool and admin reward catalog in Supabase (schema + RLS + Polish seed), so S-01 can later draw bingo boards. No session/board schema and no application TypeScript in this change.

## Current State Analysis

- Supabase is wired for auth only (`src/lib/supabase.ts`); no `public` app tables, no `src/types.ts`, no PostgREST usage.
- `supabase/` has `config.toml` (Postgres 17, migrations enabled, `[db.seed]` already points at `./seed.sql`) but no `migrations/` directory and no `seed.sql` on disk.
- CI smoke runs local `supabase start` (Docker) for auth-only checks; it does not prove catalog rows. F-01 verification does **not** use Docker.
- Roadmap F-01 / PRD: MVP delivers catalogs via deploy-time seed (FR-016 admin UI parked); seed must support **>25** phrases for default 5×5; session/board persistence starts in S-01.
- No admin role in app code; middleware only attaches `locals.user`.
- Project already uses a hosted Supabase project for app secrets (`SUPABASE_URL` / `SUPABASE_KEY`); that project is the apply + verify target for this change.

## Desired End State

On the **hosted** Supabase project (same project the app already points at), tables `phrases` and `rewards` exist with RLS allowing `SELECT` for `anon` and `authenticated`, and seed rows are present (≥26 distinct Polish phrases; a small reward set with slug/label/description). S-01 can query catalogs without inventing the data model. No local Docker database is required for F-01.

### Key Discoveries:

- Seed path already configured: `supabase/config.toml` `[db.seed] sql_paths = ["./seed.sql"]` — file missing until Phase 2; used as the canonical INSERT script to run once on hosted SQL (not via `db reset`).
- Migration/RLS convention: `CLAUDE.md` / `AGENTS.md` — `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`, RLS on, granular per-operation per-role policies.
- Prod schema changes need human approval; Workers rollback does not revert Supabase migrations (`context/foundation/infrastructure.md`).
- Anon SELECT on catalogs is intentional (decision): board flow may use the anon key; scrapeability of the phrase bank is accepted for MVP scale.

## What We're NOT Doing

- Session, board, cell, or claim tables (S-01+)
- MG custom phrases per session (S-01)
- Admin UI for phrases/rewards (FR-016)
- Category / game-system columns or filters (FR-017)
- Custom MG rewards (FR-015) or team rewards (FR-014)
- Any changes under `src/` (types, helpers, API, UI)
- Automatic CI `db push` / seed on deploy
- Service-role write paths or admin role modeling in Auth
- Local Docker / `npx supabase start` / `npx supabase db reset` as the F-01 verify path

## Implementation Approach

One migration owns DDL + RLS for two catalogs. Content lives in `seed.sql` so phrase/reward edits do not churn migration history. Apply and verify against the **hosted** Supabase project (SQL editor and/or `supabase db push` after `supabase link`, with human approval). App code stays untouched; first TypeScript reads belong to S-01.

## Critical Implementation Details

**Never `db reset` on hosted/production.** `supabase db reset` drops and recreates the database (including `auth.users`). Verification must use additive apply only: run the migration SQL, then run seed INSERTs once.

**Hosted = test for this MVP.** There is no separate local DB. A bad migration still needs careful review before apply; prefer running the migration file contents in the SQL editor (or `db push`) after a human read-through. If a second free Supabase project is created later, point verify there instead — not required for F-01.

**Seed file dual role:** Keep `supabase/seed.sql` in-repo as the canonical content script (matches `config.toml` for anyone who later uses local reset). For F-01, execute that script once against hosted SQL after the migration lands.

**CI:** Do not assume CI smoke proves catalog rows; out of scope to change CI for F-01.

---

## Phase 1: Schema + RLS

### Overview

Create `phrases` and `rewards` tables and enable read-only RLS for `anon` and `authenticated` on the hosted project.

### Changes Required:

#### 1. Catalog migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_phrases_and_rewards.sql` (timestamp at implement time)

**Intent**: Introduce the two catalog tables and RLS so seeded rows are readable by the existing anon and user-scoped Supabase clients without allowing client writes.

**Contract**:
- Table `phrases`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `text text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, `UNIQUE (text)`.
- Table `rewards`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `slug text NOT NULL`, `label text NOT NULL`, `description text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, `UNIQUE (slug)`.
- `ENABLE ROW LEVEL SECURITY` on both tables.
- Policies: `SELECT` for role `anon` and role `authenticated` on both tables (separate policies per role per table). No INSERT/UPDATE/DELETE policies for those roles.
- No category columns. No FK to `auth.users`.
- Apply to hosted project only after human approval (Dashboard SQL editor paste of the migration, or linked `supabase db push` — never `db reset`).

### Success Criteria:

#### Automated Verification:

- Migration SQL applies on the hosted project without error (SQL editor or `db push`)
- Tables `public.phrases` and `public.rewards` exist with the columns and unique constraints above
- Anon key can `SELECT` from both tables; anon key cannot `INSERT` into either table

#### Manual Verification:

- Spot-check policy names/roles in the Supabase Dashboard (Authentication/SQL → policies) after apply

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Seed content

### Overview

Add Polish catalog rows via `supabase/seed.sql`, review wording, then run the script once on the hosted project.

### Changes Required:

#### 1. Seed file

**File**: `supabase/seed.sql`

**Intent**: Populate catalogs so a default 5×5 board has enough predefined phrases and MG can later pick rewards from a stable list (slug + display label + short description).

**Contract**:
- Insert **≥26** distinct Polish RPG-flavored phrase strings into `phrases(text)`.
- Insert **~5–8** rewards into `rewards(slug, label, description)`, including at least the PRD examples (inspiracja / przedmiot / zadanie poboczne) with meaningful Polish labels and short descriptions; stable English or kebab `slug` values.
- Plain `INSERT` assuming empty catalog tables (one-time apply on hosted). Do not design for repeated `db reset`.
- Human reviews and may edit wording before the hosted run; implementer drafts the first full set.
- Execute once on hosted SQL after Phase 1; if re-run is needed, clear catalog rows deliberately or switch to upserts — default is one-shot INSERT.

### Success Criteria:

#### Automated Verification:

- After hosted seed apply, `SELECT count(*) FROM phrases` ≥ 26
- After hosted seed apply, `SELECT count(*) FROM rewards` ≥ 3
- `phrases.text` and `rewards.slug` have no duplicates

#### Manual Verification:

- Human reviews phrase tone and reward labels/descriptions for table-fit; edits allowed in the same PR before the hosted seed run

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Verify + apply notes

### Overview

Confirm hosted catalogs end-to-end and record the apply/verify runbook in change notes; keep `src/` clean.

### Changes Required:

#### 1. Hosted apply notes

**File**: `context/changes/seed-phrase-reward-catalog/change.md` (`## Notes`)

**Intent**: Record how schema + seed were applied on the hosted project and the hard rule against `db reset`, so future changes do not wipe auth or double-seed blindly.

**Contract**: Notes include: (1) hosted project is the F-01 verify target (no Docker); (2) never run `supabase db reset` against hosted; (3) apply migration then run `seed.sql` once; (4) count/RLS checks used; (5) CI does not auto-seed today; (6) no `src/` files in this change.

### Success Criteria:

#### Automated Verification:

- `git status` / diff shows no modifications under `src/`
- Hosted DB still has phrases ≥ 26 and rewards ≥ 3 after Phase 1–2 apply

#### Manual Verification:

- Notes in `change.md` are clear enough for a future apply without re-deriving the process
- Optional: anon REST or SQL client `SELECT` returns seeded rows from hosted

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

- None — no application unit test runner for SQL; rely on hosted SQL assertions.

### Integration Tests:

- Hosted: apply migration + seed, then count/uniqueness/RLS queries (Phase 1–2 automated criteria).
- Do not extend `scripts/smoke.mjs` in this change.
- Do not require Docker for F-01.

### Manual Testing Steps:

1. Human-approve and apply migration SQL on hosted Supabase (Dashboard or linked `db push` — not `db reset`).
2. Review `seed.sql`, then run it once on hosted SQL.
3. Confirm phrase count ≥ 26 and reward count ≥ 3; skim several phrases for language quality.
4. Attempt INSERT as anon (expect failure); SELECT as anon (expect success).
5. Review `change.md` Notes for the runbook and the `db reset` ban.

## Performance Considerations

Catalogs are small (tens of rows). No indexes beyond PK/unique are required for MVP.

## Migration Notes

- First app migrations: expand-only (new tables). Safe relative to current auth-only production, but irreversible without a careful DROP — review SQL before apply.
- Seed is not versioned as a migration; re-running plain INSERT on a non-empty hosted DB will fail on unique constraints — treat as one-time.
- Workers `wrangler rollback` will not remove these tables; keep migrations backward-compatible by one version for future changes.
- Optional later: a separate free Supabase “dev” project if you want safer experimentation without Docker; not part of F-01.

## References

- PRD: `context/foundation/prd.md` (FR-005, FR-016 MVP seed, Business Logic, Open Q2 ≥25 phrases)
- Roadmap: `context/foundation/roadmap.md` (F-01)
- Infra: `context/foundation/infrastructure.md` (migration rollback coupling, human approval for prod schema)
- Conventions: `CLAUDE.md`, `AGENTS.md` (migration naming, RLS)
- Config: `supabase/config.toml` (`[db.seed]` → `./seed.sql`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema + RLS

#### Automated

- [x] 1.1 Migration SQL applies on the hosted project without error (SQL editor or `db push`) — a58b05f
- [x] 1.2 Tables `public.phrases` and `public.rewards` exist with the columns and unique constraints above — a58b05f
- [x] 1.3 Anon key can `SELECT` from both tables; anon key cannot `INSERT` into either table — a58b05f

#### Manual

- [x] 1.4 Spot-check policy names/roles in the Supabase Dashboard (Authentication/SQL → policies) after apply — a58b05f

### Phase 2: Seed content

#### Automated

- [x] 2.1 After hosted seed apply, `SELECT count(*) FROM phrases` ≥ 26
- [x] 2.2 After hosted seed apply, `SELECT count(*) FROM rewards` ≥ 3
- [x] 2.3 `phrases.text` and `rewards.slug` have no duplicates

#### Manual

- [x] 2.4 Human reviews phrase tone and reward labels/descriptions for table-fit; edits allowed in the same PR before the hosted seed run

### Phase 3: Verify + apply notes

#### Automated

- [ ] 3.1 `git status` / diff shows no modifications under `src/`
- [ ] 3.2 Hosted DB still has phrases ≥ 26 and rewards ≥ 3 after Phase 1–2 apply

#### Manual

- [ ] 3.3 Notes in `change.md` are clear enough for a future apply without re-deriving the process
- [ ] 3.4 Optional: anon REST or SQL client `SELECT` returns seeded rows from hosted
