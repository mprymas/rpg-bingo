# Player join shared board Implementation Plan

## Overview

An anonymous player joins an active session from the home page with a code and a nickname, and sees the shared board: each cell's phrase and, when one is set, its reward label. The nickname and a random color are remembered in a browser cookie for that code. Claiming a cell, occupant names, and the 10-second refresh stay on S-03.

## Current State Analysis

A logged-in Game Master can open `/sessions/{uuid}` and see the session code, a `BoardGrid` of phrases and reward labels, and a reward legend (`src/pages/sessions/[id].astro`, `src/components/sessions/BoardGrid.astro`). An anonymous visitor cannot. `PROTECTED_ROUTES` is `["/dashboard", "/sessions"]`, and any path under those prefixes redirects to `/auth/signin` when `locals.user` is null (`src/middleware.ts:4`, `src/middleware.ts:18-21`).

`getSessionWithCells` reads by UUID and `gm_id` (`src/lib/services/sessions.service.ts:106-124`). The session migration grants `SELECT`/`INSERT` on `sessions` and `board_cells` to `authenticated` only (`supabase/migrations/20260927143000_sessions_and_board_cells.sql:29-65`). There is no `anon` policy, no `players` table, and no nickname column. The server client uses the anon key (`src/lib/supabase.ts:6-21`); there is no service-role client. A blanket `anon` `SELECT` would let one query list every active code, which breaks the guessing bound in the PRD.

The anonymous home page is `src/pages/index.astro`, which redirects a signed-in user to `/dashboard` and otherwise renders `src/components/Welcome.astro`. That screen is the legacy cosmic landing (sign-in and sign-up only). It is not in the UI-literal scan. Tokenized views are listed in `scripts/check-ui-literals.mjs`.

There is no app writer that sets `sessions.status` to `closed`. The column allows it (`sql:9`). Smoke already creates a session with a guaranteed phrase `Hasło ze smoke` and stores the session id (`scripts/smoke.mjs:151-172`).

## Desired End State

An anonymous visitor on `/` sees a session-code field beside "Zaloguj się" and "Załóż konto". Submitting a code opens `/play/{code}?join=1`.

- A malformed code, an unknown code, and a closed session all render "Nie znaleziono sesji" with HTTP 404 and no board. The message does not say which of the three it was.
- An active code shows a nickname form. The field is prefilled with the nick already stored for that code, or, if this browser has not joined that code, with the last nick this browser confirmed. It is empty only when this browser has never confirmed a nick. A nick must be 1–24 characters after trim. Duplicates are allowed. The value is kept as typed, apart from trim. Blank is rejected with "Nick musi mieć od 1 do 24 znaków."
- Confirming the nick stores it in an httpOnly cookie kept for 400 days, the longest lifetime current browsers honor, and each later confirm restarts that lifetime. The color comes from a fixed set of 16 tokens. The first confirm for a code picks the color. A later confirm for the same code keeps that color and may change the nick. Another code may get another color. The last confirmed nick stays the default for the next session, including a new code a week later.
- `/play/{code}` with a stored nick for that code renders the board. The header slot where the Game Master sees the session code shows the nickname on its color. The grid reuses `BoardGrid` (phrase and reward label). The reward legend is repeated. The session code is not printed in that header. Occupant names are not shown. Nothing polls.
- Reloading `/play/{code}` stays on the board. Opening the same URL with `?join=1` shows the nick form again, prefilled with that code's nick.
- The anonymous home page is rebuilt in the same semantic tokens as the rest of the app. It still offers "Zaloguj się" and "Załóż konto", plus the code field. The cosmic landing is gone.
- `/sessions` and `/dashboard` still require a signed-in user. `/` still sends a signed-in user to `/dashboard`. The dashboard has the same code field, so a signed-in Game Master can join someone else's session without signing out. That joined session does not appear in the list of sessions they created.

### Key Discoveries:

