# Signup Vintage Paper — Implementation Plan

## Overview

Restyle `/auth/signup` onto the Vintage Paper card `/auth/signin` already uses, send a signed-in visitor to `/dashboard`, gate the 7-state matrix with a production-blocked kitchen sink, and extend the literal-scan / agent-rule guard. Tokens and shared auth controls stay as left by `ui-auth-signin`. A successful signup POST still redirects to `/auth/confirm-email`.

## Current State Analysis

- Tokens and dark-only layout already live: `src/styles/global.css` (`:root` / `.dark` → `@theme inline`). Sign-in (`src/pages/auth/signin/index.astro:13–20`) uses `bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, and `text-primary`.
- `/auth/signup` (`src/pages/auth/signup.astro:9–17`) is still the cosmic glass card: `bg-cosmic`, white glass, a blue-to-purple heading, and blue/purple footer text. That is 7 palette-class occurrences plus `bg-cosmic` on this file.
- `SignUpForm.tsx` already imports `FormField`, `PasswordToggle`, `SubmitButton`, and `ServerError`. Those four files are in `SCOPED_FILES` and use role classes. The password hint at `SignUpForm.tsx:59` is `text-blue-100/50`. `FormField.tsx:62–68` wraps errors in `text-destructive` and renders `hint` with no wrapper classes.
- `FormField` sets `name={name ?? id}` (`FormField.tsx:49`). Email and password on signup omit `name`, so the posted name is the `id`. Confirm-password sets `name="confirmPassword"`.
- Middleware guards only `/dashboard` and `/sessions` (`middleware.ts:4`). A signed-in GET of `/auth/signin` redirects to `/dashboard` (`signin/index.astro:5–7`). A signed-in GET of `/auth/signup` still renders the form.
- Client validation calls `preventDefault` when invalid (`SignUpForm.tsx:51–54`). A valid submit is a native `POST` to `/api/auth/signup`. The API reads `email` and `password` and has no JSON branch (`signup.ts:6–19`). Failure returns `/auth/signup?error=`. Success goes to `/auth/confirm-email`.
- There is no signup kitchen sink. `SCOPED_FILES` (`scripts/check-ui-literals.mjs:9–27`) does not list `signup.astro` or `SignUpForm.tsx`.
- Research: `context/changes/ui-auth-signup/research.md` (charges C1–C4). The non-2xx lesson does not apply to `?error=` on this form page (same ruling as `context/changes/ui-auth-signin/plan.md`).

## Desired End State

A logged-out visitor sees a Vintage Paper signup card matching sign-in: paper shell, Polish copy, a muted “characters left” hint, destructive field errors with text plus an icon. A visitor who already has a session and opens `/auth/signup` lands on `/dashboard`. After a successful password POST they still land on `/auth/confirm-email`, which stays the cosmic card. Dev `/auth/signup/kitchen-sink` shows the matrix (empty marked N/A), including confirm-password mismatch and the hint. Lint fails if palette or `bg-cosmic` returns on the cleaned signup files.

### Key Discoveries:

- Astro cannot keep both `signup.astro` and `signup/kitchen-sink.astro`. Relocate to `src/pages/auth/signup/index.astro` first (same constraint as sign-in, `context/changes/ui-auth-signin/plan.md:22`).
- C1 clears by copying the sign-in card classes. No `card.tsx` in `src/components/ui/`. Do not add one.
- The hint is visible when there is no password error, the password is non-empty, and its length is below 6 (`SignUpForm.tsx:57–62`). An empty default section does not show C2. The focus section of the sink prefills a 1–5 character password so the muted hint is on screen.
- Redirect belongs on the signup page. A middleware prefix on `/auth/signup` would also send logged-in developers away from the kitchen sink.
- `SignInForm` now submits with `fetch` (`SignInForm.tsx:96–100`). Signup must not copy that. `signup.ts` is form POST plus redirects. The sink uses `demoState` and `preventDefault`.
- `useFormStatus().pending` is wired to a native POST (`SubmitButton`). The browser may navigate before the spinner paints. The sink forces `pending`; the live flash is checked by hand.

## What We're NOT Doing

- Redepositing Vintage Paper tokens, fonts, or changing dark-only Layout.
- Restyling `confirm-email.astro`, Welcome, Topbar, or sign-in. Removing `bg-cosmic` from `global.css`.
- Adding shadcn `Card`. Editing `FormField`, `SubmitButton`, `PasswordToggle`, `ServerError`, `input.tsx`, or `button.tsx`. Adding those primitives to `SCOPED_FILES`.
- Changing signup’s POST destination, field names, or Polish validation strings. Adding a JSON branch to `signup.ts`. Converting signup to `fetch`.
- Mapping a failed signup onto HTTP 503.
- Playwright / screenshot CI. Editing inside any `<!-- BEGIN @przeprogramowani/10x-cli -->` … `<!-- END -->` block.
- Widening `LITERAL_RE`.

## Implementation Approach

`/10x-ui` order with the library and token-value phases skipped: **one view** (relocate, role classes, muted hint, signed-in redirect) → **states** (kitchen sink) → **guard** (`SCOPED_FILES` + rules). Shared controls stay the sign-in implementation. Preserve Polish copy, `email` / `password` / `confirmPassword`, and `POST /api/auth/signup`.

## Critical Implementation Details

**Route order:** Move `src/pages/auth/signup.astro` to `src/pages/auth/signup/index.astro` before adding the sink. `/auth/signup` stays the same URL. Links from sign-in stay `/auth/signup`.

**Redirect scope:** In the signup page frontmatter, when `Astro.locals.user` is set, `return Astro.redirect("/dashboard")`. Do not add a middleware match on `/auth/signup`. Leave `signup.ts` success on `/auth/confirm-email`.

**Posted names:** Suffix field `id`s with `demoState`, and set `name` to `email`, `password`, and `confirmPassword`. `FormField` uses `name ?? id` (`FormField.tsx:49`). A suffixed id without an explicit name would POST `email-error` instead of `email`.

**Pending and the sink:** Keep the native `method="POST"` and `useFormStatus` for a real submit. When `demoState` is set, `onSubmit` calls `preventDefault` and returns before validation. `loading` passes `pending` so the label is `Tworzenie konta...` and the submit is disabled. If a real submit navigates before the spinner paints, record that live flash as N/A with that reason. Do not switch the form to `fetch`.

**Hint in the sink:** The focus section prefills password with a 1–5 character value and no password error, so the hint renders. The error section sets a password error, which hides the hint (`FormField.tsx:62–68`). Do not copy `ring-[3px]` into `SignUpForm` or the sink. Focus uses `border-ring ring-ring/50 ring-2`, as `SignInForm.tsx:136`.

---

## Phase 1: One view + signed-in entry

### Overview

Relocate the page, restyle the card and the password hint onto role classes, and redirect a signed-in GET to `/dashboard`. Closes C1, C2, and C3.

### Changes Required:

#### 1. Relocate the signup route

**File**: `src/pages/auth/signup.astro` → `src/pages/auth/signup/index.astro`

**Intent**: Free `auth/signup/` for a sibling kitchen sink without changing `/auth/signup`.

**Contract**: Same URL. Delete the flat `signup.astro` after the move. The sign-in link target stays `/auth/signup`.

#### 2. Tokenized page shell

**File**: `src/pages/auth/signup/index.astro`

**Intent**: Close C1 — the create-account card uses the same paper language as sign-in.

**Contract**: Match `signin/index.astro:13–20`. Outer `bg-background`; card `border-border bg-card text-foreground` at the current `max-w-sm` width; title `text-foreground` (no gradient); helper line `text-muted-foreground`; sign-in link `text-primary` with `hover:underline`. Keep the Polish title, helper, and link. Drop `backdrop-blur-xl`. Zero palette, `bg-cosmic`, hex, or arbitrary px|rem on this page.

#### 3. Password hint

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: Close C2 — the live “characters left” line uses the same muted role as other helper text.

**Contract**: The hint node at the current `text-blue-100/50` paragraph uses `text-muted-foreground`. Keep the visibility rule (no password error, non-empty, length below 6) and the Polish sentence. Do not wrap hint inside `FormField`; that component renders the node as given.

#### 4. Signed-in entry

**File**: `src/pages/auth/signup/index.astro`

**Intent**: Close C3 — a person who already has a session and opens the signup link continues into Panel MG.

**Contract**: When `Astro.locals.user` is set, redirect to `/dashboard` before the form renders. Logged-out GET still renders the form, including `?error=`. Do not change `src/pages/api/auth/signup.ts`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npx astro check` passes
- `npm run build` passes
- Hardcoded-value scan (`LITERAL_RE` from `scripts/check-ui-literals.mjs`) on `src/pages/auth/signup/index.astro` and `src/components/auth/SignUpForm.tsx` reports 0 hits, and those files contain no `white` or `black` colour utilities

