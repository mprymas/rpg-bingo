---
date: 2026-09-30T15:29:55+02:00
researcher: m.prymas
git_commit: f7daa03cba9b8bba9111eee3ae2c5712a77243a0
branch: master
repository: rpg-bingo
topic: "UI audit of /sessions/new against Vintage Paper tokens + shared components"
tags: [research, codebase, ui, sessions, tokens, shadcn, tweakcn]
status: complete
last_updated: 2026-09-30
last_updated_by: m.prymas
last_updated_note: Initial /10x-ui audit + motif deposit for ui-new-session-board
---

# Research: UI audit of `/sessions/new` (Vintage Paper)

**Date**: 2026-09-30T15:29:55+02:00  
**Researcher**: m.prymas  
**Git Commit**: f7daa03cba9b8bba9111eee3ae2c5712a77243a0  
**Branch**: master  
**Repository**: rpg-bingo

## Research Question

For change `ui-new-session-board` (`/10x-ui`): what is the design-system contract in this repo, which charges apply to the create-board view (`/sessions/new`), and what does the chosen tweakcn motif (**Vintage Paper**) deposit into that contract?

## Summary

On the inspected paths, the only token source is `src/styles/global.css` (`:root` / `.dark` → `@theme inline`). Product chrome on `/sessions/new` (and every other painted page inspected) does **not** read those tokens — it paints a hardcoded cosmic purple/blue/white look via `bg-cosmic` and Tailwind palette classes. The sole semantic consumer of role tokens in components is `src/components/ui/button.tsx`, and `NewSessionForm` overrides its variants with `bg-purple-600` / white borders.

Shared UI kit under `src/components/ui/` contains **two** files on disk: `button.tsx` and `LibBadge.astro`. `Input`, `Label`, `Card`, `RadioGroup`, and `Checkbox` are absent from the repo (search by name returned no files/imports). Auth has `FormField` / `SubmitButton` / `ServerError`; the create form reuses only `Button` + `ServerError`.

Motif **Vintage Paper** (`https://tweakcn.com/r/themes/cmokic2d8000304jo55ca0sy3`) is deposited as raw CSS variables in [`motif-vintage-paper.json`](./motif-vintage-paper.json). Deposit target (settled in `change.md`): map into existing `:root` / `.dark` — do not fork a second palette. Light theme is warm paper; dark theme is brown-ink. Fonts: Libre Baskerville / Lora / IBM Plex Mono; radius `0.25rem`.

`.dark` is defined in CSS but **not** applied on `<html>` / `<body>` in `Layout.astro` on the inspected markup — dark token values therefore cannot activate via class toggle today.

## Charge list (input to `/10x-plan`)

| # | Category | Evidence | Effect on the user |
| --- | --- | --- | --- |
| C1 | **Missing tokens** | `src/pages/sessions/new.astro:22-28` (`bg-cosmic`, `border-white/10`, `from-blue-200 to-purple-200`, `text-purple-300`); `src/styles/global.css:113-115` (`bg-cosmic` hex); `NewSessionForm.tsx:20-21` (`inputClass` white/purple) | Depositing Vintage Paper into `:root` changes nothing visible on this screen until these literals are replaced with role classes (`bg-background`, `bg-card`, `text-primary`, `border-border`, `ring-ring`). |
| C2 | **Missing tokens** | `NewSessionForm.tsx:198-201` overrides `Button` default (`bg-primary` in `button.tsx:12`) with `bg-purple-600 … text-white`; focus on raw inputs uses `focus:ring-purple-400` (`:21`) instead of `ring` | Primary CTA and focus ring stay purple even after token swap; keyboard focus does not follow the motif’s `--ring`. |
| C3 | **Missing shared component** | Raw `<input>` / radio pills / row shells in `NewSessionForm.tsx:74-101`, `:111-120`, `:107-109`, `:165-167`; no `Input`/`Label`/`Card`/`RadioGroup`/`Checkbox` under `src/components/ui/` | Every control is a one-off cosmic shell; adding shadcn primitives (or reusing a thinner input) is required before the view can stay on tokens without copy-pasted classes. |
| C4 | **Accidental architecture** | `src/pages/sessions/new.astro:16-17` — rewards query failure returns raw `Response("Nie udało się wczytać nagród", { status: 500 })` with **no** `Layout` | User who hits a catalog load error leaves the app chrome and sees plain text; success path (`:21-35`) is the only Layout experience. |
| C5 | **Accidental architecture** | Empty `rewards: []` still renders Layout + form (`new.astro:21-35` + `NewSessionForm.tsx:161-194`) with no empty copy; submit remains allowed | MG can generate a board with zero catalog rewards and no on-screen explanation why the Nagrody section is blank. |

### Deferred (visible, out of this view’s fix-or-explicitly-defer)

