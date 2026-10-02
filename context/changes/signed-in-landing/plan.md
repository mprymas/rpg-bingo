# Signed-in landing Implementation Plan

## Overview

A signed-in GM should reach Panel MG, both immediately after a good password and on any later visit to `/`. The live sign-in button shows **Logowanie...** only while that request is in flight, and any form error returns it to an enabled **Zaloguj się**.

## Current State Analysis

`ui-auth-signin` locked this behavior on purpose. A successful password POST redirects to `/` (`src/pages/api/auth/signin.ts`). `scripts/smoke.mjs` asserts that location. A signed-in GET of `/auth/signin` already redirects to `/dashboard` (`src/pages/auth/signin/index.astro`). `/` itself only renders `Welcome.astro` and never reads the session. Middleware guards `/dashboard` and `/sessions`, not home (`src/middleware.ts`).

The top bar shows the GM’s email and a Panel MG link when a session exists. The Welcome hero still offers **Zaloguj się** and **Załóż konto**. The live form is a document POST. `SubmitButton` reads `useFormStatus().pending`, and the sign-in plan forbade switching the form to `fetch` because the browser can navigate before the spinner paints. The kitchen sink forces the pending label and does not POST.

The frame on the sign-in change settled the diagnosis: this is not a broken button. Where a session should land is a separate product decision, made in this plan.

## Desired End State

After a good password, the GM is on `/dashboard`. Opening `/` while signed in also lands on `/dashboard`, before Welcome renders. Signed-out `/` is still Welcome. Sign-out still returns to `/`.

On the hydrated sign-in form, **Logowanie...** shows during the request. A good password keeps that label until Panel MG loads. A field error never starts loading. A rejected password, the config message, or a network failure clears loading in the same update that shows `ServerError`, leaves the typed email and password in place, and leaves **Zaloguj się** enabled. The message is Supabase’s `error.message` when the response has one, and **Nie udało się zalogować** when it does not.

A document POST (no JSON accept) still redirects: success to `/dashboard`, failure to `/auth/signin?error=`. The kitchen sink still does not submit.

### Key Discoveries:

- Success redirect is `src/pages/api/auth/signin.ts` (`redirect("/")`). Smoke expects `location: "/"` for the correct password and `location: "/auth/signin?error="` for a wrong one (`scripts/smoke.mjs`). Location checks use `startsWith`.
- Signed-in sign-in already uses a page-local `return Astro.redirect("/dashboard")` (`src/pages/auth/signin/index.astro`). `/` must not be added to `PROTECTED_ROUTES`, or anonymous visitors would be sent to sign-in.
- `handleSubmit` calls `preventDefault` for `demoState` and for failed validation (`src/components/auth/SignInForm.tsx`). `useFormStatus` does not become pending when the submit is cancelled, so the live spinner needs the existing `pending` override on `SubmitButton`.
- Session cookies are written by `createClient` before the handler returns (`src/lib/supabase.ts`). A JSON success can set the same cookies and then let the client navigate.
- A bad password must not become HTTP 503. The sign-in plan forbade that. The lessons rule about non-2xx applies to a failed data load, which here is only the missing-Supabase config on the JSON path.

## What We're NOT Doing

- Remembering the protected page that bounced the GM to sign-in (`next` / return-to). Success is always `/dashboard`.
- Restyling, tokenizing, or editing Welcome or the top bar. Signed-in visitors do not see them.
- Changing the hero calls-to-action.
- Moving signup, sign-out, or the signed-in `/auth/signin` redirect. Sign-out stays `/`. Signup stays a document POST.
- Translating Supabase errors, or mapping a bad password onto HTTP 503.
- Letting the kitchen sink POST.

## Implementation Approach

Keep one sign-in endpoint. A request whose `Accept` header lists `application/json` gets a JSON body the form can read. Every other POST keeps today’s redirect style, with the success target moved to `/dashboard`. The hydrated form always sends that Accept value, shows its own pending flag, and navigates only on an exact `/dashboard` redirect value. Native form posts do not send `application/json` (their `*/*` must not count), so smoke’s existing redirect checks stay valid aside from the new success location.

This overrides two locks in `context/changes/ui-auth-signin/plan.md`: success stays on `/`, and the live form must not become `fetch`.

## Critical Implementation Details