#### Manual Verification:

- Logged-out desktop and one mobile width: the card uses role tokens (no cosmic purple glass), Polish copy unchanged
- Logged-in GET `/auth/signup` redirects to `/dashboard`; a successful signup POST still lands on `/auth/confirm-email`
- Keyboard focus is visible on email, password, confirm-password, both password toggles, submit, and the sign-in link
- A 1–5 character password shows the muted hint; invalid fields and `?error=` show text plus an icon in destructive roles

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before Phase 2.

---

## Phase 2: Kitchen-sink + visual gate

### Overview

Dev-only gallery of signup states for screenshot review (C4’s missing gate).

### Changes Required:

#### 1. Demo states on the existing form

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: The sink renders the same form the page uses, including confirm-password error, the hint, and pending, without posting to the API.

**Contract**: Optional `demoState` of `default | focus | error | loading`. Production passes only `serverError`. When `demoState` is set, `onSubmit` calls `preventDefault` and returns. `loading` passes `pending` (`Tworzenie konta...`, disabled submit). `error` shows a field message on email, password, and confirm-password (mismatch copy already in `validate()`) plus a `ServerError` string. `focus` sets `autoFocus` on email, the ring classes `border-ring ring-ring/50 ring-2`, and a password value of length 1–5 with no password error so the hint shows. Suffix field `id`s with `demoState`. Set `name` to `email`, `password`, and `confirmPassword`.

