# Player join via QR — Plan Brief

> Full plan: `context/changes/player-join-via-qr/plan.md`

## What & Why

At the table, joining still means typing the app URL and session code. This slice adds a QR on the active GM board that opens the existing join deep link so players skip that friction, without breaking typed-code join.

## Starting Point

`/play/{CODE}?join=1` already lands on the nick form. The GM board at `/sessions/[id]` shows a large mono session code and mounts React islands with `client:load`. No absolute join URL or QR library exists yet. Regenerating a board creates a new session and code.

## Desired End State

On an active GM board, a button toggles a hidden-by-default QR (QR + a11y label only). The QR encodes `{origin}/play/{CODE}?join=1`. Closed sessions show no QR control. Unit + e2e prove the URL; typed-code join e2e still passes. Kitchen-sink covers collapsed/expanded/closed.

## Key Decisions Made

| Decision   | Choice                                          | Why (1 sentence)                                      | Source |
| ---------- | ----------------------------------------------- | ----------------------------------------------------- | ------ |
| Target URL | `/play/{CODE}?join=1`                           | Reuses proven deep link and e2e contract              | Plan   |
| Surface    | GM board only; show on button                   | Table projector; less default chrome                  | Plan   |
| Closed     | Hide QR control                                 | Avoid dead joins; open successor session instead      | Plan   |
| Render     | Client island + `window.location.origin`        | Origin matches phone; generate on first show          | Plan   |
| Toggle     | Same button show/hide; keep in memory           | Simple projector UX                                   | Plan   |
| Panel      | QR + a11y label only                            | Minimal chrome; code stays in header                  | Plan   |
| Tests      | URL unit + e2e `data-join-url` + code-join e2e  | Catch wrong path without a physical camera            | Plan   |
| Lib        | `qrcode.react` (`QRCodeSVG`)                    | Zero-dep React SVG for the island                     | Plan   |

## Scope

**In scope:** `buildPlayerJoinUrl`; `SessionJoinQr` on active `/sessions/[id]`; `qrcode.react`; board kitchen-sink states; unit + QR e2e; typed-code join regression.

**Out of scope:** Dashboard QR; copy/plain URL; cookie-aware URL without `?join=1`; successor QR on closed boards; join API/schema/auth changes; themed QR colors; native app.

## Architecture / Approach

Pure helper builds the absolute join URL. A React island toggles the panel, builds the URL from `window.location.origin` on first show, and renders `QRCodeSVG` with `data-join-url` for Playwright. Astro mounts the island under the session code; non-active status renders nothing.

## Phases at a Glance

| Phase | What it delivers                         | Key risk                                      |
| ----- | ---------------------------------------- | --------------------------------------------- |
| 1. Join URL helper + unit tests | Canonical `buildPlayerJoinUrl` | Origin slash / code normalize drift           |
| 2. SessionJoinQr + board wiring | Toggle QR on active GM board   | Wrong origin locally; closed still showing QR |
| 3. Kitchen-sink + e2e           | Visual gate + payload assert   | Breaking typed-code join guardrail            |

**Prerequisites:** Existing join deep link and GM board page (M-1 done).
**Estimated effort:** ~1 short session across 3 phases.

## Open Risks & Assumptions

- Local `localhost` origin may not be reachable from a phone on LAN — use a reachable host for table smoke.
- Stale QR after regenerate until the new session page loads is accepted.

## Success Criteria (Summary)

- Active board: toggle reveals scannable QR for `/play/{CODE}?join=1`
- Closed board: no QR control
- Typed-code join path unchanged (e2e green)
- Unit + QR payload e2e + kitchen-sink states in place
