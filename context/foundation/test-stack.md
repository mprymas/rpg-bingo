# Test stack

## E2E

<!-- Written by /10x-e2e-setup. Re-run it to change this section; other skills only read it. -->

- runner: Playwright Test, @playwright/test 1.63.0
- config: playwright.config.ts
- single-spec command: npx playwright test tests/e2e/seed.spec.ts
- full-suite command: npm run test:e2e (alias for `playwright test`)
- base URL: http://localhost:4321
- port: 4321 (detected from Astro preview default; detected default 4321, override with E2E_PORT)
- web server command: npm run build && npm run preview -- --port $E2E_PORT; reuseExistingServer outside CI, or when E2E_REUSE_SERVER=1 (CI smoke job)
- auth setup project: setup (tests/e2e/auth.setup.ts), credentials from E2E_USERNAME / E2E_PASSWORD in .env
- storageState: playwright/.auth/user.json (gitignored)
- seed: tests/e2e/seed.spec.ts — protects #4 player claim on free cell reveals reward on the board
- public join: tests/e2e/public-join-path.spec.ts — protects #10 home code → nick → shared board
- CI: smoke job installs Chromium, sets E2E_* to the provisioned GM, E2E_REUSE_SERVER=1, runs npm run test:e2e
- browser CLI: playwright-cli, command skill at .cursor/skills/playwright-cli/SKILL.md
- updated: 2026-10-07
