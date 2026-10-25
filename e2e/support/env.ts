import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FRONT = process.env.E2E_FRONT ?? "http://127.0.0.1:5190/";
export const API = process.env.E2E_API ?? "http://127.0.0.1:8090";
export const PORT = new URL(API).port || "8090";
export const FRONT_PORT = new URL(FRONT).port || "5190";
export const OUTPUT = resolve(ROOT, "e2e", "output");
/** Save file for an API the journeys start themselves. */
export const DATA = process.env.E2E_DATA ?? resolve(OUTPUT, "metro-e2e.json");
export const SHOTS = process.env.E2E_SHOTS ?? resolve(OUTPUT, "shots");
/** Low scene quality makes software-rendered runs much faster; set E2E_QUALITY=normal to keep full quality. */
export const QUALITY = process.env.E2E_QUALITY ?? "low";
