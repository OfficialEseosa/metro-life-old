import { expect, test, type Page } from "@playwright/test";
import { game, newPlayer, onlineCount, poll, quickPlay, shot, whoAmI } from "../support/game";

/** True when this page's city roster lists that player online in the city it is showing. */
const sees = (page: Page, id: string) =>
  game<boolean>(page, `(s) => s.players.some(p => p.id === ${JSON.stringify(id)} && p.online && p.city === s.sim.city)`);

test("c. two players see each other online in the same city", async ({ browser }, testInfo) => {
  const a = await newPlayer(browser, testInfo);
  const b = await newPlayer(browser, testInfo);
  // Both start in the default city (Atlanta) with the quick start.
  await Promise.all([quickPlay(a.page), quickPlay(b.page)]);
  const countA = await poll(() => onlineCount(a.page), (n) => n >= 2);
  const countB = await poll(() => onlineCount(b.page), (n) => n >= 2);
  expect(countA).toBeGreaterThanOrEqual(2);
  expect(countB).toBeGreaterThanOrEqual(2);
  // The count alone could include other residents online; each must see the other by id.
  const [idA, idB] = (await Promise.all([whoAmI(a.page), whoAmI(b.page)])).map((m) => m.id!);
  expect(idA).toBeTruthy();
  expect(idB).toBeTruthy();
  expect(await poll(() => sees(a.page, idB), Boolean)).toBe(true);
  expect(await poll(() => sees(b.page, idA), Boolean)).toBe(true);
  await shot(a.page, testInfo, "c-player-a");
  await shot(b.page, testInfo, "c-player-b");
  await a.context.close();
  await b.context.close();
});
