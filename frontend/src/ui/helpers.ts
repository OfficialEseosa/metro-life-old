import { serverNow } from "../server-time";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { sound } from "./sound";
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
export function useTask(shared = false) {
  const acting = useStore((s) => s.acting);
  const [working, setWorking] = useState(false),
    [error, setError] = useState("");
  const guard = useRef(false);
  async function run(task: () => Promise<void>) {
    if (guard.current || (shared && useStore.getState().acting)) return;
    guard.current = true;
    if (shared) useStore.setState({ acting: true });
    const trigger =
      document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null;
    trigger?.setAttribute("aria-busy", "true");
    setWorking(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Try again.",
      );
      sound("error");
      requestAnimationFrame(() => {
        const alert = trigger
          ?.closest("form")
          ?.querySelector<HTMLElement>("[role=alert]");
        if (alert) {
          alert.tabIndex = -1;
          alert.focus();
        }
      });
    } finally {
      trigger?.removeAttribute("aria-busy");
      guard.current = false;
      if (shared) useStore.setState({ acting: false });
      setWorking(false);
    }
  }
  return {
    working: working || (shared && acting),
    error,
    run,
    clearError: () => setError(""),
  };
}
export function useNow() {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Raw script failures are never shown to players. */
const technical =
  /cannot read prop|undefined|null \(reading|is not a function|is not defined|unexpected token|networkerror|failed to fetch|load failed/i;
export function friendlyError(text: string) {
  if (!text) return "";
  if (technical.test(text))
    return "Something got in the way. Try that again in a moment.";
  return text;
}