- Other pages (`dashboard`, auth, `[id]`, `Welcome`, `Topbar`, `BoardGrid`) still use the same cosmic one-offs — global token deposit will not restyle them until a later change reads the tokens.
- `ServerError.tsx:11` uses `red-*` palette classes, not `destructive` tokens — affects error banner on this form when `error` is set.
- `FormField` / `SubmitButton` are auth-shaped (`icon` required; `useFormStatus`) and are **not** drop-in for this island — do not force-fit without API change.
- Logged-out users never reach the page: `middleware.ts:4,18-20` redirects `/sessions*` → `/auth/signin` (settled; not a charge to “fix”).

## Detailed Findings

### Token source and consumers

- Source: `src/styles/global.css:6-39` (`:root`), `:41-73` (`.dark`), `:75-111` (`@theme inline`), base apply `:117-124`.
- Semantic class usage found under `src/` in this pass: `global.css` base layer + `button.tsx` variants only (grep for `bg-primary|text-muted|border-border|bg-background|text-foreground|bg-card|text-destructive`).
- `bg-cosmic` (`global.css:113-115`) is a hardcoded gradient utility, not a role token.

### Shared components

- `src/components/ui/button.tsx` — token-based variants (`:12-19`), focus via `ring-ring` (`:8`).
- `src/components/ui/LibBadge.astro` — palette one-offs; unused by the create-session path in this search.
- Auth helpers: `FormField.tsx`, `SubmitButton.tsx`, `ServerError.tsx` — cosmic styling; `ServerError` consumed at `NewSessionForm.tsx:196`.

### Entry points and states (this view)

| Condition | Observed behavior | Anchor |
| --- | --- | --- |
| Logged out | Redirect to `/auth/signin` | `middleware.ts:18-20` |
| Rewards query error | Raw 500 text, no Layout | `new.astro:16-17` |
| Empty rewards | Form with blank Nagrody list; submit OK | `NewSessionForm.tsx:161-194` |
| Over-limit | Submit disabled; counters `text-red-300` | `NewSessionForm.tsx:40,156-158,191-193,198-200` |
| Pending | Spinner + “Generowanie…” | `NewSessionForm.tsx:203-207` |
| API error | `ServerError` banner | `NewSessionForm.tsx:196` + `useCreateSession.ts` |

Named states for plan/kitchen-sink: **default**, **hover/focus** (size pills + inputs + submit), **disabled** (over-limit + pending), **error** (ServerError + over-limit counters), **empty** (zero rewards), **loading** (pending).

### Reference motif — Vintage Paper

- Registry item name: `Vintage Paper`.
- Deposit file: `context/changes/ui-new-session-board/motif-vintage-paper.json` (source URL in `_source`).
- Install path when implementing: `npx shadcn@latest add https://tweakcn.com/r/themes/cmokic2d8000304jo55ca0sy3` **or** manual map of deposited vars into `global.css` — both must land in the existing `:root` / `.dark` slots.
- Extra theme keys present in registry (fonts, shadows, tracking, spacing) beyond the current `global.css` variable set — plan must decide which extras to adopt vs skip (minimum is color + radius roles already named in `:root`).

## Code References

- `src/styles/global.css:6-124` — token contract + `bg-cosmic`
- `src/pages/sessions/new.astro:7-35` — page shell + error Responses
- `src/components/sessions/NewSessionForm.tsx:20-214` — form UI
- `src/components/ui/button.tsx:7-48` — only tokenized interactive primitive
- `src/middleware.ts:4-21` — `/sessions` auth guard
- `context/changes/ui-new-session-board/motif-vintage-paper.json` — motif deposit
- `context/archive/2026-09-27-gm-create-session-board/` — prior create-session feature decisions

## Architecture Insights

- Classic “starter ships tokens; screens ignore them” case: phase 1 of the plan is deposit Vintage Paper **and** make **this** view read role classes — not invent a second cosmic system.
- One view + global tokens (10x-ui hard rule): other cosmic pages remain deferred drift until they are on tokens.
- Adding `Input` / `Label` / (optional) `Checkbox` via `npx shadcn@latest add …` fits the stack path; `Card` / `RadioGroup` are optional if a lighter fieldset pattern on tokens is enough.

## Historical Context (from prior changes)

- `context/archive/2026-09-27-gm-create-session-board/` — **supported**: protected `/sessions`, rewards ordered by `created_at`, live counters, submit disabled over `N²`, `ServerError` for API errors, Polish UI, Inspiracja ×3 default. **Not** a visual/token pass.
- `context/changes/ui-new-session-board/change.md` — **supported**: view = `/sessions/new`; motif = tweakcn into existing `global.css`.

## Related Research

- Not applicable — no prior `research.md` for this change folder.

## Open Questions

1. **Theme extras**: adopt Vintage Paper fonts (Libre Baskerville / Lora / IBM Plex Mono) and shadow tokens in this change, or colors + radius only?
2. **Dark mode**: leave light-only for this view (no `.dark` on `html`), or wire a class / prefer-color-scheme in scope?
3. **C4/C5 in scope?** Fix rewards-load Layout error + empty-rewards copy in this change, or defer with reason?
4. **Kitchen sink**: temporary route vs inline state gallery on `/sessions/new` for the visual gate (repo has no Playwright screenshot runner)?
