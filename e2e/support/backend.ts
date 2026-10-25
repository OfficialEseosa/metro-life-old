import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { API, OUTPUT, PORT, ROOT } from "./env";

const pidFile = resolve(OUTPUT, "backend.pid");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function reachable() {
  try {
    return (await fetch(`${API}/api/version`, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
}

/** True when the journeys started the API themselves and may stop and restart it. */
export const managed = () => existsSync(pidFile);

/** Start the API jar from backend/target on the e2e port with its own save file. */
export async function start(fresh = false) {
  mkdirSync(OUTPUT, { recursive: true });
  const data = resolve(OUTPUT, "metro-e2e.json");
  if (fresh) rmSync(data, { force: true });
  const target = resolve(ROOT, "backend", "target");
  const jar = existsSync(target) && readdirSync(target).find((f) => /^backend-.*\.jar$/.test(f));
  if (!jar) throw new Error("Build the API first: (cd backend && mvn -q package)");
  const child = spawn("java", ["-jar", resolve(target, jar)], {
    env: { ...process.env, PORT, METRO_DATA: data },
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  writeFileSync(pidFile, String(child.pid));
  for (let i = 0; i < 240; i++) {
    if (await reachable()) return;
    await sleep(500);
  }
  throw new Error(`The API did not start on ${API}`);
}

export async function stop() {
  if (!managed()) return;
  const pid = Number(readFileSync(pidFile, "utf8"));
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* Already gone. */
  }
  for (let i = 0; i < 120 && (await reachable()); i++) await sleep(500);
  rmSync(pidFile, { force: true });
}
