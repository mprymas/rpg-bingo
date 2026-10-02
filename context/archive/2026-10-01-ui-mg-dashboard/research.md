---
date: 2026-10-01T08:57:47+02:00
researcher: Marcin
git_commit: 79380f94724b292165c0ce65e894475865432c66
branch: master
repository: rpg-bingo
topic: "UI audit of /dashboard (Panel MG) against Vintage Paper tokens + shared components"
tags: [research, codebase, ui, dashboard, tokens, shadcn]
status: complete
last_updated: 2026-10-01
last_updated_by: Marcin
last_updated_note: Initial /10x-ui audit for ui-mg-dashboard
---

# Research: UI audit of `/dashboard` (Panel MG)

**Date**: 2026-10-01T08:57:47+02:00  
**Researcher**: Marcin  
**Git Commit**: 79380f94724b292165c0ce65e894475865432c66  
**Branch**: master  
**Repository**: rpg-bingo

## Research Question

For change `ui-mg-dashboard` (`/10x-ui`): against the settled Vintage Paper / shadcn contract from `ui-new-session-board`, which charges apply to the MG dashboard view (`/dashboard` → `src/pages/dashboard.astro`), and what must the plan extend (tokens already deposited — do not re-deposit)?

## Summary

Tokens and dark-only Layout are **already settled**. `src/styles/global.css` holds Vintage Paper in `:root` / `.dark` → `@theme inline`; `Layout.astro:20` applies `class="dark"` on `<html>`. The cleaned create-session path (`sessions/new/index.astro`, `NewSessionForm.tsx`, kitchen-sink) reads role classes (`bg-background`, `bg-card`, `border-border`, `text-foreground`, …) and uses `src/components/ui/*`.

On the inspected path, **`dashboard.astro` does not read those tokens**. It still paints the legacy cosmic/glass stack (`bg-cosmic`, `border-white/*`, `from-blue-200`/`to-purple-200`, `bg-purple-600`, `text-blue-100/70`) — the exact drift `ui-new-session-board` deferred to a later change (`ui-new-session-board/research.md` deferred list). Literal scan: **20** matches of the hardcoded-value pattern on this file (including `bg-cosmic`); `scripts/check-ui-literals.mjs` `SCOPED_FILES` (4 paths) **excludes** `dashboard.astro`.

Auth entry is fine (middleware + page redirect). Empty list has copy. Load failure is the architectural hole: `listSessionsForGm` **throws** on Supabase error (`sessions.service.ts:102`) with **no** try/catch or Layout error UI on the page — unlike `/sessions/new`, which sets `Astro.response.status = 503` and shows `text-destructive` in Layout (`index.astro:16–32`). Lesson `lessons.md` (prefer non-2xx + branded Layout error) applies when that path is fixed.

Phase scope for planning (inferred from settled prior change): **skip** token deposit / fonts / dark wiring; **do** restyle this one view onto role classes + shared `Button`, add branded list-load error + 503, extend `SCOPED_FILES`, add a dashboard kitchen-sink, update kitchen-sink pointer in agent rules if needed.

## Charges

