# Signed-in landing — Plan Brief

> Full plan: `context/changes/signed-in-landing/plan.md`

## What & Why

The sign-in restyle is showing its locked behavior, and the public home page never sends an existing session to Panel MG. Those are not one broken button.

This change makes a new product choice: a signed-in GM lands on `/dashboard` after a good password and on any later visit to `/`. The live button shows **Logowanie...** only while the request runs. Any form error returns an enabled **Zaloguj się**.

## Starting Point

A successful password POST redirects to `/`, and smoke asserts that. `/` always renders Welcome. A signed-in GET of `/auth/signin` already goes to `/dashboard`. The top bar links to Panel MG, but the hero still says **Zaloguj się**. The live form is a document POST, so `useFormStatus` often never paints the spinner. The kitchen sink forces that label and does not submit.

## Desired End State

A good password opens Panel MG, with **Logowanie...** held until that page loads. Opening `/` while signed in also opens Panel MG, before Welcome renders. A wrong password, a config failure, or a dead network puts the button back on **Zaloguj się**, shows the error on the form, and keeps what was typed. Signed-out `/` and sign-out are still Welcome.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Problem framing | New landing decision, not a sign-in bug | The POST to `/` and the missing home redirect are locked behavior plus a separate page | Frame |
| After a good password | Always `/dashboard` | Matches the signed-in sign-in redirect, with no remembered return path | Plan |
| Signed-in visit to `/` | Redirect to `/dashboard` | One rule, so a session never sits on the public hero | Plan |
| Pending label | `fetch`, **Logowanie...** only while the request is in flight | The spinner should paint, and any form error must leave the button idle | Plan |
| Rejected password | Stay on the form, keep the typed fields | A reload would wipe the email and password the spinner just waited on | Plan |
| Error text | Supabase `error.message`; **Nie udało się zalogować** when there is none | A wrong password and an unconfirmed email stay distinguishable | Plan |
| Document POST | Still a redirect | Smoke and a no-JS submit keep working; JSON is only for `Accept: application/json` | Plan |

## Scope

**In scope:**

- Document-post success target `/dashboard`
- Signed-in GET `/` → `/dashboard`
- Hydrated sign-in `fetch`, pending flag, in-place `ServerError`
- Smoke coverage for both the redirect and the JSON path

**Out of scope:**

- Return-to the page that bounced them to sign-in
- Welcome, top bar, hero copy, signup, sign-out destination
- Translating Supabase errors
- Kitchen sink submitting

## Architecture / Approach

`signin.ts` grows a second answer on the same POST. `Accept: application/json` returns 200 `{ "redirect": "/dashboard" }`, 401 `{ "error": "<message>" }`, or 503 for a missing Supabase config. Any other POST still redirects, with success moved to `/dashboard`. The form navigates only when `redirect` is exactly `/dashboard`. `index.astro` redirects a session the way the sign-in page already does. `/` stays out of `PROTECTED_ROUTES`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Destinations | Document-post success and signed-in `/` both go to Panel MG | Smoke and the sign-in plan lock still say success is `/` |
| 2. In-place sign-in | Spinner during the request; errors stay on the form and clear loading | `useFormStatus` stays idle after `preventDefault`, so the button needs its own flag |

**Prerequisites:** None for the code. `npm run smoke` needs a running server and local Supabase.
**Estimated effort:** One session across two phases.

## Open Risks & Assumptions

- This overrides `ui-auth-signin`: POST success on `/`, and “do not switch the form to `fetch`”.
- JSON mode must key off the `application/json` token, not `*/*`, or a normal form post would stop redirecting.
- A bad password stays HTTP 401. Only the missing-config JSON path uses 503.

## Success Criteria (Summary)

- A signed-in GM never remains on Welcome: password success and a later visit to `/` both open Panel MG.
- **Logowanie...** shows during the request, stays through the move to Panel MG, and is gone whenever the form is showing an error.
- The error banner shows Supabase’s message, or **Nie udało się zalogować** when the response has none, without clearing the fields.
