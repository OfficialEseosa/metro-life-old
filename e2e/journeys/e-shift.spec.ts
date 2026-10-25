import { expect, test } from "@playwright/test";
import { ledger, newPlayer, poll, quickPlay, serverSim, shot } from "../support/game";

test("e. walk to a workplace and work a shift", async ({ browser }, testInfo) => {
  const { context, page } = await newPlayer(browser, testInfo);
  await quickPlay(page);
  // The quick start arrives outside Ponce Works Market, which is open all day and hires a Kitchen Porter.
  const start = await serverSim(page);
  expect(start?.loc).toBe("ponce");
  expect(start?.job).toBeNull();

  await page.getByRole("button", { name: /^Career:/ }).dispatchEvent("click");
  const apply = page.locator(".job-card").filter({ hasText: "Kitchen Porter" }).getByRole("button", { name: /Apply in person/ });
  await expect(apply).toBeEnabled();
  await apply.dispatchEvent("click");

  // The sim walks in through the market door to the hiring desk and applies there.
  const hired = await poll(() => serverSim(page), (s) => !!s?.job, 600_000, 2000);
  expect(hired?.job?.title).toBe("Kitchen Porter");
  expect(hired?.position?.room).toBe("foodhall:ponce");
  await shot(page, testInfo, "e-hired");

  const work = page.locator(".walk-interact").filter({ hasText: "Work a shift" });
  await expect(work).toBeEnabled();
  await work.dispatchEvent("click");
  const working = await poll(() => serverSim(page), (s) => !!s?.busyUntil, 120_000, 1000);
  expect(working?.busyLabel).toBe("Work a shift");
  await shot(page, testInfo, "e-working");

  const paid = await poll(() => serverSim(page), (s) => !s?.busyUntil && (s?.job?.shifts ?? 0) > 0, 180_000, 2000);
  expect(paid?.job?.shifts).toBe(1);
  const wages = ledger(paid, "Wage: Work a shift");
  expect(wages).toHaveLength(1);
  expect(wages[0].amount).toBeGreaterThan(0);
  await shot(page, testInfo, "e-paid");
  await context.close();
});
