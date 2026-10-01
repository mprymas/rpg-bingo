---
date: 2026-10-01T12:04:37+02:00
researcher: Marcin
git_commit: cc2c427ca52fe1b2994940f855165d642f584162
branch: master
repository: rpg-bingo
topic: "UI audit of /sessions/[id] (generated bingo board) against Vintage Paper tokens + shared components"
tags: [research, codebase, ui, session-board, tokens, shadcn, BoardGrid]
status: complete
last_updated: 2026-10-01
last_updated_by: Marcin
last_updated_note: Initial /10x-ui audit for ui-session-board
---

# Research: UI audit of `/sessions/[id]` (generated bingo board)

**Date**: 2026-10-01T12:04:37+02:00  
**Researcher**: Marcin  
**Git Commit**: cc2c427ca52fe1b2994940f855165d642f584162  
**Branch**: master  
**Repository**: rpg-bingo

## Research Question

For change `ui-session-board` (`/10x-ui`): against the settled Vintage Paper / shadcn contract from `ui-new-session-board` and `ui-mg-dashboard`, which charges apply to the generated bingo board view (`/sessions/[id]` → `src/pages/sessions/[id].astro` + `src/components/sessions/BoardGrid.astro`), and what must the plan extend (tokens already deposited — do not re-deposit)?

## Summary

Tokens and dark-only Layout are **already settled**. `src/styles/global.css` holds Vintage Paper in `:root` / `.dark` → `@theme inline`; `Layout.astro:20` applies `class="dark"` on `<html>`. Tokenized siblings (`sessions/new/index.astro`, `dashboard/index.astro` + `DashboardPanel.astro`) read role classes (`bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-primary`, `text-muted-foreground`, `text-destructive`, …).

On the inspected path, **`[id].astro` and `BoardGrid.astro` do not read those tokens**. They still paint the legacy cosmic/glass stack (`bg-cosmic`, `border-white/*`, `bg-white/*`, `text-purple-*`, `text-blue-*`, emerald/amber palette) — the drift both prior UI changes deferred. Hardcoded-value scan on these two files: **25** matches of the 10x-ui / `check-ui-literals` pattern (including `bg-cosmic`); `scripts/check-ui-literals.mjs` `SCOPED_FILES` (8 paths) **excludes** both files.

Auth entry is fine (middleware `PROTECTED_ROUTES` includes `/sessions` + page redirect). Incomplete board already has in-Layout copy. Architectural holes: invalid UUID / missing session return **raw `Response` text** (no Layout); `getSessionWithCells` **throws** on Supabase error (`sessions.service.ts:126`) with **no** try/catch on the page — unlike `/sessions/new` and `/dashboard`, which set `Astro.response.status = 503` and show `text-destructive` in Layout. Lesson `lessons.md` (prefer non-2xx + branded Layout error) applies when that path is fixed. No kitchen-sink exists for this view.

Phase scope for planning (inferred from settled prior changes): **skip** token deposit / fonts / dark wiring; **do** restyle this one view (+ `BoardGrid`) onto role classes, align branded load/not-found error UX where the plan chooses, extend `SCOPED_FILES`, add a session-board kitchen-sink, update kitchen-sink pointer in agent rules.

## Charges