#### 2. Kitchen-sink page

**File**: `src/pages/auth/signup/kitchen-sink.astro`

**Intent**: One screen for default, hover/focus, error, and loading/disabled, plus an explicit empty N/A.

**Contract**: If `import.meta.env.PROD`, return 404. Sections follow `signin/kitchen-sink.astro:9–44`: default; hover/focus; error; loading/disabled (one section — on this form disabled exists during pending); empty as a labeled N/A because the screen is a form, not a collection. Reuse `SignUpForm` with `demoState` inside the same card shell as the page. No middleware change. The page-level user redirect does not apply to this route.

#### 3. Screenshots

**Files**: `context/changes/ui-auth-signup/screenshots/` (desktop + one mobile width)

**Intent**: Visual gate evidence for review.

**Contract**: Capture the kitchen sink at two widths. No Playwright requirement.

### Success Criteria:

#### Automated Verification:

- Kitchen-sink file exists and returns 404 when `import.meta.env.PROD`
- `npm run lint` and `npx astro check` pass
- Hardcoded-value scan (`LITERAL_RE` from `scripts/check-ui-literals.mjs`) on `src/pages/auth/signup/kitchen-sink.astro` and `src/components/auth/SignUpForm.tsx` reports 0 hits

#### Manual Verification:

- In DEV, `/auth/signup/kitchen-sink` shows default, hover/focus (ring and the muted hint), error (email, password, confirm-password mismatch, and `ServerError`), and loading/disabled; empty is N/A because the screen is a form
- Desktop and one mobile-width screenshots saved under `context/changes/ui-auth-signup/screenshots/`
- Preview/PROD: kitchen-sink is not usable as the signup UI
- A real signup submit is checked; if the spinner does not paint before navigation, that live flash is recorded N/A with that reason

**Implementation Note**: Phase complete after screenshots are reviewed against tokens and charges C1–C3.

---

## Phase 3: Guard — SCOPED_FILES + agent rules

### Overview

Make the contract stick for the next agent (C4).

### Changes Required:

#### 1. Literal scan scope

**File**: `scripts/check-ui-literals.mjs`

**Intent**: Fail lint if palette or `bg-cosmic` returns on the cleaned signup files.

**Contract**: Add `src/pages/auth/signup/index.astro`, `src/pages/auth/signup/kitchen-sink.astro`, and `src/components/auth/SignUpForm.tsx` to `SCOPED_FILES`. Do not add `confirm-email.astro`, `input.tsx`, or `button.tsx`. Leave the sign-in files and shared primitives as already listed.

#### 2. Agent rule pointers

**Files**: `CLAUDE.md` (§ UI / design tokens), `AGENTS.md` (UI hard rule)

**Intent**: Point agents at the signup kitchen sink next to the sign-in sink.

**Contract**: Extend the kitchen-sink mention at `CLAUDE.md:52` and `AGENTS.md:12` to include `/auth/signup/kitchen-sink`. Keep the token source, `src/components/ui`, and the no-literals rule. Do not edit inside any `<!-- BEGIN @przeprogramowani/10x-cli -->` … `<!-- END -->` block.

### Success Criteria:

#### Automated Verification:

- The three signup files are listed in `SCOPED_FILES`; `npm run lint` passes on the clean tree
- Introducing a banned literal in a scoped signup file fails `npm run lint:ui-literals`

#### Manual Verification:

- `CLAUDE.md` and `AGENTS.md` name the token source, `src/components/ui`, the no-literals rule, and `/auth/signup/kitchen-sink`

---

## Testing Strategy

### Unit Tests:

- None (repo has no unit runner). Rely on lint, `astro check`, and build.

### Integration Tests:

