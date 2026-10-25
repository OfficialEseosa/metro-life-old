import { expect, test, type Page } from "@playwright/test";
import { game, ledger, newPlayer, onlineCount, poll, quickPlay, serverSim, shot, type ServerSim } from "../support/game";

type Kind = "wave" | "hangout" | "gift";
const GAIN: Record<Kind, number> = { wave: 2, hangout: 10, gift: 5 };

test("f. wave, hang out and gift both ways", async ({ browser }, testInfo) => {
  const a = await newPlayer(browser, testInfo);
  const b = await newPlayer(browser, testInfo);
  // Both quick starts arrive at the same spot outside Ponce Works Market, within reach of each other.
  await Promise.all([quickPlay(a.page), quickPlay(b.page)]);
  expect(await poll(() => onlineCount(a.page), (n) => n >= 2)).toBeGreaterThanOrEqual(2);
  expect(await poll(() => onlineCount(b.page), (n) => n >= 2)).toBeGreaterThanOrEqual(2);

  const send = async (from: Page, to: Page, kind: Kind) => {
    const [sender, target] = (await Promise.all([serverSim(from), serverSim(to)])) as ServerSim[];
    const name = target.username;
    const label = kind === "wave" ? `Wave to ${name}` : kind === "hangout" ? `Hang out with ${name}` : `Give ${name} a $25 gift`;
    const button = from.getByRole("button", { name: label, exact: true });
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await button.dispatchEvent("click");

    const text =
      kind === "wave"
        ? `${sender.username} waved to ${name}.`
        : kind === "hangout"
          ? `${sender.username} hung out with ${name}.`
          : `${sender.username} gave ${name} $25.`;
    const moved = (before: ServerSim, other: string) => (s: ServerSim | null) =>
      (s?.relationships[other]?.lastAt ?? 0) > (before.relationships[other]?.lastAt ?? 0);
    const [senderAfter, targetAfter] = (await Promise.all([
      poll(() => serverSim(from), moved(sender, target.userId), 60_000),
      poll(() => serverSim(to), moved(target, sender.userId), 60_000),
    ])) as ServerSim[];
    for (const [before, after, other] of [
      [sender, senderAfter, target.userId],
      [target, targetAfter, sender.userId],
    ] as const) {
      expect(after.relationships[other]?.lastGain).toBe(GAIN[kind]);
      expect(after.relationships[other]?.value).toBe(Math.min(100, (before.relationships[other]?.value ?? 0) + GAIN[kind]));
    }
    if (kind === "gift") {
      const paid = ledger(senderAfter, `Gift to ${name}`),
        received = ledger(targetAfter, `Gift from ${sender.username}`);
      expect(paid).toHaveLength(ledger(sender, `Gift to ${name}`).length + 1);
      expect(received).toHaveLength(ledger(target, `Gift from ${sender.username}`).length + 1);
      expect(paid.at(-1)?.amount).toBe(-25);
      expect(received.at(-1)?.amount).toBe(25);
    }
    // The receiver hears about it over the socket, not only the sender.
    const heard = await poll(() => game<string>(to, `(s) => s.socialNotice`), (n) => n === text, 30_000);
    expect(heard).toBe(text);
  };

  for (const kind of ["wave", "hangout", "gift"] as const) {
    await send(a.page, b.page, kind);
    await send(b.page, a.page, kind);
  }
  await shot(a.page, testInfo, "f-player-a");
  await shot(b.page, testInfo, "f-player-b");
  await a.context.close();
  await b.context.close();
});
