# Confirm-email Vintage Paper — Implementation Plan

## Overview

Restyle `/auth/confirm-email` onto the Vintage Paper card sign-in and sign-up already use, show only the inbox sentence, and send a signed-in visitor to `/dashboard`. Gate the reachable states with a production-blocked kitchen sink, then extend the literal-scan and agent-rule guard. A successful signup POST still redirects to this URL; when that response already wrote a session, the page sends the visitor on to Panel MG before the card renders.

## Current State Analysis

- Tokens and the dark-only layout already live in `src/styles/global.css` (`:root` / `.dark` → `@theme inline`). Sign-in (`src/pages/auth/signin/index.astro:13–21`) and sign-up (`src/pages/auth/signup/index.astro:13–21`) use `bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, and `text-primary` on an inline `div`.
- `/auth/confirm-email` (`src/pages/auth/confirm-email.astro:22–30`) is still the cosmic glass card: `bg-cosmic`, white glass, a blue-to-purple heading, and blue/purple body and link text. That is seven palette-class occurrences plus `bg-cosmic` on this file.
- `import.meta.env.DEV` at `confirm-email.astro:4–17` picks one of two copy objects. Dev shows „Rejestracja zakończona”. A production build shows „Sprawdź swoją skrzynkę”. Both links go to `/auth/signin`.
- The page frontmatter does not read `Astro.locals.user`. Sign-in and sign-up redirect that visitor to `/dashboard` (`signin/index.astro:5–7`, `signup/index.astro:5–7`). Middleware protects only `/dashboard` and `/sessions` (`middleware.ts:4`).
- `POST /api/auth/signup` redirects here on success and back to `/auth/signup?error=` on failure (`signup.ts:13–19`). The handler keeps `error` and drops `data`. Local `[auth.email]` sets `enable_confirmations = false` (`supabase/config.toml:209`). `createClient` writes auth cookies in `setAll` (`src/lib/supabase.ts:15–19`).
- There is no confirm-email kitchen sink. `SCOPED_FILES` (`scripts/check-ui-literals.mjs:9–30`) does not list this page. `CLAUDE.md` and `AGENTS.md` name the sign-in and sign-up sinks and do not name this route.
- Research: `context/changes/ui-auth-confirm-email/research.md` (charges C1–C4). The non-2xx lesson does not apply: this page does not render a branded error for a failed data load.

## Desired End State

A logged-out visitor sees a Vintage Paper card with one sentence: heading „Sprawdź swoją skrzynkę”, the confirmation-link body, and „Wróć do logowania” pointing at `/auth/signin`. The link shows a `ring-ring` focus ring. A visitor who already has a session, including one a local signup just wrote, lands on `/dashboard` and does not see the card. Dev `/auth/confirm-email/kitchen-sink` shows default and hover/focus, and marks disabled, error, empty, and loading N/A. Lint fails if palette classes or `bg-cosmic` return on the cleaned files.

### Key Discoveries:

- Astro cannot keep both `confirm-email.astro` and `confirm-email/kitchen-sink.astro`. Relocate to `src/pages/auth/confirm-email/index.astro` first (same constraint as sign-up, `context/changes/ui-auth-signup/plan.md:24`).
- C1 clears by copying the sign-in card classes. No `card.tsx` in `src/components/ui/`. Do not add one.
- The live page keeps a single copy object. „Rejestracja zakończona” is removed. The sink does not resurrect it.
- Redirect belongs on the confirm-email page. A middleware prefix on `/auth/confirm-email` would also send logged-in developers away from the kitchen sink.
- The session-board back link is the focus pattern for a text anchor: `outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring` (`src/pages/sessions/[id].astro:76`). `ring-[3px]` is an arbitrary value and fails the literal scan once this file is scoped.
- Sign-in and sign-up footer links omit `focus-visible`. This change does not edit them.

## What We're NOT Doing

- Redepositing Vintage Paper tokens, fonts, or changing dark-only Layout.
- Removing `@utility bg-cosmic` from `src/styles/global.css`. Restyling `Welcome.astro`, sign-in, or sign-up, including their footer links.
- Adding shadcn `Card` or a `Button` for this link. Adding `input.tsx` or `button.tsx` to `SCOPED_FILES`.
- Changing `signup.ts`: it still redirects success to `/auth/confirm-email` and does not read `data.session`. No query flag. No `emailRedirectTo` or confirmation-callback route.
- Keeping the DEV switch or the „Rejestracja zakończona” / „Przejdź do logowania” strings.
- Setting a non-2xx status on this page. Reading hosted `enable_confirmations` (it is not in the repo).
- Playwright / screenshot CI. Editing inside any `<!-- BEGIN @przeprogramowani/10x-cli -->` … `<!-- END -->` block.
- Widening `LITERAL_RE`.

## Implementation Approach

`/10x-ui` order with the library and token-value phases skipped: **one view** (relocate, role classes, inbox sentence only, signed-in redirect) → **states** (kitchen sink) → **guard** (`SCOPED_FILES` + rules). The card stays an inline `div`. Preserve the inbox Polish strings and the link to `/auth/signin`.

## Critical Implementation Details

**Route order:** Move `src/pages/auth/confirm-email.astro` to `src/pages/auth/confirm-email/index.astro` before adding the sink. `/auth/confirm-email` stays the same URL. `signup.ts` keeps that target.

**Redirect scope:** In the page frontmatter, when `Astro.locals.user` is set, `return Astro.redirect("/dashboard")`. Do not add a middleware match on `/auth/confirm-email`. The kitchen-sink file does not read `Astro.locals.user`.

**Session arrival:** Leave `signup.ts` on this URL. When the signup response wrote a session, the following GET already has `Astro.locals.user`, and the page redirects before render. The visitor does not see the inbox sentence on that path. Reviewing the card is a signed-out GET.

**Focus classes:** The live link uses `text-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring`. Do not copy `ring-[3px]` from `button.tsx`. The sink’s hover/focus section forces `underline ring-2 ring-ring` on its copy of the link so a screenshot shows both states without a keyboard.

---

## Phase 1: One view + signed-in entry

### Overview

Relocate the page, restyle the card onto role classes, keep only the inbox sentence, and redirect a signed-in GET to `/dashboard`. Closes C1, C2, and C3.

### Changes Required:

#### 1. Relocate the confirm-email route

**File**: `src/pages/auth/confirm-email.astro` → `src/pages/auth/confirm-email/index.astro`

**Intent**: Free `auth/confirm-email/` for a sibling kitchen sink without changing `/auth/confirm-email`.

**Contract**: Same URL. Delete the flat `confirm-email.astro` after the move. `signup.ts` still redirects to `/auth/confirm-email`.

#### 2. Tokenized page shell and inbox sentence

**File**: `src/pages/auth/confirm-email/index.astro`

**Intent**: Close C1 and C2 — the post-signup card uses the paper language, and the live page no longer hides the inbox sentence behind `import.meta.env.DEV`.

**Contract**: Match `signin/index.astro:13–20` for the shell. Outer `bg-background`; card `border-border bg-card text-foreground` at the current `max-w-sm` width, centered, `text-center`. Title `text-foreground` (no gradient, no emoji). Body `text-muted-foreground`. Link `text-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring` to `/auth/signin`. Keep exactly: heading „Sprawdź swoją skrzynkę”, body „Wysłaliśmy link potwierdzający na Twój adres e-mail. Kliknij go, aby aktywować konto.”, link „Wróć do logowania”. `Layout` title is that heading. Delete the DEV branch and the ready-copy object. Drop `backdrop-blur-xl`. Zero palette, `bg-cosmic`, hex, or arbitrary px|rem on this page.

#### 3. Signed-in entry

**File**: `src/pages/auth/confirm-email/index.astro`

**Intent**: Close C3 — a person who already has a session and opens this URL continues into Panel MG, including right after a signup that wrote a session.

**Contract**: When `Astro.locals.user` is set, redirect to `/dashboard` before the card renders. A logged-out GET still renders the inbox card. Do not change `src/pages/api/auth/signup.ts` or `src/middleware.ts`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npx astro check` passes
- `npm run build` passes
- Hardcoded-value scan (`LITERAL_RE` from `scripts/check-ui-literals.mjs`) on `src/pages/auth/confirm-email/index.astro` reports 0 hits, and that file contains no `white` or `black` colour utilities

