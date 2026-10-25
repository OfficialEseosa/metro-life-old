import { expect, test } from "@playwright/test";
import { ledger, newPlayer, playing, poll, quickPlay, serverSim, shot, simInfo } from "../support/game";

test("g. fly to another city", async ({ browser }, testInfo) => {
  const { context, page } = await newPlayer(browser, testInfo);
  await quickPlay(page);
  const start = await serverSim(page);
  expect(start?.city).toBe("atl");

  await page.getByRole("button", { name: /^City:/ }).dispatchEvent("click");
  await page.getByRole("button", { name: /Travel between cities/ }).dispatchEvent("click");
  // Flights leave from the airport: take the map shortcut there first.
  await page.getByRole("button", { name: /Go to Peach Field International/ }).first().dispatchEvent("click");
  const atAirport = await poll(() => serverSim(page), (s) => s?.loc === "atlAirport" && !s.busyUntil, 120_000);
  expect(atAirport?.loc).toBe("atlAirport");

  const review = page.locator('section[aria-label="Trips to New York"]').getByRole("button", { name: /Review flight/ });
  await expect(review).toBeEnabled();
  await review.dispatchEvent("click");
  const book = page.getByRole("group", { name: "Review your trip" }).getByRole("button", { name: /Book flight/ });
  await expect(book).toBeEnabled();
  await book.dispatchEvent("click");
  const confirm = page.getByRole("dialog", { name: "Confirm purchase" });
  await expect(confirm).toContainText("Plane ticket to New York");
  await confirm.getByRole("button", { name: /^Pay / }).dispatchEvent("click");

  const booked = await poll(() => serverSim(page), (s) => !!s?.trip, 60_000, 500);
  expect(booked?.trip).toMatchObject({ mode: "plane", to: "nyc" });
  expect(ledger(booked, "Plane fare to New York").map((e) => e.amount)).toEqual([-booked!.trip!.fare]);
  await expect(page.getByRole("dialog", { name: "Flight to New York" })).toBeVisible();
  await shot(page, testInfo, "g-flight");

  const landed = await poll(() => serverSim(page), (s) => s?.city === "nyc" && !s.trip, 180_000);
  expect(landed?.loc).toBe("nycAirport");
  await expect(playing(page)).toBeVisible({ timeout: 300_000 });
  const shown = await poll(() => simInfo(page), (s) => s?.city === "nyc", 120_000);
  expect(shown?.city).toBe("nyc");
  await shot(page, testInfo, "g-arrived");
  await context.close();
});
