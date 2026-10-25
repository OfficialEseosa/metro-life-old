import { expect, test } from "@playwright/test";
import { createCharacter, game, newPlayer, poll, shot, simInfo } from "../support/game";

test("a. first start: create a character, arrive home, use the bed", async ({ browser }, testInfo) => {
  const { context, page } = await newPlayer(browser, testInfo);
  await createCharacter(page, "Robin Vale");
  await shot(page, testInfo, "a-arrived");
  const arrived = await simInfo(page);
  expect(arrived?.name).toBe("Robin Vale");

  // The creator path begins inside the studio. Leave and come back through the door.
  if (arrived?.room) {
    await page.getByRole("button", { name: /Leave home/ }).dispatchEvent("click");
    await poll(() => simInfo(page), (s) => !s?.room);
  }
  await game(page, `async () => (await import('/src/ui/walking-actions.ts')).enterHome()`);
  const inside = await poll(() => simInfo(page), (s) => !!s?.room?.startsWith("home"));
  expect(inside?.room).toMatch(/^home/);
  await shot(page, testInfo, "a-home");

  // Use the bed through the same object menu a tap on the bed opens.
  await game(
    page,
    `(s, m, i) => {
      return import('/src/navigation.ts').then(n => {
        const p = m.position, layout = n.roomLayout(s.sim.city, n.roomType(p.room));
        const station = layout.stations.find(x => x.action === 'sleep');
        const furniture = layout.furniture.find(f => f.slots.some(sl => sl.station === station.id)) ?? layout.furniture.find(f => f.kind === station.id);
        i.openObjectMenu({ kind: 'furniture', id: furniture?.id, stationId: station.id, city: s.sim.city, room: p.room, point: { x: station.x, z: station.z }, screen: { x: innerWidth / 2, y: innerHeight / 2 } });
      });
    }`,
  );
  const choice = page.locator(".object-pie-choice").filter({ hasText: /Sleep|Nap|Bed/i }).first();
  await expect(choice).toBeVisible();
  await choice.dispatchEvent("click");
  const busy = await poll(() => simInfo(page), (s) => !!s?.busy, 600_000, 2000);
  expect(busy?.busy).toBeTruthy();
  await shot(page, testInfo, "a-bed");
  await context.close();
});
