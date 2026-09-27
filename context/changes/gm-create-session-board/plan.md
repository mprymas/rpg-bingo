# GM Create Session Board Implementation Plan

## Overview

Deliver roadmap slice S-01: a logged-in Mistrz Gry (MG) creates a bingo session (board size, custom phrases with an optional "guaranteed on board" flag, reward types with counts), the system draws an N×N board from the seeded catalog plus the MG's phrases, persists it, and shows the MG a short 6-character session code with a board preview. This is the first vertical slice that writes application data; S-02 (player join), S-03 (claim), S-05 (regenerate) build on the schema introduced here.

## Current State Analysis

- Catalogs exist on the hosted Supabase project: `public.phrases` (32 Polish rows) and `public.rewards` (6 rows: `inspiration`, `item`, `side-quest`, `clue`, `npc-help`, `experience`) — `supabase/migrations/20260927134220_phrases_and_rewards.sql`, `supabase/seed.sql`. RLS grants `SELECT` to `anon` and `authenticated`, no writes.
- No application code reads the DB yet. `src/types.ts`, `src/lib/services/`, `src/db/` and any non-auth API route do not exist.
- Auth is complete: `src/lib/supabase.ts` builds an SSR client bound to request cookies (RLS runs as the signed-in user); `src/middleware.ts` attaches `locals.user` and guards `PROTECTED_ROUTES = ["/dashboard"]`.
- Existing UI is a starter: English copy (`Sign in`, `Dashboard`, `10x Astro Starter` hero in `src/components/Welcome.astro`), `<html lang="en">` in `src/layouts/Layout.astro`, "cosmic" glass styling. Forms are React islands (`SignInForm.tsx`) that submit natively to `POST /api/auth/*` and receive errors via `?error=`.
- `zod` is mandated by `CLAUDE.md` for API validation but is **not installed** (`package.json`).
- CI smoke (`.github/workflows/ci.yml` → `scripts/smoke.mjs`) boots a fresh local Supabase with `supabase start`, which applies `supabase/migrations/*` and `seed.sql`, then runs the production preview. Session creation is therefore testable in CI with real catalogs. Astro `checkOrigin` is on; smoke already sends `Origin`.
- Hosted Supabase is the **only** database for development; `npm run dev` targets it. `context/foundation/lessons.md`: never `db reset` on hosted. `context/foundation/infrastructure.md:78`: Workers rollback does not revert migrations → additive, backward-compatible schema only. Workers Free: 10 ms CPU/request, no Node-only APIs → randomness via Web Crypto.

## Desired End State

An MG signs in, opens **Dashboard → Nowa sesja**, sees a form with sane defaults (5×5, no custom phrases, Inspiracja ×3), optionally adds custom phrases (each with a "gwarantowane na planszy" checkbox) and adjusts reward counts, clicks **Generuj planszę**, and lands on `/sessions/<id>` showing a large 6-character code, the N×N board with phrases and reward badges, and a reward legend. The dashboard lists the MG's sessions. Rows exist in `public.sessions` and `public.board_cells` (N² cells, distinct phrases, rewards on exactly Σcount cells), readable only by the owning MG. All screens are in Polish. `npm run smoke` covers the create flow.

### Key Discoveries:

- `src/lib/supabase.ts:5-21` — SSR client factory; reuse for all reads/writes so RLS scopes rows to `auth.uid()`. Type it with the generated `Database` type.
- `src/middleware.ts:4` — prefix-based protection; adding `/sessions` covers `/sessions/new` and `/sessions/<id>`. It does **not** cover `/api/sessions`, so the API route must check `locals.user` itself.
- `src/pages/api/auth/signin.ts` — API routes use `context.locals`/`context.cookies`; new route follows the same shape but returns JSON (`201`/`4xx`) instead of redirects, because the create form is an interactive island that posts JSON.
- `supabase/migrations/20260927134220_phrases_and_rewards.sql:23-45` — per-role, per-operation policy naming (`<table>_<op>_<role>`); follow it.
- `scripts/smoke.mjs:23-37` — `request()` helper supports form bodies and returns `{status, location}` only; needs a `json` option and body passthrough for the new steps.
- `supabase/config.toml:60-65` — `[db.seed]` runs on local start/reset only; hosted gets migrations via human-approved `npx supabase db push` (runbook in `context/archive/2026-09-27-seed-phrase-reward-catalog/change.md`).

