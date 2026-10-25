# Expand Phrase Catalog Implementation Plan

## Overview

Promote the staged phrase backlog and the one staged reward into the predefined catalog that new boards draw from. The phrases stay word for word. The change is done when those rows are in `supabase/seed.sql` and on the hosted project the app reads.

## Current State Analysis

`context/ideas/phrases.md` holds seven phrases. `context/ideas/rewards.md` holds one reward, `talia-rozmaitosci` (label `Talia Rozmaitości`, description `Nagroda z wylosowanej karty z Talii Rozmaitości`). None of the seven phrases match the 32 rows in `supabase/seed.sql` by exact text or by the same intent.

`createSession` loads every `phrases.text` and copies the drawn string onto `board_cells.phrase` (`src/lib/services/sessions.service.ts:93-95`, `src/lib/services/sessions.service.ts:150-157`). There is no foreign key back to `phrases`. Existing sessions keep the text they were created with. A 5×5 board needs 25 distinct phrases; 32 plus these seven still clears that. No test asserts a catalog size of 32.

The create-session page loads every reward (`src/pages/sessions/new/index.astro:17-20`), ordered by `created_at` ascending. A newly inserted reward appears at the end of that list.

CI applies `supabase/seed.sql` on `npx supabase db reset --local` because `[db.seed]` points at that file (`supabase/config.toml:60-65`). Dev and production read the hosted project. Hosted rows change only when someone runs the seed file against it. `supabase db reset` on that project is banned (`context/foundation/lessons.md`).

Phrase inserts skip an existing exact `text`. Reward inserts upsert `label` and `description` by `slug` (`supabase/seed.sql:1-2`, `supabase/seed.sql:37`, `supabase/seed.sql:70-72`). Catalog content lives in the seed file, not in migrations. The phrases table has no category column and no length check.

## Desired End State

`supabase/seed.sql` contains the seven staged phrase strings verbatim and the staged reward. Those bullets are gone from the ideas files; the file headers stay. Any idea added after this plan was written stays in the backlog.

On the hosted project, `public.phrases` contains the seven texts and `public.rewards` contains `talia-rozmaitosci` with the staged label and description. If the hosted catalog was still the current seed (32 phrases, 6 rewards), the counts are 39 and 7. A signed-in GM sees `Talia Rozmaitości` on the create-session reward list. New boards can draw the new phrases. Boards created earlier are unchanged.

### Key Discoveries:

- Phrase text is snapshotted onto the session at create time (`src/lib/services/sessions.service.ts:150-157`). This seed does not rewrite old boards.
- Re-running `supabase/seed.sql` is safe for these rows: phrases use `ON CONFLICT (text) DO NOTHING` (`supabase/seed.sql:37`); rewards upsert by slug (`supabase/seed.sql:70-72`).
- After a phrase is stored, editing its text in `seed.sql` does not update the hosted row. A later typo fix is a targeted `UPDATE`, which is how F-01 fixed copy (`context/archive/2026-09-27-seed-phrase-reward-catalog/change.md:39`).
- The create-session reward list is ordered by `created_at` ascending (`src/pages/sessions/new/index.astro:17-20`), so `Talia Rozmaitości` shows after the six existing rewards.

## What We're NOT Doing

- Rewriting shorthand (`min.`, `1k+`, `2x`) into full sentences, or adding "w jednej walce" / "podczas sesji" to lines that do not already say it.
- Any reward other than `talia-rozmaitosci`.
- Categories, an admin phrase screen, a new migration, or app/UI code.
- `supabase db reset` on the hosted project.
- Updating `board_cells` on sessions that already exist.
- A test that locks the catalog at 32 rows, or a kitchen-sink fixture update.
- Registering this change on `context/foundation/roadmap.md` (M-2 has no item with this Change ID).
- Editing the archived F-01 note that expected 32 phrases.

## Implementation Approach

Append the new rows to the existing `INSERT` statements in `supabase/seed.sql`, then remove only the promoted bullets from the ideas files. One phase covers both the file edit and the hosted apply, so the hosted command runs against the seed file that already contains the batch. No migration: F-01 keeps catalog copy in `seed.sql` so content edits do not churn migration history.

The seven phrase strings and the reward fields are taken from the ideas files as parked. The reward description stays the staged sentence.

## Critical Implementation Details

Run `npx supabase db query --linked -f supabase/seed.sql` only after `supabase/seed.sql` in the worktree contains the new rows. That command executes the file; it does not diff against a previous seed. Do not run `supabase db reset` against the linked hosted project. `npx supabase db reset --local` is the CI database and is not the apply step for this change.

Get the phrase literals right before that hosted run. A later change to a phrase string already stored is skipped by `ON CONFLICT (text) DO NOTHING` and needs a targeted `UPDATE`.

## Phase 1: Promote the staged batch

### Overview

Add the seven phrases and `talia-rozmaitosci` to the seed, drop those bullets from staging, and apply the seed on the hosted project.

### Changes Required:

#### 1. Phrase and reward rows

**File**: `supabase/seed.sql`

**Intent**: Extend the predefined catalog with this batch so new boards and the create-session reward list can use it, without a migration.

**Contract**: Append these seven literals to the existing `INSERT INTO public.phrases (text)` value list, leaving `ON CONFLICT (text) DO NOTHING` in place:

- `Zrań sojusznika obszarowym zaklęciem`
- `Strać przytomność w walce`
- `Użyj przedmiotu z ładunkami min. 3 razy`
- `Wydaj 1k+ złota na głupoty`
- `Wykonaj 3 reakcje w jednej walce`
- `Pierwszy w inicjatywie 2x`
- `Ostatni w inicjatywie 2x`

