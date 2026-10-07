---
type: observability-audit
date: 2026-10-07 17:05
mode: audit
commit: f26da85
branch: master
dirty_tree: false
areas: [auth, create-session, join-claim]
area_source: foundation
runtime_proof: not-run
error_tracker: none (Workers observability flag only)
previous_report: null
findings: { critical: 5, high: 14, medium: 8, low: 3 }
---

# Observability audit — auth, create-session, join-claim (2026-10-07)

## 1. TL;DR

- **Catch → soft response is the default:** APIs and SSR pages convert failures into `302` / JSON `{error}` / Polish `503` HTML with **no** `console.*` and no rethrow, so they never become Worker exceptions or Astro-logged stacks.
- **There is no app-level error tracker** and **zero** `console.error` in `src/` — the only accidental stack path is an *uncaught* throw that Astro converts into an empty HTTP 500 + stringified stack.
- **Auth outages look like “logged out”:** middleware discards `getUser()` errors and null client → `user = null` → redirect to sign-in.
- **Join infra failures look like a form resubmit:** unmapped join errors redirect to `?join=1` with no `error=` and no log.
- **Create-session PostgREST failures become a generic 500 body** with cause discarded; a failed `board_cells` insert can leave an orphan session.
- **Consequence:** a Supabase/Auth outage during a live table session can leave MG and players with soft UX failures while Cloudflare still sees mostly successful invocations — responders get status codes at best, never stacks or RPC codes.

## 2. Capture model

| Piece | Evidence | Tag |
|---|---|---|
| Runtime | Astro 7 SSR (`output: "server"`) on Cloudflare Workers via `@astrojs/cloudflare` (`astro.config.mjs:11–16`) | in repo |
| Error tracker | **None.** No `@sentry/*` (or other) in `package.json`; no init in `astro.config.mjs`; zero tracker imports under `src/`. Orphan `node_modules/@sentry` may exist from a stale install — not wired. | in repo |
| Platform logs | `wrangler.jsonc:12–14` `observability.enabled: true` | in repo |
| Capture boundary | Uncaught throws reach Astro’s SSR catch (`node_modules/astro/dist/core/routing/handler.js` ~101–108): `console.error(stack string)` + HTTP 500 Response (often empty body; no `src/pages/500.astro`). That is **not** the same as a Worker `outcome=exception`. | in repo (dependency) |
| Middleware | `src/middleware.ts` — auth only; no reporting wrapper | in repo |
| Logging | No structured logger; **0** `console.error` / `console.warn` in `src/` | in repo |
| Scrubbing / sampling | None in code | in repo |
| Release / env tags | Not set in app or `wrangler.jsonc` | in repo |
| Client | No ErrorBoundary, no `window.onerror` / `unhandledrejection`, no tracker on `Layout.astro` | in repo |
| Background | No `waitUntil` / cron / queues in app code | in repo |

**Assumptions (outside the repo, not findings):**

- Cloudflare Workers log collection for this Worker is enabled in the dashboard (**unconfirmed** by user; repo flag suggests intent).
- Whether HTTP 5xx alone pages anyone is a dashboard/alert setting (**unconfirmed**).
- Production monitoring = Workers logs only (user confirmed area picks; did not describe a separate tracker project).

## 3. What reaches the tracker

Static-only (runtime probes **not run**). There is no app tracker; “tracker” below means Cloudflare Workers logs / invocation outcomes.

| Failure shape | Response | Platform logs | App tracker | Verdict |
|---|---|---|---|---|
| Uncaught throw in handler | Empty HTTP 500 (Astro) | Stack string via Astro `console.error` | n/a | poor (rare — most paths catch first) |
| Catch → JSON 500 | 500 `{ error: "…" }` | Status only; **no** error object | n/a | missed cause |
| Catch → redirect (join/auth) | 302 | Successful redirect | n/a | **missed** |
| Middleware Auth outage | 302 to sign-in | Looks like anonymous | n/a | **missed** |
| Client poll/claim `catch {}` | UI toast / silent retry | Nothing (browser-only) | n/a | **missed** |
| Missing `SUPABASE_*` | Soft disable / 401 / 503 JSON | Mixed; often not an exception | n/a | poor |

## 4. Systemic root causes

