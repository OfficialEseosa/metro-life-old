import { expect, test } from "@playwright/test";
import { newPlayer, playing, quickPlay, shot, simInfo } from "../support/game";

test("b. reload resumes the same life", async ({ browser }, testInfo) => {
  const { context, page } = await newPlayer(browser, testInfo);
  await quickPlay(page);
  const before = await simInfo(page);
  expect(before?.id).toBeTruthy();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(playing(page)).toBeVisible({ timeout: 300_000 });
  const after = await simInfo(page);
  expect(after?.id).toBe(before?.id);
  expect(after?.name).toBe(before?.name);
  await shot(page, testInfo, "b-resumed");
  await context.close();
});