## What We're NOT Doing

- Player join, nickname, or any `anon` read path for `sessions`/`board_cells` (S-02 decides how players read boards; no anon policies here)
- Claiming cells, `claimed_by`/`claimed_at` columns, MG undo (S-03, S-04)
- Regenerating a board, closing a session, or any `UPDATE`/`DELETE` policy on `sessions` (S-05; `status` column is created now, nothing sets it to `closed` yet)
- Session expiry / TTL — `status` is the only "active" signal (decision)
- Board sizes other than 3×3, 4×4, 5×5 (decision; PRD Open Q2 stays open for larger boards)
- Free centre cell, line/pattern detection, team rewards (FR-014), custom MG rewards (FR-015)
- Persisting MG custom phrases for reuse across sessions — they are snapshotted into `board_cells.phrase` only
- Category filters (FR-017), admin UI (FR-016)
- Live sync / polling on the MG page
- Translating Supabase-originated auth error strings (e.g. `Invalid login credentials`) — passed through as-is
- Adding a unit-test runner (Vitest etc.) — verification is smoke + manual (decision)
- Changing CI workflow files

## Implementation Approach

1. **Schema first, on hosted.** One additive migration creates `sessions` and `board_cells`, RLS (owner-only for `authenticated`), and a `SECURITY INVOKER` RPC `create_session_with_cells` that inserts the session and all cells in one transaction. The RPC removes the orphan-session failure mode without needing a `DELETE` policy. The migration is pushed to hosted (human-approved) in Phase 1 because development runs against hosted.
2. **Pure generation logic in `src/lib/services/`.** `board-generator.ts` is a deterministic function of (size, predefined phrases, custom phrases with flags, reward counts, RNG). `session-code.ts` produces 6-char codes from a 32-symbol alphabet using `crypto.getRandomValues`. `sessions.service.ts` orchestrates: load catalogs → generate → call RPC, retrying on code collision.
3. **JSON API with zod.** `POST /api/sessions` validates the command, maps generator errors to `400` with Polish messages, returns `201 { id, code }`.
4. **MG UI.** `/sessions/new` renders a React island (dynamic custom-phrase rows with checkboxes, live counters, inline errors). `/sessions/[id]` and the dashboard are static Astro. `/sessions` joins `PROTECTED_ROUTES`.
5. **Polish everywhere + smoke.** Translate all existing screens, extend `smoke.mjs`, record the runbook.

## Critical Implementation Details

**Hosted-first ordering.** Phases 2–3 cannot be exercised locally until the Phase 1 migration is on the hosted project (`npm run dev` uses hosted). Push requires human approval; never `db reset`. Generate `src/db/database.types.ts` **after** the push (`npx supabase gen types typescript --linked --schema public`).

**Code collision handling.** The RPC surfaces a unique violation on `sessions.code` as Postgres `23505`; the service must catch `error.code === "23505"`, draw a new code and retry (max 5 attempts) rather than fail. Any other error propagates.

**Randomness on Workers.** Use the global `crypto.getRandomValues` (Web Crypto); do not import `node:crypto`. With a 32-symbol alphabet, `byte & 31` indexes without modulo bias.

**Dynamic grid columns.** Tailwind 4 cannot see `grid-cols-${size}`; use a fixed map `{3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5"}` merged via `cn()` so classes survive scanning.

**Form checkboxes vs. arrays.** Native `FormData` cannot align per-row checkboxes with their text inputs reliably; the island keeps rows in state and posts JSON. Client-side pre-checks mirror the server limits but the server remains authoritative.

---

## Phase 1: Schema, RPC & types

### Overview

Create the persistence contract for sessions and boards on the hosted project, expose typed access from the app, and add `zod`.

### Changes Required:

#### 1. Sessions + board cells migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_sessions_and_board_cells.sql` (timestamp at implement time; must sort after `20260927134220`)

**Intent**: Introduce the session (= one board, one code) and cell tables with owner-only RLS, plus a transactional insert function, so the app can persist a generated board atomically and later slices can add claim/close behaviour additively.

**Contract**:

