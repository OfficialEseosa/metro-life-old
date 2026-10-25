import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { useStore } from "../store";
import { Icon } from "./primitives";
import { NEED_ICONS, NEED_LABELS } from "./needs";
import { sound } from "./sound";

/** A critical need, five seconds after it drops below 15. Dismissable; never stacks over other news. */
export function NeedWarning() {
  const social = useStore((s) => !!s.socialNotice),
    critical = useStore((s) =>
      s.sim
        ? (Object.entries(s.sim.needs)
            .sort((a, b) => a[1] - b[1])
            .find(([, value]) => value < 15)?.[0] ?? "")
        : "",
    ),
    blocked = useStore(
      (s) =>
        !!s.lastResult ||
        !!s.sim?.pendingBeat ||
        ["creator", "settings", "city"].includes(s.panel ?? ""),
    ),
    [shown, setShown] = useState(""),
    dismissed = useStore((s) => s.needWarningDismissed),
    setDismissed = useStore((s) => s.dismissNeedWarning);
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setShown(critical);
        if (!critical) setDismissed("");
        if (critical) sound("low");
      },
      critical ? 5000 : 0,
    );
    return () => clearTimeout(timer);
  }, [critical, setDismissed]);
  if (
    !critical ||
    shown !== critical ||
    dismissed === critical ||
    blocked ||
    social
  )
    return null;
  const home = critical === "energy" || critical === "social";
  return (
    <div className={`hud-toast need-warning ${critical}`} role="status">
      <span className={`semantic-tile ${critical}`}>
        <Icon name={NEED_ICONS[critical] ?? "warning"} />
      </span>
      <div>
        <strong>{NEED_LABELS[critical] ?? critical} is very low</strong>
        <p>
          {home ? "Recharge at home." : "Find a place that helps."} Low needs
          reduce your pay.
        </p>
        <button
          className="text-button"
          onClick={() => {
            setDismissed(critical);
            if (home) {
              useStore.getState().selectLocation("home");
              useStore.getState().setFocus("home");
            } else {
              useStore
                .getState()
                .setMapLens(critical === "hunger" ? "eat" : "fun");
              useStore.getState().setSearchOpen(true);
            }
          }}
        >
          {home ? "Go home" : "Find a place"}
        </button>
      </div>
      <button
        className="icon-button"
        aria-label="Dismiss need warning"
        onClick={() => setDismissed(critical)}
      >
        <X size={20} weight="bold" />
      </button>
    </div>
  );
}