#### Manual Verification:

- Logged-out desktop and one mobile width: the card uses role tokens (no cosmic glass, no emoji, no gradient heading) and only the inbox sentence, with the link to `/auth/signin`
- Signed-in GET `/auth/confirm-email` redirects to `/dashboard`; a local signup that already has a session follows that redirect; `signup.ts` still targets `/auth/confirm-email`
- Keyboard focus on the sign-in link shows a `ring-ring` ring

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before Phase 2.

---

## Phase 2: Kitchen-sink + visual gate

### Overview

Dev-only gallery of the reachable confirm-email states for screenshot review (C4’s missing gate).

### Changes Required:

#### 1. Kitchen-sink page

**File**: `src/pages/auth/confirm-email/kitchen-sink.astro`

**Intent**: One screen for the inbox card, hover, and focus-visible, plus explicit N/A for the four states this static page does not have.

**Contract**: If `import.meta.env.PROD`, return 404, as `signin/kitchen-sink.astro:5–7`. Do not read `Astro.locals.user`. Sections: default (the Phase 1 card); hover/focus (the same card, with `underline ring-2 ring-ring` forced on the link so both states are visible in a screenshot); disabled, error, empty, and loading as labeled N/A blocks using the dashed card at `signin/kitchen-sink.astro:68–71`. N/A reasons: disabled — the anchor is not a pending action; error — signup failures stay on `/auth/signup?error=` and this page reads no error param; empty — the page is one message, not a collection; loading — the frontmatter does not fetch. Header link back to `/auth/confirm-email` uses the same focus classes as the card link. No „Rejestracja zakończona” section. No middleware change.

