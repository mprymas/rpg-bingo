# Configure Sentry — Implementation Plan

## Overview

Adopt Sentry for Astro 7 SSR on Cloudflare Workers so unexpected server failures (via existing `reportError` sites) and client island errors become Sentry issues with release/env context. Soft UX unchanged. Sentry-primary means Workers Logs lose structured `server.error` objects; platform invocation logs remain.

## Current State Analysis

- [`src/lib/report-error.ts`](src/lib/report-error.ts) emits structured `console.error` and is wired into middleware/API/SSR soft catches.
- No `@sentry/*` deps; [`wrangler.jsonc`](wrangler.jsonc) `main` is stock `@astrojs/cloudflare/entrypoints/server`.
- Audit listed Sentry as optional later; `report-error-helper` explicitly left vendor out of scope.
- Stack: Astro 7 + `@astrojs/cloudflare` v14. Official Workers path is `withSentry` as Wrangler `main`. Pages `sentryPagesPlugin` does not apply. `@sentry/astro` server auto-wrap is unreliable on v14.
- DSN provided out-of-band — plans/code reference `SENTRY_DSN` only; never embed the literal.

### Key Discoveries

- `session: false` in astro config — leave untouched.
- `nodejs_compat` already OK for Sentry ALS.
- Deploy uses `github.sha` in wrangler message — natural release id.

## Desired End State

- Server: Worker entry wrapped with `@sentry/cloudflare` `withSentry`; DSN from env when set.
- `reportError` → `Sentry.captureException` with safe context; no structured `console.error`; safe when DSN unset.
- Client: `sentry({ enabled: { client: true, server: false } })` + `sentry.client.config.ts` (errors + tracesSampleRate 0.1, no Replay).
- Local + preview + prod send when DSN configured; release + source maps on deploy CI.
- Dev-only probe proves ingest; soft UX unchanged.

## What We're NOT Doing

- Replay / User Feedback
- Dual-write structured `server.error` to Workers Logs
- Fail-closed auth UX (audit A1/A2)
- Per-island ErrorBoundary wiring
- Poll-route special throttle beyond existing unexpected-only filter
- Dropping session `code` from context
- Email confirm callback
- Soft response / copy changes
- Drive-by `compatibility_date` bump

## Implementation Approach

Disable `@sentry/astro` server; enable client only. Own server init via `@sentry/cloudflare` `withSentry` as Wrangler `main` (not Astro middleware as sole init). Point `reportError` at Sentry. Wire env for local/preview/prod. Upload source maps + set release on deploy. Add gated probe.

## Critical Implementation Details

**Worker entry vs Astro middleware:** On Workers, `withSentry` must wrap the fetch handler as `wrangler.jsonc` `main`. [`src/middleware.ts`](src/middleware.ts) stays auth/`reportError` only — not sole SDK init. Pages middleware plugin is out of scope.

**Astro split:** `enabled: { client: true, server: false }` avoids double server SDK while allowing client injection and source-map options on the integration.

**Sentry-primary:** Unit tests mock `@sentry/cloudflare`, not `console.error`.

---

## Phase 1: Server Worker wrap + env

### Overview

Install packages, add `withSentry` Worker entry as Wrangler `main`, wire/document `SENTRY_DSN`.

### Changes Required

#### 1. Dependencies

**File**: `package.json`

**Intent**: Add `@sentry/astro` and `@sentry/cloudflare` (v10.40.0+ compatible with Astro 7 / CF Workers).

**Contract**: Both as dependencies; lockfile updated.

#### 2. Worker entry wrap

**File**: `sentry.server.config.ts` (new, project root)

**Intent**: Initialize server Sentry around the Astro Cloudflare handler for request isolation.

**Contract**: Default export `Sentry.withSentry((env) => ({ dsn: env.SENTRY_DSN, tracesSampleRate: 0.1, environment from env when set }), handler)` with `handler` from `@astrojs/cloudflare/entrypoints/server`. No hardcoded DSN. Undefined DSN must not crash the Worker.

#### 3. Wrangler main

**File**: `wrangler.jsonc`

**Intent**: Point Worker at Sentry-wrapped entry.

**Contract**: `main` → `./sentry.server.config.ts`. Keep observability, assets, compatibility flags. Optional `version_metadata` binding; primary release from CI `SENTRY_RELEASE`.

#### 4. Env docs / schema

**Files**: `.env.example`, optionally `astro.config.mjs` `env.schema`

**Intent**: Operators set DSN in `.env` / `.dev.vars` / Workers Secrets without committing secrets.

**Contract**: Document `SENTRY_DSN`, optional `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`. No real DSN in git.

### Success Criteria

#### Automated Verification

- `npm run build` succeeds with Wrangler main on Sentry entry
- `npm run lint` and `npx astro check` pass
- No hardcoded ingest DSN URL in tracked files

#### Manual Verification

- With DSN in `.dev.vars`, dev/preview boots without Worker errors
- Without DSN, app still boots (Sentry inactive)

---

## Phase 2: reportError to Sentry-primary

### Overview

Switch `reportError` transport to Sentry; update unit tests.

### Changes Required

#### 1. reportError transport

**File**: `src/lib/report-error.ts`

**Intent**: Unexpected soft-catch reporting lands in Sentry; keep extraction/privacy.

**Contract**: Still never throws. `captureException` with tags/extras limited to existing safe fields (`route`, `httpStatus`, `sessionId`, `sessionCode`, `position`, `code`, `supabaseCode`, …). No emails/nicks/passwords. No structured `console.error` `server.error` payload (Sentry-primary).

#### 2. Unit tests

**File**: `src/lib/report-error.test.ts`

