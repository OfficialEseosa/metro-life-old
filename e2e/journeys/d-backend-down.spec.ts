import { expect, test } from "@playwright/test";
import { managed, start, stop } from "../support/backend";
import { API } from "../support/env";
import { newPlayer, playing, quickPlay, shot, simInfo } from "../support/game";

test("d. backend stopped shows the reconnect screens and recovers", async ({ browser }, testInfo) => {
  const { context, page } = await newPlayer(browser, testInfo);
  await quickPlay(page);
  const before = await simInfo(page);

  // A real stop when the journeys own the API; otherwise the outage is simulated in the browser.
  const real = managed();
  const down = async () => {
    if (real) await stop();
    else await context.route(`${API}/**`, (route) => route.abort());
  };
  const up = async () => {
    if (real) await start();
    else await context.unroute(`${API}/**`);
  };

  await down();
  await expect(page.getByText(/Reconnecting|Connection lost/i).first()).toBeVisible({ timeout: 180_000 });
  await shot(page, testInfo, "d-reconnecting");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText(/taking a breather/i).first()).toBeVisible({ timeout: 180_000 });
  await shot(page, testInfo, "d-unreachable");

  await up();
  await page.getByRole("button", { name: /Try now/ }).dispatchEvent("click").catch(() => {});
  await expect(playing(page)).toBeVisible({ timeout: 300_000 });
  expect((await simInfo(page))?.id).toBe(before?.id);
  await shot(page, testInfo, "d-recovered");
  await context.close();
});
