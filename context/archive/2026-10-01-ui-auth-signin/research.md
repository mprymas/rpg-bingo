---
date: 2026-10-01T13:57:17+02:00
researcher: Marcin
git_commit: 036fba332e70f29512050a6da402b461e360a8c2
branch: master
repository: rpg-bingo
topic: "UI audit of /auth/signin against Vintage Paper tokens and shared components"
tags: [research, codebase, ui, auth, signin, tokens, shadcn]
status: complete
last_updated: 2026-10-01
last_updated_by: Marcin
last_updated_note: Initial /10x-ui audit for ui-auth-signin
---

# Research: UI audit of `/auth/signin`

**Date**: 2026-10-01T13:57:17+02:00  
**Researcher**: Marcin  
**Git Commit**: 036fba332e70f29512050a6da402b461e360a8c2  
**Branch**: master  
**Repository**: rpg-bingo

## Research Question

For change `ui-auth-signin` (`/10x-ui`): against the settled Vintage Paper / shadcn contract, which charges apply to the sign-in view (`/auth/signin` → `src/pages/auth/signin.astro` + `SignInForm.tsx` and the auth primitives it renders), and what must the plan leave untouched?

## Summary

The contract variant is an **existing design system**. Vintage Paper already lives in `src/styles/global.css` (`:root` / `.dark` → `@theme inline`), and `<html class="dark">` is set in `Layout.astro`. Tokenized siblings (`/sessions/new`, `/dashboard`, `/sessions/[id]`) read role classes. This change should not deposit a second palette and should not re-run `shadcn init`.

On the inspected sign-in stack, the page and three shared islands do not read those role classes. A count of `scripts/check-ui-literals.mjs` `LITERAL_RE` on these six files — `signin.astro`, `SignInForm.tsx`, `FormField.tsx`, `SubmitButton.tsx`, `PasswordToggle.tsx`, `ServerError.tsx` — is **23** matches: 8, 0, 9, 4, 2, and 0. `ServerError.tsx:11` is the one file in that set that uses `destructive` role classes. `SubmitButton.tsx:3` is the one import of `@/components/ui` (`Button`), then `SubmitButton.tsx:18` overrides it with `bg-purple-600`. `FormField` renders a raw `<label>` and `<input>` even though `Input` and `Label` exist under `src/components/ui/`. A glob of that directory returned no `card.tsx`; the tokenized create-session page uses a `div` with `bg-card` and `border-border` (`sessions/new/index.astro:24–28`).

Logged-out visitors get HTML, not JSON. `PROTECTED_ROUTES` in `middleware.ts:4` is the array `["/dashboard", "/sessions"]`, so `/auth/signin` is not in that list. The same middleware has no branch that sends an already-authenticated user away from `/auth/signin`. Failed sign-in is `context.redirect` to `/auth/signin?error=…` (`signin.ts:15–16`); `signin.astro` does not assign `Astro.response.status`. Field errors are text plus an icon (`FormField.tsx:58–62`), coloured with `text-red-300`, not `text-destructive`. The non-2xx lesson in `context/foundation/lessons.md` applies to a branded error UI for a **failed data load**; this `?error=` path is an auth-failure message on the form page, so that lesson does not apply here.

`FormField`, `SubmitButton`, and `PasswordToggle` are also imported by `SignUpForm.tsx:3–5`. Editing them in place changes the signup controls. The signup and confirm-email **page shells** stay outside this one view.

Phase scope for planning (inferred from the three prior UI changes, which skipped a second token deposit once Vintage Paper was in `global.css`): **skip** token-value deposit; **do** restyle this view onto role classes, use `Input` / `Label` / `Button` without palette overrides, decide the already-authenticated entry, add a sign-in kitchen sink, and extend `SCOPED_FILES`.

## Charges

