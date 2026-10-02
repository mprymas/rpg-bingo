---
date: 2026-10-02T16:02:48+02:00
researcher: Marcin
git_commit: 1c0a06da90da3425f0c28f5b80d5e5a37af1df4d
branch: master
repository: mprymas/rpg-bingo
topic: "UI audit of /auth/confirm-email against the existing Vintage Paper tokens"
tags: [research, ui, auth, confirm-email]
status: complete
last_updated: 2026-10-02
last_updated_by: Marcin
---

# Research: UI audit of /auth/confirm-email against the existing Vintage Paper tokens

**Date**: 2026-10-02T16:02:48+02:00
**Researcher**: Marcin
**Git Commit**: 1c0a06da90da3425f0c28f5b80d5e5a37af1df4d
**Branch**: master
**Repository**: mprymas/rpg-bingo

## Research Question

What should `/10x-ui` charge against the existing confirm-email view (`src/pages/auth/confirm-email.astro`), given the Vintage Paper tokens and the already tokenized sign-in and sign-up views?

## Summary

On the files inspected for this change, `/auth/confirm-email` is one static Astro page. A successful `POST /api/auth/signup` redirects there (`src/pages/api/auth/signup.ts:19`). The shell at `src/pages/auth/confirm-email.astro:22–30` uses `bg-cosmic` and seven palette classes. The sign-in and sign-up shells at `src/pages/auth/signin/index.astro:13–21` and `src/pages/auth/signup/index.astro:13–21` use `bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, and `text-primary`.

A glob of `src/components/ui/` for this research contains `badge.tsx`, `button.tsx`, `checkbox.tsx`, `input.tsx`, `label.tsx`, `LibBadge.astro`, and `radio-group.tsx`. It does not contain `card.tsx`. Sign-in and sign-up draw the card as a `div`, so this view has no shared card component to import.

`import.meta.env.DEV` at `confirm-email.astro:4` picks one of two copy blocks (`:6–17`). The signup handler does not branch on that flag (`signup.ts:13–19`). The page frontmatter does not read `Astro.locals.user`. Sign-in and sign-up do, and redirect to `/dashboard` (`signin/index.astro:5–7`, `signup/index.astro:5–7`). `PROTECTED_ROUTES` at `src/middleware.ts:4` is `["/dashboard", "/sessions"]`.

A glob of `src/pages/auth/` contains `confirm-email.astro` and no confirm-email kitchen-sink file. `SCOPED_FILES` at `scripts/check-ui-literals.mjs:9–30` does not list this page.

Contract variant: existing design system. Do not deposit a second palette.

## Charges

| # | Category | Evidence | Effect on the user |
| --- | --- | --- | --- |
| C1 | **Missing tokens** | `src/pages/auth/confirm-email.astro:22–30` (`bg-cosmic`, `border-white/10`, `bg-white/10`, `text-white`, `backdrop-blur-xl`, `from-blue-200`, `to-purple-200`, `text-blue-100/80`, `text-purple-300`); tokenized siblings `src/pages/auth/signin/index.astro:13–21` and `src/pages/auth/signup/index.astro:13–21`; utility `src/styles/global.css:123–125` | After a successful signup the person leaves the paper registration card and lands on a blue-purple glass panel. |
| C2 | **Accidental architecture** | `confirm-email.astro:4–17` sets `isAutoConfirmed` from `import.meta.env.DEV` and renders one of two copy objects; `signup.ts:13` calls `signUp({ email, password })` with no copy branch; local email auth sets `enable_confirmations = false` at `supabase/config.toml:209` | On `astro dev` the visitor is told the account is ready. On a production build the same route tells them to open a confirmation email. A review of the running dev server does not show the inbox copy. |
| C3 | **Accidental architecture** | `signin/index.astro:5–7` and `signup/index.astro:5–7` redirect when `Astro.locals.user` is set; `confirm-email.astro:1–18` does not read `Astro.locals.user`; `middleware.ts:18–22` redirects when the path starts with a `PROTECTED_ROUTES` entry (`middleware.ts:4`, `["/dashboard", "/sessions"]`) and `context.locals.user` is absent | A person who already has a session and opens `/auth/confirm-email` still sees the post-signup card and a link to sign in. |
| C4 | **Accidental architecture** | Glob of `src/pages/auth/` has no confirm-email kitchen-sink file (the auth sinks present are `signin/kitchen-sink.astro` and `signup/kitchen-sink.astro`); `SCOPED_FILES` at `scripts/check-ui-literals.mjs:9–30` omits `confirm-email.astro`; kitchen-sink lists at `CLAUDE.md:52` and `AGENTS.md:12` name five sinks and do not name this route | The two copy variants, link hover, and keyboard focus cannot be reviewed together, and a later edit can put palette classes or `bg-cosmic` back on this file without failing `npm run lint`. |

### Missing shared component — no charge

The glob of `src/components/ui/` listed above has no `Card`. Sign-in and sign-up use an inline `div` with role classes (`signin/index.astro:14`, `signup/index.astro:14`). Their footer links are raw `<a class="text-primary hover:underline">` (`signin/index.astro:19`, `signup/index.astro:19`), not `Button`. Adding a shadcn `Card` or a second button on this page alone would fork that shell. The plan should repeat the `div` pattern.

The anchor at `confirm-email.astro:29–30` has `text-purple-300 hover:underline` and no `focus-visible` class. The sibling footer links also omit `focus-visible`. This page’s inspected markup contains that one anchor and no `button`, `input`, or `form`, so the states phase should give this link a `ring-ring` focus style and should not edit the sign-in or sign-up links.

### Deferred

- Do not remove `@utility bg-cosmic` (`src/styles/global.css:123–125`). A grep of `src` for `bg-cosmic` also matches `src/components/Welcome.astro:5`.
- Do not add `src/components/ui/button.tsx` or `src/components/ui/input.tsx` to `SCOPED_FILES`. Sign-up research left those primitives outside the guard (`context/changes/ui-auth-signup/research.md:49`).
- **disabled**, **error**, **empty**, and **loading** are N/A for this page. Reasons are in the states section below.
- Hosted Supabase `enable_confirmations` is not in this repo. The local email value at `supabase/config.toml:209` is not a production setting.

## Detailed Findings

### Page shell versus sign-in and sign-up

On `confirm-email.astro`, the inspected class strings are:

- Line 22: `bg-cosmic`
- Line 23: `border-white/10`, `bg-white/10`, `text-white`, `backdrop-blur-xl`
- Line 25: `from-blue-200`, `to-purple-200` (gradient heading)
- Line 28: `text-blue-100/80`
- Line 29: `text-purple-300`

That is seven palette-class occurrences plus `bg-cosmic` on this file. No hex, `rgb(`, `oklch(`, or arbitrary `px`/`rem` bracket utilities appear in `confirm-email.astro`. `text-transparent` on line 25 is outside the palette regex.

Sign-in and sign-up, after their UI changes, use the same role classes for this shell (`signin/index.astro:13–21`, `signup/index.astro:13–21`). Token values live in `src/styles/global.css` (`:root` from line 6, `.dark` from line 44, published in `@theme inline` from line 82). `<html class="dark">` is the app contract (`AGENTS.md:12`).

### How the route is reached

A grep of `src/**/*.{ts,tsx,astro}` for `confirm-email`, `emailRedirectTo`, `exchangeCode`, or `token_hash` matched `src/pages/api/auth/signup.ts:19` and no other line. The page file does not contain the string `confirm-email`; Astro serves it from the path `src/pages/auth/confirm-email.astro`. The signup handler redirects there when `signUp` returns no `error` (`signup.ts:13–19`). The sign-up form posts to that handler (`src/components/auth/SignUpForm.tsx:99`).

The middleware check at `middleware.ts:18–22` does not redirect `/auth/confirm-email`, because `PROTECTED_ROUTES` is `["/dashboard", "/sessions"]` (`middleware.ts:4`). The page frontmatter does not redirect either. A direct GET renders the card.

### Copy branch

`confirm-email.astro:4–17` chooses the strings at build/dev time:

- When `import.meta.env.DEV` is true: heading „Rejestracja zakończona”, body that the account exists and the person can sign in, link „Przejdź do logowania”.
- When it is false: heading „Sprawdź swoją skrzynkę”, body that a confirmation link was sent, link „Wróć do logowania”.

Both branches link to `/auth/signin` (`confirm-email.astro:29`). The flag does not call Supabase. Local `[auth.email]` sets `enable_confirmations = false` (`supabase/config.toml:208–209`). `signup.ts:13` does not read that setting.

### 7-state matrix

| State | On this page today | Sink |
| --- | --- | --- |
| default | Cosmic card and whichever copy block `import.meta.env.DEV` selected (`confirm-email.astro:4–30`) | Tokenized card. The sink shows both copy blocks, because the live template renders one of the two objects (`confirm-email.astro:4–17`). |
| hover | The anchor uses `hover:underline` with `text-purple-300` (`confirm-email.astro:29`) | `text-primary hover:underline`, matching `signin/index.astro:19` |
| focus-visible | That anchor has no `focus-visible` class (`confirm-email.astro:29`) | Visible `ring-ring` on the link. Do not restyle `signin/index.astro:19` or `signup/index.astro:19` in this change. |
| disabled | The inspected markup has no disabled control | **N/A** — static page; the anchor is not a pending action |
| error | Signup failures redirect to `/auth/signup?error=` (`signup.ts:16`). This page reads no `error` param (`confirm-email.astro:1–18`) | **N/A** — field and server errors stay on the signup view |
| empty | The page is not a collection | **N/A** — the two copy blocks are content variants, not an empty list. Sign-in marks empty N/A at `signin/kitchen-sink.astro:40–44` for a different reason (the screen is a form). |
| loading | The page frontmatter does not fetch (`confirm-email.astro:1–18`) | **N/A** — static SSR |

Kitchen-sink guard used by the auth sinks: `import.meta.env.PROD` returns 404 (`signin/kitchen-sink.astro:5–7`).

### Guard and agent rules

`scripts/check-ui-literals.mjs:1–3` fails cleaned views that reintroduce palette classes, colour functions, arbitrary `px`/`rem`, or `bg-cosmic`. `CLAUDE.md:51` says to extend `SCOPED_FILES` when another view is tokenized. `CLAUDE.md:52` and `AGENTS.md:12` list `/auth/signin/kitchen-sink` and `/auth/signup/kitchen-sink` and do not list a confirm-email sink. Sign-in and sign-up plans told their guard phases not to add `confirm-email.astro` (`context/changes/ui-auth-signin/plan.md:197`, `context/changes/ui-auth-signup/plan.md:184`).

## Code References

- `src/pages/auth/confirm-email.astro:4–30` — DEV copy switch and cosmic card
- `src/pages/api/auth/signup.ts:13–19` — success redirect to `/auth/confirm-email`; error redirect back to signup
- `src/pages/auth/signin/index.astro:5–21` — signed-in redirect and tokenized shell
- `src/pages/auth/signup/index.astro:5–21` — same redirect and shell
- `src/middleware.ts:4,18–22` — protected prefixes are `/dashboard` and `/sessions`
- `src/lib/supabase.ts:15–19` — `setAll` writes auth cookies when the client asks
- `src/styles/global.css:123–125` — `bg-cosmic` gradient utility
- `scripts/check-ui-literals.mjs:9–30` — cleaned files; confirm-email is absent
- `src/components/Welcome.astro:5` — other `bg-cosmic` match in `src`

## Architecture Insights

The cosmic card on this page is duplicated markup, not a component. The sign-in change notes say research may leave the other shells deferred, or treat them as the effect of a shared primitive if sign-in extracts one (`context/changes/ui-auth-signin/change.md:16`). The sign-in and sign-up pages that shipped use inline `div` shells. This change follows that markup.

The page is an informational screen after signup. It is not an email-link callback: the inspected `src` grep found no `emailRedirectTo`, `exchangeCode`, or `token_hash`.

## Historical Context (from prior changes)

- `context/changes/ui-auth-signin/change.md:16` — signup and confirm-email copy the cosmic card and are outside that change. **Partial**: signup’s shell is now role classes (`signup/index.astro:13–21`). Confirm-email still uses the cosmic card (`confirm-email.astro:22–30`). Supported for confirm-email.
- `context/changes/ui-auth-signin/research.md:51` — signup and confirm-email shells deferred; edit shared form primitives in place. **Partial**: `ui-auth-signup` later tokenized the signup shell. Confirm-email stayed deferred. The shared form files are not imported by `confirm-email.astro`.
- `context/changes/ui-auth-signup/research.md:45–47` — confirm-email copies the cosmic card and remains the success redirect. **Supported** by `confirm-email.astro:22–30` and `signup.ts:19`.
- `context/changes/ui-auth-signup/plan-brief.md:69` — the jump from the paper signup card to the cosmic confirm-email card is accepted until a later change. **Supported** as the current pair of screens. This change is that later change.
- `context/changes/ui-new-session-board/research.md:49` — auth pages still use cosmic one-offs. **Partial**: sign-in and sign-up index pages use role classes. In the `src` grep for `bg-cosmic`, the remaining matches are `Welcome.astro:5`, `global.css:123`, and `confirm-email.astro:22`.
- `context/changes/ui-auth-signin/change.md:16` hypothetical shared primitive. **Contradicted** as an outcome: the sign-in plan lists “Adding shadcn `Card`” under what it is not doing (`context/changes/ui-auth-signin/plan.md:33`). The shipped shell is the `div` at `signin/index.astro:14`.

## Related Research

- `context/changes/ui-auth-signin/research.md` — sign-in charges and the deferred cosmic shells
- `context/changes/ui-auth-signup/research.md` — signup charges; confirm-email left deferred
- `context/changes/ui-new-session-board/research.md` — first token deposit; auth pages left on cosmic classes

## Open Questions

- Whether the live page keeps the `import.meta.env.DEV` switch. The sink should show both copy blocks either way. Hosted `enable_confirmations` is not in the repo, so this research does not say which sentence is right in production.
- Whether a successful `signUp` leaves a session cookie. `signup.ts:13` keeps `error` and drops `data`. `createClient` implements `setAll` (`src/lib/supabase.ts:15–19`). This research did not observe a signup response. C3 still applies when `Astro.locals.user` is already set, which is the check sign-in and sign-up use.
