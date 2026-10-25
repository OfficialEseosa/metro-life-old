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

type Me = { user?: { id?: string; name?: string } | null; sim?: ServerSim | null };
export type ServerSim = {
  userId: string;
  username: string;
  city: string;
  loc: string;
  cash: number;
  busyUntil: number | null;
  busyLabel: string | null;
  position: { x: number; z: number; place: string; room: string | null } | null;
  job: { id: string; title: string; track: string; shifts: number } | null;
  trip: { id: string; mode: string; to: string; fare: number } | null;
  relationships: Record<string, { value: number; lastGain: number; lastAt: number }>;
  economy: { entries: { id: string; at: number; amount: number; reason: string }[] };
};

/** Money journal entries with this reason, oldest first. */
export const ledger = (sim: ServerSim | null, reason: string) =>
  sim?.economy?.entries.filter((e) => e.reason === reason) ?? [];

/** GET /api/auth/me from inside the page, with the same cookie or header session the game uses. */
async function me(page: Page): Promise<Me> {
  const { API } = await import("./env");
  return page.evaluate(async (api) => {
    const token = localStorage.getItem("metro:session");
    const res = await fetch(`${api}/api/auth/me`, {
      credentials: "include",
      headers: token ? { "X-Metro-Session": token } : {},
    });
    return res.json();
  }, API);
}

/** The signed-in user as the API sees this browser (cookie or header session). */
export async function whoAmI(page: Page) {
  const r = await me(page);
  return { id: r?.user?.id ?? null, name: r?.sim?.username ?? r?.user?.name ?? null };
}

/** The player's sim as the API stores it, not as the page last rendered it. */
export const serverSim = async (page: Page) => (await me(page))?.sim ?? null;

/** Number shown in the HUD status, for example "2 online · 40 residents". */
export async function onlineCount(page: Page) {
  const text = (await page.locator("text=/\\d+ online/").first().textContent().catch(() => "")) ?? "";
  return Number(/(\d+) online/.exec(text)?.[1] ?? 0);
}