| # | Category | Evidence | Effect on the user |
| --- | --- | --- | --- |
| C1 | **Missing tokens** | Page shell `[id].astro:51–52` (`bg-cosmic`, `border-white/10`, `bg-white/10`, `text-white`); meta/link/legend `:54`, `:60`, `:77`, `:80` (`text-purple-300`, `text-blue-100/*`, `border-white/15`); status pill `:64` (emerald palette); incomplete `:89` (amber palette); `BoardGrid.astro:21–24` (`border-white/15`, `bg-white/10`, `text-white`, `bg-purple-500/40`, `text-purple-100`, `text-[9px]`/`text-[10px]`); tokenized siblings `sessions/new/index.astro:24–39`, `DashboardPanel.astro:29–37` (`bg-background` / `bg-card` / `border-border` / `text-foreground`) | After creating a session the MG lands on a cosmic board that does not match “Nowa sesja” or Panel MG, so the product reads as three themes in one flow. |
| C2 | **Missing shared component** | Status pill hand-rolled `[id].astro:64–66`; legend chips `:79–82`; cell reward chips `BoardGrid.astro:24–25` (palette micro-badges); `LibBadge.astro:10–12` is palette-only and **unreferenced** under `src/`; no shadcn `Badge` in `src/components/ui/` yet; dashboard status is plain `text-muted-foreground` (`DashboardPanel.astro:65`) | Status and reward labels look like one-off glass chips instead of shared affordances; adding a Badge later (or mirroring muted bordered chips) needs an explicit plan choice, not another purple/emerald invent. |
| C3 | **Accidental architecture** | Invalid UUID / missing session: raw `Response` `[id].astro:10–11`, `:25–26`; `getSessionWithCells` throws on DB error `sessions.service.ts:126` with unguarded await `[id].astro:24`; siblings use Layout + 503 (`sessions/new/index.astro:16–32`, `dashboard/index.astro:20–24,28–34`); lesson `context/foundation/lessons.md:12–17` | Logged-in MG hitting a bad id or a query failure sees plain text / opaque adapter 500 instead of Polish copy inside app chrome. |
| C4 | **Accidental architecture** | No kitchen-sink for this view; gates exist at `sessions/new/kitchen-sink.astro:5–7` and `dashboard/kitchen-sink.astro:6–8` (PROD 404); `CLAUDE.md:52` names only those two sinks | Reviewers cannot screenshot default / incomplete / focus side-by-side for the board; `focus-visible` / incomplete / closed-status drift without a gate. |
| C5 | **Accidental architecture** | `scripts/check-ui-literals.mjs:9–17` — `SCOPED_FILES` omits `[id].astro` and `BoardGrid.astro`; project rule says extend when another view is tokenized (`CLAUDE.md` § UI / design tokens) | After a visual pass, palette/`bg-cosmic` can return on this page without failing `npm run lint`. |

### Deferred (visible, out of this view’s fix-or-explicitly-defer)

- Other cosmic pages still deferred: auth pages, `Welcome.astro`, `Topbar.astro` — not this change’s one-view scope.
- Incomplete-board **dashboard** badge (feature debt from `context/archive/2026-09-27-gm-create-session-board/reviews/impl-review.md` F4) — not a token charge for `[id]`.
- Page-level `Response("Brak konfiguracji", { status: 500 })` at `[id].astro:15–16` is **effectively unreachable** when middleware redirects missing-client users to `/auth/signin` (`middleware.ts:7–21`); same raw-500 pattern exists on `sessions/new/index.astro:7–8` and `dashboard/index.astro:9–10`. Aligning config failure UX is optional / out of band unless the plan chooses to touch it alongside C3.
- Whether status stays plain muted text (dashboard pattern) vs a tokenized `Badge` — product choice for the plan (C2); do not revive palette `LibBadge`.
- SSR **loading** skeleton: page is blocking SSR; mark **N/A** in the 7-state matrix with that reason unless the plan introduces a client island.
- **disabled**: read-only preview; **N/A** unless interactive mark/claim controls appear later.
- `tracking-[0.35em]` on session code (`[id].astro:57`) is arbitrary `em` — current `check-ui-literals` regex only flags `px|rem`; prefer `tracking-widest` like `DashboardPanel.astro:60` even if lint would not catch it.

## Detailed Findings

### Token source and consumers (Source → views)

