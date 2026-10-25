import { expect, test } from "@playwright/test";
import { newPlayer, onlineCount, poll, quickPlay, shot } from "../support/game";

test("c. two players see each other online in the same city", async ({ browser }, testInfo) => {
  const a = await newPlayer(browser, testInfo);
  const b = await newPlayer(browser, testInfo);
  // Both start in the default city (Atlanta) with the quick start.
  await Promise.all([quickPlay(a.page), quickPlay(b.page)]);
  const countA = await poll(() => onlineCount(a.page), (n) => n >= 2);
  const countB = await poll(() => onlineCount(b.page), (n) => n >= 2);
  expect(countA).toBeGreaterThanOrEqual(2);
  expect(countB).toBeGreaterThanOrEqual(2);
  await shot(a.page, testInfo, "c-player-a");
  await shot(b.page, testInfo, "c-player-b");
  await a.context.close();
  await b.context.close();
});
