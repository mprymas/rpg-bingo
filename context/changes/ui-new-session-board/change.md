---
change_id: ui-new-session-board
title: Audyt i poprawa widoku tworzenia planszy bingo
status: implemented
created: 2026-09-30
updated: 2026-09-30
archived_at: null
---

## Notes

Audyt i poprawa widoku tworzenia planszy bingo (`/10x-ui`).

- **View:** `/sessions/new` — `src/pages/sessions/new.astro` + `src/components/sessions/NewSessionForm.tsx`
- **Motif / token source:** tweakcn theme via `npx shadcn@latest add https://tweakcn.com/r/themes/cmokic2d8000304jo55ca0sy3` — deposit into this repo's existing shadcn token contract (`src/styles/global.css` `:root` / `.dark` → `@theme inline`); do not fork a second palette
