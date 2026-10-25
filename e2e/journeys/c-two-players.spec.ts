import { expect, test } from "@playwright/test";
import { game, newPlayer, poll, quickPlay, shot, simInfo } from "../support/game";

const online = (page: import("@playwright/test").Page) =>
  game<{ id: string; city: string }[]>(page, `(s) => s.players.filter(p => p.online && !p.npc).map(p => ({ id: p.id, city: p.city }))`);

test("c. two players see each other online in the same city", async ({ browser }, testInfo) => {
  const a = await newPlayer(browser, testInfo);
  const b = await newPlayer(browser, testInfo);
  await Promise.all([quickPlay(a.page), quickPlay(b.page)]);
  const [simA, simB] = await Promise.all([simInfo(a.page), simInfo(b.page)]);
  expect(simA?.city).toBe(simB?.city);
  const seenByA = await poll(() => online(a.page), (list) => list.some((p) => p.id === simB?.id));
  const seenByB = await poll(() => online(b.page), (list) => list.some((p) => p.id === simA?.id));
  expect(seenByA.some((p) => p.id === simB?.id)).toBe(true);
  expect(seenByB.some((p) => p.id === simA?.id)).toBe(true);
  await shot(a.page, testInfo, "c-player-a");
  await shot(b.page, testInfo, "c-player-b");
  await a.context.close();
  await b.context.close();
});
