import { reachable, start } from "./backend";
import { API } from "./env";

export default async function globalSetup() {
  if (await reachable()) {
    console.log(`Using the API already running at ${API} (journey d will simulate the outage).`);
    return;
  }
  await start(true);
}