1. **Catch-and-return without logging** — e.g. `src/pages/api/sessions/index.ts:61–82`, `src/pages/api/play/join.ts:43–50` / `67–76`, `src/pages/api/play/claim.ts:66–78`, SSR `catch {` on dashboard/session/play pages. Prevents Astro/CF from seeing the `Error`; responders get a Polish string at best.
2. **No application reporter and no structured logs** — empty greps for `console.error` / Sentry in `src/`; only accidental Astro logging on the *uncaught* path. Explains why even “high” HTTP 5xx are undiagnosable.
3. **Soft identity in middleware** — `src/middleware.ts:9–16` ignores `getUser` errors and null client → `user = null`. Auth/config outages masquerade as “not signed in” (`18–20` redirect).
4. **Redirect / 401 as the error channel** — join (`join.ts:76`) and auth signup/signin map infra and user errors onto the same soft shapes (`302 ?error=` or 401 JSON). Platform sees success or credential-reject, not outage.
5. **Domain mapping strips diagnosis** — `JoinSessionPlayerError` / `ClaimBoardCellError` / generic API catches drop PostgREST `code`/`details` and never use `Error.cause` (0 `cause:` in `src/`).
6. **Client islands absorb failures** — `PlayerBoard.tsx:135–137`, `205–206`; `useCreateSession` / `SignInForm` / `GmBoard` empty catches. Live board can freeze with no Worker signal.

## 5. Findings by area

Spot-checked by hand (kept): middleware soft-fail; join redirect on infra; create-session catch; non-atomic session+cells insert; zero `console.*` in `src/`; PlayerBoard poll/claim empty catches. Downgraded/dropped: treating “no Sentry package” as dozens of separate findings (one systemic fact); dashboard alert absence (assumption).

### Auth

| # | Location | Category | Severity | What happens in production | Fix direction |
|---|---|---|---|---|---|
| A1 | `src/middleware.ts:9–16` | swallowed | critical | Auth/API failure → `user=null` → 302 sign-in. User: “logged out”. Responder: healthy redirects; outage = anonymous. | On `getUser` error: log + 503 (fail closed); don’t equate with anonymous. |
| A2 | `src/pages/api/auth/signin.ts:34–40` | flattened-response | critical | All `signInWithPassword` errors → 401 JSON or 302 `?error=`. User: auth message. Responder: Auth outage looks like wrong password. | Branch retryable/status → 503 + log; keep 401 for credentials only. |
| A3 | `src/pages/api/auth/signup.ts:10–19` | flattened-response | high | Config + all `signUp` errors → 302 only; `data`/identities ignored → confirm-email even when no mail. User: “check inbox”. Responder: success redirects. | 503 for infra; treat empty identities as failure; log codes. |
| A4 | `src/pages/api/auth/signout.ts:5–9` | swallowed | high | `signOut` error ignored; always 302 `/`. User: thinks signed out. Responder: success. | Check `{ error }`; log; clear cookies deliberately. |
| A5 | `src/components/auth/SignInForm.tsx:95–110` | coverage-gap | high | `fetch` catch → UI only. User: generic failure. Responder: nothing (client-only). | `console.error` + status; optional beacon. |
| A6 | No confirm/callback route under `src/` | coverage-gap | medium | Email confirm failures outside app handlers. User: silent/incomplete. Responder: no route to inspect. | Add callback/verify route; surface `?error=`. |

### GM create session

| # | Location | Category | Severity | What happens in production | Fix direction |
|---|---|---|---|---|---|
| C1 | `src/pages/api/sessions/index.ts:61–82` | flattened-response | critical | Any `createSession` failure → generic 500 JSON; bound `error` unused; no log. User: banner. Responder: status only, no stack/PostgREST code. | Log unexpected + rethrow or structured `console.error` with fields; map only known 4xx. |
| C2 | `src/lib/services/sessions.service.ts:106–136` | missing-throw | critical | Session insert then `board_cells` without rollback; `cellsError` throws after orphan row. User: create fails; dashboard may list broken session. Responder: later incomplete-board 422 ≠ original insert error. | Transaction or delete session on cells failure; log `session.id` + `cellsError`. |
| C3 | `index.ts:73–82` + `SessionServiceError("CODE_COLLISION")` | identity-lost | high | Exhausted code retries → same generic 500 as DB down. | Distinct status/body + log attempt count. |
| C4 | `src/components/hooks/useCreateSession.ts:33–34` | coverage-gap | high | Network/`json` failures → same UI as server 500; empty catch. Responder: client-only silence (or duplicate sessions if 201 then parse fail). | Separate offline vs HTTP; harden success parse. |
| C5 | `dashboard/index.astro:20–24`, `sessions/new/index.astro:11–18`, `sessions/[id].astro:36–39` | swallowed | high | Catalog/list/board SSR failures → Polish 503; empty catch / dropped Supabase `error`. | Bind + log before setting UI status. |
| C6 | `api/sessions/[id]/board.ts` + `GmBoard.tsx` poll | swallowed | high | Post-create live board freezes; poll soft-fails. | Server log; client degraded state after N failures. |

