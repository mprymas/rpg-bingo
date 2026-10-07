// Risk #4 — Board view / claim path regresses so a player cannot mark a free
// cell or see the post-claim reward.
import { test, expect } from "@playwright/test";

/** Astro islands have hydrated when no `astro-island[ssr]` remains. */
async function waitForIslands(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
}

test("player claim on free cell reveals reward on the board", async ({ page }) => {
  const stamp = Date.now();
  const phrase = `E2E claim phrase ${stamp}`;
  const nick = `e2e${stamp}`.slice(0, 24);

  // Setup — GM creates a 3×3 board where every cell has a reward, plus a
  // guaranteed phrase so the claim target is findable by accessible name.
  await page.goto("/sessions/new");
  await waitForIslands(page);

  await page.getByRole("radio", { name: "3×3" }).click();
  await page.getByPlaceholder("Wpisz hasło…").fill(phrase);
  await page.getByRole("checkbox", { name: "Gwarantowane na planszy" }).check();
  await page.getByLabel("Liczba nagród: Inspiracja").fill("9");
  await page.getByRole("button", { name: "Generuj planszę" }).click();

  await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/i);
  await expect(page.getByLabel("Kod sesji")).toBeVisible();
  const code = (await page.getByLabel("Kod sesji").innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // Action — join as a player and claim the guaranteed phrase cell.
  await page.goto(`/play/${code}?join=1`);
  await waitForIslands(page);
  await page.getByLabel("Nick").fill(nick);
  await page.getByRole("button", { name: "Wejdź" }).click();

  await expect(page.getByRole("button", { name: `Zajmij pole: ${phrase}` })).toBeVisible();
  await page.getByRole("button", { name: `Zajmij pole: ${phrase}` }).click();

  // Assertion — claimed mystery cell shows the reward label (not the phrase).
  await expect(page.getByLabel("Nagroda: Inspiracja")).toBeVisible();

  // Cleanup — no session-delete UI in the product; orphan sessions are left
  // (same pattern as local integration runs against this backend).
});
