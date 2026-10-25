import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { API, DATA, OUTPUT, PORT, ROOT } from "./env";

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
  mkdirSync(dirname(DATA), { recursive: true });
  if (fresh) rmSync(DATA, { force: true });
  const target = resolve(ROOT, "backend", "target");
  const jar = existsSync(target) && readdirSync(target).find((f) => /^backend-.*\.jar$/.test(f));
  if (!jar) throw new Error("Build the API first: (cd backend && mvn -q package)");
  const child = spawn("java", ["-jar", resolve(target, jar)], {
    env: { ...process.env, PORT, METRO_DATA: DATA },
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

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * Stop the API and wait for the process itself to be gone: a paused connector already refuses new
 * requests while open sockets keep streaming, which would leave the game looking connected.
 */
export async function stop() {
  if (!managed()) return;
  const pid = Number(readFileSync(pidFile, "utf8"));
  const started = Date.now();
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* Already gone. */
  }
  for (let i = 0; i < 40 && alive(pid); i++) await sleep(500);
  if (alive(pid)) {
    console.warn(`The API ignored SIGTERM for ${Math.round((Date.now() - started) / 1000)} s; killing it.`);
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* Gone meanwhile. */
    }
    for (let i = 0; i < 40 && alive(pid); i++) await sleep(250);
  }
  for (let i = 0; i < 20 && (await reachable()); i++) await sleep(500);
  rmSync(pidFile, { force: true });
}
