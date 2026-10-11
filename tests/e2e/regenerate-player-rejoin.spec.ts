// Risk — After MG regenerates a board, a joined player on the old code must
// auto-rejoin the successor without re-entering the nick form.
import { test, expect } from "@playwright/test";

/** Astro islands have hydrated when no `astro-island[ssr]` remains. */
async function waitForIslands(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
}

test("MG regenerate moves joined player onto the new session code", async ({ page, browser }) => {
  const stamp = Date.now();
  const phrase = `E2E regen phrase ${stamp}`;
  const nick = `e2eregen${stamp}`.slice(0, 24);

  // Setup — GM creates a small board with a guaranteed phrase for identity checks.
  await page.goto("/sessions/new");
  await waitForIslands(page);

  await page.getByRole("radio", { name: "3×3" }).click();
  await page.getByPlaceholder("Wpisz hasło…").fill(phrase);
  await page.getByRole("checkbox", { name: "Gwarantowane na planszy" }).check();
  await page.getByLabel("Liczba nagród na polach: Inspiracja").fill("9");
  await page.getByRole("button", { name: "Generuj planszę" }).click();

  await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/i);
  await expect(page.getByLabel("Kod sesji")).toBeVisible();
  const oldCode = (await page.getByLabel("Kod sesji").innerText()).trim();
  expect(oldCode).toMatch(/^[A-Z0-9]{6}$/);
  test.info().annotations.push({ type: "test-data", description: `old=${oldCode}` });

  // Player joins the old board in a separate unauthenticated context.
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  try {
    await playerPage.goto(`/play/${oldCode}?join=1`);
    await waitForIslands(playerPage);
    await playerPage.getByLabel("Nick").fill(nick);
    await playerPage.getByRole("button", { name: "Wejdź" }).click();
    await expect(playerPage.getByRole("button", { name: `Zajmij pole: ${phrase}` })).toBeVisible();
    await expect(playerPage).toHaveURL(new RegExp(`/play/${oldCode}$`, "i"));

    // Action — MG confirms regenerate, submits create-with-replace.
    await page.getByRole("button", { name: "Wygeneruj nową planszę" }).click();
    await page.getByRole("button", { name: "Kontynuuj" }).click();
    await page.waitForURL(/\/sessions\/new\?from=/i);
    await waitForIslands(page);
    await page.getByRole("button", { name: "Generuj planszę" }).click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]{36}/i);
    await expect(page.getByLabel("Kod sesji")).toBeVisible();
    const newCode = (await page.getByLabel("Kod sesji").innerText()).trim();
    expect(newCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(newCode).not.toBe(oldCode);
    test.info().annotations.push({ type: "test-data", description: `new=${newCode}` });

    // Assertion — player poll + auto-rejoin lands on the successor board.
    await expect(playerPage).toHaveURL(new RegExp(`/play/${newCode}`, "i"), { timeout: 20_000 });
    await waitForIslands(playerPage);
    await expect(playerPage.getByText(nick, { exact: true }).first()).toBeVisible();
    await expect(playerPage.getByText("Sesja zamknięta")).toHaveCount(0);
  } finally {
    await playerContext.close();
  }
});