#### 2. Screenshots

**Files**: `context/changes/ui-auth-confirm-email/screenshots/` (desktop + one mobile width)

**Intent**: Visual gate evidence for review.

**Contract**: Capture the kitchen sink at two widths. No Playwright requirement.

### Success Criteria:

#### Automated Verification:

- Kitchen-sink file exists and returns 404 when `import.meta.env.PROD`
- `npm run lint` and `npx astro check` pass
- Hardcoded-value scan (`LITERAL_RE` from `scripts/check-ui-literals.mjs`) on `src/pages/auth/confirm-email/kitchen-sink.astro` reports 0 hits

#### Manual Verification:

- In DEV, `/auth/confirm-email/kitchen-sink` shows the inbox card (default), a hover/focus card with underline and ring, and labeled N/A for disabled, error, empty, and loading
- Desktop and one mobile-width screenshots saved under `context/changes/ui-auth-confirm-email/screenshots/`
- Preview/PROD: kitchen-sink returns 404; a signed-in visit to the sink in DEV still renders the gallery

**Implementation Note**: Phase complete after screenshots are reviewed against tokens and charges C1–C3.

---

## Phase 3: Guard — SCOPED_FILES + agent rules

### Overview

Make the contract stick for the next agent (C4).

### Changes Required:

#### 1. Literal scan scope

**File**: `scripts/check-ui-literals.mjs`

**Intent**: Fail lint if palette classes or `bg-cosmic` return on the cleaned confirm-email files.

**Contract**: Add `src/pages/auth/confirm-email/index.astro` and `src/pages/auth/confirm-email/kitchen-sink.astro` to `SCOPED_FILES`. Do not add `input.tsx` or `button.tsx`. Leave the sign-in and sign-up files as already listed.

#### 2. Agent rule pointers

**Files**: `CLAUDE.md` (§ UI / design tokens), `AGENTS.md` (UI hard rule)

**Intent**: Point agents at the confirm-email kitchen sink next to the sign-up sink.

**Contract**: Extend the kitchen-sink mention at `CLAUDE.md:52` and `AGENTS.md:12` to include `/auth/confirm-email/kitchen-sink`. Keep the token source, `src/components/ui`, and the no-literals rule. Do not edit inside any `<!-- BEGIN @przeprogramowani/10x-cli -->` … `<!-- END -->` block.

### Success Criteria:

#### Automated Verification:

- `src/pages/auth/confirm-email/index.astro` and `src/pages/auth/confirm-email/kitchen-sink.astro` are listed in `SCOPED_FILES`; `npm run lint` passes on the clean tree
- Introducing a banned literal in a scoped confirm-email file fails `npm run lint:ui-literals`

#### Manual Verification:

- `CLAUDE.md` and `AGENTS.md` name the token source, `src/components/ui`, the no-literals rule, and `/auth/confirm-email/kitchen-sink`

---

## Testing Strategy

### Unit Tests:

- None (repo has no unit runner). Rely on lint, `astro check`, and build.

### Integration Tests:

- Optional: `npm run smoke` after Phase 1 if the auth flow is still green. Smoke is not the visual gate. A local signup that already has a session is expected to finish on `/dashboard`, not on this card.