| # | Category | Evidence | Effect on the user |
| --- | --- | --- | --- |
| C1 | **Missing tokens** | `src/pages/dashboard.astro:31–32` (`bg-cosmic`, `border-white/10`, `bg-white/10`, `text-white`); `:34` (`from-blue-200 to-purple-200`); `:46–58` (`text-blue-100/70`, `divide-white/10`, `hover:bg-white/10`); tokenized sibling `sessions/new/index.astro:24–39` (`bg-background` / `bg-card` / `border-border` / `text-foreground`) | After login the MG lands on a cosmic panel that does not match “Nowa sesja”, so the product reads as two themes in the same flow. |
| C2 | **Missing shared component** | Raw primary `<a>` `dashboard.astro:37–42` (`bg-purple-600` / `hover:bg-purple-500`, no `focus-visible`); raw sign-out `<button>` `:72–77` (glass literals, no ring); shared `Button` / `buttonVariants` in `src/components/ui/button.tsx:7–19,50` (`bg-primary`, `outline`, `focus-visible:ring-ring/50`) | Primary and logout actions miss shared focus rings and primary/outline variants, so keyboard users get weaker affordances than on the create-session form. |
| C3 | **Accidental architecture** | `listSessionsForGm` throws on DB error `sessions.service.ts:102–103`; unguarded await `dashboard.astro:16`; sibling pattern `sessions/new/index.astro:16–32` (503 + Layout + `text-destructive`); lesson `context/foundation/lessons.md` (non-2xx + branded Layout) | When the sessions query fails, the MG sees an opaque adapter 500 instead of a Polish message inside the app chrome. |
| C4 | **Accidental architecture** | No kitchen-sink / state gallery for this view; create-session gate lives at `src/pages/sessions/new/kitchen-sink.astro:5–7` (PROD 404) + `demoState` sections; `CLAUDE.md` kitchen-sink pointer names only `/sessions/new/kitchen-sink` | Reviewers cannot screenshot empty / focus / error side-by-side for the dashboard; `disabled`/`focus-visible`/`error` drift without a gate. |
| C5 | **Accidental architecture** | `scripts/check-ui-literals.mjs:9–14` — `SCOPED_FILES` omits `dashboard.astro`; project rule says extend when another view is tokenized (`CLAUDE.md` § UI / design tokens) | After a visual pass, palette/`bg-cosmic` can return on this page without failing `npm run lint`. |

### Deferred (visible, out of this view’s fix-or-explicitly-defer)

- Other cosmic pages still deferred: `sessions/[id].astro`, auth pages, `Welcome.astro`, `Topbar` / `BoardGrid` if still on palette — not this change’s one-view scope.
- Incomplete-board dashboard badge (feature debt from `context/archive/2026-09-27-gm-create-session-board/`) — not a token charge.
- Page-level `Response("Brak konfiguracji", { status: 500 })` at `dashboard.astro:7–8` is **effectively unreachable** for `/dashboard` when middleware redirects missing-client users to `/auth/signin` (`middleware.ts:14–21`); same raw-500 pattern exists on `sessions/new/index.astro:7–8`. Aligning config failure UX is optional / out of band unless the plan chooses to touch it alongside C3.
- Adding shadcn `Badge` for session status — nice-to-have; status is plain text today (`dashboard.astro:61`); `LibBadge.astro` is still palette-based and not a drop-in.
- SSR **loading** skeleton: page is blocking SSR; mark **N/A** in the 7-state matrix with that reason unless the plan introduces a client island for the list.

## Detailed Findings

### Token source and consumers (post `ui-new-session-board`)

- Source: `src/styles/global.css:6–42` (`:root`), `:44–80` (`.dark`), `:82–121` (`@theme inline`), `bg-cosmic` utility `:123–125`, base body `:127–133`.
- Dark applied: `Layout.astro:20` (`<html class="dark">`).
- Role-token consumers on inspected paths: `sessions/new/index.astro`, `kitchen-sink.astro`, `NewSessionForm.tsx`, `ServerError.tsx`, `button.tsx` / `input.tsx` / `checkbox.tsx` / `radio-group.tsx`.
- `bg-cosmic` still used on: `dashboard.astro:31`, `sessions/[id].astro:51`, auth pages, `Welcome.astro:5`.

### Shared components

- `src/components/ui/`: `button.tsx`, `input.tsx`, `label.tsx`, `checkbox.tsx`, `radio-group.tsx`, `LibBadge.astro` (palette).
- Dashboard imports **none** of them; CTA and sign-out are hand-rolled.
- `Button` exports `asChild` + `buttonVariants` (`button.tsx:39–50`) — Astro can either mount a small React island or apply `buttonVariants` if a non-React path is preferred; plan must pick one approach consistent with the stack (React islands when interactivity is needed; class string may suffice for static links).

### Entry points and states (this view)

