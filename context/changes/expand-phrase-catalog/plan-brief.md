# Expand Phrase Catalog — Plan Brief

> Full plan: `context/changes/expand-phrase-catalog/plan.md`

## What & Why

The staged backlog is ready to join the predefined catalog. New boards draw from `phrases`, and the create-session form lists every `rewards` row. This batch adds the seven parked phrases and the one parked reward, using the words already written in staging.

## Starting Point

`supabase/seed.sql` has 32 phrases and 6 rewards. Inserts are safe to re-run: phrases skip a duplicate `text`, rewards upsert label and description by slug. The ideas files hold seven phrases and one reward (`talia-rozmaitosci`). The app reads the hosted project; CI loads the seed only on a local database reset. Existing boards store phrase text on the session, so this seed does not change them.

## Desired End State

The seven phrases and `Talia Rozmaitości` are in the seed file and on the hosted catalog. Staging no longer lists those items. A GM can assign the new reward on a new session, and new boards can draw the new phrases, including the shorthand `min.`, `1k+`, and `2x`. Older sessions look the same as before.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| Batch | All 7 staged phrases, plus reward `talia-rozmaitosci` | That reward is the only one in `context/ideas/rewards.md`, which is the "1 z nagród" to include |
| Wording | Verbatim, including `min.`, `1k+`, and `2x` | The parked strings are the catalog strings; shorthand is not expanded |
| Reward copy | Staged slug, label, and description | Same rule as the phrases: `Nagroda z wylosowanej karty z Talii Rozmaitości` is not rewritten |
| Delivery | `seed.sql` and a hosted linked seed before done | Dev and production read the hosted project, so a repo-only edit leaves live boards on the current 32 |
| Staging | Remove the promoted bullets; keep headers and any newer bullets | The backlog is what has not been promoted yet |
| Shape | Append to the existing seed `INSERT`s; no migration | F-01 keeps catalog copy in `seed.sql` |
| Phases | One phase for the file edit and the hosted apply | The hosted command must run the seed file that already contains the batch |

## Scope

**In scope:**

- Seven verbatim phrase rows and the `talia-rozmaitosci` reward row in `supabase/seed.sql`
- Removal of those bullets from `context/ideas/phrases.md` and `context/ideas/rewards.md`
- Hosted apply via `npx supabase db query --linked -f supabase/seed.sql`, plus a short note in `change.md`
- Confirming the new reward label on the create-session page

**Out of scope:**

- Rewriting shorthand, any other reward, categories, admin UI, migrations, and app code
- `supabase db reset` on the hosted project
- Changing phrases already stored on existing sessions
- A roadmap slice for this change, or an edit to the archived F-01 count of 32

## Architecture / Approach

```mermaid
flowchart LR
  ideas[ideas phrases and rewards]
  seed[seed.sql append]
  hosted[(Hosted Supabase)]
  boards[New session boards]
  ideas --> seed
  seed -->|linked db query| hosted
  hosted -->|SELECT catalogs| boards
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Promote the staged batch | Seed rows, empty those staging bullets, hosted catalog updated | A hosted `db reset` would wipe the project; a phrase typo after insert is skipped by `ON CONFLICT` and needs an `UPDATE` |

**Prerequisites:** Supabase CLI linked to the hosted project, and a person to run the seed query.
**Estimated effort:** One short session, one phase.

## Open Risks & Assumptions

- "1 z nagród" means the only staged reward, `talia-rozmaitosci`. There is no second staged reward to choose.
- The reward description does not say what the GM does at the table. It ships as staged.
- Shorthand will sit beside full sentences such as "Przebiegnij w walce minimum 100 metrów". That is accepted.
- Hosted counts are 39 and 7 only if the project still has exactly the current seed (32 and 6). Extra rows already there stay. Presence of the new rows is the check.
- Anon `SELECT` on the catalog stays as it is today.

## Success Criteria (Summary)

- The seed file and the hosted `phrases` table contain the seven verbatim strings.
- The hosted `rewards` table contains `talia-rozmaitosci` / `Talia Rozmaitości` / `Nagroda z wylosowanej karty z Talii Rozmaitości`, and the create-session page lists that label.
- The promoted bullets are gone from the ideas files, and no migration or app code changed.
