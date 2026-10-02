# Sign-in Vintage Paper — Plan Brief

> Full plan: `context/changes/ui-auth-signin/plan.md`  
> Research: `context/changes/ui-auth-signin/research.md`

## What & Why

`/auth/signin` is still the cosmic glass card, so the first screen does not match the paper surfaces used after login. This change restyles that view onto the existing Vintage Paper contract, shared `Input` / `Label` / `Button`, a signed-in redirect to `/dashboard`, a kitchen-sink gate, and an extended literal-scan guard.

## Starting Point

Tokens and `html.dark` are live. `signin.astro` and the shared auth controls ignore them (23 `LITERAL_RE` hits). `FormField` is a raw input; `SubmitButton` overrides `Button` with purple. A signed-in GET of `/auth/signin` still shows the form. Success POST goes to `/`. `SCOPED_FILES` includes `ServerError.tsx` and omits the rest of this stack.

## Desired End State

A logged-out visitor sees a tokenized sign-in card. Focus follows `--ring`. Field errors are text plus an icon in `destructive`. A signed-in visit to `/auth/signin` lands on `/dashboard`. A successful sign-in still lands on `/`. Dev `/auth/signin/kitchen-sink` exposes the matrix; lint fails if palette or `bg-cosmic` returns on the scoped sign-in files.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Complexity | LOW, 1 question | One view, settled tokens, one open entry choice | Plan interview |
| Signed-in entry | GET → `/dashboard`; POST success stays `/` | Panel MG is the app; Welcome stays the post-login landing | User |
| Tokens / Card | Skip redeposit; `div` + `bg-card` | Tokens exist; no `card.tsx`; siblings already use the div | Research |
| Shared controls | Edit `FormField`, `SubmitButton`, `PasswordToggle` in place | Signup imports them; a second field/button breaks the shared-component rule | Research |
| Page shells | Signup and confirm-email deferred | One view per change; shells stay cosmic | Research |
| `ServerError` | Leave the destructive banner | Already tokenized and in `SCOPED_FILES` | Research |
| Loading | Sink forces pending; live POST checked by hand | Native POST may navigate before `useFormStatus` paints | Research |
| Kitchen sink | `/auth/signin/kitchen-sink`, PROD 404, page relocated to `index.astro` | Astro cannot pair `signin.astro` with `signin/` | Plan (dashboard precedent) |
| Bad password | Stays `?error=` on the form | Lessons non-2xx applies to failed data loads, not this path | Research / lessons |

## Scope

**In scope:**

- Relocate `signin.astro` → `auth/signin/index.astro`
- Restyle the card and shared field, submit, and password toggle onto role classes
- Signed-in GET redirects to `/dashboard`
- Dev kitchen sink + screenshots
- Extend `SCOPED_FILES` + CLAUDE/AGENTS kitchen-sink pointer

**Out of scope:**

- Signup and confirm-email page shells; Welcome; Topbar; removing `bg-cosmic`
- shadcn `Card`; restyling `ServerError`; scoping `input.tsx` / `button.tsx`
- Changing success POST away from `/`; client `fetch`; HTTP 503 for a bad password
- Playwright CI; widening `LITERAL_RE`

## Architecture / Approach

Relocate the page → restyle shell and shared controls, and redirect signed-in GET to `/dashboard` from the page (not middleware) → sibling kitchen sink gated by `import.meta.env.PROD` → extend lint scope and agent rules. Signup controls change because they share those three components. No schema or API destination change.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. One view + signed-in entry | Tokenized `/auth/signin`, shared controls, redirect to `/dashboard` | Shared edit also restyles signup controls |
| 2. Kitchen-sink + gate | Named-state gallery + screenshots | A middleware-style redirect would hide the sink from logged-in devs |
| 3. Guard | `SCOPED_FILES` + rule pointers | Rules updated while files stay off the scoped list |

**Prerequisites:** Research complete; local `npm run dev`; one logged-out and one logged-in session.  
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- `useFormStatus` on the native POST may not paint; the sink still shows loading, and the live flash can be N/A.
- `LITERAL_RE` misses `placeholder-*` and `border-t-*`; those classes still leave the files, and a later return would not fail lint.
- Signup controls become paper while the signup shell stays cosmic until a later change.
- Roadmap has no Change ID `ui-auth-signin` — left untouched.

## Success Criteria (Summary)

- `/auth/signin` uses role tokens and shared `Input` / `Label` / `Button`; no cosmic palette on the view or shared controls.
- Signed-in GET goes to `/dashboard`; successful POST still goes to `/`.
- Kitchen sink covers the matrix (empty N/A) in DEV and 404s in PROD; screenshots exist.
- Literal scan scopes the sign-in files; agent rules mention `/auth/signin/kitchen-sink`.
