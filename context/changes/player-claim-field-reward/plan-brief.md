# Player claim field reward — Plan Brief

> Full plan: `context/changes/player-claim-field-reward/plan.md`

## What & Why

This is the north-star slice: a player at the table marks a free bingo cell after the GM’s verbal OK and immediately sees whether that cell’s reward is theirs. First claim wins under race conditions; others see the cell occupied within about ten seconds; the GM can tell who owns which colored cell and still read every reward label.

## Starting Point

S-02 already lets anonymous players join with a code + nick cookie and view a static board with phrases and full reward labels. There is no players table, no claim column, no click handler, and no polling. Board reads use a SECURITY DEFINER RPC with no anon table grants.

## Desired End State

Join persists a `session_players` row (sequential color). Claiming flips a mystery “has reward” frame into the reward label on the player board and paints the cell with the claimer’s color. Boards poll occupancy. The GM keeps labels, sees claimer colors, and has a nick-in-color roster under the board. FR-010 is amended so players learn the reward type only after claim.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| Sync | Poll ~5s (≤10s NFR) | Primary SC allows refresh, but the NFR needs no manual reload |
| Identity | `session_players` + FK on cell | Stable claimer id; roster and colors live in DB |
| Late claim | Typed conflict + grid update | Matches US-01 “already taken” without silent dead clicks |
| Reward UX | Frame until claim → flip reveal + player color; no toast/modal | Table-readable mystery without blocking UI |
| Label visibility | Player mystery; GM always sees types; FR-010 amended | Spoiler-free for players; MG can still run the table |
| Claimed label layout | Single line in-tile, smaller type, ellipsis | Must fit phone cells without wrap |
| GM mapping | Claimer color on cell + join roster (nick in color) | Color↔nick without nick text on every cell |
| CSRF | Origin/referrer on join and claim | Closes S-02 review debt when claims bind to cookie |
| Duplicate nicks | Allowed; distinct rows; color by join order (cycle 1–16) | Two “Ala” stay distinguishable by color |
| Cut line | Drop flip animation polish first | Keep claim, reveal, poll, first-wins |

## Scope

**In scope:**

- FR-010 / Business Logic PRD amend
- `session_players`, claim columns, first-wins RPC
- Join → player row + cookie `playerId` + sequential color
- Claim API, player-safe snapshots, poll endpoints
- Player interactive board (mystery, reveal, conflict, poll)
- GM colored occupancy + roster + poll
- CSRF on join/claim; kitchen sinks; smoke claim/conflict

**Out of scope:**

- Undo (S-04), regenerate (S-05), websockets, team rewards
- Unique nicks; anon table policies; toast/modal reward UI

## Architecture / Approach

Anonymous writes stay behind SECURITY DEFINER RPCs (join, claim, board snapshot), same pattern as `get_active_board_by_code`. The player page mounts a React island that POSTs claims and GETs polls; the GM page adds roster + colored cells and polls on the authenticated session path. Player snapshots expose `hasReward` without unclaimed labels; after claim, the label is public on that cell.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. PRD + schema + types | FR-010 amend; players/claims migration | Wrong secrecy rules baked into RPC shape |
| 2. Join → player row | DB player + cookie `playerId` + CSRF | Orphan rows on every re-confirm if binding is wrong |
| 3. Claim API + reads | First-wins claim + safe snapshots + poll | Leaking unclaimed labels on player poll |
| 4. Player board UX | Click, reveal, conflict, poll | Phone tap targets / spoiler legend left in place |
| 5. GM board UX | Colors + roster + poll | Roster/color mismatch confusing MG |
| 6. Smoke + verification | Automated claim/conflict + gates | Smoke still signed-in during play steps |

**Prerequisites:** S-02 done. Local Supabase for migration + typegen. Hosted `db push` is human-approved later.
**Estimated effort:** ~3–4 sessions across 6 phases.

## Open Risks & Assumptions

- Hosted schema must match migrations before production claim works.
- More than 16 joiners reuse colors (modulo 16); rare at a table but weakens color↔nick uniqueness.
- Old cookies without `playerId` require re-join before claim.
- Public reveal of reward label after any claim is assumed; only pre-claim type is hidden from players.

## Success Criteria (Summary)

- Player claims a free cell, sees reward reveal (or plain claim color if none), and losers of a race get a clear conflict.
- Other players and GM see the new occupancy within ~10s without manual refresh.
- GM maps cell color → roster nick → reward label; players never saw that label before the cell was claimed.