- Table `public.sessions`: `id uuid PK DEFAULT gen_random_uuid()`, `gm_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `code text NOT NULL UNIQUE CHECK (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$')`, `size smallint NOT NULL CHECK (size BETWEEN 3 AND 5)`, `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed'))`, `created_at timestamptz NOT NULL DEFAULT now()`. Index on `(gm_id, created_at DESC)`.
- Table `public.board_cells`: `id uuid PK DEFAULT gen_random_uuid()`, `session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE`, `position smallint NOT NULL CHECK (position >= 0)` (row-major, `0 … size²−1`), `phrase text NOT NULL`, `reward_id uuid NULL REFERENCES public.rewards(id)`, `UNIQUE (session_id, position)`, `UNIQUE (session_id, phrase)`.
- RLS enabled on both. Policies (per-role, per-operation naming as in the F-01 migration): `sessions_select_authenticated USING (gm_id = auth.uid())`, `sessions_insert_authenticated WITH CHECK (gm_id = auth.uid())`, `board_cells_select_authenticated USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.gm_id = auth.uid()))`, `board_cells_insert_authenticated WITH CHECK (same predicate)`. **No** `anon` policies, **no** `UPDATE`/`DELETE` policies.
- Function `public.create_session_with_cells(p_code text, p_size smallint, p_cells jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public`: raises if `jsonb_array_length(p_cells) <> p_size * p_size`; inserts the session with `gm_id = auth.uid()`; inserts cells via `jsonb_to_recordset(p_cells) AS c(position smallint, phrase text, reward_id uuid)`; returns the new `sessions.id`. `REVOKE EXECUTE … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated`. Unique violations propagate to the caller.
- Apply to hosted **only after human approval** via `npx supabase db push` (never `db reset`).

#### 2. Generated database types

**File**: `src/db/database.types.ts` (new)

**Intent**: Give supabase-js compile-time knowledge of tables and the RPC so services and pages are typed end-to-end.

**Contract**: Output of `npx supabase gen types typescript --linked --schema public` after the migration is pushed; committed to the repo. `src/lib/supabase.ts` passes `Database` as the generic to `createServerClient<Database>`. Regenerate whenever a migration lands (note in change.md runbook).

#### 3. Shared types and DTOs

**File**: `src/types.ts` (new)

**Intent**: Single home for entity aliases and the create-session command/response contract used by the API, service, island and smoke expectations.

**Contract**:

- Entity aliases from `Database["public"]["Tables"]`: `Phrase`, `Reward`, `Session`, `BoardCell`; `SessionStatus = "active" | "closed"`; `BoardSize = 3 | 4 | 5`; `BOARD_SIZES = [3, 4, 5] as const`; `SESSION_CODE_LENGTH = 6`.
- `CustomPhraseInput { text: string; guaranteed: boolean }`, `RewardCountInput { rewardId: string; count: number }`, `CreateSessionCommand { size: BoardSize; customPhrases: CustomPhraseInput[]; rewards: RewardCountInput[] }`.
- `CreateSessionResponse { id: string; code: string }`, `ApiErrorResponse { error: string }`.
- `GeneratedCell { position: number; phrase: string; rewardId: string | null }`; `SessionWithCells = Session & { cells: (BoardCell & { reward: Pick<Reward, "slug" | "label"> | null })[] }`.

#### 4. Dependency

**File**: `package.json`

**Intent**: Install `zod` (required by `CLAUDE.md` for API validation).

**Contract**: `zod` in `dependencies`; lockfile updated via `npm install zod`.

### Success Criteria:

#### Automated Verification:

- Human-approved `npx supabase db push` applies the migration on the hosted project without error (never `db reset`)
- SQL check on hosted: `public.sessions`, `public.board_cells` exist with the columns, CHECKs, UNIQUEs and FKs above, RLS enabled, exactly the four policies listed, and `public.create_session_with_cells` exists with EXECUTE granted only to `authenticated`
- Anon key: `SELECT` on `sessions`/`board_cells` returns 0 rows, `INSERT` is rejected (42501), and calling the RPC is rejected
- `src/db/database.types.ts` generated from hosted, `src/types.ts` compiles, `src/lib/supabase.ts` is typed, and `npx astro check` passes
- `zod` is in `package.json` dependencies; `npm run lint` passes

#### Manual Verification:

- Human reviews the migration SQL (RLS predicates, CHECK regex/alphabet, GRANT/REVOKE on the function) before approving the push

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Generation domain & API

### Overview

Implement the pure board generator, code generator, session service and the validated `POST /api/sessions` endpoint.

### Changes Required:

#### 1. Session code generator

**File**: `src/lib/services/session-code.ts` (new)

**Intent**: Produce short, unambiguous session codes that satisfy the NFR (< 1 hit per 100 000 guesses) and are easy to read aloud at the table.

**Contract**: `SESSION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"` (32 symbols; no `0/O/1/I`), `generateSessionCode(): string` returns exactly `SESSION_CODE_LENGTH` (6) symbols using `crypto.getRandomValues` and `byte & 31`. Export `SESSION_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/` (mirrors the DB CHECK).

#### 2. Board generator

**File**: `src/lib/services/board-generator.ts` (new)

**Intent**: Deterministically turn MG inputs plus the catalog into `size²` cells with unique phrases and rewards on random distinct cells, encoding the agreed rules (guaranteed customs, dedupe, pool shortage, reward caps).

**Contract**:

- `normalizePhrase(text: string): string` — trim, collapse internal whitespace to one space, `toLocaleLowerCase("pl")`.
- `generateBoard(input: { size: BoardSize; predefined: string[]; customPhrases: CustomPhraseInput[]; rewards: RewardCountInput[]; random?: () => number }): GeneratedCell[]`.
- Rules, in order:
  1. Trim custom texts; drop empty. Collapse custom duplicates (by normalized form) into the first occurrence; `guaranteed = true` if any duplicate was guaranteed.
  2. A custom phrase whose normalized form matches a predefined phrase **wins**: the predefined entry is removed from the pool; the custom entry keeps its text and flag.
  3. `cells = size²`. If `guaranteedCount > cells` → throw `BoardGenerationError("TOO_MANY_GUARANTEED")`.
  4. Pool = non-guaranteed customs + remaining predefined. If `pool.length < cells − guaranteedCount` → throw `BoardGenerationError("POOL_TOO_SMALL", { missing: cells − guaranteedCount − pool.length })`.
  5. Phrases = all guaranteed customs + `cells − guaranteedCount` drawn from the pool without replacement; Fisher–Yates shuffle over positions `0 … cells−1`.
  6. Expand rewards to a list of `rewardId` repeated `count` times (skip `count = 0`). If `list.length > cells` → throw `BoardGenerationError("TOO_MANY_REWARDS")`. Assign each to a distinct random position; one reward per cell max.
- `random` defaults to a Web-Crypto-backed uniform `[0,1)`; injectable for manual repeatability.
- `BoardGenerationError extends Error { code: "TOO_MANY_GUARANTEED" | "POOL_TOO_SMALL" | "TOO_MANY_REWARDS"; missing?: number }`.

#### 3. Sessions service

**File**: `src/lib/services/sessions.service.ts` (new)

**Intent**: Orchestrate create/read operations against Supabase for the API route and pages, keeping RLS as the ownership boundary.

**Contract**:

- `createSession(supabase, command: CreateSessionCommand): Promise<CreateSessionResponse>` — loads `phrases.text` and `rewards.id`; unknown `rewardId` → throw `SessionServiceError("UNKNOWN_REWARD")`; calls `generateBoard`; loops ≤ 5 times: `generateSessionCode()` → `supabase.rpc("create_session_with_cells", { p_code, p_size, p_cells })`; on `error.code === "23505"` retry, other errors throw; after 5 collisions throw `SessionServiceError("CODE_COLLISION")`.
- `listSessionsForGm(supabase): Promise<Session[]>` — own sessions, newest first (RLS scopes rows).
- `getSessionWithCells(supabase, id: string): Promise<SessionWithCells | null>` — session + cells ordered by `position`, each cell joined with `rewards(slug,label)`; `null` when not found/not owned.

#### 4. Command schema

**File**: `src/lib/schemas/session.ts` (new)

**Intent**: One zod schema shared by the API route (authoritative) and the island (pre-validation), with Polish messages.

**Contract**: `createSessionSchema` → `CreateSessionCommand`: `size` ∈ `{3,4,5}`; `customPhrases` array max 50, each `text` trimmed 1–120 chars, `guaranteed` boolean; `rewards` array with unique `rewardId` (uuid), `count` integer 0–25. Cross-field refinements: `guaranteed count ≤ size²` ("Zbyt wiele haseł gwarantowanych — maksymalnie N"), `Σ count ≤ size²` ("Zbyt wiele nagród — maksymalnie N").

#### 5. Create-session endpoint

**File**: `src/pages/api/sessions/index.ts` (new)

**Intent**: Accept the MG's JSON command, validate, create the session, and return the id + code.

**Contract**: `export const prerender = false; export const POST: APIRoute`. `locals.user` missing → `401 { error: "Wymagane logowanie" }`. Non-JSON body → `400`. zod failure → `400 { error: <first issue message> }`. `BoardGenerationError` → `400` with Polish text (`POOL_TOO_SMALL` → "Za mało haseł na planszę N×N — dodaj jeszcze M własnych haseł"). `UNKNOWN_REWARD` → `400`. `CODE_COLLISION`/other → `500 { error: "Nie udało się utworzyć sesji" }`. Success → `201 { id, code }`. Supabase client missing → `500`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` and `npx astro check` pass
- Signed-in `POST /api/sessions` with `{ "size": 5, "customPhrases": [], "rewards": [] }` returns `201 { id, code }` where `code` matches `^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$`, and hosted SQL shows 25 `board_cells` for that session with distinct phrases and positions `0–24`
- Signed-in `POST /api/sessions` with `rewards: [{ inspiration id, count: 3 }]` yields exactly 3 cells with that `reward_id` and 22 with `NULL`
- Anonymous `POST /api/sessions` returns `401` JSON
- Invalid commands return `400` with a Polish message: `size: 6`; 26 guaranteed customs on 5×5; `Σ count = 26`; unknown `rewardId`

#### Manual Verification:

- Create with 3 custom phrases (2 guaranteed, one of them equal to a predefined phrase in different case/whitespace): both guaranteed appear on the board, the matching phrase appears exactly once, the non-guaranteed one may or may not appear
- Code review of `board-generator.ts` confirms the `POOL_TOO_SMALL` branch and message (unreachable with the current 32-phrase catalog at ≤ 5×5)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: MG UI

### Overview

Add the create form, the session page and the dashboard list; protect `/sessions`.

### Changes Required:

#### 1. Route protection

**File**: `src/middleware.ts`

**Intent**: Require sign-in for all MG session pages.

**Contract**: `PROTECTED_ROUTES = ["/dashboard", "/sessions"]`. API route keeps its own `401` check.

#### 2. New session page

**File**: `src/pages/sessions/new.astro` (new)

**Intent**: Server-render the create screen with the rewards catalog and defaults, hosting the interactive form island.

**Contract**: Loads `rewards` (ordered by `created_at`) via the SSR client; renders `<NewSessionForm rewards={rewards} client:load />` inside the cosmic layout with heading "Nowa sesja" and a link back to `/dashboard`. Title "Nowa sesja".

#### 3. Create form island

**File**: `src/components/sessions/NewSessionForm.tsx` (new), hook `src/components/hooks/useCreateSession.ts` (new)

**Intent**: Let the MG set size, custom phrases with per-row "gwarantowane" checkboxes, and reward counts; submit JSON; show errors inline without losing input.

**Contract**:

- Props: `rewards: Pick<Reward, "id" | "slug" | "label" | "description">[]`.
- State defaults: `size = 5`; `customPhrases = []` (one empty row rendered for discoverability; empty rows are dropped on submit); `rewards` counts = `3` for `slug === "inspiration"`, `0` otherwise.
- Controls: size radio/select (`3×3`, `4×4`, `5×5`); custom rows = text input + checkbox "Gwarantowane na planszy" + remove button, "Dodaj hasło" button; per-reward number input `0 … size²` with label + description.
- Live counters: "Gwarantowane: X / N²", "Nagrody: Y / N²"; submit disabled while pending or when either counter exceeds `N²`.
- Submit: `fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body })`; `201` → `window.location.assign(`/sessions/${id}`)`; otherwise render `error` via `ServerError`. Reuse `FormField`-like styling and `Button`; use `cn()` for conditional classes.
- Hook `useCreateSession()` owns pending/error state and the `fetch` call.

#### 4. Session page

**File**: `src/pages/sessions/[id].astro` (new), component `src/components/sessions/BoardGrid.astro` (new)

**Intent**: Show the MG the code to read aloud and a read-only preview of the generated board with rewards.

**Contract**:

- Validate `id` as uuid; `getSessionWithCells` → `null` ⇒ `return new Response("Nie znaleziono sesji", { status: 404 })`.
- Header: session code as the dominant element (large, monospace, letter-spaced, `aria-label="Kod sesji"`), size `N×N`, status badge ("Aktywna"), created date, link "Wróć do panelu".
- `BoardGrid` props: `size`, `cells` (ordered by position). Renders `grid` with `cn(GRID_COLS[size])`, one tile per cell: phrase text, reward badge (`reward.label`) when present. Tiles must fit a ~6" portrait phone without horizontal scroll (≤ `max-w-md`, small text, `break-words`).
- Legend: each reward used on the board with its count.

#### 5. Dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Turn the placeholder into the MG entry point: create a session, revisit existing ones.

**Contract**: Heading "Panel MG", primary CTA "Nowa sesja" → `/sessions/new`, list from `listSessionsForGm` (code, `N×N`, status, created date; each row links to `/sessions/<id>`), empty state "Nie masz jeszcze żadnej sesji", sign-out form retained. Polish copy.

### Success Criteria:

#### Automated Verification:

- `npm run lint` and `npx astro check` pass
- Anonymous `GET /sessions/new` and `GET /sessions/<id>` redirect `302` to `/auth/signin`
- Signed-in `GET /sessions/new` → `200`; `GET /sessions/<own id>` → `200`; `GET /sessions/<random uuid>` → `404`

#### Manual Verification:

- Form defaults are 5×5 and Inspiracja ×3 (others 0); rows can be added/removed; counters update live; over-limit blocks submit client-side; a server `400` shows inline and inputs are preserved
- After generate, the session page shows a 6-character code readable from across a table, the N×N grid with phrases, reward badges on exactly the rewarded cells, and a legend; on a ~6" phone in portrait the 5×5 grid needs no horizontal scroll or zoom
- Dashboard shows "Nowa sesja", lists own sessions newest first with working links, and shows the empty state for a fresh account

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Polish copy, smoke & runbook

### Overview

Make the whole app Polish, extend the smoke test to the create flow, and record how the schema was applied.

### Changes Required:

#### 1. Layout and landing

**Files**: `src/layouts/Layout.astro`, `src/components/Welcome.astro`, `src/components/Topbar.astro`

**Intent**: Replace starter branding with RPG Bingo in Polish.

**Contract**: `<html lang="pl">`, default title "RPG Bingo". `Welcome.astro`: hero "RPG Bingo" with a one-paragraph product description from the PRD vision, CTAs "Zaloguj się" / "Załóż konto", three feature cards (MG tworzy planszę w chwilę / Gracze dołączają kodem z telefonu / Nagrody bez uznaniowości). `Topbar.astro`: "Panel MG", "Wyloguj", "Niezalogowany", "Zaloguj się", "Załóż konto".

#### 2. Auth screens

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`, `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/PasswordToggle.tsx`, `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`

