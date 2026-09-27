<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Seed Phrase Reward Catalog

- **Plan**: context/changes/seed-phrase-reward-catalog/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-09-27
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Non-idempotent seed INSERT

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/seed.sql:3
- **Detail**: Plain `INSERT` assumes empty catalogs. Re-run fails on UNIQUE constraints. Matches plan contract; documented in change.md Notes (use UPDATE / avoid second full seed).
- **Fix**: Keep one-shot policy as documented. Only add `ON CONFLICT DO NOTHING` if re-runs become routine.
- **Decision**: FIXED — phrases ON CONFLICT DO NOTHING; rewards ON CONFLICT DO UPDATE

### F2 — Soft ban on hosted `db reset`

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: context/changes/seed-phrase-reward-catalog/change.md:17
- **Detail**: Hosted wipe risk is guarded by runbook text only (`config.toml` still wires `[db.seed]` for future local reset). Plan chose additive hosted apply; Notes make the ban prominent.
- **Fix**: No code change. Keep using `db push` / `db query --linked` only on hosted.
- **Decision**: ACCEPTED-AS-RULE: Never db reset on hosted Supabase

### F3 — Anon SELECT exposes full catalogs

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260927134220_phrases_and_rewards.sql:23
- **Detail**: `SELECT … USING (true)` for `anon`/`authenticated` is intentional per plan (board clients may use anon key; scrapeability accepted at MVP scale).
- **Fix**: No change for F-01. Revisit if catalogs become sensitive.
- **Decision**: SKIPPED