| # | Category | Evidence | Effect on the user |
| --- | --- | --- | --- |
| C1 | **Missing tokens** | `src/pages/auth/signin.astro:9–17` (`bg-cosmic`, `border-white/10`, `bg-white/10`, `text-white`, `from-blue-200 to-purple-200`, `text-blue-100/60`, `text-purple-300`); tokenized sibling `src/pages/sessions/new/index.astro:24–28` (`bg-background`, `border-border`, `bg-card`, `text-foreground`, `text-primary`); utility `src/styles/global.css:123–125` | The sign-in card is a blue-purple glass panel, so the first screen does not match the paper surfaces the same person sees after login. |
| C2 | **Missing shared component** | Raw `<label>` / `<input>` `FormField.tsx:37–55` (`text-blue-100/80`, `bg-white/10`, `text-white`, `focus:outline-none focus:ring-2`, `border-red-400/60 focus:ring-red-400` or `border-white/20 focus:ring-purple-400`, error `text-red-300` at `:59`); `PasswordToggle.tsx:13` (`text-white/40`, `hover:text-white/70`, no focus ring class); existing `Input` `src/components/ui/input.tsx:11–13` (`border-input`, `placeholder:text-muted-foreground`, `focus-visible:ring-ring/50`, `aria-invalid:border-destructive`); `Label` `src/components/ui/label.tsx:6–12` | Email and password, including keyboard focus and the error line, use purple/red/white instead of the shared field, so focus and errors do not follow `--ring` / `destructive`. |
| C3 | **Missing shared component** | `SubmitButton.tsx:15–22` imports `Button` then sets `bg-purple-600`, `hover:bg-purple-500`, `text-white`, and a spinner `border-white/30`; `Button` default is `bg-primary text-primary-foreground hover:bg-primary/90` with `focus-visible:ring-ring/50` (`button.tsx:8–12`) | The primary action stays a purple button with a white spinner, so the control that submits the form does not use the shared primary or its focus ring. |
| C4 | **Accidental architecture** | `middleware.ts:4,18–24` redirects only when the path starts with `/dashboard` or `/sessions` and `locals.user` is missing; no branch redirects an authenticated user off `/auth/signin`; success POST goes to `/` (`signin.ts:19`) | A person who already has a session and opens the sign-in link still gets the form, and can submit again, instead of continuing into the app. |
| C5 | **Accidental architecture** | No sign-in kitchen sink; precedent `src/pages/sessions/new/kitchen-sink.astro:4–6` (PROD 404); `SCOPED_FILES` in `scripts/check-ui-literals.mjs:9–21` includes `ServerError.tsx` and omits `signin.astro`, `SignInForm.tsx`, `FormField.tsx`, `SubmitButton.tsx`, `PasswordToggle.tsx`; rule to extend that list is `CLAUDE.md:51` | Focus, error, and disabled states of this form have no screenshot gate, and palette / `bg-cosmic` can return on these files without failing `npm run lint`. |

### Deferred (visible, out of this view’s fix-or-explicitly-defer)

- Page shells `src/pages/auth/signup.astro:9–18` and `src/pages/auth/confirm-email.astro:22–30` copy the same cosmic card. They are not this change’s view. `SignUpForm.tsx:3–5` imports `FormField`, `PasswordToggle`, and `SubmitButton`, so C2/C3 edited in place also restyle signup **controls**. Forking a second input or button would break the shared-component rule; the plan should edit the shared files and leave the two page shells deferred.
- `ServerError.tsx:11` already uses `border-destructive/30`, `bg-destructive/10`, and `text-destructive`, and the file is already in `SCOPED_FILES`. Do not restyle it onto card colours. The older note that it uses `red-*` (`context/changes/ui-new-session-board/research.md:50`) is contradicted by the current file.
- `src/components/ui/` has no `card.tsx` in the glob of that directory (files present: `badge.tsx`, `button.tsx`, `checkbox.tsx`, `input.tsx`, `label.tsx`, `radio-group.tsx`, `LibBadge.astro`). Tokenized pages use a `div` with `bg-card`. Adding `Card` through `npx shadcn@latest add card` is optional, not required to clear C1.
- `button.tsx:8` `focus-visible:ring-[3px]` and `button.tsx:14` `text-white` on the destructive variant sit on the primitive, which is not in `SCOPED_FILES`. They are not a sign-in charge.
- Empty state for this view: the screen is a form, not a list. Mark **empty** N/A in the 7-state matrix with that reason.
- Loading spinner visibility under a native `method="POST"` (see Open Questions) is unverified. The markup exists; do not treat a missing flash as a separate charge until it is observed.

## Detailed Findings

### Token source and this view

