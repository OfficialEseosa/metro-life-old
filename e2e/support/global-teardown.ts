import { stop } from "./backend";

export default async function globalTeardown() {
  await stop();
}
