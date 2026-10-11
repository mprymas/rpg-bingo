// Risk — Revealed join QR must encode the canonical play URL. Assert the
// data-join-url payload; no camera and no second browser.
import { test, expect } from "@playwright/test";

/** Astro islands have hydrated when no `astro-island[ssr]` remains. */
async function waitForIslands(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
}

test("GM board QR encodes the canonical join URL", async ({ page }) => {
  const stamp = Date.now();
  const phrase = `E2E qr phrase ${stamp}`;

  // Setup — GM creates a small board and lands on the active session.
  await page.goto("/sessions/new");
  await waitForIslands(page);

  await page.getByRole("radio", { name: "3×3" }).click();
  await page.getByPlaceholder("Wpisz hasło…").fill(phrase);
  await page.getByRole("checkbox", { name: "Gwarantowane na planszy" }).check();
  await page.getByLabel("Liczba nagród na polach: Inspiracja").fill("9");
  await page.getByRole("button", { name: "Generuj planszę" }).click();

  await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/i);
  await expect(page.getByLabel("Kod sesji")).toBeVisible();
  const code = (await page.getByLabel("Kod sesji").innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  test.info().annotations.push({ type: "test-data", description: code });

  // Action — hydrated show control reveals the payload wrapper.
  await waitForIslands(page);
  await page.getByRole("button", { name: "Pokaż kod QR" }).click();

  // Assertion — canonical join URL for this session's code and page origin.
  const origin = new URL(page.url()).origin;
  await expect(page.locator("[data-join-url]")).toHaveAttribute("data-join-url", `${origin}/play/${code}?join=1`);
});