- **Pending flag:** Set it only after `validate()` passes. Field errors never enter loading. On a rejected password, a config error, or a network failure, clear the flag in the same update that sets `ServerError`, so the button is not still **Logowanie...** when the message is visible. On success, leave the flag set until `window.location.assign("/dashboard")` replaces the document.
- **`useFormStatus`:** A `preventDefault` submit does not go pending. Drive the live button through `SubmitButton`’s `pending` prop. Pass `true` only while the request flag or the kitchen-sink loading state is on; otherwise pass `undefined` so a literal `false` does not mask the hook for signup.
- **Accept:** JSON mode is only when `Accept` contains the token `application/json`. Do not treat `*/*` as JSON.

## Phase 1: Destinations

### Overview

Move the document-post success target and a signed-in visit to `/` onto Panel MG. Welcome remains the signed-out page.

### Changes Required:

#### 1. Password success redirect

**File**: `src/pages/api/auth/signin.ts`

**Intent**: A good password’s document response sends the GM to Panel MG. Failure redirects stay as they are so phase 1 does not change error handling.

**Contract**: On success, redirect to `/dashboard` instead of `/`. Missing Supabase config and `signInWithPassword` errors still redirect to `/auth/signin?error=` with the same messages. No JSON branch in this phase.

#### 2. Signed-in home

**File**: `src/pages/index.astro`

**Intent**: A session opening `/` leaves Welcome before it renders, matching the signed-in sign-in page.

**Contract**: When `Astro.locals.user` is set, `return Astro.redirect("/dashboard")`. Anonymous GET still renders Welcome at HTTP 200. Do not add `/` to `PROTECTED_ROUTES` in `src/middleware.ts`. Do not edit `Welcome.astro` or `Topbar.astro`.

#### 3. Smoke destinations

**File**: `scripts/smoke.mjs`

**Intent**: The redirect contract matches the new destinations without covering JSON yet.

**Contract**: The correct-password step expects location `/dashboard`. Immediately after it, a signed-in GET `/` expects status 302 and location `/dashboard`. The opening anonymous “home renders” step stays 200. The wrong-password location stays `/auth/signin?error=`. Sign-out stays `/`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npx astro check` passes

#### Manual Verification:

- Signed-out `/` renders Welcome; a signed-in visit to `/` redirects to `/dashboard`; sign-out still returns to Welcome
- `npm run smoke` against a running server: correct-password POST location is `/dashboard`, the following signed-in GET `/` is 302 to `/dashboard`, wrong-password and sign-out locations stay `/auth/signin?error=` and `/`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: In-place sign-in

### Overview

The hydrated form paints **Logowanie...** during the request and keeps a failure on the page. Document posts from phase 1 keep working.

### Changes Required:

#### 1. JSON responses

**File**: `src/pages/api/auth/signin.ts`

**Intent**: The hydrated form can read success and failure without a navigation. A normal form post still redirects.

**Contract**: If `Accept` lists `application/json`, respond with `Content-Type: application/json` and do not redirect. Missing Supabase config: 503 and `{ "error": "Supabase nie jest skonfigurowany" }`. `signInWithPassword` error: 401 and `{ "error": "<error.message>" }` — not 503. Success: set the session cookies, then 200 and `{ "redirect": "/dashboard" }`. Any other request keeps the phase 1 redirects.

#### 2. Hydrated submit

**File**: `src/components/auth/SignInForm.tsx`

**Intent**: Show **Logowanie...** only while the request runs, and put the button back on **Zaloguj się** whenever the form shows an error.

**Contract**: `demoState` still `preventDefault`s and returns before any request; loading still forces the pending label. Failed `validate()` `preventDefault`s, does not set pending, and does not fetch. Otherwise `preventDefault`, set pending, and `fetch` POST `/api/auth/signin` with the email and password, `Accept: application/json`, and same-origin credentials. HTTP 200 whose JSON `redirect` is exactly `/dashboard`: leave pending set and `window.location.assign("/dashboard")`. Any other outcome, including a thrown fetch: clear pending and set `ServerError` in one update. Use `body.error` when it is a non-empty string; otherwise **Nie udało się zalogować**. Do not clear email or password, and do not navigate. Pass that pending flag through `SubmitButton`’s existing `pending` prop. Do not change `SignUpForm`.

#### 3. Smoke for the JSON path

**File**: `scripts/smoke.mjs`

**Intent**: The path the button uses is asserted, not only the document redirect.

**Contract**: `request()` gains an optional headers argument and still sends `Cookie` and `Origin`. A wrong-password POST with `Accept: application/json` expects status 401 and a non-empty string `body.error`. A correct-password POST with that header expects status 200 and `body.redirect === "/dashboard"`. Phase 1’s document-post expectations stay.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npx astro check` passes

