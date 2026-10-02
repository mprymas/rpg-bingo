# MG dashboard Vintage Paper — Plan Brief

> Full plan: `context/changes/ui-mg-dashboard/plan.md`  
> Research: `context/changes/ui-mg-dashboard/research.md`

## What & Why

`/dashboard` still paints the legacy cosmic/glass look while `/sessions/new` already reads Vintage Paper tokens. This change restyles Panel MG onto the existing contract, shared `Button` islands, a branded 503 list-load error, a kitchen-sink gate, and an extended literal-scan guard — without redepositing tokens.

## Starting Point

Tokens and `html.dark` are live. `dashboard.astro` ignores them (20 literal hits). CTA and Wyloguj are raw purple/glass controls. `listSessionsForGm` throws with no Layout error path. `SCOPED_FILES` does not include the dashboard.

## Desired End State

MG sees a tokenized Panel MG matching create-session chrome. Focus rings follow `--ring` via shared `Button`. List-load failures stay in Layout at HTTP 503. Dev `/dashboard/kitchen-sink` exposes named states; lint fails if palette/`bg-cosmic` return on scoped dashboard files.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Complexity | LOW | One view, settled tokens, mirror create-session patterns | Plan interview |
| Button (C2) | React island + `Button` / `asChild` | Reuse shared focus/variants instead of class-string only | User 2B |
| List error (C3) | Layout + Polish + 503 | Matches sibling + lessons non-2xx rule | User 3A / lessons |
| Kitchen sink | `/dashboard/kitchen-sink`, PROD 404 | Same gate pattern as create-session | Plan default |
| Status UI | Plain text — no Badge | Out of token scope; defer feature chrome | Plan default |
| Tokens / dark / fonts | Skip redeposit | Already landed in `ui-new-session-board` | Research |

## Scope

**In scope:**

- Relocate `dashboard.astro` → `dashboard/index.astro`
- Restyle shell/list/empty onto role classes
- React actions island (`Button` CTA + sign-out)
- C3 branded 503 list-load error
- Dev kitchen-sink + screenshots
- Extend `SCOPED_FILES` + CLAUDE/AGENTS kitchen-sink pointer

**Out of scope:**

- Other cosmic pages; removing `bg-cosmic` utility
- Badge / incomplete-board; Playwright CI
- Loading skeleton; config-missing raw-500 alignment
- Token/font/dark redeposit

## Architecture / Approach

Relocate page → restyle + Button island + catch list errors (503) → sibling kitchen-sink gated by `import.meta.env.PROD` → extend lint scope and agent rules. No schema/API product changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. One view + C3 | Tokenized `/dashboard`, Button island, 503 error | Island/form wiring breaks sign-out |
| 2. Kitchen-sink + gate | Named-state gallery + screenshots | Sink reachable in PROD |
| 3. Guard | `SCOPED_FILES` + rule pointers | Rules updated but files omitted from scope |

**Prerequisites:** Research complete; local `npm run dev` with auth for `/dashboard`.  
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Relocate must happen before the sink (Astro routing conflict).
- Exact Polish list-error string left to implementer within “could not load sessions” meaning.
- Roadmap has no `ui-mg-dashboard` Change ID — left untouched.

## Success Criteria (Summary)

- `/dashboard` uses role tokens + shared `Button`; no cosmic palette on the view.
- List-load error: Layout + 503.
- Kitchen-sink covers matrix cells (or N/A) in DEV; blocked in PROD; screenshots exist.
- Literal scan scopes dashboard files; agent rules mention `/dashboard/kitchen-sink`.
