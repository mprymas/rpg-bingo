# Sign-in Vintage Paper — Implementation Plan

## Overview

Restyle `/auth/signin` onto the existing Vintage Paper token contract, compose shared `Input` / `Label` / `Button` inside the auth controls, send an already-signed-in visitor to `/dashboard`, gate the 7-state matrix with a production-blocked kitchen sink, and extend the literal-scan / agent-rule guard. Tokens, fonts, and dark mode stay as deposited in `ui-new-session-board`. A successful sign-in POST still redirects to `/`.

## Current State Analysis

- Tokens and dark-only layout already live: `src/styles/global.css` (`:root` / `.dark` → `@theme inline`); `Layout.astro` sets `<html class="dark">`. Tokenized siblings (`/sessions/new`, `/dashboard`, `/sessions/[id]`) read role classes.
- `/auth/signin` (`src/pages/auth/signin.astro`) is still the cosmic glass card. `FormField`, `SubmitButton`, and `PasswordToggle` paint palette classes. `ServerError` already uses `destructive` roles and is already in `SCOPED_FILES`.
- Research count of `LITERAL_RE` on the six-file stack is **23** (page 8, `SignInForm` 0, `FormField` 9, `SubmitButton` 4, `PasswordToggle` 2, `ServerError` 0). Two colour classes sit outside that regex: `placeholder-white/40` (`FormField.tsx:6`) and `border-t-white` (`SubmitButton.tsx:22`).
- Middleware guards only `/dashboard` and `/sessions`. A signed-in GET of `/auth/signin` still renders the form. Failed POST returns to `/auth/signin?error=`. Successful POST goes to `/` (`signin.ts:19`), the public Welcome page.
- `FormField`, `PasswordToggle`, and `SubmitButton` are imported by `SignUpForm.tsx`. Editing them in place restyles signup controls. Signup and confirm-email page shells stay cosmic.
- Research: `context/changes/ui-auth-signin/research.md` (charges C1–C5). Lessons non-2xx rule does not apply to `?error=` on this form page.

## Desired End State

A logged-out visitor sees a Vintage Paper sign-in card: `bg-background` / `bg-card` shell, fields and the primary button from shared primitives, focus rings from `--ring`, field errors in `destructive` with text plus an icon. A visitor who already has a session and opens `/auth/signin` lands on `/dashboard`. After a successful password POST they still land on `/`. Dev `/auth/signin/kitchen-sink` shows the matrix (empty marked N/A). Lint fails if palette or `bg-cosmic` returns on the cleaned sign-in files. Signup and confirm-email shells stay deferred.

### Key Discoveries:

- Astro cannot keep both `signin.astro` and `signin/kitchen-sink.astro`. Relocate to `src/pages/auth/signin/index.astro` first (same constraint as `context/changes/ui-mg-dashboard/plan.md`).
- C1 clears with a `div` using `bg-card` / `border-border` / `text-foreground`, matching `src/pages/sessions/new/index.astro:24–28`. No `card.tsx` in `src/components/ui/`.
- `Input` (`input.tsx:11–13`) and `Label` already carry invalid and focus-visible roles. `Button` default is `bg-primary` (`button.tsx:12`). `SubmitButton` overrides that with `bg-purple-600` (`SubmitButton.tsx:18`).
- `input.tsx` and `button.tsx` contain `ring-[3px]`. Those primitives stay out of `SCOPED_FILES`. Scoped files use a non-arbitrary stand-in (`ring-2` + `ring-ring/50`), as `NewSessionForm.tsx:144`.
- Redirect belongs on the sign-in page. A middleware prefix on `/auth/signin` would also send logged-in developers away from the kitchen sink.
- `useFormStatus().pending` is wired to a native `method="POST"` (`SignInForm.tsx:43`, `SubmitButton.tsx:12`). The browser may navigate before the spinner paints. The sink forces pending; the live flash is checked by hand.

## What We're NOT Doing

- Redepositing Vintage Paper tokens, fonts, or changing dark-only Layout.
- Restyling `signup.astro`, `confirm-email.astro`, Welcome, or Topbar. Removing `bg-cosmic` from `global.css`.
- Adding shadcn `Card`. Restyling `ServerError`. Adding `input.tsx` or `button.tsx` to `SCOPED_FILES`.
- Changing the successful sign-in POST destination away from `/`. Changing signup’s POST or confirm-email flow.
- Converting sign-in to a client `fetch`. Mapping a bad password onto HTTP 503.
- Playwright / screenshot CI. Editing inside any `<!-- BEGIN @przeprogramowani/10x-cli -->` … `<!-- END -->` block.
- Widening `LITERAL_RE` for `placeholder-*` / `border-t-*` prefixes (those classes still leave the sign-in files).