#### Manual Verification:

- Empty or invalid fields leave the button on Zaloguj się and do not request sign-in
- A wrong password shows Logowanie..., then an enabled Zaloguj się, the Supabase message in ServerError, and the typed email and password
- When the response has no message, ServerError shows Nie udało się zalogować and the button is not loading
- A correct password keeps Logowanie... until Panel MG loads
- Kitchen-sink loading shows Logowanie... and does not POST
- `npm run smoke` covers JSON wrong-password 401 with a non-empty `error` and JSON success 200 with `redirect` equal to `/dashboard`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None. This repo has no unit runner.

### Integration Tests:

- `npm run smoke` against a running server after each phase. Phase 1 checks redirect locations. Phase 2 adds the JSON status and body checks. Smoke does not follow redirects (`redirect: "manual"`).

### Manual Testing Steps:

1. Signed out, open `/` — Welcome, including **Zaloguj się**.
2. Sign in with a good password — **Logowanie...** stays up, then Panel MG loads. Open `/` again — Panel MG, not Welcome.
3. Sign out — Welcome.
4. Submit empty fields and a bad email — field errors, button stays **Zaloguj się**, no navigation.
5. Submit a wrong password — spinner, then **Zaloguj się** again, Supabase text in the error banner, email and password still filled. Submit again.
6. Stop the network (or block the sign-in request) and submit — **Nie udało się zalogować**, button idle.
7. While signed in, open `/auth/signin` — still Panel MG. Open `/auth/signup` — signup form still posts.
8. Kitchen sink loading state shows **Logowanie...** and does not create a session.

## Performance Considerations

Sign-in already hydrates one React island. This phase adds one `fetch` on submit. Do not hydrate Welcome or the home page.

## Migration Notes

No database migration. Rollback is reverting the change commits. Reverting phase 1 restores POST success to `/` and leaves signed-in `/` on Welcome; smoke expectations must match. Reverting phase 2 restores the document POST on the hydrated form. Session cookies are unchanged.

## References

- Frame (sibling change): `context/changes/ui-auth-signin/frame.md`
- Overridden locks: `context/changes/ui-auth-signin/plan.md` (“What We're NOT Doing”, “Redirect scope”, “Pending and the sink”, criterion 1.6)
- Decision record: `context/changes/ui-auth-signin/plan-brief.md` (POST success stayed `/`)
- Code: `src/pages/api/auth/signin.ts`, `src/pages/index.astro`, `src/pages/auth/signin/index.astro`, `src/components/auth/SignInForm.tsx`, `src/components/auth/SubmitButton.tsx`, `src/middleware.ts`, `scripts/smoke.mjs`
- Lessons: `context/foundation/lessons.md` (non-2xx for a failed data load — JSON config failure only)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Destinations

#### Automated

- [x] 1.1 `npm run lint` passes — 45ba633
- [x] 1.2 `npx astro check` passes — 45ba633

#### Manual

- [x] 1.3 Signed-out `/` renders Welcome; a signed-in visit to `/` redirects to `/dashboard`; sign-out still returns to Welcome — 45ba633
- [ ] 1.4 `npm run smoke` against a running server: correct-password POST location is `/dashboard`, the following signed-in GET `/` is 302 to `/dashboard`, wrong-password and sign-out locations stay `/auth/signin?error=` and `/`

### Phase 2: In-place sign-in

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npx astro check` passes

#### Manual

- [x] 2.3 Empty or invalid fields leave the button on Zaloguj się and do not request sign-in
- [x] 2.4 A wrong password shows Logowanie..., then an enabled Zaloguj się, the Supabase message in ServerError, and the typed email and password
- [x] 2.5 When the response has no message, ServerError shows Nie udało się zalogować and the button is not loading
- [x] 2.6 A correct password keeps Logowanie... until Panel MG loads
- [x] 2.7 Kitchen-sink loading shows Logowanie... and does not POST
- [x] 2.8 `npm run smoke` covers JSON wrong-password 401 with a non-empty `error` and JSON success 200 with `redirect` equal to `/dashboard`
