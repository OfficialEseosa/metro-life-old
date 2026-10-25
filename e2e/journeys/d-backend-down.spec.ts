import { expect, test, type WebSocketRoute } from "@playwright/test";
import { managed, start, stop } from "../support/backend";
import { API } from "../support/env";
import { newPlayer, playing, quickPlay, shot, whoAmI } from "../support/game";

test("d. backend stopped shows the reconnect screens and recovers", async ({ browser }, testInfo) => {
  const { context, page } = await newPlayer(browser, testInfo);
  // A real stop when the journeys own the API; otherwise the outage is simulated in the browser.
  const real = managed();
  // The reconnect banner follows the live socket, which HTTP routes do not touch, so a simulated
  // outage also has to cut the sockets that are already open.
  const sockets: WebSocketRoute[] = [];
  let offline = false;
  if (!real)
    await context.routeWebSocket(
      (url) => url.host === new URL(API).host && url.pathname === "/ws",
      (ws) => {
        if (offline) return ws.close();
        ws.connectToServer();
        sockets.push(ws);
      },
    );
  await quickPlay(page);
  const before = await whoAmI(page);

  const down = async () => {
    if (real) return stop();
    offline = true;
    await context.route(`${API}/**`, (route) => route.abort());
    await Promise.all(sockets.splice(0).map((ws) => ws.close()));
  };
  const up = async () => {
    if (real) return start();
    offline = false;
    await context.unroute(`${API}/**`);
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
  expect((await whoAmI(page))?.id).toBe(before?.id);
  await shot(page, testInfo, "d-recovered");
  await context.close();
});
