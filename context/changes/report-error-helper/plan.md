# Shared reportError helper — Implementation Plan

## Overview

Ship a server-only `reportError(error, context)` that logs one structured object via `console.error`, then wire it into unexpected API/SSR soft-catch paths and middleware/auth `{ error }` branches so Cloudflare Workers Logs get stacks and codes. Soft JSON/redirect/503 UX stays unchanged; no Sentry; no mapper `Error.cause` work.

## Current State Analysis

- Zero `console.*` / `reportError` under `src/` today. Platform collection is already on (`wrangler.jsonc` `observability.enabled: true`).
- Soft-catch is the product pattern: 11 API + 3 SSR catches return 4xx/5xx JSON, redirects, or Polish 503 HTML with no log (`context/changes/report-error-helper/research.md`).
- APIs already branch with `instanceof` on domain errors; unexpected = generic 500 / empty catch / join `?join=1` without `error=`.
- `src/middleware.ts` ignores `getUser()` `{ error }`; auth routes soft-map `{ error }` without logging; `src/pages/api/auth/signout.ts` ignores `signOut` result.
- Unit pattern: colocated Vitest under `src/**/*.test.ts` (`src/lib/services/board-generator.test.ts`); no existing `console` spies.

### Key Discoveries:

- Highest diagnostic value: bound unused 500s, empty 500/503 catches, join silent `?join=1` (`research.md` catch inventory).
- Domain codes that currently look unexpected: `CODE_COLLISION` → 500; join `SESSION_NOT_FOUND` → `?join=1` without `error=`.
- Workers Logs indexes structured `console.*` object fields; string-only messages are weaker.
- Session `code` may appear in server logs per prior practice; nicks/emails must not.

## Desired End State

- `src/lib/report-error.ts` exists and is covered by unit tests that spy `console.error`.
- Every unexpected API/SSR soft-catch path calls `reportError` before the existing soft return (empty catches bound where needed).
- Middleware logs Auth `getUser` failures; auth APIs log null-client and non-credential Auth errors; signout logs any `signOut` error — all without changing redirects/status UX.
- Mapped domain 4xx and bad-JSON 400 paths remain silent in Workers Logs.
- Workers Logs can filter on `event: "server.error"` and fields `route`, `code`, `supabaseCode`.

## What We're NOT Doing

- Vendor error tracker (Sentry / `@sentry/cloudflare`)
- Client-island logging / ErrorBoundary
- Fail-closed middleware or auth UX status branching (audit A2 remains a follow-up)
- Attaching `Error.cause` in join/claim mappers (audit J6)
- Logging emails, nicks, passwords, `claimToken`, raw body/FormData, cookies
- Changing domain-to-HTTP/redirect mapping or Polish copy
- Lib soft-parse sites (`player-cookie.ts`, `request-origin.ts`)
- Kitchen-sink pages

## Implementation Approach

Helper extracts `name` / `message` / `stack` plus duck-typed `code` / `supabaseCode` / cause chain; merges caller `route` and optional safe scalars; one `console.error({ event: "server.error", ... })`. Call sites invoke only on unexpected branches already present in handlers. Middleware/auth read `{ error }`, report when the filter says so, keep current soft behavior.

### Auth / middleware unexpected filter

- **Middleware**: read `{ data: { user }, error }` from `getUser()`; if `error`, `reportError` then still `user ?? null`. Do not log anonymous-without-error. Do not log null `createClient` on every request.
- **signin / signup**: log null-client paths; on Auth `{ error }`, log when `status` is missing or `>= 500`; skip credential-shaped `400`/`401`. Never log email/password.
- **signout**: bind `{ error }` from `signOut()`; log if present; keep redirect `/`.

## Phase 1: Helper + unit tests

### Overview

Add the shared reporter and prove the emit shape with Vitest.

### Changes Required:

#### 1. reportError module

**File**: `src/lib/report-error.ts` (new)

**Intent**: Provide one server helper that turns an unknown thrown value plus safe context into a single structured `console.error` object Workers Logs can index.

**Contract**: Export `reportError(error: unknown, context: ReportErrorContext): void`. Context requires `route: string`; optional safe scalars only: `httpStatus?`, `sessionId?`, `sessionCode?`, `position?` (no PII fields on the type). Emitted object always includes `event: "server.error"`, `route`, plus extracted `name`, `message`, `stack`, `code`, `supabaseCode`, `cause` when present. Extraction: `Error` fields when `instanceof Error`; duck-type string `code` on the error object for domain codes; duck-type Auth/PostgREST `code` into `supabaseCode` when distinct; serialize `error.cause` chain if present (may be absent today). Never throw from the helper.

#### 2. Unit tests

**File**: `src/lib/report-error.test.ts` (new)

**Intent**: Lock the structured payload and extraction behavior without hitting the network.

**Contract**: Colocated Vitest (`npm run test:unit`); `vi.spyOn(console, "error")`; cases for plain `Error` (stack), domain-like `{ code }` / `Error` subclass with `code`, optional context scalars present/absent, non-Error throwables. Restore spy after each test.

### Success Criteria:

#### Automated Verification:

- Unit tests pass for reportError payload/extraction: `npm run test:unit`
- Lint/typecheck clean for the new helper module: `npm run lint`

#### Manual Verification:

- None required for this phase

---

## Phase 2: Wire API + SSR unexpected catches

### Overview

Call `reportError` immediately before soft returns on unexpected paths; bind empty catches so the thrown value is available.

### Changes Required:

#### 1. Session create API

**File**: `src/pages/api/sessions/index.ts`

