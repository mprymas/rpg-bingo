<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: GM Delete Session

- **Plan**: context/changes/gm-delete-session/plan.md
- **Scope**: Full plan (Phases 1–3 of 3)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-11
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Roadmap still marks delete in progress

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md:47
- **Detail**: Commit 36c9b61 sets S-03 `gm-delete-session` to `in-progress` in the glance table and in the slice body (line 112), after every plan phase is checked off and `change.md` is `implemented`. The same commit also moved unrelated S-01 `player-join-via-qr` from `ready` to `planning`. Commit 93adaac later set S-01 to `in-progress` for the QR slice, so that status is no longer this change's to revert. S-03 is still `in-progress`. The `cursor-pointer` edit on `src/components/ui/button.tsx` and the lessons.md entry in 36c9b61 match the accepted cursor-pointer lesson and are left as-is.
- **Fix**: Set S-03 to `done` in the glance table (line 47) and the slice section (line 112). Leave S-01 at `in-progress`.
- **Decision**: FIXED

### F2 — Kitchen sink stacks three delete dialogs

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/pages/dashboard/kitchen-sink.astro:139
- **Detail**: Three sections pass `initialDeleteOpenId` (`delete-confirm-active`, `delete-confirm-closed`, `delete-error`), so three AlertDialog roots mount already open. `AlertDialogContent` portals an overlay (`fixed inset-0 z-50` in `src/components/ui/alert-dialog.tsx`) to the document. Those overlays cover the gallery, so the active, closed, and error confirms cannot be read as separate sections. The live dashboard opens one dialog on click. Production still 404s this page.
- **Fix A ⭐ Recommended**: Show each confirm state inside its own section without a second and third portaled overlay (inline dialog content, or one live `initialDeleteOpenId` plus static copy for the other two).
  - Strength: The page can act as the visual gate the plan asked for.
  - Tradeoff: Closed and error are not live Radix dialogs unless the inline path still renders the dialog content.
  - Confidence: MEDIUM — inferred from three open roots and the portal overlay; this review did not load the page.
  - Blind spot: Route is auth-gated and local Supabase was down, so the stack was not confirmed in the browser.
- **Fix B**: Keep three live dialogs, but mount only one open dialog at a time (hash or a control that swaps which section is open).
  - Strength: Each state is the real component.
  - Tradeoff: The gallery is no longer one scan; the reviewer has to switch states.
  - Confidence: MEDIUM — same unverified stack.
  - Blind spot: Same as Fix A.
- **Decision**: FIXED via Fix A

### F3 — Delete spinner uses the primary-button ring color

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/dashboard/DashboardSessionList.tsx:179
- **Detail**: The pending confirm control is `variant="destructive"` (`text-white`, `dark:bg-destructive/60`) but the spinner uses `border-primary-foreground`. In `.dark`, `--primary-foreground` is `oklch(0.2747 …)`, the same value as `--background`, so the ring is a dark track on the red fill. The label still changes to "Usuwanie…". Non-primary loaders in `GmBoard.tsx` and `CloseRetryBanner.tsx` use `border-foreground`.
- **Fix**: Use `border-foreground/30 border-t-foreground` on that spinner.
- **Decision**: FIXED

## Verification

| Check | Result |
|-------|--------|
| `npx supabase migration list --local` | Not applied-checkable. Local Postgres refused `127.0.0.1:54322`. Did not run `supabase db reset`. |
| `npm run test:unit` | PASS — 7 files, 34 tests |
| `npm run lint` | PASS — ui-literals ok (35 files) |
| `npx astro check` | PASS — 0 errors, 0 warnings, 0 hints |
| `npm run test:integration` | Not re-run. Local Supabase is down; the suite needs a preview URL and credentials. Progress 3.1 stays `[x]` from implementation. |
| Manual Progress 1.5, 1.6, 2.3, 2.4, 2.5, 3.3 | All `[x]`. The HTTP matrix is encoded in `tests/integration/delete-session.test.ts`. This review did not repeat the browser walk. F2 is in tension with 2.4 (confirm states render as a gallery). |
