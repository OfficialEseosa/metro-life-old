import { chromium } from "@playwright/test";
import { reachable, start } from "./backend";
import { API, FRONT } from "./env";

/**
 * On a cold cache the dev server optimises dependencies during the first page load and then
 * reloads that page, which would throw away whatever the first journey had typed. Let it happen here.
 */
async function warmFront() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const title = page.locator(".quick-start-play, .metro-hud.is-playing").first();
    await page.goto(FRONT, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await title.waitFor({ timeout: 180_000 });
    await page.waitForTimeout(10_000);
    await title.waitFor({ timeout: 180_000 });
  } catch (error) {
    console.warn(`Could not warm the dev server: ${error}`);
  } finally {
    await browser.close();
  }
}

export default async function globalSetup() {
  if (await reachable()) {
    console.log(`Using the API already running at ${API} (journey d will simulate the outage).`);
  } else {
    await start(true);
  }
  await warmFront();
}
