import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { QUALITY, SHOTS } from "./env";

/**
 * Helpers for driving the real game in a software-rendered browser. Clicks on overlay buttons use
 * dispatchEvent because pointer input waits for animation frames, which arrive seconds apart there.
 */
export const playing = (page: Page) => page.locator(".metro-hud.is-playing");

export async function newPlayer(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext(testInfo.project.use);
  await prepare(context);
  const page = await context.newPage();
  return { context, page };
}

export async function prepare(context: BrowserContext) {
  await context.addInitScript((quality) => {
    try {
      localStorage.setItem("metro-quality", quality);
    } catch {
      /* Private mode: full quality. */
    }
  }, QUALITY);
}

export async function shot(page: Page, testInfo: TestInfo, name: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${testInfo.project.name}-${name}.png`, timeout: 180_000 }).catch(() => {});
}

export async function openTitle(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".quick-start-play, .metro-hud.is-playing").first()).toBeVisible({ timeout: 180_000 });
}

/** Click through the arrival cards until the city is playable. */
export async function finishArrival(page: Page) {
  for (let i = 0; i < 8; i++) {
    if (await playing(page).count()) return;
    const next = page.locator(".intro-story button.primary");
    await next.first().waitFor({ timeout: 300_000 }).catch(() => {});
    if (await playing(page).count()) return;
    await next.first().dispatchEvent("click").catch(() => {});
  }
  await expect(playing(page)).toBeVisible({ timeout: 300_000 });
}

/** Quick start: Play with the suggested look. */
export async function quickPlay(page: Page) {
  await openTitle(page);
  if (!(await playing(page).count())) {
    await page.locator(".quick-start-play").dispatchEvent("click");
    await finishArrival(page);
  }
}

/** Full creator: name, city, arrival. */
export async function createCharacter(page: Page, name: string) {
  await openTitle(page);
  await page.getByRole("button", { name: /Make every detail my own/ }).dispatchEvent("click");
  await page.fill("#life-name", name);
  await page.getByRole("button", { name: /Choose my city/ }).dispatchEvent("click");
  await page.getByRole("button", { name: /^Begin in/ }).dispatchEvent("click");
  await finishArrival(page);
}

/** Read a value from the running game (Vite dev server modules). */
export function game<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(
    `(async () => {
      const store = (await import('/src/store.ts')).useStore.getState();
      const motion = (await import('/src/walking.ts')).motion;
      const interactions = await import('/src/interactions.ts');
      return (${fn})(store, motion, interactions);
    })()`,
  ) as Promise<T>;
}

export const simInfo = (page: Page) =>
  game<{ id: string; name: string; city: string; loc: string; room: string | null; busy: string | null } | null>(
    page,
    `(s, m) => s.sim && { id: s.sim.userId, name: s.sim.username, city: s.sim.city, loc: s.sim.loc, room: m.position?.room ?? null, busy: s.sim.busyLabel ?? null }`,
  );

export async function poll<T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeout = 240_000, every = 1000) {
  const end = Date.now() + timeout;
  let value = await fn();
  while (!ok(value) && Date.now() < end) {
    await new Promise((r) => setTimeout(r, every));
    value = await fn();
  }
  return value;
}
