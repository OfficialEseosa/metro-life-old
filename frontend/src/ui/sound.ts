/** Original procedural score and foley. No remote audio, samples or tracking. */
export type SoundKind =
  | "tap"
  | "open"
  | "close"
  | "coin"
  | "error"
  | "low"
  | "level"
  | "purchase"
  | "payday"
  | "reward"
  | "friend"
  | "wave"
  | "laugh"
  | "cheer"
  | "dance"
  | "honk"
  | "step"
  | "cook"
  | "eat"
  | "shower"
  | "sleep"
  | "type"
  | "arrival"
  | "notification";
export type AudioMix = {
  muted: boolean;
  master: number;
  music: number;
  ambience: number;
  sfx: number;
  ui: number;
};
export type AudioSceneState = {
  city: "atl" | "nyc" | "bay";
  place: string;
  night: boolean;
  duck: boolean;
  party?: boolean;
  zone?: string;
  ambient?: string;
};
type Bus = "music" | "ambience" | "sfx" | "ui";
type MusicLayer = {
  gain: GainNode;
  scene: AudioSceneState;
  next: number;
  step: number;
  fadeAt?: number;
};
type AmbienceLayer = { gain: GainNode; sources: AudioScheduledSourceNode[] };
const defaultMix: AudioMix = {
  muted: false,
  master: 0.7,
  music: 0.5,
  ambience: 0.6,
  sfx: 0.8,
  ui: 0.7,
};
function loadMix(): AudioMix {
  try {
    const saved =
        JSON.parse(localStorage.getItem("metro:audio:v2") ?? "null") ?? {},
      mix = { ...defaultMix, ...saved };
    if (
      !localStorage.getItem("metro:audio:v2") &&
      localStorage.getItem("metro:sound:v1") === "off"
    )
      mix.muted = true;
    for (const field of ["master", "music", "ambience", "sfx", "ui"] as const)
      mix[field] = Math.max(
        0,
        Math.min(
          1,
          Number.isFinite(mix[field]) ? mix[field] : defaultMix[field],
        ),
      );
    return mix;
  } catch {
    return defaultMix;
  }
}
let mix = loadMix(),
  context: AudioContext | null = null,
  master: GainNode | null = null,
  buses: Record<Bus, GainNode> | null = null,
  noise: AudioBuffer | null = null,
  ambient: AmbienceLayer | null = null,
  timer: number | undefined,
  scene: AudioSceneState = {
    city: "atl",
    place: "street",
    night: false,
    duck: false,
  },
  layers: MusicLayer[] = [],
  listeners = new Set<() => void>(),
  lastLow = -100,
  lastStep = 0,
  partyOverride = false;
export const audioSnapshot = () => mix;
export const subscribeAudio = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function ramp(param: AudioParam, value: number, seconds = 0.15) {
  if (!context) return;
  param.cancelScheduledValues(context.currentTime);
  param.setTargetAtTime(
    value,
    context.currentTime,
    Math.max(0.01, seconds / 4),
  );
}
function updateGains() {
  if (!master || !buses) return;
  ramp(master.gain, mix.muted ? 0 : mix.master);
  for (const bus of ["music", "ambience", "sfx", "ui"] as const)
    ramp(
      buses[bus].gain,
      mix[bus] * (bus === "music" && scene.duck ? 0.5 : 1),
      bus === "music" ? 0.8 : 0.15,
    );
}
export function setAudioMix(update: Partial<AudioMix>) {
  mix = { ...mix, ...update };
  for (const field of ["master", "music", "ambience", "sfx", "ui"] as const)
    mix[field] = Math.max(0, Math.min(1, mix[field]));
  try {
    localStorage.setItem("metro:audio:v2", JSON.stringify(mix));
    localStorage.setItem("metro:sound:v1", mix.muted ? "off" : "on");
  } catch {
    /* The current tab still retains the mix. */
  }
  updateGains();
  listeners.forEach((fn) => fn());
}
export const isMuted = () => mix.muted;
export function toggleSound() {
  setAudioMix({ muted: !mix.muted });
  return mix.muted;
}
function frequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}
function tone(
  note: number,
  at: number,
  duration: number,
  volume: number,
  bus: AudioNode,
  type: OscillatorType = "sine",
  detune = 0,
) {
  if (!context) return;
  const oscillator = context.createOscillator(),
    gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency(note);
  oscillator.detune.value = detune;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(bus);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.05);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}
function noiseHit(
  at: number,
  duration: number,
  volume: number,
  cutoff: number,
  bus: AudioNode,
) {
  if (!context || !noise) return;
  const source = context.createBufferSource(),
    filter = context.createBiquadFilter(),
    gain = context.createGain();
  source.buffer = noise;
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(gain).connect(bus);
  source.start(at);
  source.stop(at + duration);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}
