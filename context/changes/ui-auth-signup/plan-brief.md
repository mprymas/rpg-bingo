# Signup Vintage Paper — Plan Brief

> Full plan: `context/changes/ui-auth-signup/plan.md`
> Research: `context/changes/ui-auth-signup/research.md`

## What & Why

`/auth/signup` is the screen a person reaches from the paper sign-in card, and it still paints the old blue-purple glass panel. The shared fields are already on Vintage Paper. This change makes the page, the password hint, and the signed-in entry match sign-in, then locks that with a kitchen sink and the literal-value check.

## Starting Point

Sign-in (`ui-auth-signin`) already uses `bg-background` / `bg-card` / `text-primary` and redirects a session to `/dashboard`. Signup (`src/pages/auth/signup.astro:9–17`) is still `bg-cosmic` plus palette classes. `SignUpForm.tsx:59` is the one remaining literal, `text-blue-100/50`. There is no signup kitchen sink, and those two files are outside `SCOPED_FILES`.

## Desired End State

A logged-out visitor sees the same paper card as sign-in, with a muted “characters left” hint and destructive errors that include text. A signed-in visitor who opens `/auth/signup` lands on `/dashboard`. A successful POST still lands on `/auth/confirm-email`. Dev `/auth/signup/kitchen-sink` shows default, hover/focus, error (including confirm-password), and loading/disabled, with empty marked N/A. Lint fails if palette or `bg-cosmic` returns on the cleaned signup files.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Token deposit | Skip; use `global.css` as sign-in does | Vintage Paper is already published through `@theme inline` | Research |
| Shared controls | Do not edit `FormField`, `SubmitButton`, `PasswordToggle`, or `ServerError` | Signup already imports the tokenized controls | Research |
| Page shell | Copy sign-in role classes; drop the gradient and `bg-cosmic` | C1: the create-account card should match the card the person just left | Research |
| Password hint | `text-muted-foreground` on the existing hint node | C2: `FormField` renders `hint` unchanged | Research |
| Signed-in entry | Page redirect to `/dashboard`, not middleware | C3, and a middleware prefix would also hide the kitchen sink | Research |
| Route shape | `signup/index.astro` plus `signup/kitchen-sink.astro` | Astro cannot host a sink next to a flat `signup.astro` | Research |
| Submit transport | Keep native `POST /api/auth/signup`; do not copy sign-in’s `fetch` | `signup.ts` has no JSON branch | Plan |
| Posted names | Suffix `id`, set `name` to `email` / `password` / `confirmPassword` | `FormField` uses `name ?? id`, so a suffixed id would rename the POST fields | Plan |
| Hint in the sink | Focus section prefills a 1–5 character password | An empty default section never renders the hint | Plan |
| Empty state | N/A — the screen is a form | Same ruling as the sign-in sink | Research |
| Confirm-email | Deferred | `change.md` keeps that cosmic card out of this view | Research |
| Phases | One view, then kitchen sink, then guard | User approved this breakdown; library and token phases skipped | Plan |

## Scope

**In scope:**

- Relocate and restyle `/auth/signup`
- Muted password hint
- Signed-in redirect on that page
- Dev kitchen sink and screenshots
- `SCOPED_FILES` plus the kitchen-sink line in `CLAUDE.md` and `AGENTS.md`

**Out of scope:**

- `/auth/confirm-email`, Welcome, Topbar, sign-in
- New tokens, shadcn `Card`, or edits to shared auth primitives and `input.tsx` / `button.tsx`
- Signup API, Polish copy, field names, or a client `fetch` submit
- HTTP 503 on `?error=`, Playwright, widening `LITERAL_RE`

## Architecture / Approach

Move the page to `src/pages/auth/signup/index.astro`, paint it with the sign-in card classes, and redirect there when `Astro.locals.user` is set. `SignUpForm` gains an optional `demoState` so the sink can show error, focus, the hint, and pending without posting. Phase 3 adds the page, the sink, and `SignUpForm.tsx` to the existing literal scan.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. One view + signed-in entry | Paper card, muted hint, redirect to `/dashboard` | A suffixed id without an explicit `name` would break POST; Phase 1 does not suffix ids |
| 2. Kitchen sink + visual gate | Dev gallery of the 7 states, empty marked N/A | A real submit may navigate before `Tworzenie konta...` paints |
| 3. Guard | Lint fails if literals return; rules name the sink | Confirm-email stays unguarded on purpose |

**Prerequisites:** `ui-auth-signin` is implemented (shared controls and sign-in card already tokenized).
**Estimated effort:** about 2 sessions across 3 phases.

## Open Risks & Assumptions

- After a successful signup the next screen is still the cosmic confirm-email card. That jump is accepted until a later change.
- The signed-in redirect runs when middleware has set `Astro.locals.user`. A signup that does not establish a session still shows the form on the next GET, which matches sign-in.
- If the native POST navigates before the spinner paints, Phase 2 records that flash as N/A. The sink still shows pending.

## Success Criteria (Summary)

- Logged-out `/auth/signup` is the paper card, and a 1–5 character password shows a muted hint.
- A signed-in GET of `/auth/signup` goes to `/dashboard`; a successful POST still goes to `/auth/confirm-email`.
- The dev kitchen sink shows the matrix, and `npm run lint` fails if palette or `bg-cosmic` returns on the cleaned signup files.