- `BoardGrid` already renders phrase and reward label (`src/components/sessions/BoardGrid.astro:20-27`). This slice reuses it and does not add a click handler.
- The GM not-found copy is already "Nie znaleziono sesji" (`src/pages/sessions/[id].astro:81`). The player page uses that same sentence for every rejected code.
- Failed data loads on the GM page set HTTP 503 and "Nie udało się wczytać sesji" (`src/pages/sessions/[id].astro:36-38`). The player page follows that lesson.
- Session codes are 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`src/lib/services/session-code.ts:3-5`).
- Smoke's `request()` keeps a cookie jar and follows no redirects (`scripts/smoke.mjs:54-92`), so a join POST can be asserted by status, `Location`, and a later GET.
- S-01 left the player read as a later policy or function (`context/archive/2026-09-27-gm-create-session-board/plan-brief.md:68`). The function is the option that does not expose a table listing.

## What We're NOT Doing

- A `players` table, or any server row for a nickname
- Claim, undo, regenerate, claimant columns, occupant names on cells, or a 10-second refresh (S-03, S-04, S-05)
- An `anon` `SELECT` policy on `sessions` or `board_cells`, or a service-role client
- Unique nicknames, or colors that are unique across players at the table
- Printing the session code in the player header
- Changing the Game Master board page at `/sessions/{uuid}`
- Putting a joined session onto the dashboard list of sessions this account created
- A new visual theme. The home page moves onto the tokens the rest of the app already uses
- Rate limiting. The code space remains the control for the guessing bound
- Supabase Realtime

## Implementation Approach

The code is the secret. The nickname is a display identity for this browser. The board is loaded only by a `SECURITY DEFINER` function that returns cells for one active code and returns no rows otherwise. Anonymous roles do not gain table access, so they cannot list codes.

The home page and the dashboard both collect the code and hand off to `/play/{code}?join=1`. The player page decides among not-found, the nick form, and the board. The nick and color live in one httpOnly cookie the server can read, because the browser never receives the Supabase key and `localStorage` would not be visible to SSR. The cookie lasts 400 days and is refreshed on each confirm, so a weekly session does not force the nick to be typed again. Cell phrases are rendered only on the board response, not in the nick-form HTML.

The player screen and the rebuilt home page use the existing semantic tokens, including 16 new player-color tokens. The dashboard keeps its current tokenized shell and gains the code field.

## Critical Implementation Details

- **Read path.** Do not add an `anon` policy on `sessions` or `board_cells`. A policy that can see active rows can also list them. The only new database entry point is `get_active_board_by_code(p_code text)`, `SECURITY DEFINER`, `SET search_path = public`, filtered with `status = 'active'`. Unknown and closed both return zero rows. Grant `EXECUTE` to `anon` and `authenticated` after revoking `PUBLIC`. Do not return `gm_id` or the session UUID.
- **When the board HTML exists.** `?join=1` always shows the nick form for an active code, even if the cookie already has a nick. A request without that flag shows the board only when the cookie has a valid nick and color for that code. The nick-form response must not include cell phrases. A missing, malformed, or closed code is 404 with "Nie znaleziono sesji" and never shows the nick form, including when `?join=1` or `error=nick` is present.
- **Hosted database.** Add a migration file and apply it only to the local stack. Do not `supabase db push` or `supabase db reset` against the linked project. Regenerate types with `--local`.

---

## Phase 1: Code-keyed board read

### Overview

