# Player join shared board — Plan Brief

> Full plan: `context/changes/player-join-shared-board/plan.md`
> Research: `context/changes/player-join-shared-board/research.md`

## What & Why

A player at the table needs to open the shared board with a session code and a nickname, without an account. Today only a logged-in Game Master can see a board, and only by its UUID. This slice adds the anonymous join path and shows phrases and reward labels. Who occupies a cell, and the 10-second refresh, wait until someone can actually claim a cell.

## Starting Point

S-01 stores a session, a 6-character code, and board cells. `BoardGrid` already renders each phrase and reward label. Middleware sends every `/sessions` path to sign-in when there is no user. There is no nickname store, no player route, and no `anon` read of `sessions` or `board_cells`. The server uses the anon key, so a player read cannot skip RLS.

## Desired End State

On the anonymous home page, next to sign-in and sign-up, the player enters a code. The page uses the same tokens as the rest of the app. An active code asks for a nickname, prefilled with the nick for that code, or with the last nick this browser confirmed. After confirm, `/play/{code}` shows the board. The header shows the nickname on one of 16 colors, in the slot where the Game Master sees the code. A reload stays on the board. The cookie lasts 400 days and is renewed on each confirm, so a session a week later still knows the nick. A missing, malformed, or closed code all show "Nie znaleziono sesji" and no board. A signed-in Game Master joins from the dashboard instead of signing out, and that session stays off the list of sessions they created.

## Key Decisions Made


| Decision              | Choice                                                                              | Why (1 sentence)                                                                               | Source |
| --------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------ |
| Nickname storage      | httpOnly cookie for 400 days, renewed on each confirm, no players table             | Sessions are often a week apart, and 8 hours would force the nick to be typed again every time | Plan   |
| Where join starts     | Code field on anonymous `/` and on the signed-in dashboard; board at `/play/{code}` | A player starts from home; a Game Master joins another session without signing out             | Plan   |
| Nick step             | Home and dashboard always open `?join=1`; a reload of the board URL skips it        | Those paths confirm the nick; a refresh does not send them back through the form               | Plan   |
| Prefill               | This code's nick, otherwise the last nick this browser confirmed                    | A new code the following week still starts from the remembered nick                            | Plan   |
| Occupancy and refresh | Phrases and reward labels only                                                      | Nothing can claim a cell yet, so a timer would reload unchanged rows                           | Plan   |
| Rejected codes        | One not-found for malformed, unknown, and closed                                    | The response does not reveal whether the code ever existed                                     | Plan   |
| Nickname rules        | Trimmed, 1–24 characters, duplicates allowed                                        | Uniqueness can wait until a name is shown on a cell                                            | Plan   |
| Color                 | Random token 1–16, stable per code in this browser, on the nick label               | Same nicknames can be told apart later; this slice only shows the local label                  | Plan   |
| Board read            | `SECURITY DEFINER` function, no anon table policy                                   | A table policy that can see active rows can also list every code                               | Plan   |


## Scope

**In scope:**

- Home page rebuilt on the app tokens, with a code field plus sign-in and sign-up
- The same code field on the signed-in dashboard
- `/play/{code}` nick step and shared board
- Cookie memory of the last nick and of a color per code, kept for 400 days
- Function `get_active_board_by_code`, granted to `anon`
- Smoke coverage and dev-only kitchen sinks for the player page and the home page

**Out of scope:**

- Players table, claims, occupant names, polling, undo, regenerate
- Anon `SELECT` on `sessions` or `board_cells`
- Unique nicks or unique colors across the table
- A second visual theme; the home page uses the tokens already in the app
- Adding a joined session to the dashboard list of sessions this account created

## Architecture / Approach

`/` and the signed-in dashboard submit the code to `/play` with a GET form, which redirects a well-formed code to `/play/{code}?join=1`. That page calls `get_active_board_by_code`. Zero rows become the shared 404. An active board with no cookie identity for that code, or with `?join=1`, renders the nick form and no cell phrases. The field is prefilled from that code, or from the last nick. `POST /api/play/join` writes the cookie only when the board exists and the nick is valid, then redirects to `/play/{code}`, which renders `BoardGrid`. The Game Master board page is unchanged, and a joined session is not added to the created-sessions list.

## Phases at a Glance


| Phase                       | What it delivers                                      | Key risk                                                                       |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1. Code-keyed board read    | Function and service that return one active board     | A policy instead of the function would list every code                         |
| 2. Player page              | Nick form, 400-day cookie, 16-color nick label, board | Phrases leaking into the nick-form HTML                                        |
| 3. Home and dashboard entry | Tokenized home page and a dashboard code field        | Dropping sign-in or sign-up, or listing a joined session as one the GM created |
| 4. Verification             | Smoke steps and kitchen sinks                         | Smoke running the play checks while still signed in                            |


**Prerequisites:** S-01 done. Local Supabase for the migration and `--local` typegen. No hosted push.
**Estimated effort:** about 2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Research read the migration files, not the hosted database. The function assumes those tables match production.
- Two browsers can draw the same color. Uniqueness across players waits until a later slice stores the color.
- The code appears in the player URL and in server logs. That is the table secret.
- Asking for a nick only after the code resolves tells the submitter that this code is active. Unknown and closed still look the same.
- The guessing bound is the size of the code space. This slice adds no rate limit.
- Nothing in the app sets `closed`. The manual closed check is a local SQL update that must be restored.

## Success Criteria (Summary)

- An anonymous player joins from `/` with a code and a nickname and sees phrases and reward labels.
- A reload of `/play/{code}` stays on the board, and a new code the following week still offers the last nick.
- A signed-in Game Master joins another session from the dashboard without signing out, and that session is not in the created-sessions list.
- A missing, malformed, or closed code shows one not-found and no board, and `/sessions` still requires sign-in.

