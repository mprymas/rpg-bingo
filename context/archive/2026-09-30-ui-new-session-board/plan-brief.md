# Vintage Paper create-session board — Plan Brief

> Full plan: `context/changes/ui-new-session-board/plan.md`
> Research: `context/changes/ui-new-session-board/research.md`

## What & Why

`/sessions/new` ignores the repo token contract and paints a cosmic purple/glass one-off. This change deposits the Vintage Paper motif into the existing `global.css` system, forces dark mode app-wide, and restyles the create-board view onto tokens plus shared shadcn primitives — including catalog error/empty states so the screen stays inside the design contract.

## Starting Point

Tokens live in `src/styles/global.css` but almost nothing reads them except `button.tsx` (then overridden). The create form and page shell use hardcoded palette classes; rewards query failure returns raw 500 text; empty catalog shows a blank Nagrody list. Motif values are deposited in `motif-vintage-paper.json`.

## Desired End State

MG sees a Vintage Paper dark create form built from role tokens and Input/Label/Checkbox/RadioGroup. Catalog load errors stay in Layout; empty catalog shows Polish copy with submit still allowed. A prod-blocked kitchen-sink exposes named states for screenshot review. Other cosmic pages remain deferred.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Motif depth | Colors + radius + fonts | Motif needs type, not only a beige recolor | Plan |
| Architecture charges | Fix C4 + C5 | Accidental-architecture charges stay visible until fixed | Research / Plan |
| Theme mode | Force dark on every page (`html.dark`) | App ships brown-ink only; no light UI or toggle | Plan |
| Empty catalog | Copy + keep submit | Explains blank list without changing archive “empty rewards OK” rule | Plan |
| Shared primitives | Input + Label + Checkbox + RadioGroup | Closes missing-component charge for every control on the form | Plan |
| Visual gate | Dev-only kitchen-sink route | Matches `/10x-ui` without installing Playwright | Research / Plan |
| Deposit target | Existing `:root` / `.dark` only | Do not fork a second palette | change.md / Research |

## Scope

**In scope:**

- Vintage Paper color/radius/font deposit into `global.css`
- Force `.dark` on `<html>`; self-host motif fonts
- Add Input, Label, Checkbox, RadioGroup
- Restyle `/sessions/new` + `NewSessionForm`; tokenize `ServerError`
- C4 Layout error path; C5 empty-catalog copy (submit allowed)
- Dev-only `/sessions/new/kitchen-sink` + screenshots

**Out of scope:**

- Restyling other cosmic pages
- Light theme / theme toggle
- Shadow/tracking/spacing motif extras
- API/product rule changes; Playwright CI
- Removing `bg-cosmic` utility globally

## Architecture / Approach

Deposit motif → force dark Layout → shadcn primitives → restyle one view (relocate `new.astro` → `new/index.astro`) → kitchen-sink sibling gated by `import.meta.env.PROD`. Create-session API and generation logic unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Token deposit + fonts + force dark | Live Vintage Paper dark tokens + fonts | Global body/button bleed under remaining cosmic pages |
| 2. Shared primitives | Input/Label/Checkbox/RadioGroup in repo | Wrong shadcn hook alias path |
| 3. Create-session view + C4/C5 | Tokenized form + Layout error + empty copy | Behavior regressions while swapping controls |
| 4. Kitchen-sink + visual gate | Named-state gallery + screenshots | Sink accidentally reachable in prod |

**Prerequisites:** Change folder + research + motif deposit; local `npm run dev` with auth for `/sessions*`.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Forced dark + token deposit will subtly change auth/dashboard behind `bg-cosmic` until those pages migrate.
- Exact Polish empty-catalog string is left to implementer within the agreed meaning.
- Self-hosted `@fontsource` (or equivalent) is the intended font path on Cloudflare Workers.

## Success Criteria (Summary)

- `/sessions/new` reads role tokens and shared primitives in forced dark Vintage Paper.
- C4/C5 fixed (Layout error; empty copy; submit still allowed).
- Kitchen-sink covers named states in DEV and is blocked in PROD; screenshots exist for review.