**Intent**: Polish labels, placeholders, validation messages, button texts, aria-labels and the "Supabase is not configured" API message.

**Contract**: All hard-coded English UI strings replaced (titles, headings, labels, placeholders, validation errors, `pendingText`, link texts, `aria-label`s, confirm-email variants). Password hint avoids Polish plural pitfalls ("Minimum 6 znaków — brakuje N"). Routes, form field `name`s and redirect targets unchanged so `scripts/smoke.mjs` expectations still hold. Supabase error strings pass through untranslated.

#### 3. Smoke extension

**File**: `scripts/smoke.mjs`

**Intent**: Prove in CI (fresh local Supabase with migrations + seed) that session creation works end to end with RLS and auth.

**Contract**: `request()` gains a `json` option (sets `Content-Type: application/json`, serialises body) and returns `body` (parsed JSON when the response is JSON). Steps added: before sign-in — `POST /api/sessions` anonymous → `401`; `GET /sessions/new` anonymous → `302 /auth/signin`. After "dashboard renders for signed-in user" — `GET /sessions/new` → `200`; `POST /api/sessions` with `{ size: 5, customPhrases: [{ text: "Hasło ze smoke", guaranteed: true }], rewards: [] }` → `201` and `body.code` matches `^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$`; `GET /sessions/<body.id>` → `200`. After sign-out — `GET /sessions/<id>` → `302 /auth/signin`. Expectation objects may carry an optional `check(body)` predicate; zero dependencies preserved.

