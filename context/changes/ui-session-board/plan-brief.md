# Session board Vintage Paper — Plan Brief

> Full plan: `context/changes/ui-session-board/plan.md`  
> Research: `context/changes/ui-session-board/research.md`

## What & Why

After create-session and Panel MG were tokenized, `/sessions/[id]` still paints cosmic/glass. This change restyles the generated board onto the existing Vintage Paper contract, adds shared Badge chips, brands 404/503 failures, adds a kitchen-sink gate, and extends the literal-scan guard — without redepositing tokens.

## Starting Point

Tokens and `html.dark` are live. `[id].astro` + `BoardGrid.astro` ignore them (~25 literal hits). Status/legend/rewards are palette chips; errors are raw Responses or uncaught throws; no board kitchen-sink; `SCOPED_FILES` excludes these files.

## Desired End State

MG sees a tokenized board matching sibling chrome. Badge covers status, legend, and rewards. Missing session → Layout + 404; query failure → Layout + 503; incomplete → destructive copy. Dev `/sessions/board/kitchen-sink` exposes named states; lint fails if palette/`bg-cosmic` return on scoped board files.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Complexity | MEDIUM, 5 questions | One view + BoardGrid, settled tokens, five product choices | Plan interview |
| Error UX (C3) | Layout + 404 (invalid/missing); Layout + 503 (throw) | Matches siblings + lessons non-2xx rule | User / lessons |
| Status / chips (C2) | shadcn Badge | One shared chip for status, legend, rewards | User |
| Kitchen-sink | `/sessions/board/kitchen-sink`, PROD 404 | Avoids `[id]` clash; same gate pattern | User |
| Incomplete board | Hard error (`text-destructive`) | Recreate path should read as failure | User |
| Closed session | Copy-only (Badge label) | Status word is enough; no extra chrome | User |
| Tokens / dark / fonts | Skip redeposit | Already landed in `ui-new-session-board` | Research |

## Scope

**In scope:**

- Install shadcn Badge
- Restyle `[id].astro` + `BoardGrid.astro` onto role classes
- C3 branded Layout 404 / 503
- Incomplete board as destructive
- Dev kitchen-sink + screenshots
- Extend `SCOPED_FILES` + CLAUDE/AGENTS kitchen-sink pointer

**Out of scope:**

- Other cosmic pages; removing `bg-cosmic` utility
- Closed muted grid / banner; incomplete-board dashboard badge
- Playwright CI; loading skeleton; config-missing raw-500 alignment
- Token/font/dark redeposit; `LibBadge` revival; service API redesign

## Architecture / Approach

Install Badge → restyle page/grid + catch errors (404/503) → sibling kitchen-sink under `sessions/board/` gated by `import.meta.env.PROD` → extend lint scope and agent rules. No schema changes; no `[id]` relocate.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. One view + Badge + C3 | Tokenized board, Badge chips, branded 404/503 | Astro/Badge SSR boundary in BoardGrid |
| 2. Kitchen-sink + gate | Named-state gallery + screenshots | Sink reachable in PROD |
| 3. Guard | `SCOPED_FILES` + rule pointers | Rules updated but files omitted from scope |

**Prerequisites:** Research complete; local `npm run dev` with auth and a session id.  
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Exact Polish 503 string left to implementer within “could not load session” meaning.
- Badge SSR-from-Astro assumed; fall back to `badgeVariants` on spans if needed.
- Roadmap has no Change ID `ui-session-board` — left untouched.

## Success Criteria (Summary)

- `/sessions/[id]` uses role tokens + Badge; no cosmic palette on the view/grid.
- Missing session: Layout + 404; query error: Layout + 503; incomplete: destructive.
- Kitchen-sink covers matrix cells (or N/A) in DEV; blocked in PROD; screenshots exist.
- Literal scan scopes board files; agent rules mention `/sessions/board/kitchen-sink`.
