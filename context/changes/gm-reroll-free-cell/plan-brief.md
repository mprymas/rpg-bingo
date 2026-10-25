# GM Reroll Free Cell — Plan Brief

> Full plan: `context/changes/gm-reroll-free-cell/plan.md`

## What & Why

The game master needs to fix a phrase that does not fit the table without starting a new session. FR-018 lets them draw a new phrase onto a free cell, leave that cell's reward where it is, and show the change to everyone only after one confirmation. Regeneration already opens a new session and a new code; this edit stays on the same board.

## Starting Point

Cells already store `phrase` and `reward_id` separately, with exact-text uniqueness per session. The GM cannot `UPDATE` those rows; undo claim is a `SECURITY DEFINER` function on an active session. Custom phrases from create are not stored anywhere except the text now sitting on a cell. Both boards poll every 5 seconds. There is no draft and no phrase-edit API.

## Desired End State

On an active session the GM clicks the icon-only pencil immediately to the right of **Wygeneruj nową planszę**, then clicks free cells and sees catalog phrases replace them in that browser tab only. Rewards stay. Players still see the old phrases. **Anuluj** throws the draft away. **Zatwierdź** writes every drafted phrase or writes none. If a player has claimed one drafted cell, the GM drops only that cell from the draft and can publish the rest.

On a 5×5 board, custom `Smok zjadł konia` (not in the 40-phrase catalog) cannot be drawn onto another cell after it leaves cell A. Catalog phrase `Oswój zwierzę` can be drawn onto another cell once the draft no longer shows it. If cell 7 is claimed while its draft says `Oswój zwierzę`, players keep `Wespnij się na wysoki mur`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Pool | Catalog only, excluding phrases visible in the draft | A custom phrase that leaves a cell cannot be drawn again; a catalog phrase that leaves a cell can |
| Publish race | Reject the whole draft when any drafted cell is claimed | The player keeps the phrase they claimed, and no other cell changes either |
| After rejection | Drop only the claimed cells from the draft, then commit the rest | This is the recovery for that race, not a restore button on a free cell |
| Draft storage | This browser tab only | The server draws and validates, but a refresh starts from the published board |
| Cancel | **Anuluj** clears the whole draft; a click always draws again | One bad free-cell roll is fixed by another draw or by discarding everything |
| Session | Active only, same gate as undo | A closed board stays a record |
| Edit entry | Icon-only pencil to the right of **Wygeneruj nową planszę** | The GM enters edit mode from the header, with no visible label and no second button on the board |
| Draw trust | Commit rechecks catalog membership, free cells, and normalized uniqueness | Draws are not signed; a modified client still cannot publish a custom or a duplicate |

## Scope

**In scope:**

- Pure catalog draw and unit tests
- One commit function that updates `phrase` or updates nothing
- `POST /api/sessions/[id]/reroll-phrase` and `POST /api/sessions/[id]/commit-phrase-rerolls`
- Header pencil to enter edit mode, poll-safe overrides, kitchen-sink states
- Integration coverage of the claim race and the player snapshot

**Out of scope:**

- Typing or picking a phrase, reward edits, reroll of a claimed cell
- A stored draft, cross-tab draft, or per-cell restore on a free cell
- Freezing claims during edit mode, regenerate, realtime, closed-session edit
- Signed draws, a new Playwright spec, persisting customs that are not on the board

## Architecture / Approach

The tab keeps `{ position → phrase }` overrides. Each click sends those overrides; the server builds the visible board from published cells plus overrides and returns one catalog phrase. **Zatwierdź** sends the map to `commit_phrase_rerolls`, which locks the cells and either updates every targeted `phrase` or raises `cell_claimed:` with the blocking positions. Players learn from the next poll of the existing board read.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Phrase reroll on a free cell | Draw, atomic commit, both endpoints, GM edit mode, tests, kitchen sink | Commit must roll back the whole set when one cell was claimed |

**Prerequisites:** FR-018 and the `rerollPhrase` glossary row are already in the working tree. Local Supabase must apply the new migration before integration tests. Undo's route and RPC are the pattern.
**Estimated effort:** ~1–2 sessions, one phase.

## Open Risks & Assumptions

- Two tabs can draw the same catalog phrase. The second commit fails as a duplicate and writes nothing. Accepted with the tab-local draft.
- `lower()` in SQL is the twin of `normalizePhrase`, not a locale clone. The integration test covers a whitespace/case collision the unique index would miss.
- A custom phrase that is not in the catalog is gone from the session after a successful publish. **Anuluj** restores it only because the server has not written yet.
- New catalog rows added after the session was created can appear on a later draw. Accepted with "catalog only".

## Success Criteria (Summary)

- The GM can replace free-cell phrases from the catalog, keep rewards, and discard the draft without anyone else seeing it.
- One confirmation publishes every drafted phrase, or none of them, when a drafted cell has been claimed.
- A joined player sees the new phrases on the next poll and still cannot see a phrase that was only in the GM's tab.
