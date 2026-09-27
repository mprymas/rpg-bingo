---
change_id: seed-phrase-reward-catalog
title: Seed phrase reward catalog
status: implementing
created: 2026-09-27
updated: 2026-09-27
archived_at: null
---

## Notes

### F-01 verify target

- The **hosted** Supabase project is the F-01 apply + verify target. There is no Docker / local Supabase path for this change.
- Linked project: `ecatwonofbmztxxgmeqb` (name `rpg-bingo`) — same project the app secrets (`SUPABASE_URL` / `SUPABASE_KEY`) already point at.

### Hard rule: never `db reset` on hosted

**Never run `supabase db reset` (or any reset that drops/recreates the DB) against the hosted project.** That wipes `auth.users` and all data. F-01 apply is additive only: migration, then seed once.

### Hosted apply runbook (Phases 1–2)

1. **Human-approve** the migration SQL, then push schema (never reset):

   ```bash
   npx supabase db push
   ```

   Applied file: `supabase/migrations/20260927134220_phrases_and_rewards.sql`.

2. **Run seed once** against the linked hosted DB:

   ```bash
   npx supabase db query --linked -f supabase/seed.sql
   ```

   Do not re-run plain INSERT seed on a non-empty catalog — unique constraints on `phrases.text` / `rewards.slug` will fail. Content edits after the initial seed should use targeted `UPDATE` (or a new migration), not a second full seed.

3. **Typo fixes** (after initial seed) were applied as hosted `UPDATE`s: zwierzę, improwizowanej, Wprowadzenie.

### Count / uniqueness checks used

After seed + typo fixes:

```sql
SELECT count(*) AS phrases_count FROM public.phrases;
SELECT count(*) AS rewards_count FROM public.rewards;
-- Expect: phrases_count = 32, rewards_count = 6
-- No duplicate text / slug (UNIQUE constraints hold)
```

Success bar for F-01: phrases ≥ 26, rewards ≥ 3.

### RLS checks used

- Anon `SELECT` on `phrases` / `rewards` → **200** (rows readable).
- Anon `INSERT` on either table → rejected with Postgres **42501** (RLS).

### CI / app code

- CI does **not** auto-seed today (smoke stays auth-only; no catalog row proof in CI).
- This change has **no `src/` files** — schema + seed + notes only. First TypeScript catalog reads belong to S-01.
