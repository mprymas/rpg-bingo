# Configure Sentry — Plan Brief

> Full plan: `context/changes/configure-sentry/plan.md`

## What & Why

Wire Cloudflare-compatible Sentry so unexpected server soft failures and client island errors become Issues with release/env context. Soft UX stays; Sentry replaces structured Workers Logs payloads from `reportError` (Sentry-primary).

## Starting Point

`reportError` already logs unexpected API/SSR/middleware failures via `console.error`. No `@sentry/*`, no release tags, Wrangler `main` is the stock Astro Cloudflare entry. Audit listed Sentry as optional follow-up to the helper.

## Desired End State

Server events from `reportError` (and Worker isolation via `withSentry`) plus client errors land in Sentry when `SENTRY_DSN` is set locally, in preview, and in production. Deploy CI tags releases and uploads source maps. A gated probe proves ingest; production probe is unreachable.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Capture scope | Client + server | Soft catches + island failures both matter | Plan |
| Astro integration | `enabled: { client: true, server: false }` | Client via `@sentry/astro`; server not doubled via Astro Node SDK | Plan |
| Server init | `@sentry/cloudflare` `withSentry` as Wrangler `main` | Official Workers path; Astro middleware alone is not Workers init | Plan |
| reportError transport | Sentry-primary | Single sink; Workers Logs lose structured `server.error` | Plan |
| Tracing | `tracesSampleRate: 0.1` | Light perf without burning quota on polls | Plan |
| Releases / maps | Deploy CI upload + git SHA release | Readable stacks mapped to deploys | Plan |
| Environments | Local + preview + prod when DSN set | Verify early; same project when configured | Plan |
| Privacy / filter | Same unexpected-only + ids/codes | Matches existing helper contract | Plan |
| Verification | Dev-only probe route | Cheap ingest proof; must 404 in prod | Plan |

## Scope

**In scope:** `@sentry/astro` + `@sentry/cloudflare`; Worker entry wrap; env/secrets docs; `reportError` → Sentry; client init (no Replay); CI release/source maps; gated probe.

**Out of scope:** Replay/Feedback; dual-write console; fail-closed auth; per-island ErrorBoundary; poll throttle; dropping session `code`; email confirm callback; soft UX/copy changes.

## Architecture / Approach

`sentry.server.config.ts` wraps the Astro CF handler with `withSentry` and becomes Wrangler `main`. Soft catches keep calling `reportError`, which `captureException`s with safe tags. Client uses `sentry.client.config.ts` under Astro `sentry({ enabled: { client: true, server: false } })`. Deploy build supplies auth token + release for maps.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Server wrap + env | Packages, `withSentry` entry, DSN wiring | Boot failure if wrap/env wrong |
| 2. reportError → Sentry | Primary capture + unit tests | Silent no-op if SDK not initialized |
| 3. Client SDK | Browser errors + 0.1 traces | Public DSN / PII in client events |
| 4. Release, maps, probe | CI upload, gated probe | Missing CI/Wrangler secrets block prod proof |

**Prerequisites:** Sentry project exists; implementer supplies org/project slugs + `SENTRY_AUTH_TOKEN`; DSN as Workers/local secret (never committed).
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- Org/project/auth token for source maps are supplied at implement time (not in plan files).
- Without Worker `withSentry`, server capture can silently no-op on CF v14.
- Polling flaps can still spam Issues under the unexpected-only filter (accepted).

## Success Criteria (Summary)

- Unexpected soft failures create Sentry Issues with route/context when DSN is set
- Client errors appear when client SDK + DSN configured
- Soft UX unchanged; probe works in DEV and 404s in production