#### 4. Runbook notes

**File**: `context/changes/gm-create-session-board/change.md` (`## Notes`)

**Intent**: Record how the schema reached hosted and how to keep types in sync, so later slices do not re-derive it.

**Contract**: Notes cover: migration filename and `npx supabase db push` (human-approved, never reset); `npx supabase gen types typescript --linked --schema public > src/db/database.types.ts` after every migration; RLS/anon checks used; smoke steps added; decision summary (single entity, 6-char code, guaranteed checkbox, sizes 3–5, Inspiracja ×3, `status` only, Polish everywhere).

### Success Criteria:

#### Automated Verification:

- `npm run build` then `npm run smoke` against `npm run preview` passes with the new steps (locally against hosted or in CI)
- `npm run lint` and `npx astro check` pass; `src/layouts/Layout.astro` contains `lang="pl"`
- `rg -n "Sign in|Sign up|Sign out|Create account|Check your email|10x Astro Starter|Not signed in" src/` returns no matches

#### Manual Verification:

- Walk signup → confirm-email → signin → dashboard → nowa sesja → session page → signout; every screen is Polish and the only English text that can appear is a Supabase-originated error
- `change.md` Notes are sufficient to re-apply the schema and regenerate types without reading this plan

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

- None (no runner in repo — decision). `board-generator.ts` stays pure with an injectable `random` so a runner can be added later without refactoring.