### Manual Testing Steps:

1. Logged out: open `/auth/confirm-email` — paper card, inbox heading, confirmation-link body, „Wróć do logowania”.
2. Tab to the link — `ring-ring` ring, then underline on hover.
3. While signed in, open `/auth/confirm-email` — land on `/dashboard`. Open `/auth/confirm-email/kitchen-sink` while signed in — the sink still renders.
4. Successful local signup — `signup.ts` still redirects to `/auth/confirm-email`; if the session cookie is present, the page continues to `/dashboard`. If the inbox card renders instead, the session was not written; record that, and do not put the ready-copy strings back.
5. Kitchen sink: default, hover/focus, four N/A labels, screenshots, PROD 404.

## Performance Considerations

The page is static SSR with no React island. Do not hydrate the shell. The sink is dev-only markup.

## Migration Notes

No database migrations. Rollback is reverting the change commits. The relocate keeps `/auth/confirm-email`. The signed-in redirect is page-local; reverting the page restores the card for signed-in visitors. `signup.ts` is not edited, so the signup success URL does not move with this change.

## References

- Research: `context/changes/ui-auth-confirm-email/research.md`
- Sibling plan: `context/changes/ui-auth-signup/plan.md`
- Tokenized sibling: `src/pages/auth/signin/index.astro`
- Kitchen-sink pattern: `src/pages/auth/signin/kitchen-sink.astro`
- Focus pattern: `src/pages/sessions/[id].astro:76`
- Signup redirect: `src/pages/api/auth/signup.ts:13–19`
- Lessons: `context/foundation/lessons.md` (non-2xx does not apply; this page is not a failed data load)
- `/10x-ui` skill: `.cursor/skills/10x-ui/SKILL.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: One view + signed-in entry

#### Automated

- [x] 1.1 `npm run lint` passes — 6aaeff5
- [x] 1.2 `npx astro check` passes — 6aaeff5
- [x] 1.3 `npm run build` passes — 6aaeff5
- [x] 1.4 Hardcoded-value scan (`LITERAL_RE` from `scripts/check-ui-literals.mjs`) on `src/pages/auth/confirm-email/index.astro` reports 0 hits, and that file contains no `white` or `black` colour utilities — 6aaeff5

#### Manual

- [x] 1.5 Logged-out desktop and one mobile width: the card uses role tokens (no cosmic glass, no emoji, no gradient heading) and only the inbox sentence, with the link to `/auth/signin` — 6aaeff5
- [x] 1.6 Signed-in GET `/auth/confirm-email` redirects to `/dashboard`; a local signup that already has a session follows that redirect; `signup.ts` still targets `/auth/confirm-email` — 6aaeff5
- [x] 1.7 Keyboard focus on the sign-in link shows a `ring-ring` ring — 6aaeff5

### Phase 2: Kitchen-sink + visual gate

#### Automated

- [x] 2.1 Kitchen-sink file exists and returns 404 when `import.meta.env.PROD` — 71ca380
- [x] 2.2 `npm run lint` and `npx astro check` pass — 71ca380
- [x] 2.3 Hardcoded-value scan (`LITERAL_RE` from `scripts/check-ui-literals.mjs`) on `src/pages/auth/confirm-email/kitchen-sink.astro` reports 0 hits — 71ca380

#### Manual

- [x] 2.4 In DEV, `/auth/confirm-email/kitchen-sink` shows the inbox card (default), a hover/focus card with underline and ring, and labeled N/A for disabled, error, empty, and loading — 71ca380
- [x] 2.5 Desktop and one mobile-width screenshots saved under `context/changes/ui-auth-confirm-email/screenshots/` — 71ca380
- [x] 2.6 Preview/PROD: kitchen-sink returns 404; a signed-in visit to the sink in DEV still renders the gallery — 71ca380

### Phase 3: Guard — SCOPED_FILES + agent rules

#### Automated

- [x] 3.1 `src/pages/auth/confirm-email/index.astro` and `src/pages/auth/confirm-email/kitchen-sink.astro` are listed in `SCOPED_FILES`; `npm run lint` passes on the clean tree
- [x] 3.2 Introducing a banned literal in a scoped confirm-email file fails `npm run lint:ui-literals`

#### Manual

- [x] 3.3 `CLAUDE.md` and `AGENTS.md` name the token source, `src/components/ui`, the no-literals rule, and `/auth/confirm-email/kitchen-sink`
