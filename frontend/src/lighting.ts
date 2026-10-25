import { serverNow } from "./server-time";
import { useEffect, useState } from "react";
import { useStore } from "./store";

const currentNight = () => {
  const { sceneTheme: theme, clock } = useStore.getState();
  const minutes = clock
    ? clock.hour * 60 +
      clock.minute +
      Math.max(0, serverNow() - clock.at) / clock.msPerMinute
    : 660;
  const hour = Math.floor((minutes % 1440) / 60);
  return theme === "night" || (theme === "auto" && (hour < 6 || hour >= 19));
};
/** Notify the scene only when the light actually changes. */
export function useNightLighting() {
  const [night, setNight] = useState(currentNight);
  useEffect(() => {
    const update = () => setNight(currentNight());
    const off = useStore.subscribe((s, previous) => {
      if (s.sceneTheme !== previous.sceneTheme || s.clock !== previous.clock)
        update();
    });
    const timer = setInterval(update, 1000);
    update();
    return () => {
      off();
      clearInterval(timer);
    };
  }, []);
  return night;
}