### Integration Tests:

- `scripts/smoke.mjs` (Phase 4) against the production preview: anonymous `401`/`302`, signed-in create `201` + code format, session page `200`, post-signout `302`. CI runs it on a fresh local Supabase with migrations + seed.
- Hosted SQL assertions in Phases 1–2 (schema, RLS, cell counts, reward distribution).

### Manual Testing Steps:

1. Approve and push the migration; confirm tables, policies and function on hosted; run anon RLS probes.
2. Create a default session via the UI; verify 25 cells, 3 Inspiracja badges, code readable.
3. Create a 3×3 session with 9 guaranteed custom phrases → all 9 on board, no predefined; with 10 guaranteed → client blocks, server returns `400` if forced.
4. Add a custom phrase equal to a predefined one in different case → appears once.
5. Set rewards Σ = 26 on 5×5 → blocked/400.
6. Open a session page from a second account → `404`.
7. Check the 5×5 page on a phone in portrait: no horizontal scroll.
8. Full Polish walkthrough (Phase 4).

## Performance Considerations

- One create = 2 catalog reads (≤ 40 rows) + 1 RPC inserting ≤ 25 rows; well within Workers Free CPU budget. Generation is O(n) over ~60 strings.
- Session page = 1 query with a `rewards` join on ≤ 25 rows. Dashboard = 1 query on own sessions.

