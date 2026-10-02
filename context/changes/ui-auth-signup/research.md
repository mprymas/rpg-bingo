---
date: 2026-10-02T13:06:45+02:00
researcher: Marcin
git_commit: 1ad0f3628742f50b38baea6e68732c4d031b636f
branch: master
repository: mprymas/rpg-bingo
topic: "UI audit of /auth/signup against the existing Vintage Paper tokens"
tags: [research, ui, auth, signup]
status: complete
last_updated: 2026-10-02
last_updated_by: Marcin
---

# Research: UI audit of /auth/signup against the existing Vintage Paper tokens

**Date**: 2026-10-02T13:06:45+02:00
**Researcher**: Marcin
**Git Commit**: 1ad0f3628742f50b38baea6e68732c4d031b636f
**Branch**: master
**Repository**: mprymas/rpg-bingo

## Research Question

What should `/10x-ui` charge against the existing signup view (`src/pages/auth/signup.astro` and `src/components/auth/SignUpForm.tsx`), given the Vintage Paper tokens and the already tokenized sign-in view?

## Summary

On the files inspected for this change, signup already renders through the shared auth controls (`FormField`, `PasswordToggle`, `SubmitButton`, `ServerError`). Those four files use role classes. The page shell and one password hint do not.

`src/pages/auth/signup.astro:9–17` still paints `bg-cosmic`, a white glass card, a blue-to-purple gradient heading, and blue/purple footer text. The matching roles on `src/pages/auth/signin/index.astro:13–20` are `bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, and `text-primary`. `SignUpForm.tsx:59` passes a hint node with `text-blue-100/50`; `FormField.tsx:67–68` renders that node unchanged.

A signed-in visitor is sent away from `/auth/signin` (`signin/index.astro:5–7`) and is not sent away from `/auth/signup` (page frontmatter `signup.astro:1–6` has no `Astro.locals.user` check; the `PROTECTED_ROUTES` array at `middleware.ts:4` is `["/dashboard", "/sessions"]`). The glob of `src/pages/auth/` for this research contains `signin/kitchen-sink.astro` and no signup kitchen-sink file. `scripts/check-ui-literals.mjs:9–27` does not list `signup.astro` or `SignUpForm.tsx`.

Contract variant: existing design system. Do not deposit a second palette. `/auth/confirm-email` stays deferred.

## Charges

| # | Category | Evidence | Effect on the user |
| --- | --- | --- | --- |
| C1 | **Missing tokens** | `src/pages/auth/signup.astro:9–17` (`bg-cosmic`, `border-white/10`, `bg-white/10`, `text-white`, `backdrop-blur-xl`, `from-blue-200`, `to-purple-200`, `text-blue-100/60`, `text-purple-300`); tokenized sibling `src/pages/auth/signin/index.astro:13–20` (`bg-background`, `border-border`, `bg-card`, `text-foreground`, `text-muted-foreground`, `text-primary`); utility `src/styles/global.css:123–125` | The person who follows “Załóż konto” from the paper sign-in card lands on a blue-purple glass panel that does not match the screen they just left. |
| C2 | **Missing tokens** | `src/components/auth/SignUpForm.tsx:57–62` hint `<p className="mt-1 text-xs text-blue-100/50">`; `FormField.tsx:62–68` wraps errors in `text-destructive` and renders `hint` with no wrapper classes | While the password is still too short, the live “characters left” line stays pale blue beside fields whose errors already use the destructive token. |
| C3 | **Accidental architecture** | `src/pages/auth/signin/index.astro:5–7` redirects when `Astro.locals.user` is set; `src/pages/auth/signup.astro:1–6` does not; `src/middleware.ts:4,18–24` redirects only unauthenticated requests whose path starts with `/dashboard` or `/sessions` | A person who already has a session and opens `/auth/signup` still gets the create-account form, including from the sign-in footer after a later return to that URL. |
| C4 | **Accidental architecture** | No `signup/kitchen-sink` in the glob of `src/pages/auth/` (the kitchen-sink file there is `src/pages/auth/signin/kitchen-sink.astro:5–7`, PROD 404); `SCOPED_FILES` at `scripts/check-ui-literals.mjs:9–27` includes the sign-in page, sign-in sink, `SignInForm.tsx`, and the four shared primitives, and does not include `signup.astro` or `SignUpForm.tsx`; extend-the-list rule `CLAUDE.md:51` | Focus, confirm-password error, and pending cannot be reviewed together on this form, and a later edit can put palette classes or `bg-cosmic` back on these two files without failing `npm run lint`. |

### Deferred

- `src/pages/auth/confirm-email.astro:22–30` copies the same cosmic card (`bg-cosmic`, `border-white/10`, `bg-white/10`, `from-blue-200`, `to-purple-200`, `text-blue-100/80`, `text-purple-300`). `context/changes/ui-auth-signup/change.md:16` keeps it out of this view. Success POST still redirects there (`src/pages/api/auth/signup.ts:19`).
- Empty, for this form: mark **empty** N/A in the 7-state matrix. The screen is a form, not a collection. Sign-in already does that at `signin/kitchen-sink.astro:40–44`.
- `src/components/ui/button.tsx` and `src/components/ui/input.tsx` stay outside `SCOPED_FILES`. The sign-in plan left `ring-[3px]` and destructive `text-white` on those primitives (`context/changes/ui-auth-signin/plan.md:197`). They are not a signup charge.
- No second `Card`, `Input`, or `Button`. Signup already imports the shared auth controls (`SignUpForm.tsx:3–6`). Sign-in restyled those files in place (`context/changes/ui-auth-signin/plan.md:197` deliberately omitted `SignUpForm.tsx` from the guard). A grep of `src/components/auth` for the literal pattern in this session matched `SignUpForm.tsx:59` and no line in `FormField.tsx`, `SubmitButton.tsx`, `PasswordToggle.tsx`, or `ServerError.tsx`.

## Detailed Findings

### Page shell versus sign-in

On `signup.astro`, the inspected class strings are:

- Line 9: `bg-cosmic`
- Line 10: `border-white/10`, `bg-white/10`, `text-white`, `backdrop-blur-xl`
- Line 11: `from-blue-200`, `to-purple-200` (gradient heading)
- Line 15: `text-blue-100/60`
- Line 17: `text-purple-300`

That is 7 palette-class occurrences plus `bg-cosmic` on this file. No hex, `rgb(`, `oklch(`, or arbitrary `px`/`rem` bracket utilities appear in `signup.astro` or `SignUpForm.tsx`.

Sign-in, after `ui-auth-signin`, uses role classes for the same roles (`signin/index.astro:13–20`). Token values for `--background`, `--card`, `--foreground`, `--primary`, `--muted-foreground`, `--destructive`, `--border`, and `--ring` live in `src/styles/global.css` (`:root` from line 6, `.dark` from line 44, published in `@theme inline` from line 82). `<html class="dark">` is the app contract (`CLAUDE.md:47`).

### Password hint

`SignUpForm.tsx:57–62` builds the short-password hint only when there is no password error, the password is non-empty, and its length is below `MIN_PASSWORD_LENGTH` (6, line 8). The node is passed as `hint` on the password `FormField` (line 91). `FormField` shows `hint` only when `error` is absent (`FormField.tsx:62–68`), so the blue hint and the destructive error do not render together. The colour fix belongs on that hint node (`text-muted-foreground`), not on a new component.

Confirm-password has no hint. Its errors are the client strings at `SignUpForm.tsx:38–40`.

### What the shared controls already cover

`SignUpForm` uses `FormField` for email, password, and confirm-password, `ServerError` for `serverError`, and `SubmitButton` with pending text `"Tworzenie konta..."` (`SignUpForm.tsx:66–130`). `SubmitButton.tsx` disables the button while `useFormStatus()` is pending or the optional `pending` prop is set. `PasswordToggle.tsx:13` uses `text-muted-foreground`, `hover:text-foreground`, and `focus-visible:ring-ring`. Field errors set `aria-invalid` on `Input` (`FormField.tsx:57`).

`SignUpForm` has no `demoState` prop. `SignInForm.tsx:9–19` does (`default | focus | error | loading`), and the sign-in sink passes it so the gallery does not POST (`signin/kitchen-sink.astro:8–38`). A signup sink needs the same kind of prop, including confirm-password mismatch in the error section, because that field is on `SignUpForm.tsx:103–124` and is absent from the inspected `SignInForm.tsx`.

### Entry, validation, and redirects

`PROTECTED_ROUTES` is `["/dashboard", "/sessions"]` (`middleware.ts:4`). Unauthenticated users hitting those prefixes go to `/auth/signin` (`middleware.ts:18–21`). `/auth/signup` is not in that array, so logged-out and logged-in requests both reach the page.

Client validation calls `preventDefault` when invalid (`SignUpForm.tsx:51–54`), so those submits do not POST. Messages are the six strings in `validate()` (`SignUpForm.tsx:25–40`). A valid submit is a native `POST` to `/api/auth/signup` (`SignUpForm.tsx:65`). The API reads `email` and `password` only (`signup.ts:6–7`); confirm-password is client-only. Failure redirects to `/auth/signup?error=…` (`signup.ts:11,16`). The page passes that query to `SignUpForm` (`signup.astro:5–6,14`). Success redirects to `/auth/confirm-email` (`signup.ts:19`).

Sign-in’s signed-in redirect is on the page, not in middleware, so `/auth/signin/kitchen-sink` is not redirected (`context/changes/ui-auth-signin/plan.md:47`, `plan.md:155`). Signup is still a flat `signup.astro`. A sink at `/auth/signup/kitchen-sink` needs the same split: move the page to `signup/index.astro`, redirect only there, and 404 the sink when `import.meta.env.PROD`.

### States the sign-in sink already shows

The sign-in sink sections (`signin/kitchen-sink.astro:9–44`) are `default`, `focus` (title “hover / focus”), `error`, `loading` (title “loading / disabled”; description says disabled occurs during pending), and `empty` as `kind: "na"`. Hover is not its own section. Signup can drive default, client error, and server error today. It cannot freeze focus or pending without a `demoState` (or equivalent) because it does not pass `className`, `autoFocus`, or `pending`.

### Agent rules

`CLAUDE.md:49–52` and `AGENTS.md:12` point at `src/styles/global.css` and `src/components/ui/`, ban palette classes, arbitrary values, and new `bg-cosmic`, and name `/auth/signin/kitchen-sink` among the dev sinks. Neither file contains a `<!-- BEGIN @przeprogramowani/10x-cli -->` block in the copy read for this research. No rule in those UI sections tells the agent to use one-off palette classes. `CLAUDE.md:51` still allows existing `bg-cosmic` on deferred pages until they are added to `SCOPED_FILES`.

## Code References

- `src/pages/auth/signup.astro:9–17` — cosmic shell, gradient heading, palette footer
- `src/components/auth/SignUpForm.tsx:57–62` — `text-blue-100/50` password hint
- `src/components/auth/FormField.tsx:62–68` — destructive error wrapper; raw `hint`
- `src/pages/auth/signin/index.astro:5–7` — signed-in redirect to `/dashboard`
- `src/pages/auth/signin/index.astro:13–20` — role-class card and footer link
- `src/middleware.ts:4` — `PROTECTED_ROUTES`
- `src/pages/api/auth/signup.ts:11–19` — error query and confirm-email redirect
- `src/pages/auth/signin/kitchen-sink.astro:5–44` — PROD 404 and five sections
- `src/components/auth/SignInForm.tsx:9–19` — `demoState` prop
- `scripts/check-ui-literals.mjs:9–27` — guarded files; signup view files absent
- `src/pages/auth/confirm-email.astro:22–30` — deferred cosmic card
- `src/styles/global.css:123–125` — `bg-cosmic` utility

## Architecture Insights

Signup is one view on an existing token system. The plan order from `/10x-ui`, with the token-value phase skipped the way `ui-auth-signin` skipped it: restyle this view onto the sign-in role classes, send signed-in users to `/dashboard` from the page (not middleware), add a signup kitchen sink with `demoState`, then add `signup/index.astro`, the sink, and `SignUpForm.tsx` to `SCOPED_FILES`. Preserve Polish copy, `email` / `password` / `confirmPassword`, and `POST /api/auth/signup`.

## Historical Context (from prior changes)

- `context/changes/ui-auth-signin/research.md:49–51` — signup and confirm-email shells were deferred; shared controls would restyle signup fields in place. **Supported** on the current imports (`SignUpForm.tsx:3–6`) and on the current cosmic shell (`signup.astro:9–17`).
- `context/changes/ui-auth-signin/plan.md:47` and `plan.md:155` — signed-in redirect stays on the sign-in page so the sink is not redirected. **Supported** by `signin/index.astro:5–7` and by the absence of an `/auth` branch in `middleware.ts:18–24`.
- `context/changes/ui-auth-signin/plan.md:197` — do not add `signup.astro`, `confirm-email.astro`, or `SignUpForm.tsx` to `SCOPED_FILES` in that change. **Supported** by the current array (`check-ui-literals.mjs:9–27`).
- `context/changes/ui-auth-signin/research.md:43` — the sign-in shell charge cited `signin.astro:9–17`. **Partial:** the page now lives at `src/pages/auth/signin/index.astro`. The charge’s colour claim is superseded by the tokenized classes at lines 13–20 of that file. The deferral of signup was a separate sentence and still holds.
- `context/changes/ui-new-session-board/research.md`, `ui-mg-dashboard/research.md`, and `ui-session-board/research.md` (each around the deferred-cosmic note near line 49) — auth pages were left for a later view. **Supported** for signup and confirm-email; **contradicted** for sign-in, which `ui-auth-signin` has since tokenized.

## Related Research

- `context/changes/ui-auth-signin/research.md` — the sibling audit this view should follow
- `context/changes/ui-new-session-board/research.md` — first Vintage Paper deposit and the literal-scan guard

## Open Questions

- Whether a real signup POST paints “Tworzenie konta...” before navigation is unverified in the browser. Sign-in left the same native-POST flash as a possible N/A (`context/changes/ui-auth-signin/plan.md:49`). It is not a separate charge.
- Supabase’s session cookie after `signUp` was not read beyond `signup.ts:13–19`. The signed-in redirect on a later GET of `/auth/signup` depends on `Astro.locals.user`, which middleware sets from `getUser()` (`middleware.ts:9–13`).