- Source: `src/styles/global.css:6–42` (`:root`), `:44–80` (`.dark`), `:82–121` (`@theme inline`), `bg-cosmic` utility `:123–125`, base body `:127–133`.
- Dark applied: `Layout.astro:20` (`<html class="dark">`).
- Role-token consumers on inspected paths: `sessions/new/index.astro`, `sessions/new/kitchen-sink.astro`, `NewSessionForm.tsx`, `ServerError.tsx`, `dashboard/index.astro`, `dashboard/kitchen-sink.astro`, `DashboardPanel.astro`, `DashboardActions.tsx`, shadcn `ui/*` TSX primitives.
- `bg-cosmic` still used on inspected `src/` pages: `sessions/[id].astro:51`, auth pages, `Welcome.astro:5` (definition `global.css:123–125`).

### View → source (literals on this view)

| Area | Anchor | Suggested role / component |
| --- | --- | --- |
| Page wrapper | `[id].astro:51` | `bg-background` |
| Inner card | `:52` | `border-border bg-card text-foreground` (drop `backdrop-blur-xl` to match siblings) |
| Back link | `:54` | `text-primary` |
| Session code | `:57` | `text-foreground` + `tracking-widest` |
| Meta row | `:60` | `text-muted-foreground` |
| Status | `:64–66` | plain muted span (dashboard) **or** tokenized Badge |
| Legend heading / chips | `:77`, `:80` | `text-muted-foreground` / `border-border bg-muted` |
| Incomplete board | `:89` | dashed `border-border` + `text-muted-foreground` **or** `text-destructive` if kept as hard error |
| Grid tiles | `BoardGrid.astro:21–22` | `border-border bg-card` / `text-foreground text-xs` |
| Reward chip | `BoardGrid.astro:24` | Badge or `bg-secondary text-secondary-foreground text-xs` |

Pre-audit scan count on `[id].astro` + `BoardGrid.astro`: **25** hits (17 + 8). Count should drop to **0** after the visual phase before adding both files to `SCOPED_FILES`.

### Shared components

- `src/components/ui/`: `button.tsx`, `input.tsx`, `label.tsx`, `checkbox.tsx`, `radio-group.tsx`, `LibBadge.astro` (palette, **0** imports under `src/`).
- Session board imports **none** of them; only `BoardGrid` + Layout.
- No shadcn `Badge` present — add via `npx shadcn@latest add badge` if the plan wants one shared chip, else reuse bordered muted patterns from tokenized siblings.

### Entry points and states (this view)

| Condition | Observed behavior | Anchor |
| --- | --- | --- |
| Logged out | Redirect `/auth/signin` | `middleware.ts:4,18–21`; page also `[id].astro:19–21` |
| Missing Supabase client | Middleware → same redirect; page 500 branch typically not reached | `middleware.ts:7–21`; `[id].astro:15–16` |
| Invalid UUID | Raw text 404 | `[id].astro:10–11` |
| Session null / wrong GM | Raw text 404 | `[id].astro:24–26`; service `eq("gm_id")` `:122–123` |
| Query error | Throw → adapter 500, no Layout | `[id].astro:24`; `sessions.service.ts:126` |
| Incomplete cells | Layout + amber copy, no grid | `[id].astro:46–47,88–92` |
| Complete board | Grid + optional legend | `[id].astro:71–86` |

**7-state matrix (current):**

| State | Present? |
| --- | --- |
| default | Yes (cosmic complete board) |
| hover | Partial (back link `hover:underline` only; tiles non-interactive) |
| focus-visible | **Missing** on back link; no focusable board controls |
| disabled | **N/A** (read-only preview) |
| error | Split: raw 404/500 outside Layout; incomplete inside Layout; query throw undressed |
| empty | Folded into incomplete-board path when `cells.length !== size²` |
| loading | **N/A** for blocking SSR |

## Code References