## Migration Notes

- Additive only (two new tables, one function). Backward-compatible with the current Worker version; a Workers rollback leaves the schema in place harmlessly.
- Apply order: push migration → regenerate types → implement. Never `supabase db reset` on hosted (`context/foundation/lessons.md`).
- Later slices extend additively: S-03 adds claim columns to `board_cells`; S-05 adds an `UPDATE` policy for `sessions.status`; S-02 defines the player read path (likely server-side reads by `code` with a dedicated policy or function). None of that is pre-built here.

## References

- Roadmap item S-01: `context/foundation/roadmap.md` (Change ID `gm-create-session-board`)
- PRD: `context/foundation/prd.md` (US-01, FR-004, FR-005, FR-006, NFR code guessing, Business Logic, Open Q2)
- Lessons: `context/foundation/lessons.md` (never `db reset` on hosted)
- Infra: `context/foundation/infrastructure.md` (migration/rollback coupling, Workers CPU limit)
- F-01 contract and runbook: `supabase/migrations/20260927134220_phrases_and_rewards.sql`, `supabase/seed.sql`, `context/archive/2026-09-27-seed-phrase-reward-catalog/change.md`
- Patterns: `src/lib/supabase.ts`, `src/middleware.ts`, `src/pages/api/auth/signin.ts`, `src/components/auth/SignInForm.tsx`, `scripts/smoke.mjs`
- Conventions: `CLAUDE.md`, `AGENTS.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema, RPC & types

#### Automated

- [x] 1.1 Human-approved `npx supabase db push` applies the migration on the hosted project without error (never `db reset`) — fa7ae03
- [x] 1.2 SQL check on hosted: `public.sessions`, `public.board_cells` exist with the columns, CHECKs, UNIQUEs and FKs above, RLS enabled, exactly the four policies listed, and `public.create_session_with_cells` exists with EXECUTE granted only to `authenticated` — fa7ae03
- [x] 1.3 Anon key: `SELECT` on `sessions`/`board_cells` returns 0 rows, `INSERT` is rejected (42501), and calling the RPC is rejected — fa7ae03
- [x] 1.4 `src/db/database.types.ts` generated from hosted, `src/types.ts` compiles, `src/lib/supabase.ts` is typed, and `npx astro check` passes — fa7ae03
- [x] 1.5 `zod` is in `package.json` dependencies; `npm run lint` passes — fa7ae03

#### Manual

- [x] 1.6 Human reviews the migration SQL (RLS predicates, CHECK regex/alphabet, GRANT/REVOKE on the function) before approving the push — fa7ae03

### Phase 2: Generation domain & API

#### Automated

- [x] 2.1 `npm run lint` and `npx astro check` pass — 8f1ae80
- [x] 2.2 Signed-in `POST /api/sessions` with `{ "size": 5, "customPhrases": [], "rewards": [] }` returns `201 { id, code }` where `code` matches `^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$`, and hosted SQL shows 25 `board_cells` for that session with distinct phrases and positions `0–24` — 8f1ae80
- [x] 2.3 Signed-in `POST /api/sessions` with `rewards: [{ inspiration id, count: 3 }]` yields exactly 3 cells with that `reward_id` and 22 with `NULL` — 8f1ae80
- [x] 2.4 Anonymous `POST /api/sessions` returns `401` JSON — 8f1ae80
- [x] 2.5 Invalid commands return `400` with a Polish message: `size: 6`; 26 guaranteed customs on 5×5; `Σ count = 26`; unknown `rewardId` — 8f1ae80

#### Manual

- [x] 2.6 Create with 3 custom phrases (2 guaranteed, one of them equal to a predefined phrase in different case/whitespace): both guaranteed appear on the board, the matching phrase appears exactly once, the non-guaranteed one may or may not appear — 8f1ae80
- [x] 2.7 Code review of `board-generator.ts` confirms the `POOL_TOO_SMALL` branch and message (unreachable with the current 32-phrase catalog at ≤ 5×5) — 8f1ae80

### Phase 3: MG UI

#### Automated

- [x] 3.1 `npm run lint` and `npx astro check` pass — 27b031a
- [x] 3.2 Anonymous `GET /sessions/new` and `GET /sessions/<id>` redirect `302` to `/auth/signin` — 27b031a
- [x] 3.3 Signed-in `GET /sessions/new` → `200`; `GET /sessions/<own id>` → `200`; `GET /sessions/<random uuid>` → `404` — 27b031a

#### Manual

- [x] 3.4 Form defaults are 5×5 and Inspiracja ×3 (others 0); rows can be added/removed; counters update live; over-limit blocks submit client-side; a server `400` shows inline and inputs are preserved — 27b031a
- [x] 3.5 After generate, the session page shows a 6-character code readable from across a table, the N×N grid with phrases, reward badges on exactly the rewarded cells, and a legend; on a ~6" phone in portrait the 5×5 grid needs no horizontal scroll or zoom — 27b031a
- [x] 3.6 Dashboard shows "Nowa sesja", lists own sessions newest first with working links, and shows the empty state for a fresh account — 27b031a

### Phase 4: Polish copy, smoke & runbook

#### Automated

- [x] 4.1 `npm run build` then `npm run smoke` against `npm run preview` passes with the new steps (locally against hosted or in CI)
- [x] 4.2 `npm run lint` and `npx astro check` pass; `src/layouts/Layout.astro` contains `lang="pl"`
- [x] 4.3 `rg -n "Sign in|Sign up|Sign out|Create account|Check your email|10x Astro Starter|Not signed in" src/` returns no matches

#### Manual

- [x] 4.4 Walk signup → confirm-email → signin → dashboard → nowa sesja → session page → signout; every screen is Polish and the only English text that can appear is a Supabase-originated error
- [x] 4.5 `change.md` Notes are sufficient to re-apply the schema and regenerate types without reading this plan