- Optional: `npm run smoke` after Phase 1 if the auth flow is still green. Smoke is not the visual gate.

### Manual Testing Steps:

1. Logged out: open `/auth/signup` — paper card, Polish copy, sign-in link.
2. Type a 1–5 character password — muted hint, no field error.
3. Submit empty, a bad email, a short password, and a mismatched confirm — field text plus icon, no navigation. The password error replaces the hint.
4. Submit with `?error=` already on the URL — destructive banner, empty fields.
5. Successful signup — land on `/auth/confirm-email` (still the cosmic card).
6. While signed in, open `/auth/signup` — land on `/dashboard`. Open `/auth/signup/kitchen-sink` while signed in — the sink still renders.
7. Tab the form — rings on email, both password fields, both toggles, submit, and the sign-in link. Both toggles still show and hide their field.
8. Kitchen sink: named states, screenshots, PROD 404. Note whether a real submit flashes `Tworzenie konta...`.

## Performance Considerations

Signup already hydrates one React island (`client:load`). Do not hydrate the page shell. The sink mounts one island per form section in dev only.

## Migration Notes

No database migrations. Rollback is reverting the change commits. The relocate keeps `/auth/signup`. The signed-in redirect is page-local; reverting the page restores the form for signed-in visitors. Shared auth controls are not edited, so sign-in does not move with this change.

## References

- Research: `context/changes/ui-auth-signup/research.md`
- Sibling plan: `context/changes/ui-auth-signin/plan.md`
- Tokenized sibling: `src/pages/auth/signin/index.astro`
- Kitchen-sink pattern: `src/pages/auth/signin/kitchen-sink.astro`
- Focus stand-in: `src/components/auth/SignInForm.tsx:136`
- Posted name: `src/components/auth/FormField.tsx:49`
- Lessons: `context/foundation/lessons.md` (non-2xx does not apply to this `?error=` path)
- `/10x-ui` skill: `.cursor/skills/10x-ui/SKILL.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: One view + signed-in entry

#### Automated

- [x] 1.1 `npm run lint` passes — 3aa401d
- [x] 1.2 `npx astro check` passes — 3aa401d
- [x] 1.3 `npm run build` passes — 3aa401d
- [x] 1.4 Hardcoded-value scan (`LITERAL_RE` from `scripts/check-ui-literals.mjs`) on `src/pages/auth/signup/index.astro` and `src/components/auth/SignUpForm.tsx` reports 0 hits, and those files contain no `white` or `black` colour utilities — 3aa401d

#### Manual

- [x] 1.5 Logged-out desktop and one mobile width: the card uses role tokens (no cosmic purple glass), Polish copy unchanged — 3aa401d
- [x] 1.6 Logged-in GET `/auth/signup` redirects to `/dashboard`; a successful signup POST still lands on `/auth/confirm-email` — 3aa401d
- [x] 1.7 Keyboard focus is visible on email, password, confirm-password, both password toggles, submit, and the sign-in link — 3aa401d
- [x] 1.8 A 1–5 character password shows the muted hint; invalid fields and `?error=` show text plus an icon in destructive roles — 3aa401d

### Phase 2: Kitchen-sink + visual gate

#### Automated

- [x] 2.1 Kitchen-sink file exists and returns 404 when `import.meta.env.PROD`
- [x] 2.2 `npm run lint` and `npx astro check` pass
- [x] 2.3 Hardcoded-value scan (`LITERAL_RE` from `scripts/check-ui-literals.mjs`) on `src/pages/auth/signup/kitchen-sink.astro` and `src/components/auth/SignUpForm.tsx` reports 0 hits

#### Manual

- [x] 2.4 In DEV, `/auth/signup/kitchen-sink` shows default, hover/focus (ring and the muted hint), error (email, password, confirm-password mismatch, and `ServerError`), and loading/disabled; empty is N/A because the screen is a form
- [x] 2.5 Desktop and one mobile-width screenshots saved under `context/changes/ui-auth-signup/screenshots/`
- [x] 2.6 Preview/PROD: kitchen-sink is not usable as the signup UI
- [x] 2.7 A real signup submit is checked; if the spinner does not paint before navigation, that live flash is recorded N/A with that reason

### Phase 3: Guard — SCOPED_FILES + agent rules

#### Automated

- [ ] 3.1 The three signup files are listed in `SCOPED_FILES`; `npm run lint` passes on the clean tree
- [ ] 3.2 Introducing a banned literal in a scoped signup file fails `npm run lint:ui-literals`

#### Manual

- [ ] 3.3 `CLAUDE.md` and `AGENTS.md` name the token source, `src/components/ui`, the no-literals rule, and `/auth/signup/kitchen-sink`