- Source: `src/styles/global.css` `:root` / `.dark` / `@theme inline`, and `@utility bg-cosmic` at `:123–125` (hex gradient). Role names published there include `background`, `foreground`, `card`, `card-foreground`, `primary`, `primary-foreground`, `muted`, `muted-foreground`, `destructive`, `border`, `input`, `ring`.
- Dark wrapper: `Layout.astro` sets `class="dark"` on `<html>` (same contract as the dashboard audit).
- On `src/pages/auth/*.astro`, a grep for `bg-background|text-foreground|bg-primary|text-muted-foreground|border-border|text-destructive|bg-card|ring-ring` returned no matches.
- `LITERAL_RE` hit lines on the six-file stack: `signin.astro:9` `bg-cosmic`; `:10` `border-white`, `bg-white`, `text-white`; `:11` `from-blue`, `to-purple`; `:15` `text-blue`; `:17` `text-purple`; `FormField.tsx:6` `bg-white`, `text-white`; `:37` `text-blue`; `:41` `text-white`; `:53` `border-red`, `ring-red`, `border-white`, `ring-purple`; `:59` `text-red`; `SubmitButton.tsx:18` `bg-purple`, `text-white`, `bg-purple`; `:22` `border-white`; `PasswordToggle.tsx:13` `text-white`, `text-white`.
- Two colour-family classes on that stack are outside `LITERAL_RE`: `placeholder-white/40` (`FormField.tsx:6`) and `border-t-white` (`SubmitButton.tsx:22`).

### Shared components

- `FormField` is used by `SignInForm.tsx:3` and `SignUpForm.tsx:3`. It does not import `Input` or `Label`.
- `PasswordToggle.tsx` is a raw `<button type="button">` with an accessible name (`aria-label` at `:14`). No toggle primitive exists in the `ui/` glob above.
- `SubmitButton` is used by `SignInForm.tsx:5` and `SignUpForm.tsx:5`. Pending UI is `useFormStatus` plus a hand-rolled spinner (`SubmitButton.tsx:11–23`). No spinner primitive is in that `ui/` glob.
- `ServerError` is also used by `NewSessionForm.tsx:8` and `:224`. A visual edit there would touch the create-session form, which is already tokenized.

### Entry points and states (this view)

| Condition | Observed in source | Anchor |
| --- | --- | --- |
| Logged out, GET `/auth/signin` | Middleware calls `next()`; page renders `Layout` + form | `middleware.ts:18–24`; `signin.astro:8–14` |
| Logged out, GET `/dashboard` or `/sessions…` | Redirect to `/auth/signin` | `middleware.ts:4,18–21` |
| Already logged in, GET `/auth/signin` | Same form; no redirect in this middleware | `middleware.ts:18–24` |
| Straight from a link | Same GET page (signup, confirm-email, and the protected-route redirect all target `/auth/signin`) | `signin.astro:8`; `signup.astro:17`; `confirm-email.astro:29` |
| Failed POST | Redirect to `/auth/signin?error=` with `error.message`; page reads the query and passes it to `ServerError` | `signin.ts:15–16`; `signin.astro:5`; `SignInForm.tsx:80` |
| Successful POST | Redirect to `/` | `signin.ts:19` |
| Empty or invalid fields | `noValidate`; `preventDefault` when `validate()` fails; Polish text under the field plus `CircleAlert` | `SignInForm.tsx:18–39,43`; `FormField.tsx:58–62` |
| `?error=` empty string | `ServerError` returns null when `message` is falsy | `ServerError.tsx:7–8` |
| Pending submit | `disabled={pending}` and spinner text `Logowanie...` when `useFormStatus().pending` is true | `SubmitButton.tsx:12–23`; `SignInForm.tsx:82` |
| Disabled besides pending | No other `disabled` on this form | `SubmitButton.tsx:17` |

**7-state matrix (current source, not a screenshot):**

| State | On this path |
| --- | --- |
| default | C1–C3 literals, not role classes |
| hover | Link `hover:underline` (`signin.astro:17`); button `hover:bg-purple-500` (`SubmitButton.tsx:18`); toggle `hover:text-white/70` (`PasswordToggle.tsx:13`) |
| focus-visible | Inputs use `focus:` + `focus:outline-none` + `focus:ring-purple-400` or `focus:ring-red-400` (`FormField.tsx:6,53`), not `focus-visible` and not `ring-ring`. `Button` defines `focus-visible:ring-ring/50` (`button.tsx:8`) but the submit `className` overrides the fill. The password toggle has no focus-ring class (`PasswordToggle.tsx:13`). |
| disabled | Submit sets `disabled` only while `pending` (`SubmitButton.tsx:17`). Inputs have no disabled prop on this form. |
| error | Field message is text plus icon, so not colour alone, but the colour is `text-red-300` / `border-red-400` (`FormField.tsx:53,59`). Server banner is `destructive` (`ServerError.tsx:11`). |
| empty | N/A — form, no collection to be empty |
| loading | Spinner markup is behind `pending` (`SubmitButton.tsx:20–23`). Whether that flag becomes true for this native POST was not run in a browser (Open Questions). |

