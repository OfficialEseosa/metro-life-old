import { serverNow } from "./server-time";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { useStore } from "./store";

/**
 * Continuous time of day. One mutable palette is interpolated from keyframes
 * by game minute; scene code reads it every frame without React renders.
 */
type Key = {
  at: number;
  sunElevation: number;
  sunAzimuth: number;
  sun: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  skyTop: string;
  skyBottom: string;
  fog: string;
  env: number;
  exposure: number;
  saturation: number;
  vignette: number;
  shadowTint: string;
  highlightTint: string;
  shadowIntensity: number;
  ground: string;
};
const night: Omit<Key, "at"> = {
  sunElevation: 55,
  sunAzimuth: 200,
  sun: "#a9c0ff",
  sunIntensity: 1.15,
  hemiSky: "#9fb2ea",
  hemiGround: "#3a3550",
  hemiIntensity: 0.8,
  skyTop: "#1b2a55",
  skyBottom: "#4b4f80",
  fog: "#2e3760",
  env: 0.4,
  exposure: 1.12,
  saturation: 0.9,
  vignette: 0.1,
  shadowTint: "#3a4a8a",
  highlightTint: "#ffd2a0",
  shadowIntensity: 0.7,
  ground: "#5c7f68",
};
const day: Omit<Key, "at"> = {
  sunElevation: 58,
  sunAzimuth: 185,
  sun: "#fff0d6",
  sunIntensity: 3.0,
  hemiSky: "#cfe6ff",
  hemiGround: "#a08a6a",
  hemiIntensity: 0.65,
  skyTop: "#6fb3e8",
  skyBottom: "#dcebf2",
  fog: "#d6e6ee",
  env: 0.55,
  exposure: 1.0,
  saturation: 1.1,
  vignette: 0.05,
  shadowTint: "#5a4a8a",
  highlightTint: "#ffd9a0",
  shadowIntensity: 0.8,
  ground: "#86b86a",
};
const keys: Key[] = [
  { at: 0, ...night },
  { at: 270, ...night, sunAzimuth: 240 },
  {
    at: 360,
    sunElevation: 8,
    sunAzimuth: 75,
    sun: "#ffc9a8",
    sunIntensity: 2.2,
    hemiSky: "#dcd6f5",
    hemiGround: "#7c6f86",
    hemiIntensity: 0.6,
    skyTop: "#8aa6d6",
    skyBottom: "#f6c6c0",
    fog: "#e9d3d6",
    env: 0.45,
    exposure: 1.0,
    saturation: 1.04,
    vignette: 0.07,
    shadowTint: "#6a4a8a",
    highlightTint: "#ffc9a8",
    shadowIntensity: 0.75,
    ground: "#82b06c",
  },
  {
    at: 510,
    ...day,
    sunElevation: 32,
    sunAzimuth: 128,
    sun: "#ffe6c8",
    sunIntensity: 2.8,
    hemiSky: "#d6e4fb",
    hemiGround: "#958571",
    skyTop: "#7cb1e3",
    skyBottom: "#e6e4e6",
    fog: "#dfe3ea",
  },
  { at: 720, ...day, sunAzimuth: 215 },
  { at: 900, ...day, sunElevation: 50, sunAzimuth: 238 },
  {
    at: 1050,
    sunElevation: 15,
    sunAzimuth: 255,
    sun: "#ffbe7a",
    sunIntensity: 3.4,
    hemiSky: "#ffe2c4",
    hemiGround: "#7d6a8c",
    hemiIntensity: 0.8,
    skyTop: "#86a3d8",
    skyBottom: "#ffd09a",
    fog: "#f6d2ae",
    env: 0.5,
    exposure: 1.05,
    saturation: 1.14,
    vignette: 0.07,
    shadowTint: "#6a4a8a",
    highlightTint: "#ffb070",
    shadowIntensity: 0.8,
    ground: "#8cb565",
  },
  {
    at: 1155,
    sunElevation: 2,
    sunAzimuth: 275,
    sun: "#ff8a6b",
    sunIntensity: 1.5,
    hemiSky: "#b9a8d8",
    hemiGround: "#4a4060",
    hemiIntensity: 0.75,
    skyTop: "#4a5a9a",
    skyBottom: "#f29e8e",
    fog: "#b49aa8",
    env: 0.42,
    exposure: 1.08,
    saturation: 1.0,
    vignette: 0.09,
    shadowTint: "#4a3a7a",
    highlightTint: "#ff9a70",
    shadowIntensity: 0.72,
    ground: "#7a9f6c",
  },
  { at: 1230, ...night, sunAzimuth: 140 },
  { at: 1440, ...night, sunAzimuth: 200 },
];

export type Palette = {
  minutes: number;
  sunElevation: number;
  sunAzimuth: number;
  /** Direction from the scene towards the sun (or moon), unit length. */
  sunDirection: THREE.Vector3;
  sun: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  skyTop: THREE.Color;
  skyBottom: THREE.Color;
  fog: THREE.Color;
  env: number;
  exposure: number;
  saturation: number;
  vignette: number;
  shadowTint: THREE.Color;
  highlightTint: THREE.Color;
  shadowIntensity: number;
  ground: THREE.Color;
  /** 0 by day, 1 at night. */
  nightFactor: number;
  /** Window and street-lamp multiplier, 0 by day and 1 after dark. */
  lights: number;
  /** Sun disc visibility in the sky shader (0 at night). */
  sunDisc: number;
  /** Bumped when the palette changes enough to refresh baked sky light. */
  revision: number;
};
const colour = () => new THREE.Color();
export const timeOfDay: Palette = {
  minutes: 720,
  sunElevation: 58,
  sunAzimuth: 185,
  sunDirection: new THREE.Vector3(0, 1, 0),
  sun: colour(),
  sunIntensity: 3,
  hemiSky: colour(),
  hemiGround: colour(),
  hemiIntensity: 0.6,
  skyTop: colour(),
  skyBottom: colour(),
  fog: colour(),
  env: 0.5,
  exposure: 1,
  saturation: 1.1,
  vignette: 0.05,
  shadowTint: colour(),
  highlightTint: colour(),
  shadowIntensity: 0.8,
  ground: colour(),
  nightFactor: 0,
  lights: 0,
  sunDisc: 1,
  revision: 0,
};
/** Shared shader uniforms: every window, lamp pool and headlight reads the same value. */
export const lightUniforms = {
  lights: { value: 0 },
  night: { value: 0 },
};
const a = new THREE.Color(),
  b = new THREE.Color(),
  lastRefresh = { top: new THREE.Color(-1, -1, -1), minutes: -999 };
