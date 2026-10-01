---
change_id: ui-session-board
title: Audyt i poprawa widoku wygenerowanej planszy bingo
status: implemented
created: 2026-10-01
updated: 2026-10-01
archived_at: null
---

## Notes

Audyt i poprawa widoku wygenerowanej planszy bingo (`/10x-ui`).

- **View:** `/sessions/[id]` — `src/pages/sessions/[id].astro` + `src/components/sessions/BoardGrid.astro`
- **Motif / token source:** existing Vintage Paper dark theme via shadcn contract already in repo (`src/styles/global.css` `:root` / `.dark` → `@theme inline`); do not fork a second palette or re-run `shadcn init`. Extend the guard from prior UI changes (CLAUDE.md § UI / design tokens, `scripts/check-ui-literals.mjs` SCOPED_FILES).
