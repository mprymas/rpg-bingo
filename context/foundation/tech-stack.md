---
starter_id: 10x-astro-starter
package_manager: npm
project_name: rpg-bingo
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

A solo developer building RPG Bingo after hours, with a 3-week MVP window and a hard deadline of 2026-11-04, needs a starter that ships auth, a relational database, and deployment already wired together. 10x Astro Starter (Astro 7 + React 19 + TypeScript + Tailwind 4 + Supabase + Cloudflare Workers) is the recommended default for a JavaScript web-app and clears all four agent-friendly gates. Supabase covers the Game Master login (FR-001) and gives Postgres constraints to enforce the "one field, one owner" guardrail even on near-simultaneous clicks; the anonymous player join by session code (FR-002) is plain application logic. The PRD explicitly makes live sync a non-goal and accepts a 10-second visibility window, so board refresh is handled by polling rather than websockets, and the realtime flag is off; Supabase Realtime remains available later if FR-013 is promoted. Small scale and low QPS fit Cloudflare's free tier. Scaffolding confidence is first-class, so expect mostly-smooth bootstrapping with occasional manual steps. CI on GitHub Actions with auto-deploy on merge, the starter's standard shape.