Add a function that returns one active board by code, and a service that maps it to a player DTO. Anonymous clients still cannot select the tables.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20261003120000_player_board_by_code.sql`

**Intent**: Give the anonymous server client one way to read a single active board by code, without a table policy that would list every code.

**Contract**: New function `public.get_active_board_by_code(p_code text)` returns one row per cell: `code`, `size`, `position`, `phrase`, `reward_slug`, `reward_label`. `reward_slug` and `reward_label` are null when the cell has no reward. Rows are ordered by `position`. The function is `STABLE`, `SECURITY DEFINER`, and sets `search_path = public`. The predicate is `sessions.code = p_code AND sessions.status = 'active'`. `REVOKE ALL` on the function from `PUBLIC`, then `GRANT EXECUTE` to `anon` and `authenticated`. No new table, no new policy, no `anon` grant on `sessions` or `board_cells`.

```sql
CREATE FUNCTION public.get_active_board_by_code(p_code text)
RETURNS TABLE (
  code text,
  size smallint,
  position smallint,
  phrase text,
  reward_slug text,
  reward_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.code, s.size, c.position, c.phrase, r.slug, r.label
  FROM public.sessions s
  JOIN public.board_cells c ON c.session_id = s.id
  LEFT JOIN public.rewards r ON r.id = c.reward_id
  WHERE s.code = p_code
    AND s.status = 'active'
  ORDER BY c.position;
$$;
```

#### 2. Player board type and service

**File**: `src/types.ts`
**File**: `src/lib/services/sessions.service.ts`
**File**: `src/db/database.types.ts`

**Intent**: Map the function result into the shape `BoardGrid` already consumes, without the owner id, so the player page cannot reuse the GM query by mistake.

**Contract**: Add a `PlayerBoard` type with `code`, `size`, and `cells` of `{ position, phrase, reward: { slug, label } | null }`. Add `getActiveBoardByCode(supabase, code)` that returns `PlayerBoard | null`. It calls the RPC, returns null for zero rows, and throws on a client error. It does not filter by `gm_id` and does not select `sessions` or `board_cells` directly. Regenerate `src/db/database.types.ts` from the local database after the migration is applied locally (`npx supabase gen types typescript --local --schema public`). Do not use `--linked`.

### Success Criteria:

#### Automated Verification:

- `npx astro check` passes and the generated database types include `get_active_board_by_code`
- `npm run lint` passes

#### Manual Verification:

- On the local database, anonymous select from `sessions` and `board_cells` returns no rows, the function returns cells for an active code, and it returns no rows for an unknown code and for a code flipped to `closed` then restored

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Player page

### Overview

Add `/play/{code}` and the join POST. An active code leads to a nick form or the board. Every rejected code looks the same.

### Changes Required:

#### 1. Player cookie

**File**: `src/lib/player-cookie.ts`

**Intent**: Remember the nickname for as long as the browser will keep a cookie, and remember which color belongs to each code, so a weekly return does not start from an empty nick.

**Contract**: Cookie name `rpg_player`. Flags: `httpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=34560000` (400 days). Every successful write sets that max-age again from the time of the write. The value is JSON: `{ lastNick: string, byCode: { [code]: { nick: string, color: number, seen: number } } }`. `color` is an integer 1–16. `seen` is epoch milliseconds. Ignore the whole cookie when the JSON is invalid. Ignore `lastNick` when it is not 1–24 characters after trim. Ignore one `byCode` entry when its nick fails that rule or its color is outside 1–16. When the serialized cookie would exceed 3500 characters, drop the `byCode` entries with the smallest `seen` until it fits. Never drop `lastNick` to make room.

`readPlayerIdentity(cookie, code)` returns the `byCode` entry for that code or null. `readLastNick(cookie)` returns `lastNick` or null. `writePlayerIdentity` sets `lastNick` to the nick just confirmed, updates `seen`, and updates that code: keep the existing color when that code is already stored, otherwise set `color` to `(randomByte % 16) + 1` using `crypto.getRandomValues`. 256 is divisible by 16, so the pick is uniform. The nick stored on another code is left as it was.

#### 2. Join endpoint

**File**: `src/lib/schemas/play-join.ts`
**File**: `src/pages/api/play/join.ts`

**Intent**: Accept the nickname only after the code resolves to an active board, and leave the cookie unchanged when it does not.

**Contract**: `POST` only, `prerender = false`. Accept `application/x-www-form-urlencoded` with fields `code` and `nick`, validated with zod. Normalize the code with trim and uppercase. Check the code against `SESSION_CODE_PATTERN` before the RPC.

- Pattern mismatch, or `getActiveBoardByCode` returns null: do not write the cookie. Redirect to `/play/{code}` only when the pattern matches; otherwise redirect to `/play`. The player page renders the shared not-found. Do not include `error=nick`.
- Active board and nick invalid after trim (empty or longer than 24, or containing a character U+0000–U+001F): do not write the cookie. Redirect to `/play/{code}?join=1&error=nick`.
- Active board and nick valid: write the cookie as in the cookie contract, then redirect to `/play/{code}` with no query.

No authentication check. This route does not insert a row.

#### 3. Player color tokens

**File**: `src/styles/global.css`

**Intent**: Give each joined browser a stable swatch the nick label can use without a hex or palette class in the view.

**Contract**: Add `--player-1` through `--player-16` and matching foreground variables in both `:root` and `.dark`, and publish them through `@theme inline` as `--color-player-1` and `--color-player-1-foreground` (same for 2–16). The 16 swatches are visually distinct on the dark paper background. Views use `bg-player-N` and `text-player-N-foreground` only. A corrupted color never reaches the class list: the cookie reader drops it.

#### 4. Player route

**File**: `src/pages/play/[code].astro`
**File**: `scripts/check-ui-literals.mjs`

**Intent**: Show the nick step or the shared board for one code, and use one not-found for every code that does not resolve.

**Contract**: Normalize `Astro.params.code` with trim and uppercase. If it fails `SESSION_CODE_PATTERN`, set HTTP 404 and render "Nie znaleziono sesji" inside `Layout`. Do not call the RPC.

If the pattern matches, call `getActiveBoardByCode`. Null: same 404 and the same sentence. A thrown error: HTTP 503, "Nie udało się wczytać sesji", same branded `Layout` pattern as `src/pages/sessions/[id].astro:36-38`. Do not render the nick form or any cell phrase on 404 or 503.

When the board loads and `join=1` is set, or the cookie has no valid identity for this code: HTTP 200, a form posting to `/api/play/join` with a hidden `code` and a nick input. Label "Nick". Submit "Wejdź". Prefill from this code's stored nick when it exists, otherwise from `lastNick`. When `error=nick` is set, show "Nick musi mieć od 1 do 24 znaków." The HTML does not include any `cell.phrase`.

When the board loads and the cookie has a valid identity for this code and `join=1` is absent: HTTP 200. Header slot is the nick on `bg-player-N`, centered where the GM page prints the code (`src/pages/sessions/[id].astro:110-115`). Do not render `board.code` in that slot. Do not render status, created time, or the size line. A link "Wróć" points at `/dashboard` when `locals.user` is set, and at `/` otherwise. Reuse `BoardGrid` unchanged. Repeat the reward-legend counts from the GM page; do not refactor the GM page. If `cells.length` is not `size * size`, set HTTP 422 and show "Nie udało się wczytać planszy." without the GM sentence "Utwórz sesję ponownie."

Add this page to `SCOPED_FILES` in `scripts/check-ui-literals.mjs`. Use semantic token classes only. Do not add `/play` to `PROTECTED_ROUTES`.

### Success Criteria:

#### Automated Verification:

- `npx astro check` passes
- `npm run lint` passes with the player page included in the UI literal scan

#### Manual Verification:

- Opening `/play/{code}` for an active session without the player cookie shows the nick form and the HTML does not contain any cell phrase
- Submitting a valid nick shows the board with that nick and its color above the grid, cell phrases, and reward labels, and does not show the session code in that header slot
- Reloading `/play/{code}` stays on the board; opening `/play/{code}?join=1` shows the nick form prefilled with that nick, and confirming again keeps the same color
- A missing code, a malformed code, and a closed code all show "Nie znaleziono sesji" with status 404 and no board
- Opening the nick step for a different active code prefills the last confirmed nick, and confirming it may use a different color

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Home and dashboard entry

### Overview

The anonymous home page is rebuilt on the app's tokens, collects a session code, and still links to sign-in and sign-up. The dashboard offers the same code field to a signed-in Game Master. Both send a well-formed code to the nick step.

### Changes Required:

#### 1. Tokenized home page

**File**: `src/components/Welcome.astro`
**File**: `src/components/Topbar.astro`
**File**: `src/pages/kitchen-sink.astro`
**File**: `scripts/check-ui-literals.mjs`

**Intent**: Replace the cosmic landing with the same visual language as the rest of the app, and keep account entry next to the join field.

**Contract**: Rebuild `Welcome.astro` with semantic tokens only (`bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-primary`, and the shared layout spacing already used on tokenized pages). Remove the cosmic orbs, star field, gradient title, palette classes, and arbitrary blur values. Do not use `bg-cosmic`. Stop importing `Topbar.astro`. Delete `src/components/Topbar.astro` once nothing imports it. Keep a short product title and one short description. The page contains a GET form, `action="/play"`, with one text input, `name="code"`, label "Kod sesji", `maxlength="6"`, `autocapitalize="characters"`, `autocomplete="off"`, and submit button "Dołącz", plus links "Zaloguj się" (`/auth/signin`) and "Załóż konto" (`/auth/signup`). `src/pages/index.astro` keeps the signed-in redirect to `/dashboard`. Add `Welcome.astro` to `SCOPED_FILES`. Add `src/pages/kitchen-sink.astro`: HTTP 404 when `import.meta.env.PROD`, otherwise render `Welcome` without Supabase. Add that file to `SCOPED_FILES`.

#### 2. Code handoff

**File**: `src/pages/play/index.astro`
**File**: `scripts/check-ui-literals.mjs`

**Intent**: Turn either code form into the nick-step URL, and send every other submission to the same not-found as a bad code.

**Contract**: Read query `code`, trim, and uppercase. When it matches `SESSION_CODE_PATTERN`, redirect to `/play/{code}?join=1`. Otherwise set HTTP 404 and render "Nie znaleziono sesji" in `Layout`, with no nick form and no board. This page does not decide whether the code exists; the dynamic route does, after the redirect. Add `src/pages/play/index.astro` to `SCOPED_FILES`.

#### 3. Dashboard join

**File**: `src/components/dashboard/DashboardPanel.astro`

**Intent**: Let a signed-in Game Master join a session they did not create, without signing out and without mixing that session into the list of sessions they own.

**Contract**: Above the created-sessions list, add a heading "Dołącz do sesji" and the same GET form as the home page (`action="/play"`, input `name="code"`, label "Kod sesji", button "Dołącz"). The list below stays `listSessionsForGm`: sessions this account created. Do not query or insert a joined session there. When `demo` is true, submitting the form does not navigate, matching the existing demo links. The dashboard kitchen sink already renders `DashboardPanel`, so the field appears there without a second copy. `src/pages/dashboard/index.astro` stays behind the existing auth redirect.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npx astro check` passes

#### Manual Verification:

- Anonymous `/` shows the code field, "Zaloguj się", and "Załóż konto"
- Submitting an active code opens the nick step; submitting a bad code shows "Nie znaleziono sesji" and no board
- A signed-in visit to `/` still redirects to `/dashboard`
- Anonymous `/` uses semantic tokens and does not use `bg-cosmic` or Tailwind palette classes
- Signed-in `/dashboard` shows "Dołącz do sesji", and a session joined from there does not appear in the created-sessions list

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Verification

### Overview

Cover the anonymous join path in smoke, and add a dev-only kitchen sink for the player states.

### Changes Required:

#### 1. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Lock the anonymous board gate and the unchanged `/sessions` redirect into the existing cookie-jar smoke run.

**Contract**: Keep the zero-dependency `request()` helper. On the existing create step, also store `body.code`.

Always, with the anonymous jar:

- `GET /play/AAAAAA` returns 404 and the body contains "Nie znaleziono sesji"
- `GET /play/not-a-code` returns 404 and the body contains the same sentence

When `SMOKE_EMAIL` and `SMOKE_PASSWORD` are set, the existing signed-in dashboard step also asserts the body contains "Dołącz do sesji". After the existing sign-out step:

- `GET /sessions/new` is still 302 to `/auth/signin`
- `GET /play/{code}` is 200, the body contains "Nick", and the body does not contain "Hasło ze smoke"
- `POST /api/play/join` with that code and nick `Anna` is 302 to `/play/{code}`
- The following `GET /play/{code}` is 200 and the body contains both "Hasło ze smoke" and "Anna"
- `POST /api/play/join` with code `AAAAAA` and nick `Anna` does not cause a later `GET /play/AAAAAA` to render a board; that GET stays 404

Do not weaken the existing anonymous `GET /sessions/new` → 302 or `POST /api/sessions` → 401 steps.

#### 2. Kitchen sink

**File**: `src/pages/play/kitchen-sink.astro`
**File**: `scripts/check-ui-literals.mjs`

**Intent**: Give the tokenized player states a dev-only visual gate, matching the other cleaned views.

**Contract**: When `import.meta.env.PROD`, return HTTP 404 before any fixture renders. Otherwise render fixtures, without Supabase, for: empty nick form, prefilled nick form, nick error "Nick musi mieć od 1 do 24 znaków.", board with a colored nick label plus `BoardGrid` and legend, not-found "Nie znaleziono sesji", and load error "Nie udało się wczytać sesji". The static file `kitchen-sink.astro` must win over `play/[code].astro`. Add the file to `SCOPED_FILES`.

### Success Criteria:

#### Automated Verification:

- `npm run smoke` passes, including anonymous play steps for a missing code, a valid code before nick, and the same code after nick
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- `/play/kitchen-sink` in dev shows the nick form, the board, not-found, and the load-error state, and the route returns 404 in production
- A 5×5 board at a phone width shows the full grid without horizontal scrolling

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No unit runner in this repo. Nick and code rules are covered by the join route's zod schema and by smoke's 404 versus 200 assertions.

### Integration Tests:

- `npm run smoke` against a running server, after a local migration, with `SMOKE_EMAIL` and `SMOKE_PASSWORD` set so the create step can supply a real code.
- Anonymous `GET /sessions/new` stays 302. Anonymous `POST /api/sessions` stays 401.

### Manual Testing Steps:

1. Apply the migration on the local stack only. As `anon`, select from `sessions` and `board_cells` and expect no rows. Call `get_active_board_by_code` for an active code, a wrong code, and a code set to `closed` then restored.
2. From a logged-out browser, enter that code on `/`. Confirm the nick field is empty. Submit `Anna`. Confirm the board shows phrases and reward labels, and the header is `Anna` on a color, not the session code.
3. Reload `/play/{code}`. Confirm the board stays. Open `/play/{code}?join=1`. Confirm `Anna` is prefilled. Submit `Ania`. Confirm the color is unchanged and the label updates.
4. Enter a different active code on `/`. Confirm the nick field is prefilled with `Ania`. Submit it. Confirm this board's color may differ from the previous code, and reloading the first code still shows that code's own nick and color.
5. Submit `AAAAAA` and a too-long nick on a real code. Confirm both failures: one shared not-found, and the nick error, with no board phrases in the nick-form HTML.
6. Sign in and open `/`. Confirm the redirect to `/dashboard`. On the dashboard, enter another active code under "Dołącz do sesji" and confirm the nick step opens, prefilled. Confirm that joined session is not in the created-sessions list. Open `/sessions/{uuid}` as the owner and confirm the GM board page is unchanged.
7. In dev, open `/play/kitchen-sink` and `/kitchen-sink`. Resize to a phone width and confirm a 5×5 grid does not scroll horizontally. Confirm the home page no longer uses the cosmic background.

## Performance Considerations

Each player page view is one function call and returns at most 25 cells. There is no poll loop in this slice. That matches the current low-QPS target. The 10-second visibility window is not implemented here; S-03 adds it with the first claim writer.

## Migration Notes

The migration only adds a function. Existing rows stay valid. Rollback is `DROP FUNCTION public.get_active_board_by_code(text)`. Do not push or reset the hosted project as part of implementation. A hosted apply waits for human approval and must stay backward-compatible: the function is additive, and the GM policies stay as they are.

## References

- Related research: `context/changes/player-join-shared-board/research.md`
- Roadmap slice: `context/foundation/roadmap.md` S-02
- PRD: FR-002, FR-008, FR-010, access control, guessing and 8-hour NFRs in `context/foundation/prd.md`
- GM board shell: `src/pages/sessions/[id].astro:70-140`
- Board grid: `src/components/sessions/BoardGrid.astro:20-27`
- Auth gate: `src/middleware.ts:4-21`
- Prior deferral of the anon read: `context/archive/2026-09-27-gm-create-session-board/plan-brief.md:68`
- Non-2xx branded error lesson: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Code-keyed board read

#### Automated

- [x] 1.1 `npx astro check` passes and the generated database types include `get_active_board_by_code` — 0f8a055
- [x] 1.2 `npm run lint` passes — 0f8a055

#### Manual

- [x] 1.3 On the local database, anonymous select from `sessions` and `board_cells` returns no rows, the function returns cells for an active code, and it returns no rows for an unknown code and for a code flipped to `closed` then restored

### Phase 2: Player page

#### Automated

- [x] 2.1 `npx astro check` passes — 0af7ae2
- [x] 2.2 `npm run lint` passes with the player page included in the UI literal scan — 0af7ae2

#### Manual

- [x] 2.3 Opening `/play/{code}` for an active session without the player cookie shows the nick form and the HTML does not contain any cell phrase — 0af7ae2
- [x] 2.4 Submitting a valid nick shows the board with that nick and its color above the grid, cell phrases, and reward labels, and does not show the session code in that header slot — 0af7ae2
- [x] 2.5 Reloading `/play/{code}` stays on the board; opening `/play/{code}?join=1` shows the nick form prefilled with that nick, and confirming again keeps the same color — 0af7ae2
- [x] 2.6 A missing code, a malformed code, and a closed code all show "Nie znaleziono sesji" with status 404 and no board — 0af7ae2
- [x] 2.7 Opening the nick step for a different active code prefills the last confirmed nick, and confirming it may use a different color — 0af7ae2

### Phase 3: Home and dashboard entry

#### Automated

- [x] 3.1 `npm run lint` passes — 8f21c0d
- [x] 3.2 `npx astro check` passes — 8f21c0d

#### Manual

- [x] 3.3 Anonymous `/` shows the code field, "Zaloguj się", and "Załóż konto" — 8f21c0d
- [x] 3.4 Submitting an active code opens the nick step; submitting a bad code shows "Nie znaleziono sesji" and no board — 8f21c0d
- [x] 3.5 A signed-in visit to `/` still redirects to `/dashboard` — 8f21c0d
- [x] 3.6 Anonymous `/` uses semantic tokens and does not use `bg-cosmic` or Tailwind palette classes — 8f21c0d
- [x] 3.7 Signed-in `/dashboard` shows "Dołącz do sesji", and a session joined from there does not appear in the created-sessions list — 8f21c0d

### Phase 4: Verification

#### Automated

- [x] 4.1 `npm run smoke` passes, including anonymous play steps for a missing code, a valid code before nick, and the same code after nick — 6dc4860
- [x] 4.2 `npm run lint` and `npx astro check` pass — 6dc4860

#### Manual

- [x] 4.3 `/play/kitchen-sink` in dev shows the nick form, the board, not-found, and the load-error state, and the route returns 404 in production — 6dc4860
- [x] 4.4 A 5×5 board at a phone width shows the full grid without horizontal scrolling — 6dc4860