### Player join + claim

| # | Location | Category | Severity | What happens in production | Fix direction |
|---|---|---|---|---|---|
| J1 | `src/pages/api/play/join.ts:67–76` | flattened-response | critical | Unmapped join / `SESSION_NOT_FOUND` → 302 `?join=1` **without** `error=`. User: nick form again, no message. Responder: successful redirects; outage invisible. | Domain codes only → UX redirects; else log + 5xx. |
| J2 | `src/pages/api/play/join.ts:43–50` | swallowed | critical | `getActiveBoardByCode` throw → same 302 as missing board. | Null board ≠ thrown error. |
| J3 | `src/pages/api/play/claim.ts:66–78`, `board.ts:26–34` | flattened-response | high | RPC failures → 500 JSON, cause discarded, no log. User: toast / stale board. Responder: status flood from 5s polls, no stack. | Log/rethrow unexpected; keep typed domain JSON. |
| J4 | `PlayerBoard.tsx:126–137`, `179–206` | swallowed | high | Poll silent; claim catch → toast only. User: frozen/stale board. Responder: nothing client-side. | Degraded UI + `console.error`; backoff on 5xx. |
| J5 | `play/[code].astro:43–51` | flattened-response | high | SSR load catch → 503 HTML; no exception escape. | Log with session `code` before render. |
| J6 | `sessions.service.ts` join/claim mappers | identity-lost | medium | Mapped errors without `cause`; PostgREST details dropped before API. | `Error(..., { cause })`; preserve codes on log. |
| J7 | `player-cookie.ts:69–77` | swallowed | medium | Corrupt cookie → empty identity; looks like “join first”. | Sampled log + clear cookie. |

### Platform / plumbing

| # | Location | Category | Severity | What happens in production | Fix direction |
|---|---|---|---|---|---|
| P1 | Repo-wide: 21× `catch {` / 4× bound-unused; 0 `console.error` | swallowed | high | Almost all failures leave no error object in Workers logs. | Shared `reportError(err, ctx)` used in every catch before soft response. |
| P2 | Astro SSR catch → Response 500 (dependency) | coverage-gap | medium | Even uncaught throws are Responses, not Worker exceptions; empty body. | Don’t rely on exception filters; log explicitly; add `500.astro` for UX. |
| P3 | No release/env in init code | missing-context | low | Stacks (if any) hard to map to deploys. | Tag Worker version / git SHA on deploy. |
| P4 | `astro.config.mjs` secrets `optional: true` + `createClient` null | config | medium | Mis-deploy soft-disables auth paths instead of failing loud. | Require secrets in prod; hard-fail null client on critical routes. |

## 6. Recommended fix order

1. **Shared server `reportError(error, context)`** (structured `console.error` with `{ route, code, supabaseCode, cause }` at minimum) called from every API/SSR catch **before** returning soft responses — closes C1, J3, C5, P1 and makes Workers logs useful without a vendor yet. *(Privacy: log ids/codes, not emails/nicks/passwords.)*
2. **Stop soft-failing Auth identity** — middleware A1 + signin A2 branching — closes the “everyone looks logged out / wrong password” class.
3. **Join: only domain redirects; infra → 5xx + log** — J1/J2; biggest north-star blindness.
4. **Create-session: log + map CODE_COLLISION; transactional/rollback cells insert** — C1/C2/C3.
5. **Client: degraded poll state + console.error on claim/create failures** — J4/C4/A5 (until a real client SDK exists).
6. **Optional later:** Cloudflare-compatible Sentry (`@sentry/cloudflare` + Astro integration), release tagging, email confirm callback route.

## 7. Changes since last audit

First run — no previous report.

## 8. Method and limits

- **Agents:** auth ([Auth observability](8c103f00-0049-4012-9dd1-9b669239cd92)), create-session ([Create-session observability](617695b1-2145-4b5e-a821-85a94e275914)), join-claim ([Join-claim observability](49003ee7-3cb6-4982-abff-b2db2deb29bd)), plumbing ([Plumbing observability](f6ff93e8-7a3a-482e-9091-2f09032194b6)).
- **Hand spot-check:** middleware, join redirects, sessions API catch, non-atomic create, `console.*` grep (0), PlayerBoard poll/claim.
- **Repo-wide sweep:** ~21 empty `catch {` in `src/`; 0 app `console.error`; 0 `Error.cause`.
- **Runtime proof:** not run. Offer: isolated worktree + `scripts/fake-ingest.mjs` probe suite if/when a tracker is added; for current stack, probes would assert `console`/HTTP status only.
- **Not verifiable:** CF dashboard alert rules, log retention, whether 5xx pages anyone.