- `src/pages/sessions/[id].astro:1–96` — view under audit
- `src/components/sessions/BoardGrid.astro:1–30` — grid + reward chips
- `src/pages/sessions/new/index.astro:6–49` — tokenized shell + 503 error UX to mirror
- `src/pages/dashboard/index.astro:18–31` + `DashboardPanel.astro:28–67` — tokenized sibling shell / meta / empty
- `src/pages/sessions/new/kitchen-sink.astro:5–7` + `src/pages/dashboard/kitchen-sink.astro:6–8` — visual-gate pattern
- `src/styles/global.css:6–133` — token contract + legacy `bg-cosmic`
- `src/layouts/Layout.astro:20` — `html.dark`
- `src/lib/services/sessions.service.ts:106–140` — getSessionWithCells + throw
- `src/middleware.ts:4,7–21` — `/sessions` guard
- `scripts/check-ui-literals.mjs:9–17` — SCOPED_FILES
- `context/foundation/lessons.md:12–17` — non-2xx branded Layout errors
- `context/changes/ui-new-session-board/research.md:49` — deferred `[id]` / `BoardGrid`
- `context/changes/ui-mg-dashboard/research.md:49` — deferred `sessions/[id].astro`

## Architecture Insights

- This is the **existing design system** variant: deposit already done; the change is “make this view (+ BoardGrid) read the tokens” + extend the guard.
- Mirror the create-session / dashboard **page shell** classes rather than inventing a fourth surface language.
- Kitchen sink for a mostly-static Astro page can fixture complete / incomplete / closed-status / focus-demo without a React `demoState` API — still PROD-404 like sibling routes; path under `/sessions/` remains auth-gated by middleware.
- One view + `BoardGrid` + extend `SCOPED_FILES` + rule pointer; do not rebrand auth/Welcome in this change.
- C3 (branded not-found / query error) is the charge most likely to be scoped or deferred with reason — archive plan originally specified raw 404 for missing session; lesson + siblings now prefer Layout + non-2xx for **data-load** failures. Plan must decide: Layout 404 for null session, try/catch 503 for throws, or defer with reason.

## Historical Context (from prior changes)

- `ui-new-session-board` — **supported**: Vintage Paper in `global.css`, dark-only Layout, create-session on role classes, kitchen-sink, `check-ui-literals`. Explicitly deferred `[id]` / `BoardGrid` cosmic one-offs (`research.md:49`).
- `ui-mg-dashboard` — **supported**: dashboard on role classes + kitchen-sink + SCOPED_FILES extension. Explicitly deferred `sessions/[id].astro` (`research.md:49`). Note: that research still names `dashboard.astro` in places; live path is `src/pages/dashboard/index.astro` + `DashboardPanel.astro` (**partial** path naming, behavior claim holds for current dashboard).
- `context/archive/2026-09-27-gm-create-session-board/` — **supported**: feature shipped `[id].astro` + `BoardGrid`, protected `/sessions`, incomplete-board failure UI on detail page (impl-review F4 FIXED). **Not** a visual/token pass; raw 404 Response was the original plan contract for missing session.
- `ui-session-board/change.md` — **supported**: view = `/sessions/[id]` + `BoardGrid`; extend existing token contract + guard; no second palette.

## Related Research

- `context/changes/ui-new-session-board/research.md` — design-system contract and deferred board drift.
- `context/changes/ui-mg-dashboard/research.md` — second tokenized view; same deferred `[id]` list.

## Open Questions

1. **C3 scope**: catch `getSessionWithCells` throws with Layout + `Astro.response.status = 503`, and/or render Layout for null-session / invalid-UUID 404 — or defer raw Responses with reason (archive specified plain 404)?
2. **Status / reward chips**: plain muted text + bordered `bg-muted` chips (no new dependency), or `npx shadcn@latest add badge` for status + legend + cell rewards?
3. **Kitchen-sink route**: `/sessions/[id]/kitchen-sink` is awkward (dynamic segment); prefer `/sessions/board/kitchen-sink` or `/sessions/kitchen-sink` — PROD 404 required either way?
4. **Incomplete-board severity**: keep as neutral dashed empty-like state (`text-muted-foreground`) or treat as `text-destructive` hard error?
5. **Closed session**: any visual distinction beyond the status label string, or leave copy-only?
