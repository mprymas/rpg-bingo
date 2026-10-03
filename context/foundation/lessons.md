# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Never db reset on hosted Supabase

- **Context**: `context/changes/seed-phrase-reward-catalog/change.md:17`
- **Problem**: Hosted wipe risk is guarded by a soft runbook ban only. `supabase db reset` against the linked project would drop `auth.users` and all data; `[db.seed]` in config.toml would re-seed after wipe.
- **Rule**: 
- **Applies to**: 

## Prefer non-2xx status with branded Layout error UI

- **Context**: `src/pages/sessions/new/index.astro` (SSR pages that render Layout on data-load failure)
- **Problem**: Catalog load failure showed a branded Layout error but stayed HTTP 200, so monitors/CDNs treat the request as success while siblings use non-2xx for hard failures.
- **Rule**: When an SSR page renders a branded error UI for a failed data load, set a non-2xx status (e.g. `Astro.response.status = 503`) instead of leaving HTTP 200.
- **Applies to**: implement, impl-review

## Show a loader on navigation form submit

- **Context**: forms
- **Problem**: użytkownik nie widzi, że coś się dzieje
- **Rule**: after clicking button/ submit on a navigation form, show a loader
- **Applies to**: implement