### Agent rules

`CLAUDE.md:51–52` and `AGENTS.md` (UI bullet) forbid palette classes, arbitrary values, and extending `bg-cosmic` past deferred pages, and they name the three existing kitchen sinks. No rule in those UI sections tells the agent to use one-off palette or arbitrary values. C5 is the missing extension of that guard, not a rule that causes the drift.

## Code References

- `src/pages/auth/signin.astro:8–22` — cosmic card, gradient title, signup link, `SignInForm`
- `src/components/auth/SignInForm.tsx:18–43` — client validation and native POST
- `src/components/auth/FormField.tsx:5–62` — raw input, palette focus/error
- `src/components/auth/SubmitButton.tsx:11–31` — `Button` plus purple override and spinner
- `src/components/auth/PasswordToggle.tsx:9–16` — raw icon button
- `src/components/auth/ServerError.tsx:7–14` — `destructive` banner; null when message is falsy
- `src/pages/api/auth/signin.ts:4–19` — POST, error redirect, success to `/`
- `src/middleware.ts:4–24` — protected prefixes only
- `src/components/ui/input.tsx:11–13` — tokenized input, including invalid and focus-visible
- `src/components/ui/button.tsx:7–12` — default primary and focus-visible ring
- `src/pages/sessions/new/index.astro:24–28` — role-class page shell to mirror
- `scripts/check-ui-literals.mjs:9–21` — `SCOPED_FILES`
- `src/styles/global.css:123–125` — `bg-cosmic` hex utility

## Architecture Insights

Sign-in is a public HTML page plus a classic form POST, not a JSON API rendered as the page. The visual drift is the deferred cosmic shell from the earlier UI changes. In the current `SCOPED_FILES` list (`scripts/check-ui-literals.mjs:9–21`), the auth path included is `ServerError.tsx`; `signin.astro`, `SignInForm.tsx`, `FormField.tsx`, `SubmitButton.tsx`, and `PasswordToggle.tsx` are absent from that list.

There is no `Card` in `src/components/ui/`. C1 is cleared by the same `div` + `bg-card` / `border-border` / `text-foreground` shell as `sessions/new/index.astro:25`, not by a second card implementation.

C2 and C3 cannot be fixed only inside `signin.astro`. The classes live in files `SignUpForm` also imports.

## Historical Context (from prior changes)

- `context/changes/ui-new-session-board/research.md:49` — deferred list includes auth among cosmic one-offs. **Supported** for the three auth page shells inspected now (`signin.astro:9`, `signup.astro:9`, `confirm-email.astro:22` still use `bg-cosmic`).
- `context/changes/ui-new-session-board/research.md:50` — `ServerError.tsx:11` uses `red-*`. **Contradicted** by current `ServerError.tsx:11` (`destructive` roles). Later changes left that file in `SCOPED_FILES`.
- `context/changes/ui-mg-dashboard/research.md:49` and `context/changes/ui-session-board/research.md:49` — auth pages deferred, one view per change. **Supported** as the scope rule this change follows; those notes do not name `/auth/signin` as the view to edit.
- `context/changes/ui-new-session-board/change.md` — token source is Vintage Paper in `global.css`, kitchen sink PROD 404, guard in `CLAUDE.md` plus `check-ui-literals.mjs`. **Supported** by `global.css` `@theme inline`, `kitchen-sink.astro:4–6`, and `CLAUDE.md:51–52`. Do not deposit the theme again.
- `context/foundation/lessons.md` — non-2xx when an SSR page renders a branded error for a failed data load. **Does not apply** to GET `/auth/signin?error=` on this path: the page is the form, and `signin.astro` does not set a status. Do not map a bad password onto 503.

## Related Research

- `context/changes/ui-new-session-board/research.md` — token deposit and the first charge-list shape
- `context/changes/ui-mg-dashboard/research.md` — `## Charges` table this document follows
- `context/changes/ui-session-board/research.md` — same one-view deferral of auth pages

## Open Questions

- `useFormStatus().pending` on `SignInForm`’s native `method="POST" action="/api/auth/signin"` was not exercised in a browser. The loading cell may not paint before the document navigates. The plan should confirm that in the kitchen sink or a real submit before calling the loading state done.
- If C4 is accepted, the destination for an already-authenticated visitor is not fixed by the sign-in page. The success POST redirects to `/` (`signin.ts:19`), not `/dashboard`. That destination is a product choice for the plan, not a token decision.