## Implementation Approach

`/10x-ui` order with the token deposit skipped: **one view** (relocate, role classes, shared field/button/toggle, signed-in redirect) → **states** (kitchen sink) → **guard** (`SCOPED_FILES` + rules). Preserve Polish copy, field names `email` and `password`, and `POST /api/auth/signin`. Shared controls stay one implementation so signup imports the tokenized fields.

## Critical Implementation Details

**Route order:** Move `src/pages/auth/signin.astro` to `src/pages/auth/signin/index.astro` before adding the sink. `/auth/signin` stays the same URL.

**Redirect scope:** In the sign-in page frontmatter, when `Astro.locals.user` is set, `return Astro.redirect("/dashboard")`. Do not add a middleware match on `/auth/signin`, or `/auth/signin/kitchen-sink` redirects a logged-in developer away. Leave `signin.ts` success on `/`.

**Pending and the sink:** Keep `useFormStatus` for a real submit. The sink passes `demoState` that forces the pending label and `preventDefault` so the gallery does not POST. If a real submit navigates before the spinner paints, record that live flash as N/A with that reason. Do not switch the form to `fetch`.

**Scoped rings and missed prefixes:** Do not copy `ring-[3px]` into `FormField`, `PasswordToggle`, `SignInForm`, or the sink. Replace `placeholder-white/40` and `border-t-white` even though `LITERAL_RE` does not match those prefixes.

**Shared props:** Keep `FormField`’s props (`id`, `name`, `label`, `type`, `value`, `onChange`, `placeholder`, `error`, `hint`, `icon`, `endContent`) so `SignUpForm` still typechecks. Error sets `aria-invalid` on `Input`. In the sink, suffix `id` per `demoState`; keep `name` as `email` / `password`.

---

## Phase 1: One view + signed-in entry

### Overview

Relocate the page, restyle the card and shared controls onto role classes and `Input` / `Label` / `Button`, and redirect a signed-in GET to `/dashboard`.

### Changes Required:

#### 1. Relocate the sign-in route

**File**: `src/pages/auth/signin.astro` → `src/pages/auth/signin/index.astro`

**Intent**: Free `auth/signin/` for a sibling kitchen sink without changing `/auth/signin`.

**Contract**: Same URL. Delete the flat `signin.astro` after the move. Links from signup, confirm-email, Welcome, and the middleware stay `/auth/signin`.

#### 2. Tokenized page shell

**File**: `src/pages/auth/signin/index.astro`

**Intent**: Close C1 — the first screen uses the same paper card language as Nowa sesja.

**Contract**: Outer `bg-background min-h-screen`; card `border-border bg-card text-foreground` at the current `max-w-sm` width; title `text-foreground` (no blue/purple gradient); helper line `text-muted-foreground`; signup link `text-primary` with `hover:underline`. Keep the Polish title, helper, and link. Zero palette, `bg-cosmic`, hex, or arbitrary px|rem on this page.

#### 3. Shared field

**File**: `src/components/auth/FormField.tsx`

**Intent**: Close C2 — email and password, including focus and the error line, follow `Input` / `Label` and `destructive`.

**Contract**: Render `Label` and `Input` from `@/components/ui`. Keep the existing props so `SignUpForm` is unchanged at the call site. Icon and `endContent` stay positioned on the field. Error passes `aria-invalid` and shows `text-destructive` plus `CircleAlert` (text, not colour alone). Hint still renders when there is no error. No palette classes and no `ring-[3px]` in this file.

#### 4. Shared submit

**File**: `src/components/auth/SubmitButton.tsx`

**Intent**: Close C3 — the primary action uses `Button`’s primary fill and focus ring.

**Contract**: Keep `Button type="submit"`. Drop the purple `className` override so the default variant shows; width may stay `w-full`. Pending still reads `useFormStatus` unless a later `demoState` override is passed (Phase 2). Spinner uses a foreground/border role class, not `border-white` or `border-t-white`. Pending copy stays the `pendingText` prop (`Logowanie...` on sign-in).

#### 5. Password toggle

**File**: `src/components/auth/PasswordToggle.tsx`

**Intent**: The show/hide control matches muted icon buttons and has a visible keyboard ring.

**Contract**: Keep `type="button"` and the Polish `aria-label` pair. Classes use muted/foreground roles, a hover colour change, and `focus-visible:ring-2` with `ring-ring` (no arbitrary px). No new toggle primitive.

#### 6. Signed-in entry

**File**: `src/pages/auth/signin/index.astro`

**Intent**: Close C4 — a person who already has a session and opens the sign-in link continues into Panel MG.

