---
change_id: ui-mg-dashboard
title: Audyt i poprawa panelu MG (dashboard)
status: implementing
created: 2026-10-01
updated: 2026-10-01
archived_at: null
---

## Notes

Audyt i poprawa widoku dashboardu MG (`/10x-ui`).

- **View:** `/dashboard` — `src/pages/dashboard.astro`
- **Motif / token source:** existing Vintage Paper dark theme via shadcn contract already in repo (`src/styles/global.css` `:root` / `.dark` → `@theme inline`); do not fork a second palette or re-run `shadcn init`. Extend the guard from `ui-new-session-board` (CLAUDE.md § UI / design tokens, `scripts/check-ui-literals.mjs` SCOPED_FILES).
