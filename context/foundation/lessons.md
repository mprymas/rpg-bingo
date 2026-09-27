# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Never db reset on hosted Supabase

- **Context**: `context/changes/seed-phrase-reward-catalog/change.md:17`
- **Problem**: Hosted wipe risk is guarded by a soft runbook ban only. `supabase db reset` against the linked project would drop `auth.users` and all data; `[db.seed]` in config.toml would re-seed after wipe.
- **Rule**: 
- **Applies to**: 