**Contract**: When `Astro.locals.user` is set, redirect to `/dashboard` before the form renders. Logged-out GET still renders the form, including `?error=`. Do not change `src/pages/api/auth/signin.ts` success redirect (`/`).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npx astro check` passes
- `npm run build` passes
- Hardcoded-value scan (`LITERAL_RE` from `scripts/check-ui-literals.mjs`) on `src/pages/auth/signin/index.astro`, `src/components/auth/SignInForm.tsx`, `FormField.tsx`, `SubmitButton.tsx`, and `PasswordToggle.tsx` reports 0 hits, and those files contain no `white` or `black` colour utilities

#### Manual Verification:

- Logged-out desktop and one mobile width: the card uses role tokens (no cosmic purple glass)
- Logged-in GET `/auth/signin` redirects to `/dashboard`; a successful sign-in POST still lands on `/`
- Keyboard focus is visible on email, password, the password toggle, submit, and the signup link
- Invalid fields and `?error=` show text plus an icon in destructive roles; signup still submits with the restyled controls

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before Phase 2.

---

## Phase 2: Kitchen-sink + visual gate

### Overview

Dev-only gallery of sign-in states for screenshot review (C5’s missing gate).

### Changes Required:

#### 1. Demo states on the existing form

**Files**: `src/components/auth/SignInForm.tsx`, `src/components/auth/SubmitButton.tsx`

**Intent**: The sink renders the same form the page uses, including error and pending, without posting to the API.

**Contract**: Optional `demoState` of `default | focus | error | loading`. Production passes only `serverError`. When `demoState` is set, `onSubmit` calls `preventDefault`. `loading` forces pending (`Logowanie...`, disabled submit). `error` shows a field message on email and password plus a `ServerError` string. `focus` sets `autoFocus` on email and the non-arbitrary ring classes from `NewSessionForm.tsx:144` (`border-ring ring-ring/50 ring-2`). Suffix field `id`s with `demoState`; keep `name` `email` and `password`.

#### 2. Kitchen-sink page

**File**: `src/pages/auth/signin/kitchen-sink.astro`

**Intent**: One screen for default, hover/focus, error, and loading/disabled, plus an explicit empty N/A.

**Contract**: If `import.meta.env.PROD`, return 404. Sections: default; hover/focus; error; loading/disabled (one section — on this form disabled exists only while pending); empty as a labeled N/A because the screen is a form, not a collection. Reuse `SignInForm` with `demoState` inside the same card shell as the page. No middleware change. The page-level user redirect does not apply to this route.

#### 3. Screenshots

**Files**: `context/changes/ui-auth-signin/screenshots/` (desktop + one mobile width)

**Intent**: Visual gate evidence for review.

**Contract**: Capture the kitchen sink at two widths. No Playwright requirement.

### Success Criteria:

#### Automated Verification:

- Kitchen-sink file exists and returns 404 when `import.meta.env.PROD`
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- In DEV, `/auth/signin/kitchen-sink` shows default, hover/focus, error, and loading/disabled; empty is N/A because the screen is a form
- Desktop and one mobile-width screenshots saved under `context/changes/ui-auth-signin/screenshots/`
- Preview/PROD: kitchen-sink is not usable as the sign-in UI
- A real sign-in submit is checked; if the spinner does not paint before navigation, that live flash is recorded N/A with that reason

**Implementation Note**: Phase complete after screenshots are reviewed against tokens and charges C1–C4.

---

## Phase 3: Guard — SCOPED_FILES + agent rules

### Overview

Make the contract stick for the next agent (C5).

### Changes Required:

#### 1. Literal scan scope

**File**: `scripts/check-ui-literals.mjs`

**Intent**: Fail lint if palette or `bg-cosmic` returns on the cleaned sign-in files.

**Contract**: Add `src/pages/auth/signin/index.astro`, `src/pages/auth/signin/kitchen-sink.astro`, `src/components/auth/SignInForm.tsx`, `FormField.tsx`, `SubmitButton.tsx`, and `PasswordToggle.tsx` to `SCOPED_FILES`. Leave `ServerError.tsx` as already listed. Do not add `input.tsx`, `button.tsx`, `signup.astro`, `confirm-email.astro`, or `SignUpForm.tsx`.

#### 2. Agent rule pointers

**Files**: `CLAUDE.md` (§ UI / design tokens), `AGENTS.md` (UI hard rule)

**Intent**: Point agents at the sign-in kitchen sink next to the three existing sinks.

**Contract**: Extend the kitchen-sink mention to include `/auth/signin/kitchen-sink`. Keep the token source, `src/components/ui`, and the no-literals rule. Do not edit inside any `<!-- BEGIN @przeprogramowani/10x-cli -->` … `<!-- END -->` block.

### Success Criteria:

#### Automated Verification:

- The six sign-in files are listed in `SCOPED_FILES`; `npm run lint` passes on the clean tree
- Introducing a banned literal in a scoped sign-in file fails `npm run lint:ui-literals`

#### Manual Verification:

- `CLAUDE.md` and `AGENTS.md` name the token source, `src/components/ui`, the no-literals rule, and `/auth/signin/kitchen-sink`

---

## Testing Strategy

### Unit Tests:

- None (repo has no unit runner). Rely on lint, `astro check`, and build.

### Integration Tests:

- Optional: `npm run smoke` after Phase 1 if the auth flow is still green. Smoke is not the visual gate.

### Manual Testing Steps:

1. Logged out: open `/auth/signin` — paper card, Polish copy, signup link.
2. Submit empty and a bad email — field text plus icon, no navigation.
3. Submit bad credentials — return with `?error=` and the destructive banner.
4. Successful sign-in — land on `/` (Welcome).
5. While signed in, open `/auth/signin` — land on `/dashboard`.
6. Tab the form — rings on email, password, toggle, submit, signup link. Toggle still shows and hides the password.
7. Open `/auth/signup` — controls match the new field/button; the cosmic page shell is unchanged; signup still posts.
8. Kitchen sink: named states, screenshots, PROD 404. Note whether a real submit flashes `Logowanie...`.

## Performance Considerations

Sign-in already hydrates one React island (`client:load`). Do not hydrate the page shell. The sink mounts one island per section in dev only.

## Migration Notes

No database migrations. Rollback is reverting the change commits. The relocate keeps `/auth/signin`. The signed-in redirect is page-local; reverting the page restores the form for signed-in visitors. Signup controls move with `FormField` / `SubmitButton` / `PasswordToggle` because they are shared.

## References

- Research: `context/changes/ui-auth-signin/research.md`
- Prior UI plans: `context/changes/ui-mg-dashboard/plan.md`, `context/changes/ui-session-board/plan.md`
- Tokenized sibling: `src/pages/sessions/new/index.astro`
- Kitchen-sink pattern: `src/pages/sessions/new/kitchen-sink.astro`
- Focus stand-in: `src/components/sessions/NewSessionForm.tsx:144`
- Input / Button: `src/components/ui/input.tsx`, `src/components/ui/button.tsx`
- Lessons: `context/foundation/lessons.md` (non-2xx does not apply to this `?error=` path)
- `/10x-ui` skill: `.cursor/skills/10x-ui/SKILL.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: One view + signed-in entry

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 `npx astro check` passes
- [x] 1.3 `npm run build` passes
- [x] 1.4 Hardcoded-value scan (`LITERAL_RE` from `scripts/check-ui-literals.mjs`) on `src/pages/auth/signin/index.astro`, `src/components/auth/SignInForm.tsx`, `FormField.tsx`, `SubmitButton.tsx`, and `PasswordToggle.tsx` reports 0 hits, and those files contain no `white` or `black` colour utilities

