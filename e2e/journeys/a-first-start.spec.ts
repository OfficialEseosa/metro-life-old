import { expect, test } from "@playwright/test";
import { createCharacter, game, newPlayer, poll, serverSim, shot, simInfo, uniqueName } from "../support/game";

test("a. first start: create a character, arrive home, use the bed", async ({ browser }, testInfo) => {
  const { context, page } = await newPlayer(browser, testInfo);
  const name = uniqueName("Robin");
  await createCharacter(page, name);
  await shot(page, testInfo, "a-arrived");
  const arrived = await simInfo(page);
  expect(arrived?.name).toBe(name);

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
  const before = await serverSim(page);
  expect(before?.needs.energy).toBeLessThan(100);
  await choice.dispatchEvent("click");
  // A home action keeps the sim busy for only a few seconds, so watch for its outcome on the
  // server (every action grants 15 XP; sleep restores all energy) instead of racing that window.
  const slept = await poll(() => serverSim(page), (s) => (s?.xp ?? 0) > (before?.xp ?? 0), 600_000, 2000);
  expect(slept?.xp).toBe((before?.xp ?? 0) + 15);
  expect(slept?.needs.energy).toBeGreaterThan(99);
  expect(slept?.loc).toBe("home");
  await shot(page, testInfo, "a-bed");
  await context.close();
});
