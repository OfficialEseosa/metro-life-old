import { expect, test } from "@playwright/test";
import { newPlayer, playing, quickPlay, shot, whoAmI } from "../support/game";

test("b. reload resumes the same life", async ({ browser }, testInfo) => {
  const { context, page } = await newPlayer(browser, testInfo);
  await quickPlay(page);
  const before = await whoAmI(page);
  expect(before?.id).toBeTruthy();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(playing(page)).toBeVisible({ timeout: 300_000 });
  const after = await whoAmI(page);
  expect(after?.id).toBe(before?.id);
  await shot(page, testInfo, "b-resumed");
  await context.close();
});