function instrument(
  note: number,
  at: number,
  length: number,
  volume: number,
  layer: MusicLayer,
  style: string,
) {
  if (!context) return;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value =
    style === "guitar" ? 1800 : style === "keys" ? 2600 : 1400;
  filter.connect(layer.gain);
  tone(
    note,
    at,
    length,
    volume,
    filter,
    style === "guitar" ? "triangle" : "sine",
  );
  if (style === "keys") {
    tone(note + 12, at, length * 0.7, volume * 0.12, filter, "sine", 3);
    tone(note + 19, at, length * 0.3, volume * 0.04, filter);
  } else if (style === "guitar")
    tone(note + 12, at, length * 0.45, volume * 0.16, filter, "sine", -4);
  window.setTimeout(
    () => filter.disconnect(),
    Math.max(0, (at - context.currentTime + length + 0.15) * 1000),
  );
}
const progressions = {
  atl: [
    [48, 55, 59, 62],
    [45, 52, 55, 59],
    [53, 57, 60, 64],
    [55, 59, 62, 65],
    [48, 55, 59, 64],
    [45, 52, 57, 60],
    [50, 57, 60, 64],
    [55, 59, 62, 65],
  ],
  nyc: [
    [50, 57, 60, 64],
    [55, 59, 62, 65],
    [48, 55, 59, 62],
    [45, 52, 55, 59],
    [53, 57, 60, 64],
    [52, 59, 62, 67],
    [45, 52, 55, 59],
    [55, 59, 62, 65],
  ],
  bay: [
    [53, 57, 60, 64],
    [48, 55, 59, 62],
    [50, 57, 60, 65],
    [46, 53, 57, 60],
    [53, 57, 60, 67],
    [48, 55, 60, 64],
    [50, 57, 60, 65],
    [55, 59, 62, 65],
  ],
};
function score(layer: MusicLayer) {
  if (!context) return;
  const { city, place, night } = layer.scene,
    party = layer.scene.party || place === "club",
    tempo = party
      ? 120
      : ((
          {
            home: 68,
            cafe: 86,
            foodhall: 88,
            gym: 108,
            arena: 110,
            stadium: 112,
            aquarium: 62,
            museum: 70,
            theatre: 76,
            airport: 92,
            work: 80,
            skyoffice: 84,
            hospital: 66,
            civic: 74,
            retail: 96,
            campus: 82,
            heritage: 64,
            ballpark: 104,
            park: 72,
            waterfront: 78,
            bus: 84,
            plane: 76,
          } as Record<string, number>
        )[place] ?? (city === "nyc" ? 94 : city === "bay" ? 76 : 84)),
    beat = 60 / (night && !party ? tempo * 0.9 : tempo),
    step = layer.step,
    bar = Math.floor(step / 8),
    within = step % 8,
    chord = progressions[city][bar % 8],
    transpose =
      (night ? -5 : 0) +
      ((
        {
          aquarium: 2,
          museum: 5,
          theatre: -2,
          airport: 7,
          work: 3,
          skyoffice: 5,
          hospital: 5,
          civic: -5,
          retail: 2,
          campus: 7,
          heritage: -2,
          ballpark: 5,
        } as Record<string, number>
      )[place] ?? 0),
    style =
      (city === "bay" && place !== "home") ||
      ["street", "park", "cafe", "lounge"].includes(layer.scene.ambient ?? "")
        ? "guitar"
        : "keys",
    at = layer.next;
  // Eight-bar, seventh-chord motifs, with small rests and an answering second phrase.
  if (within === 0) {
    for (const [i, note] of chord.entries())
      instrument(
        note + transpose,
        at + i * 0.018,
        beat * 3.8,
        0.018,
        layer,
        style,
      );
    instrument(
      chord[0] - 12 + transpose,
      at,
      beat * 1.3,
      0.047,
      layer,
      "guitar",
    );
  }
  if (within === 4)
    instrument(
      chord[0] - 12 + transpose,
      at,
      beat * 1.4,
      0.035,
      layer,
      "guitar",
    );
  const motif =
      city === "atl"
        ? [2, -1, 1, 3, -1, 2, 1, -1]
        : city === "nyc"
          ? [3, 2, -1, 1, 2, -1, 3, 1]
          : [1, -1, 2, -1, 3, 2, -1, 1],
    index = motif[(within + (bar % 2) * 2) % 8];
  if (index >= 0 && !(night && within === 6))
    instrument(
      chord[index] + 12 + transpose + (bar % 4 === 3 && within === 7 ? 12 : 0),
      at,
      beat * (within % 2 ? 0.55 : 0.9),
      0.025,
      layer,
      style,
    );
  if (place !== "home" && place !== "museum" && place !== "park") {
    const drums = layer.gain;
    if ((party && within % 2 === 0) || within === 0 || within === 4) {
      tone(36, at, 0.16, party ? 0.1 : 0.035, drums, "sine");
      if (party) noiseHit(at + 0.005, 0.045, 0.011, 3000, drums);
    }
    if (within === 2 || within === 6) noiseHit(at, 0.1, 0.014, 1900, drums);
    if (within % 2 === 1)
      noiseHit(at, 0.04, party ? 0.008 : 0.003, 6500, drums);
  }
  layer.step++;
  layer.next += beat / 2;
}
function createAmbience(fade = 4) {
  if (!context || !buses || !noise) return;
  if (ambient) {
    ramp(ambient.gain.gain, 0, fade);
    const old = ambient;
    window.setTimeout(
      () => {
        old.sources.forEach((s) => {
          try {
            s.stop();
          } catch {
            /* already ended */
          }
        });
        old.gain.disconnect();
      },
      fade * 1000 + 200,
    );
  }
  const gain = context.createGain();
  gain.gain.value = 0.0001;
  gain.connect(buses.ambience);
  ambient = { gain, sources: [] };
  const place = scene.ambient ?? scene.place,
    outdoors = ["street", "park", "waterfront", "bus", "plane"].includes(place),
    crowd = [
      "cafe",
      "foodhall",
      "club",
      "arena",
      "stadium",
      "airport",
    ].includes(place);
  const wash = (hz: number, volume: number, rate: number) => {
    const source = context!.createBufferSource(),
      filter = context!.createBiquadFilter(),
      level = context!.createGain();
    source.buffer = noise;
    source.loop = true;
    source.playbackRate.value = rate;
    filter.type = "lowpass";
    filter.frequency.value = hz;
    level.gain.value = volume;
    source.connect(filter).connect(level).connect(gain);
    source.start();
    ambient!.sources.push(source);
  };
  if (outdoors) {
    wash(scene.night ? 260 : 500, 0.022, 0.38);
    wash(110, 0.012, 0.7);
  } else if (crowd) {
    wash(650, place === "foodhall" ? 0.031 : 0.018, 0.5);
    wash(220, 0.012, 0.34);
  } else if (place === "aquarium") {
    wash(160, 0.023, 0.3);
    wash(1500, 0.006, 0.12);
  } else if (place === "theatre") {
    wash(450, 0.009, 0.38);
  } else if (place === "museum") {
    wash(90, 0.004, 0.3);
  } else if (place === "retail" || place === "campus") {
    wash(550, 0.014, 0.45);
  } else wash(130, 0.007, 0.5);
  ramp(gain.gain, 1, fade);
}
function switchScore(fade = 4) {
  if (!context || !buses) return;
  const now = context.currentTime;
  for (const old of layers)
    if (!old.fadeAt) {
      old.fadeAt = now + fade;
      ramp(old.gain.gain, 0, fade);
    }
  const gain = context.createGain();
  gain.gain.value = 0.0001;
  gain.connect(buses.music);
  layers.push({
    gain,
    scene: { ...scene, party: scene.party || partyOverride },
    next: now + 0.05,
    step: 0,
  });
  ramp(gain.gain, 1, fade);
  createAmbience(fade);
}
function scheduler() {
  if (!context || context.state !== "running" || document.hidden) return;
  const now = context.currentTime;
  layers = layers.filter((layer) => {
    if (layer.fadeAt && now > layer.fadeAt + 0.2) {
      layer.gain.disconnect();
      return false;
    }
    while (layer.next < now + 0.15) {
      if (layer.next < now - 0.1) layer.next = now + 0.02;
      score(layer);
    }
    return true;
  });
  const outside = scene.place === "street" || scene.place === "park";
  if (outside && Math.random() < 0.025 && buses) {
    const at = now + 0.04;
    if (scene.night) {
      tone(96, at, 0.08, 0.009, buses.ambience, "sine");
      tone(99, at + 0.12, 0.08, 0.007, buses.ambience, "sine");
    } else {
      tone(88, at, 0.12, 0.014, buses.ambience, "sine");
      tone(93, at + 0.15, 0.17, 0.01, buses.ambience, "sine");
    }
  }
}
export async function unlockAudio() {
  if (typeof AudioContext === "undefined") return;
  try {
    if (!context) {
      context = new AudioContext();
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 3;
      master = context.createGain();
      master.connect(compressor).connect(context.destination);
      buses = {
        music: context.createGain(),
        ambience: context.createGain(),
        sfx: context.createGain(),
        ui: context.createGain(),
      };
      Object.values(buses).forEach((bus) => bus.connect(master!));
      noise = context.createBuffer(
        1,
        context.sampleRate * 2,
        context.sampleRate,
      );
      const data = noise.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * 0.08) / 1.02;
        data[i] = previous * 3.4;
      }
      updateGains();
      switchScore();
      timer = window.setInterval(scheduler, 100);
    }
    await context.resume();
    scheduler();
  } catch {
    /* A browser without audio can still play the game. */
  }
}
export function setAudioScene(next: AudioSceneState | null | undefined) {
  if (!next) return;
  const safe: AudioSceneState = {
    ...next,
    city: next.city === "nyc" || next.city === "bay" ? next.city : "atl",
    place: typeof next.place === "string" && next.place ? next.place : "street",
    night: !!next.night,
    duck: !!next.duck,
  };
  const changed =
    scene.city !== safe.city ||
    scene.place !== safe.place ||
    scene.night !== safe.night ||
    scene.party !== safe.party ||
    scene.zone !== safe.zone ||
    scene.ambient !== safe.ambient;
  const zoneOnly =
    scene.city === safe.city &&
    scene.place === safe.place &&
    scene.night === safe.night;
  scene = safe;
  try {
    updateGains();
    if (changed) switchScore(zoneOnly ? 1 : 4);
  } catch {
    /* A suspended or unavailable mixer must not interrupt a saved life. */
  }
}
/** Event hosts can switch the party score without coupling music to a UI or network module. */
export function setPartyAudio(active: boolean) {
  if (partyOverride === active) return;
  partyOverride = active;
  switchScore();
}
export function pauseAudio() {
  if (context?.state === "running") void context.suspend().catch(() => {});
}
export function continueAudio() {
  if (context && context.state !== "closed" && !document.hidden)
    void context.resume().catch(() => {});
}
const lastEffects = new Map<SoundKind, number>();
export function sound(kind: SoundKind) {
  if (mix.muted || !context || context.state !== "running" || !buses) return;
  const now = context.currentTime;
  if (now - (lastEffects.get(kind) ?? -10) < 0.09) return;
  lastEffects.set(kind, now);
  if (kind === "low") {
    if (now - lastLow < 30) return;
    lastLow = now;
  }
  if (kind === "step") {
    if (now - lastStep < 0.22) return;
    lastStep = now;
    noiseHit(
      now,
      0.065,
      0.023,
      scene.place === "street" ? 800 : 450,
      buses.sfx,
    );
    return;
  }
  const ui = ["tap", "open", "close", "error"].includes(kind),
    bus = ui ? buses.ui : buses.sfx,
    pitch = (Math.random() - 0.5) * 0.45,
    volume = 0.045 * (0.9 + Math.random() * 0.2);
  const notes: Partial<Record<SoundKind, number[]>> = {
    coin: [76, 79, 84],
    purchase: [72, 79, 76],
    payday: [60, 67, 72, 76, 79],
    reward: [72, 76, 79, 84],
    friend: [67, 71, 74, 79],
    level: [60, 64, 67, 72, 76],
    wave: [74, 79],
    laugh: [72, 76, 72],
    cheer: [67, 72, 79],
    dance: [60, 67, 72],
    honk: [58, 62],
    arrival: [67, 72, 76],
    notification: [72, 79],
    open: [76],
    close: [67],
    tap: [84],
    error: [48],
    low: [48, 43],
    cook: [65, 72],
    eat: [72, 74],
    shower: [79],
    sleep: [60, 67],
    type: [86],
  };
  const sequence = notes[kind] ?? [72];
  sequence.forEach((note, i) =>
    tone(
      note + pitch,
      now + i * 0.085,
      kind === "honk"
        ? 0.3
        : kind === "sleep"
          ? 0.6
          : kind === "tap"
            ? 0.075
            : 0.23,
      volume * (kind === "tap" ? 0.4 : kind === "type" ? 0.3 : 1),
      bus,
      kind === "honk"
        ? "sawtooth"
        : kind === "purchase" || kind === "coin"
          ? "triangle"
          : "sine",
    ),
  );
  if (kind === "cook") noiseHit(now, 0.55, 0.018, 2800, bus);
  if (kind === "shower") noiseHit(now, 1.5, 0.022, 2200, bus);
  if (kind === "eat") noiseHit(now, 0.1, 0.013, 1300, bus);
}
export function resumeSound(kind: SoundKind) {
  void unlockAudio().then(() => sound(kind));
}
/** Kept for page lifecycle ownership; the active game normally retains one mixer for the tab. */
export function stopAudio() {
  if (timer) clearInterval(timer);
  timer = undefined;
  layers = [];
  ambient = null;
  void context?.close();
  context = null;
  master = null;
  buses = null;
  noise = null;
}