**Intent**: Assert Sentry capture + context instead of console spy.

**Contract**: Mock `@sentry/cloudflare`; cover extraction, codes, optional context, non-Error, never-throws.

### Success Criteria

#### Automated Verification

- `npm run test:unit` passes for report-error tests
- Call-site filters unchanged (mapped 4xx stay quiet)

#### Manual Verification

- Unexpected soft path with DSN set → Sentry event with `route` (and codes when present)
- Workers Logs no longer show structured `event: "server.error"` from that path

---

## Phase 3: Client SDK

### Overview

Enable browser Sentry via `@sentry/astro` client-only.

### Changes Required

#### 1. Astro Sentry integration

**File**: `astro.config.mjs`

**Intent**: Inject client SDK only; server owned by Worker wrap.

**Contract**: `sentry({ enabled: { client: true, server: false } })` — org/project/authToken added in Phase 4 for maps.

#### 2. Client init

**File**: `sentry.client.config.ts` (new)

**Intent**: Browser errors + light tracing; no Replay.

**Contract**: Init from `@sentry/astro`; `tracesSampleRate: 0.1`; no replay integration; active when DSN configured (local/preview/prod).

### Success Criteria

#### Automated Verification

- `npm run build` includes client init without Astro server SDK
- Lint / `astro check` pass

#### Manual Verification

- Client/island error with DSN configured appears as client event in Sentry

---

## Phase 4: Release, source maps, probe

### Overview

Tag releases and upload source maps on deploy; add gated probe; document secrets.

### Changes Required

#### 1. Source maps + release

**File**: `astro.config.mjs` (sentry options)

**Intent**: Readable stacks mapped to git SHA releases.

**Contract**: `org`, `project`, `authToken` from env (`SENTRY_AUTH_TOKEN`); upload when token present; release = `SENTRY_RELEASE` / `github.sha`. Slugs supplied at implement time — not secrets in plan files.

#### 2. Deploy CI

**File**: `.github/workflows/ci.yml` (deploy job)

**Intent**: Build with Sentry auth + release so maps upload with deploy.

**Contract**: Deploy build env includes `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_RELEASE: ${{ github.sha }}`. Production `SENTRY_DSN` via Wrangler secrets (human approval for `secret put`).

#### 3. Dev-only probe

**File**: e.g. `src/pages/api/debug/sentry-probe.ts`

**Intent**: Prove server ingest without waiting for real outages.

**Contract**: Only when `import.meta.env.DEV` (or non-PROD gate that 404s in production). Captures/throws a test error; returns simple ack. Unreachable in production builds.

### Success Criteria

#### Automated Verification

- CI deploy YAML references Sentry release/auth env vars
- Probe route exists and is gated (PROD/non-DEV → 404)
- `npm run build` / lint / unit tests pass

#### Manual Verification

- Local probe with DSN → Issue in Sentry
- After deploy with secrets: release visible; stacks unminified or at least release tagged
- Production probe unreachable (404)

---

## Testing Strategy

### Unit Tests

- `reportError` capture tags/context; never-throws; extraction edge cases (mock Sentry)

### Integration / E2E

- No mandatory new Playwright coverage (soft UX unchanged)

### Manual Testing Steps

1. Set DSN locally; hit probe → Issue
2. Force unexpected API soft path → Issue with `route`; soft UX unchanged
3. Mapped 4xx (wrong password) creates no Issue
4. Client error → client Issue
5. Deploy: verify release (and maps when CI token present)

## Performance Considerations

`tracesSampleRate: 0.1` bounds quota; unexpected-only filter limits volume. Poll-flapping spam risk accepted.

## Migration Notes

- Existing `reportError` call sites unchanged if signature stays the same
- Operators add `SENTRY_DSN` + CI auth/org/project; stop expecting structured `server.error` in Workers Logs

## References

- Audit: `context/audits/observability/2026-10-07_auth-create-session-join-claim.md`
- Helper plan: `context/changes/report-error-helper/plan.md`
- Docs: https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/astro/
- CF v14 caveat: https://github.com/getsentry/sentry-javascript/issues/21901

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Server Worker wrap + env

#### Automated

- [x] 1.1 npm run build succeeds with Wrangler main pointing at the Sentry entry
- [x] 1.2 npm run lint and npx astro check pass
- [x] 1.3 No hardcoded ingest DSN URL in tracked files

#### Manual

- [ ] 1.4 With DSN in .dev.vars, astro dev/preview starts without Worker boot errors
- [ ] 1.5 Without DSN, app still boots (Sentry inactive)

### Phase 2: reportError to Sentry-primary

#### Automated

- [ ] 2.1 npm run test:unit passes for report-error tests
- [ ] 2.2 Call-site filters unchanged (mapped 4xx stay quiet)

#### Manual

- [ ] 2.3 Unexpected soft path with DSN set creates Sentry event with route
- [ ] 2.4 Workers Logs no longer show structured server.error from that path

### Phase 3: Client SDK

#### Automated

- [ ] 3.1 npm run build includes client Sentry init without Astro server SDK
- [ ] 3.2 Lint / astro check pass

#### Manual

- [ ] 3.3 Client/island error appears as client event when DSN configured

### Phase 4: Release, source maps, probe

#### Automated

- [ ] 4.1 CI deploy workflow references Sentry release/auth env vars
- [ ] 4.2 Probe route exists and is gated (PROD/non-DEV returns 404)
- [ ] 4.3 npm run build / lint / unit tests still pass

#### Manual

- [ ] 4.4 Hit probe in local/dev with DSN creates Sentry Issue
- [ ] 4.5 After deploy with secrets: release visible; stacks unminified or release tagged
- [ ] 4.6 Production probe unreachable (404)