Append one tuple to the existing `INSERT INTO public.rewards (slug, label, description)` value list, leaving the `ON CONFLICT (slug) DO UPDATE` clause in place:

- slug `talia-rozmaitosci`
- label `Talia Rozmaitości`
- description `Nagroda z wylosowanej karty z Talii Rozmaitości`

#### 2. Staging backlog

**File**: `context/ideas/phrases.md`

**Intent**: Take the promoted phrases out of the backlog so the next `/add-idea` does not treat them as still waiting.

**Contract**: Delete the seven bullets listed above. Keep the `# Phrase ideas` heading, the staging blockquote, and any other bullet that is not one of those seven.

**File**: `context/ideas/rewards.md`

**Intent**: Take the promoted reward out of the backlog for the same reason.

**Contract**: Delete the bullet whose slug is `talia-rozmaitosci`. Keep the `# Reward ideas` heading, the staging blockquote, and any other reward bullet.

#### 3. Hosted apply note

**File**: `context/changes/expand-phrase-catalog/change.md`

**Intent**: Record how the hosted catalog was updated, in the same place F-01 recorded its runbook, so a later typo fix does not start from a reset.

**Contract**: Under `## Notes`, record the linked seed command and the hosted result (the seven texts present, slug `talia-rozmaitosci` present, and the counts observed). Do not change frontmatter in this step. Do not document `db reset` as an apply step.

### Success Criteria:

#### Automated Verification:

- `supabase/seed.sql` contains the seven phrase literals verbatim and a rewards row with slug `talia-rozmaitosci`, label `Talia Rozmaitości`, and description `Nagroda z wylosowanej karty z Talii Rozmaitości`, inside the existing `ON CONFLICT` statements
- `context/ideas/phrases.md` and `context/ideas/rewards.md` still have their headers, and the seven phrase bullets plus the `talia-rozmaitosci` bullet are gone
- The diff has no changes under `src/` or `supabase/migrations/`

#### Manual Verification:

- A human runs `npx supabase db query --linked -f supabase/seed.sql` on the hosted project after the seed file contains the new rows, and does not run `supabase db reset` against that project
- Hosted `public.phrases` contains all seven verbatim texts and `public.rewards` contains slug `talia-rozmaitosci` with label `Talia Rozmaitości` and description `Nagroda z wylosowanej karty z Talii Rozmaitości`; if the hosted catalog was still 32 phrases and 6 rewards, the counts are 39 and 7
- A signed-in create-session page lists `Talia Rozmaitości` after the six existing rewards

**Implementation Note**: After the automated checks pass, pause for the human hosted seed and the create-session check before marking the manual steps done.

---

## Testing Strategy

### Unit Tests:

- No new unit tests. This change does not touch `src/`, and no unit test asserts the seed list.

### Integration Tests:

- No new integration test and no edit to an existing one. Create-session tests already require a pool large enough for a 5×5; they do not assert a count of 32. CI's local `db reset` will load the updated `seed.sql` on the next run.

### Manual Testing Steps:

1. Confirm `supabase/seed.sql` on disk contains the seven strings and the reward tuple before any hosted command.
2. From the repo, with the Supabase CLI linked to the hosted project, run `npx supabase db query --linked -f supabase/seed.sql`.
3. On that hosted database, confirm the seven texts and the reward slug, label, and description. Read the counts. Expect 39 phrases and 7 rewards only when the pre-change counts were 32 and 6.
4. Sign in as a GM, open the create-session page, and confirm `Talia Rozmaitości` is on the reward list, after the existing six.
5. Write the command and the observed counts into `change.md` notes.

## Performance Considerations

Create-session already selects every phrase text and every reward row. Seven phrases and one reward do not change that path.

## Migration Notes

No new migration. Existing `board_cells.phrase` values stay as stored. The hosted apply is the seed file only. If a hosted count is already above 32 phrases or 6 rewards, keep those extra rows; this seed does not delete catalog data. Re-running the seed skips phrase texts that are already present and refreshes this reward's label and description from the seed file.

## References

- Staged phrases: `context/ideas/phrases.md`
- Staged reward: `context/ideas/rewards.md`
- Catalog seed: `supabase/seed.sql`
- Prior catalog change: `context/archive/2026-09-27-seed-phrase-reward-catalog/plan.md`
- Hosted reset ban: `context/foundation/lessons.md`
- Phrase snapshot: `src/lib/services/sessions.service.ts:150-157`
- Reward list order: `src/pages/sessions/new/index.astro:17-20`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Promote the staged batch

#### Automated

- [x] 1.1 `supabase/seed.sql` contains the seven phrase literals verbatim and a rewards row with slug `talia-rozmaitosci`, label `Talia Rozmaitości`, and description `Nagroda z wylosowanej karty z Talii Rozmaitości`, inside the existing `ON CONFLICT` statements
- [x] 1.2 `context/ideas/phrases.md` and `context/ideas/rewards.md` still have their headers, and the seven phrase bullets plus the `talia-rozmaitosci` bullet are gone
- [x] 1.3 The diff has no changes under `src/` or `supabase/migrations/`

#### Manual

- [x] 1.4 A human runs `npx supabase db query --linked -f supabase/seed.sql` on the hosted project after the seed file contains the new rows, and does not run `supabase db reset` against that project
- [x] 1.5 Hosted `public.phrases` contains all seven verbatim texts and `public.rewards` contains slug `talia-rozmaitosci` with label `Talia Rozmaitości` and description `Nagroda z wylosowanej karty z Talii Rozmaitości`; if the hosted catalog was still 32 phrases and 6 rewards, the counts are 39 and 7
- [x] 1.6 A signed-in create-session page lists `Talia Rozmaitości` after the six existing rewards