| Condition | Observed behavior | Anchor |
| --- | --- | --- |
| Logged out | Redirect `/auth/signin` | `middleware.ts:4,18–21`; page also `dashboard.astro:12–14` |
| Missing Supabase client | Middleware sets `user = null` → same redirect; page 500 branch typically not reached | `middleware.ts:14–21`; `dashboard.astro:7–8` |
| Empty sessions | Dashed empty copy | `dashboard.astro:45–48` |
| Sessions present | List links to `/sessions/:id` | `dashboard.astro:49–68` |
| List query error | Throw → adapter 500, no Layout | `dashboard.astro:16`; `sessions.service.ts:102` |

**7-state matrix (current):**

| State | Present? |
| --- | --- |
| default | Yes (cosmic) |
| hover | Partial (palette hovers on CTA / rows / sign-out) |
| focus-visible | **Missing** on CTA, rows, sign-out |
| disabled | **N/A** (no disabled controls on happy path) |
| error | **Missing** (load failure) |
| empty | Yes (copy exists; still cosmic literals) |
| loading | **N/A** for blocking SSR list (no client fetch) |

### Hardcoded-value scan (pre-audit)

Run on `src/pages/dashboard.astro` only: **20** hits matching the 10x-ui / `check-ui-literals` pattern (including `bg-cosmic`). Count should drop to **0** after the visual phase before adding the file to `SCOPED_FILES`.

## Code References

- `src/pages/dashboard.astro:1–81` — view under audit
- `src/pages/sessions/new/index.astro:6–49` — tokenized shell + 503 error UX to mirror
- `src/pages/sessions/new/kitchen-sink.astro:5–7,24+` — visual-gate pattern
- `src/styles/global.css:6–133` — token contract + legacy `bg-cosmic`
- `src/layouts/Layout.astro:20` — `html.dark`
- `src/components/ui/button.tsx:7–50` — shared Button
- `src/lib/services/sessions.service.ts:95–103` — list + throw
- `src/middleware.ts:4,14–21` — `/dashboard` guard
- `scripts/check-ui-literals.mjs:9–14` — SCOPED_FILES
- `context/changes/ui-new-session-board/research.md` — prior audit; dashboard deferred
- `context/foundation/lessons.md` — non-2xx branded Layout errors

## Architecture Insights

- This is the **existing design system** variant: deposit already done; the change is “make this view read the tokens” + extend the guard.
- Mirror the create-session **page shell** classes rather than inventing a third surface language.
- Kitchen sink for a mostly-static Astro page can fixture empty / populated / error branches without a full React `demoState` API — still PROD-404 like the sibling route.
- One view + extend `SCOPED_FILES` + rule pointer; do not rebrand auth/`[id]` in this change.

## Historical Context (from prior changes)

- `ui-new-session-board` — **supported**: Vintage Paper in `global.css`, dark-only Layout, create-session on role classes, kitchen-sink, `check-ui-literals` scoped to create-session + `ServerError`. Explicitly deferred dashboard cosmic one-offs.
- `context/archive/2026-09-27-gm-create-session-board/` — **supported**: `/dashboard` list feature, protected route, Polish copy. **Not** a visual/token pass.
- `ui-mg-dashboard/change.md` — **supported**: view = `/dashboard`; extend existing token contract + guard; no second palette.

## Related Research

- `context/changes/ui-new-session-board/research.md` — design-system contract and deferred dashboard drift.

## Open Questions

1. **Button in Astro**: small React island with `asChild` for “Nowa sesja”, or export/use `buttonVariants` as class strings on native `<a>`/`<button>` without an island?
2. **Kitchen-sink route**: `/dashboard/kitchen-sink` (sibling page under `src/pages/dashboard/`) vs another path — PROD 404 required either way?
3. **C3 scope**: catch `listSessionsForGm` failures with Layout + `Astro.response.status = 503` in this change (recommended by lesson + sibling), or defer with reason?
4. **Status presentation**: keep plain text status labels, or add a tokenized Badge in this change?