let override: number | null = null;
/** Development and verification hook: pin the clock to a game minute. */
export function setTimeOverride(minutes: number | null) {
  override = minutes;
  lastMinute = -1;
}
const smooth = (x: number) => x * x * (3 - 2 * x);
const ramp = (m: number, from: number, to: number) =>
  smooth(THREE.MathUtils.clamp((m - from) / (to - from), 0, 1));

export function gameMinutes() {
  if (override !== null) return override;
  const { sceneTheme: theme, clock } = useStore.getState();
  if (theme === "day") return 750;
  if (theme === "night") return 1350;
  if (!clock) return 690;
  const minutes =
    clock.hour * 60 +
    clock.minute +
    Math.max(0, serverNow() - clock.at) / clock.msPerMinute;
  return ((minutes % 1440) + 1440) % 1440;
}

function lerpHex(
  target: THREE.Color,
  from: string,
  to: string,
  t: number,
) {
  // Lerp in linear space so warm and cool keys mix without muddy greys.
  a.set(from);
  b.set(to);
  target.lerpColors(a, b, t);
}
let lastMinute = -1;
/** Update the shared palette. Returns true when anything visibly changed. */
export function updateTimeOfDay() {
  const m = gameMinutes();
  if (Math.abs(m - lastMinute) < 0.05) return false;
  lastMinute = m;
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].at <= m) i++;
  const k0 = keys[i],
    k1 = keys[i + 1],
    t = smooth(THREE.MathUtils.clamp((m - k0.at) / (k1.at - k0.at), 0, 1)),
    mix = (x: number, y: number) => x + (y - x) * t,
    p = timeOfDay;
  p.minutes = m;
  p.sunElevation = mix(k0.sunElevation, k1.sunElevation);
  // Azimuth wraps through north at night; interpolate along the short arc.
  let da = k1.sunAzimuth - k0.sunAzimuth;
  if (da > 180) da -= 360;
  if (da < -180) da += 360;
  p.sunAzimuth = k0.sunAzimuth + da * t;
  lerpHex(p.sun, k0.sun, k1.sun, t);
  p.sunIntensity = mix(k0.sunIntensity, k1.sunIntensity);
  lerpHex(p.hemiSky, k0.hemiSky, k1.hemiSky, t);
  lerpHex(p.hemiGround, k0.hemiGround, k1.hemiGround, t);
  p.hemiIntensity = mix(k0.hemiIntensity, k1.hemiIntensity);
  lerpHex(p.skyTop, k0.skyTop, k1.skyTop, t);
  lerpHex(p.skyBottom, k0.skyBottom, k1.skyBottom, t);
  lerpHex(p.fog, k0.fog, k1.fog, t);
  p.env = mix(k0.env, k1.env);
  p.exposure = mix(k0.exposure, k1.exposure);
  p.saturation = mix(k0.saturation, k1.saturation);
  p.vignette = mix(k0.vignette, k1.vignette);
  lerpHex(p.shadowTint, k0.shadowTint, k1.shadowTint, t);
  lerpHex(p.highlightTint, k0.highlightTint, k1.highlightTint, t);
  p.shadowIntensity = mix(k0.shadowIntensity, k1.shadowIntensity);
  lerpHex(p.ground, k0.ground, k1.ground, t);
  // Practicals: on between 18:30 and 20:00, off between 06:00 and 07:00.
  p.lights = Math.max(ramp(m, 1110, 1200), 1 - ramp(m, 360, 420));
  p.nightFactor = Math.max(ramp(m, 1140, 1230), 1 - ramp(m, 330, 400));
  p.sunDisc = 1 - p.nightFactor;
  // Below 12 degrees the shadow caster stays at 12 so shadows never streak across the map.
  const elevation = THREE.MathUtils.degToRad(Math.max(12, p.sunElevation)),
    azimuth = THREE.MathUtils.degToRad(p.sunAzimuth);
  // Azimuth 0 = north (-Z), 90 = east (+X).
  p.sunDirection.set(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
  );
  lightUniforms.lights.value = p.lights;
  lightUniforms.night.value = p.nightFactor;
  const top = lastRefresh.top;
  if (
    Math.abs(top.r - p.skyTop.r) +
      Math.abs(top.g - p.skyTop.g) +
      Math.abs(top.b - p.skyTop.b) >
      0.05 ||
    Math.abs(m - lastRefresh.minutes) > 120
  ) {
    top.copy(p.skyTop);
    lastRefresh.minutes = m;
    p.revision++;
  }
  return true;
}
updateTimeOfDay();

const isNight = () => {
  updateTimeOfDay();
  return timeOfDay.nightFactor > 0.5;
};
/** Notify React consumers (HUD theme, audio) only when day turns to night or back. */
export function useNightLighting() {
  const [value, setValue] = useState(isNight);
  useEffect(() => {
    const update = () => setValue(isNight());
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
  return value;
}