**Intent**: Log unexpected create failures (including `CODE_COLLISION` falling through to 500) while keeping mapped board/reward 400s quiet.

**Contract**: On the `createSession` catch, after domain 400 branches, call `reportError` on the 500 path with `route` like `POST /api/sessions` and optional `httpStatus: 500`. Do not call on JSON-parse 400 catch or mapped `BoardGenerationError` / `UNKNOWN_REWARD` branches.

#### 2. Claim / undo-claim APIs

**Files**: `src/pages/api/play/claim.ts`, `src/pages/api/sessions/[id]/undo-claim.ts`

**Intent**: Log only the generic 500 fallback after domain `instanceof` maps.

**Contract**: `reportError` on else/500 branches only; skip JSON-parse 400 catches; optional `sessionId` / `position` from already-parsed validated body when safely in scope (ids only).

#### 3. Join API

**File**: `src/pages/api/play/join.ts`

**Intent**: Surface infra/silent join failures that currently look like normal redirects.

**Contract**: Bind empty catch around `getActiveBoardByCode`; `reportError` then existing redirect. On `joinSessionPlayer` catch: skip `SESSION_FULL` / `INVALID_NICK` redirects; `reportError` before generic `?join=1` without `error=` (covers `SESSION_NOT_FOUND` + raw throws); optional `sessionCode` from URL/form code already used for redirects. Skip formData catch → `/play`.

#### 4. Board GET APIs

**Files**: `src/pages/api/play/board.ts`, `src/pages/api/sessions/[id]/board.ts`

**Intent**: Log empty-catch 500s that currently discard the error.

**Contract**: Bind `catch (error)`, `reportError`, then existing JSON 500. Happy-path 404s unchanged and unlogged.

#### 5. SSR page loads

**Files**: `src/pages/dashboard/index.astro`, `src/pages/sessions/[id].astro`, `src/pages/play/[code].astro`

**Intent**: Log SSR data-load failures before Polish 503 UI.

**Contract**: Bind empty catches; `reportError` with route pathname (and session id/code when already in scope as ids); keep `Astro.response.status = 503` and existing messages.

### Success Criteria:

#### Automated Verification:

- Unit tests still pass: `npm run test:unit`
- Lint passes: `npm run lint`
- Integration regression green (HTTP contracts unchanged): `npm run test:integration`

#### Manual Verification:

- Trigger one known soft 500/503 path in local `astro dev` and confirm a structured `server.error` object appears in the workerd/console / `wrangler tail` output with `route` and stack/message
- Confirm a mapped domain 4xx (e.g. join `error=full`) does not emit `server.error`

---

## Phase 3: Middleware + auth `{ error }` logging

### Overview

Close Auth soft-identity blindness for logging only; UX stays soft.

### Changes Required:

#### 1. Middleware

**File**: `src/middleware.ts`

**Intent**: Distinguish Auth API failure from anonymous when `getUser` returns an error, for logs only.

**Contract**: Read `{ data: { user }, error }`; if `error`, `reportError(error, { route: context.url.pathname })`; assign `context.locals.user = user ?? null` as today; protected-route redirect unchanged.

#### 2. Auth API routes

**Files**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`, `src/pages/api/auth/signout.ts`

**Intent**: Log config/Auth infra failures and signout failures without changing response shapes or logging credentials.

**Contract**: Apply the auth/middleware filter above; `route` values like `POST /api/auth/signin`; signout must check `{ error }` from `signOut()` before redirect.

### Success Criteria:

#### Automated Verification:

- Lint + unit tests pass: `npm run lint` and `npm run test:unit`

#### Manual Verification:

- Soft auth UX unchanged; wrong-password 401 stays unlogged; getUser / signOut / infra-shaped errors are log-eligible per filter

---

## Testing Strategy

### Unit Tests:

- Helper payload, extraction of `code` / stack, optional context scalars, non-Error throwables (`src/lib/report-error.test.ts`)

### Integration Tests:

- No new cases required — HTTP contracts and soft UX unchanged; re-run existing suite as regression

### Manual Testing Steps:

1. Force one unexpected soft 500/503 and confirm `event: "server.error"` in logs
2. Exercise a mapped domain 4xx and confirm no `server.error`
3. Spot-check wrong-password sign-in stays unlogged; review middleware/auth call sites against the filter

## Open Risks & Assumptions

- Auth credential vs infra distinction via `status` 400/401 may miss some infra cases that also return 401 — accepted until audit A2 UX branching ships
- Workers Free log quotas: unexpected-only filter mitigates; mapped 4xx stay out
- Session `code` in logs matches prior practice; still never log nicks/emails

## References

- Related research: `context/changes/report-error-helper/research.md`
- Observability audit: `context/audits/observability/2026-10-07_auth-create-session-join-claim.md`
- Lessons: non-2xx SSR status already applied on target pages (`context/foundation/lessons.md`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Helper + unit tests

#### Automated

- [x] 1.1 Unit tests pass for reportError payload/extraction
- [x] 1.2 Lint/typecheck clean for the new helper module

### Phase 2: Wire API + SSR unexpected catches

#### Automated

- [ ] 2.1 Unit tests still pass
- [ ] 2.2 Lint passes
- [ ] 2.3 Integration regression green (unchanged HTTP contracts)

#### Manual

- [ ] 2.4 Unexpected soft 500/503 shows structured server.error in logs
- [ ] 2.5 Mapped domain 4xx does not emit server.error

### Phase 3: Middleware + auth `{ error }` logging

#### Automated

- [ ] 3.1 Lint + unit tests pass

#### Manual

- [ ] 3.2 Soft auth UX unchanged; infra-shaped / getUser / signOut errors are log-eligible per filter
