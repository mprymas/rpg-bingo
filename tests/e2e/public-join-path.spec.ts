// Risk #10 — Player enters a valid session code and nick on the public join
// path but never reaches the shared board (stuck on form, bad redirect, empty board).
// Facet: home code entry → nick → board with free cells. Seed covers claim via
// deep-link only (`/play/{code}?join=1`); this spec exercises JoinSessionForm.
import { test, expect } from "@playwright/test";

/** Astro islands have hydrated when no `astro-island[ssr]` remains. */
async function waitForIslands(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
}

test("public join path reaches shared board from home code entry", async ({ page }) => {
  const stamp = Date.now();
  const phrase = `E2E join phrase ${stamp}`;
  const nick = `e2ejoin${stamp}`.slice(0, 24);

  // Setup — GM creates a 3×3 board with a guaranteed phrase so the board is
  // findable by accessible name after the public join path.
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
  test.info().annotations.push({ type: "test-data", description: code });

  // Action — drop GM auth so `/` stays the public home, then enter code + nick
  // through JoinSessionForm (not a deep-link).
  await page.context().clearCookies();
  await page.goto("/");
  await waitForIslands(page);

  await page.getByLabel("Kod sesji").fill(code);
  await page.getByRole("button", { name: "Dołącz" }).click();

  await page.waitForURL(new RegExp(`/play/${code}\\?join=1`, "i"));
  await waitForIslands(page);
  await page.getByLabel("Nick").fill(nick);
  await page.getByRole("button", { name: "Wejdź" }).click();

  // Assertion — player identity and free cells are on the shared board
  // (not stuck on the nick form / empty after a bad redirect).
  await expect(page.getByRole("button", { name: `Zajmij pole: ${phrase}` })).toBeVisible();
  await expect(page.getByText(nick, { exact: true }).first()).toBeVisible();
  await expect(page).not.toHaveURL(/\?join=1/);

  // Cleanup — no session-delete UI in the product; orphan sessions are left
  // (same pattern as local integration runs against this backend).
});