#### Manual

- [x] 1.5 Logged-out desktop and one mobile width: the card uses role tokens (no cosmic purple glass)
- [x] 1.6 Logged-in GET `/auth/signin` redirects to `/dashboard`; a successful sign-in POST still lands on `/`
- [x] 1.7 Keyboard focus is visible on email, password, the password toggle, submit, and the signup link
- [x] 1.8 Invalid fields and `?error=` show text plus an icon in destructive roles; signup still submits with the restyled controls

### Phase 2: Kitchen-sink + visual gate

#### Automated

- [ ] 2.1 Kitchen-sink file exists and returns 404 when `import.meta.env.PROD`
- [ ] 2.2 `npm run lint` and `npx astro check` pass

#### Manual

- [ ] 2.3 In DEV, `/auth/signin/kitchen-sink` shows default, hover/focus, error, and loading/disabled; empty is N/A because the screen is a form
- [ ] 2.4 Desktop and one mobile-width screenshots saved under `context/changes/ui-auth-signin/screenshots/`
- [ ] 2.5 Preview/PROD: kitchen-sink is not usable as the sign-in UI
- [ ] 2.6 A real sign-in submit is checked; if the spinner does not paint before navigation, that live flash is recorded N/A with that reason

### Phase 3: Guard — SCOPED_FILES + agent rules

#### Automated

- [ ] 3.1 The six sign-in files are listed in `SCOPED_FILES`; `npm run lint` passes on the clean tree
- [ ] 3.2 Introducing a banned literal in a scoped sign-in file fails `npm run lint:ui-literals`

#### Manual

- [ ] 3.3 `CLAUDE.md` and `AGENTS.md` name the token source, `src/components/ui`, the no-literals rule, and `/auth/signin/kitchen-sink`
