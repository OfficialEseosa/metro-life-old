import "./hud.css";
import "./panels.css";
import { ConnectionGate, ReconnectBanner } from "./connection-gate";
import { VenueMomentBridge } from "./venue-moments";
import { SocialLifeHud, SocialTools } from "./social-life";
import { useSocialUi } from "./social-ui";
import { MoneyLedger } from "./money-ledger";
import { PurchaseConfirmation } from "./purchase-confirmation";
import { BuyMode, BuyModeButton } from "./buy-mode";
import { ActionButton, Joystick, WalkHelp } from "./walking-controls";
import { TravelPanel, TravelRideGate } from "./travel-panel";
import { ObjectActions } from "./object-actions";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import { Compass, Moon, Sun, Scan } from "@phosphor-icons/react";
import canonical from "../shared-data/world.json";
import { api } from "../api/client";
import { useSimIdentity, useSimVitals, useStore } from "../store";
import { useNightLighting } from "../lighting";
import {
  Creator,
  Intro,
  Settings,
  FirstDayGoals,
  FirstRentPrimary,
  FirstDayClosing,
} from "./entry";
import { PortraitStudio } from "./character-preview";
import {
  Busy,
  JobPrimary,
  JobsPanel,
  LocationPanel,
  LocationPrimary,
  SimPanel,
  StoryPanel,
} from "./panels";
import { Avatar, ArrowUpRight, Icon, Sheet } from "./primitives";
import { NEED_ICONS, NEED_LABELS, NEED_ORDER } from "./needs";
import { money, useCompact, useNow } from "./helpers";
import { serverNow } from "../server-time";
import { CashCounter, RewardFlight, SoundButton } from "./feedback";
import { sound } from "./sound";
import { AudioScene } from "./audio";
import { useGameFeedback } from "./use-game-feedback";
import { NeedWarning } from "./need-warning";
import { MapTools } from "./map-tools";
import { policyHours } from "./action-rules";
import { ErrorNotices, TOAST_REGION_ID } from "./notices";
import {
  CityServices,
  MayorPanel,
  MayorPrimary,
  PlotsPanel,
  PlotPrimary,
  BillboardPanel,
  BillboardPrimary,
  HomesPanel,
} from "./economy-panels";
import {
  CommunityLinks,
  PeoplePanel,
  ChatPanel,
  ChatPrimary,
} from "./community-panels";
import type { CityId } from "../api/types";

const state = () => useStore.getState();

function Time() {
  const clock = useStore((s) => s.clock),
    now = useNow();
  if (!clock) return <time>Welcome home</time>;
  const elapsed = Math.max(0, now - clock.at) / clock.msPerMinute,
    total = clock.hour * 60 + clock.minute + Math.floor(elapsed),
    minutes = total % 1440;
  return (
    <time>
      Day {clock.day + Math.floor(total / 1440)} ·{" "}
      {String(Math.floor(minutes / 60)).padStart(2, "0")}:
      {String(minutes % 60).padStart(2, "0")}
    </time>
  );
}

function ConnectionStatus() {
  const online = useStore(
      (s) => s.players.filter((p) => p.online && !p.npc).length,
    ),
    residents = useStore((s) => s.players.filter((p) => p.npc).length),
    connected = useStore((s) => s.connected);
  return (
    <span className="connection-status" role="status">
      {connected
        ? online || residents
          ? `${online} online · ${residents} residents`
          : "Finding neighbours…"
        : "Reconnecting…"}
    </span>
  );
}

function CashDetail({ close }: { close: () => void }) {
  const today = useStore(useShallow((s) => s.sim?.moneyToday ?? null));
  return (
    <div className="cash-detail plate" role="dialog" aria-label="Your money">
      <MoneyLedger />
      <strong>Today</strong>
      <span>
        Income <b>{money(today?.income ?? 0)}</b>
      </span>
      <span>
        Spent <b>{money(today?.spent ?? 0)}</b>
      </span>
      <button className="text-button" onClick={close}>
        Close
      </button>
    </div>
  );
}

const needLevel = (value: number) =>
  value < 25 ? "low" : value < 50 ? "mid" : "good";

/** Top-left: portrait with mood, cash and clock, and the five needs. */
function Vitals() {
  const vitals = useSimVitals(),
    identity = useSimIdentity(),
    [cashOpen, setCashOpen] = useState(false),
    compact = useCompact(),
    lowCount = useRef(0);
  const low = vitals
    ? NEED_ORDER.filter((n) => (vitals.needs[n] ?? 100) < 25).length
    : 0;
  useEffect(() => {
    if (low > lowCount.current) sound("low");
    lowCount.current = low;
  }, [low]);
  if (!vitals || !identity)
    return (
      <header className="vitals plate">
        <button
          className="wordmark"
          onClick={() => state().setFocus("overview")}
          aria-label="Metro Life: see the whole city"
        >
          <span className="semantic-tile">
            <Compass size={24} weight="duotone" />
          </span>
          Metro Life
        </button>
      </header>
    );
  const mood = vitals.mood;
  return (
    <header className="vitals plate">
      <button
        className="vitals-avatar"
        data-mood={mood}
        aria-label={`${identity.name}, feeling ${mood}. Open your life`}
        onClick={() => state().openPanel("sim")}
      >
        <Avatar look={identity.look} size={compact ? 48 : 60} />
        <span className="vitals-mood" aria-hidden="true">
          <Icon
            name={
              mood === "low" || mood === "rough"
                ? "smiley-sad"
                : mood === "okay"
                  ? "smiley-meh"
                  : "smiley"
            }
            size={16}
          />
        </span>
      </button>
      <div className="vitals-money">
        <button
          className="cash-button"
          data-cash
          aria-label={`Cash ${money(vitals.cash)}. Today's income and spending`}
          aria-expanded={cashOpen}
          onClick={() => setCashOpen(!cashOpen)}
        >
          <span className="cash-line">
            <span className="coin-token" aria-hidden="true">
              <Icon name="coins" size={16} />
            </span>
            <CashCounter cash={vitals.cash} />
          </span>
          <Time />
        </button>
        <ConnectionStatus />
      </div>
      <button
        className="vitals-needs"
        aria-label={`Your needs: ${NEED_ORDER.map((n) => `${NEED_LABELS[n]} ${Math.round(vitals.needs[n] ?? 100)}`).join(", ")}. Open your life`}
        onClick={() => state().openPanel("sim")}
      >
        {NEED_ORDER.map((need) => {
          const value = Math.round(vitals.needs[need] ?? 100);
          return (
            <span
              key={need}
              className={`need-ring ${need}`}
              data-level={needLevel(value)}
              style={{ "--v": value } as CSSProperties}
              title={`${NEED_LABELS[need]} ${value} / 100`}
            >
              <Icon name={NEED_ICONS[need]} size={20} />
            </span>
          );
        })}
      </button>
      {cashOpen && <CashDetail close={() => setCashOpen(false)} />}
    </header>
  );
}

/** Top-right: city map, overview, light preview and sound. Also drives the HUD theme. */
function TopControls() {
  const night = useNightLighting(),
    city = useStore((s) => s.city),
    world = useStore((s) => s.world),
    home = useStore((s) => s.sim?.city),
    theme = useStore((s) => s.sceneTheme);
  useEffect(() => {
    document.documentElement.dataset.time = night ? "night" : "day";
  }, [night]);
  return (
    <div className="hud-controls">
      <select
        className="city-select hide-with-panel"
        aria-label="View a city map. This does not move your character."
        title="View a city map; use Travel to visit"
        value={city}
        onChange={(e) => {
          const next = e.target.value as CityId;
          void state()
            .setCity(next)
            .then(() => state().setFocus("overview"));
        }}
      >
        {(world?.cities ?? canonical.cities).map((c) => (
          <option key={c.id} value={c.id}>
            {c.short}
            {home ? (c.id !== home ? " · map" : " · home") : ""}
          </option>
        ))}
      </select>
      <button
        className="plate-button overview-button"
        aria-label="See the whole city"
        title="See the whole city"
        onClick={() => {
          state().setFocus("overview");
          state().openPanel(null);
          state().setSearchOpen(false);
        }}
      >
        <Scan size={22} weight="duotone" />
      </button>
      <button
        className="plate-button"
        onClick={() =>
          state().setSceneTheme(
            theme === "auto" ? (night ? "day" : "night") : "auto",
          )
        }
        aria-label={
          theme === "auto"
            ? night
              ? "Preview daytime lighting"
              : "Preview night lighting"
            : "Follow the game clock again"
        }
        aria-pressed={theme !== "auto"}
        title={theme === "auto" ? "Preview lighting" : "Follow game clock"}
      >
        {night ? (
          <Sun size={22} weight="duotone" />
        ) : (
          <Moon size={22} weight="duotone" />
        )}
      </button>
      <SoundButton />
    </div>
  );
}

const DOCK = [
  ["Home", "house", "rest"],
  ["Career", "briefcase", "work"],
  ["City", "buildings", "social"],
  ["Search", "search", "fun"],
] as const;
function Dock({ search }: { search: () => void }) {
  return (
    <nav className="bottom-dock plate hide-with-panel" aria-label="Your life">
      {DOCK.map(([label, icon, tone]) => (
        <button
          key={label}
          aria-label={
            label === "Home"
              ? "Home: go to your home"
              : label === "Career"
                ? "Career: jobs and your next shift"
                : label === "City"
                  ? "City: neighbours, chat and services"
                  : "Search places"
          }
          onClick={() => {
            if (label === "Home") {
              state().selectLocation("home");
              state().setFocus("home");
            } else if (label === "Search") search();
            else state().openPanel(label === "Career" ? "jobs" : "city");
          }}
        >
          <span className={`semantic-tile ${tone}`}>
            <Icon name={icon} />
          </span>
          <span aria-hidden="true">{label}</span>
        </button>
      ))}
    </nav>
  );
}

type StoryLead = { title: string; loc: string; name: string; hint?: string };
/** "A story is waiting at <place>" once the first day is done (gameplay sends `sim.storyLead`). */
function StoryLeadCue() {
  const lead = useStore(
      useShallow((s) => {
        const l = (s.sim as { storyLead?: StoryLead | null } | null)?.storyLead;
        return l ? { title: l.title, loc: l.loc, name: l.name } : null;
      }),
    ),
    firstDayOpen = useStore(
      (s) => !!s.sim?.firstDay && !s.sim.firstDay.complete,
    );
  if (!lead || firstDayOpen) return null;
  return (
    <button
      className="first-day-cue plate story-lead"
      aria-label={`A story is waiting at ${lead.name}: ${lead.title}. Show it on the map`}
      onClick={() => {
        state().selectLocation(lead.loc);
        state().setFocus(lead.loc);
      }}
    >
      <span className="semantic-tile fun">
        <Icon name="book-open" />
      </span>
      <span>
        <small>A story is waiting</small>
        <strong>{lead.name}</strong>
      </span>
    </button>
  );
}

/**
 * Left column: action queue, first-day progress (or the first-job nudge), the
 * activity in progress, then the HUD's own notices (reconnect, errors, needs).
 * Notices stay visible while a side sheet is open; the cues step aside.
 */
function LeftColumn() {
  const busy = useStore((s) => !!s.sim?.busyUntil),
    job = useStore((s) => !!s.sim?.job),
    firstDay = useStore((s) => !!s.sim?.firstDay);
  return (
    <div className="hud-left">
      <div className="hud-cues">
        <ObjectActions />
        {firstDay ? (
          <FirstDayGoals compact />
        ) : (
          !job && (
            <button
              className="first-job-cue plate"
              onClick={() => state().openPanel("jobs")}
            >
              <span className="semantic-tile work">
                <Icon name="briefcase" />
              </span>
              <span>Find your first job</span>
              <ArrowUpRight size={20} />
            </button>
          )
        )}
        <StoryLeadCue />
        {busy && (
          <div className="idle-progress">
            <Busy />
          </div>
        )}
      </div>
      <div
        id={TOAST_REGION_ID}
        className="hud-toasts"
        aria-live="polite"
        aria-label="Messages"
      >
        <ReconnectBanner />
        <ErrorNotices />
        <NeedWarning />
      </div>
    </div>
  );
}

function ChatTool({ onOpen }: { onOpen: () => void }) {
  const userId = useStore((s) => s.sim?.userId),
    messages = useStore((s) => s.chat),
    [seen, setSeen] = useState(serverNow);
  useEffect(
    () =>
      useStore.subscribe((s, previous) => {
        if (
          s.sim?.city !== previous.sim?.city ||
          s.panel === "chat" ||
          previous.panel === "chat"
        )
          setSeen(serverNow());
      }),
    [],
  );
  const unread = messages.filter(
    (m) => !m.npc && m.userId !== userId && m.at > seen,
  ).length;
  return (
    <button
      className="hud-tool"
      aria-label={`Open city chat${unread ? `, ${unread} unread messages` : ""}`}
      onClick={() => {
        setSeen(serverNow());
        onOpen();
        state().openPanel("chat");
      }}
    >
      <Icon name="chat" />
      <span>City chat</span>
      {unread > 0 && (
        <b className="chat-unread" aria-hidden="true">
          {Math.min(unread, 99)}
        </b>
      )}
    </button>
  );
}

/** Bottom-right: tools, social buttons and the contextual action. Always mounted. */
function ActionStack() {
  const [expanded, setExpanded] = useState(false);
  useEffect(
    () =>
      useStore.subscribe((s, previous) => {
        if (s.panel !== previous.panel || s.sim?.city !== previous.sim?.city)
          setExpanded(false);
      }),
    [],
  );
  return (
    <div
      className={`hud-action-stack hide-with-panel ${expanded ? "is-open" : ""}`}
      role="group"
      aria-label="Your actions"
    >
      <div className="hud-tools" id="hud-tools">
        <SocialTools onOpen={() => setExpanded(false)} />
        <ChatTool onOpen={() => setExpanded(false)} />
        <BuyModeButton />
      </div>
      <button
        className="hud-tool hud-more-toggle"
        aria-expanded={expanded}
        aria-controls="hud-tools"
        onClick={() => {
          setExpanded((v) => !v);
          useSocialUi.setState({ wheel: false, friends: false });
          sound(expanded ? "close" : "open");
        }}
      >
        <Icon name={expanded ? "x" : "more"} />
        <span>{expanded ? "Close" : "More"}</span>
      </button>
      <ActionButton />
    </div>
  );
}

const PANEL_TITLES: Record<string, string> = {
  city: "Your city",
  settings: "Settings and wardrobe",
  sim: "Your life",
  mayor: "Your city election",
  plots: "A place for your idea",
  billboard: "Make it seen",
  homes: "Find your home",
  travel: "Visit another city",
  people: "Your neighbours",
  chat: "Around the city",
};
const PANEL_KICKERS: Record<string, string> = {
  jobs: "Practice today. Grow tomorrow.",
  sim: "Needs, skills and dreams",
  mayor: "Your voice in the city",
  plots: "A space in the community market",
  billboard: "Share something with your neighbours",
  homes: "Make yourself at home",
  people: "Good company, close by",
  chat: "Say hello to the neighbourhood",
  settings: "Sound, image, wardrobe and your life",
  travel: "Buses and planes between cities",
};
const PANEL_ICONS: Record<string, string> = {
  sim: "heart-pulse",
  jobs: "briefcase",
  mayor: "landmark",
  plots: "map-pin",
  billboard: "monitor-play",
  homes: "house",
  settings: "gear",
  travel: "plane",
  city: "buildings",
  people: "users",
  chat: "chat",
};
const PANEL_TONES: Record<string, string> = {
  jobs: "work",
  plots: "work",
  billboard: "work",
  sim: "social",
  homes: "rest",
  travel: "travel",
  settings: "travel",
  city: "travel",
  people: "social",
  chat: "social",
  mayor: "learn",
};

/** View another city's map from the City panel on phones, where the top select is hidden. */
function CityMapPicker() {
  const city = useStore((s) => s.city),
    world = useStore((s) => s.world),
    home = useStore((s) => s.sim?.city);
  return (
    <label className="field city-map-picker">
      View a city map
      <select
        value={city}
        onChange={(e) => {
          const next = e.target.value as CityId;
          state().openPanel(null);
          void state()
            .setCity(next)
            .then(() => state().setFocus("overview"));
        }}
      >
        {(world?.cities ?? canonical.cities).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {home && c.id === home ? " (home)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActivePanel() {
  const panel = useStore((s) => s.panel),
    selected = useStore((s) => s.selectedLoc),
    world = useStore((s) => s.world),
    city = useStore((s) => s.city),
    hasSim = useStore((s) => !!s.sim),
    hasJob = useStore((s) => !!s.sim?.job),
    rentDue = useStore((s) => !!s.sim?.firstDay && !s.sim.firstDay.rent),
    now = useNow(),
    clock = useStore((s) => s.clock),
    policy = useStore((s) => s.mayor?.mayor?.policy);
  const close = useCallback(() => {
    state().openPanel(null);
    sound("close");
  }, []);
  if (!panel) return null;
  const place = world?.cities
    .find((c) => c.id === city)
    ?.landmarks.find((l) => l.id === selected);
  const open = policyHours(
      place?.open ?? [0, 24],
      place?.category ?? "",
      policy,
    ),
    hour = clock
      ? ((clock.hour * 60 +
          clock.minute +
          (now - clock.at) / clock.msPerMinute) %
          1440) /
        60
      : 12,
    closed =
      open[0] < open[1]
        ? hour < open[0] || hour >= open[1]
        : hour < open[0] && hour >= open[1],
    hours =
      open[0] === 0 && open[1] === 24
        ? "Open all day"
        : `${closed ? "Closed" : "Open"} · ${open[0]}:00–${open[1]}:00`;
  const title =
    panel === "location"
      ? selected === "home"
        ? "Home, sweet home"
        : (place?.name ?? "Explore the city")
      : panel === "jobs"
        ? hasJob
          ? "Your next shift"
          : "Find your first job"
        : (PANEL_TITLES[panel] ?? "The city");
  return (
    <Sheet
      key={`${panel}:${selected}`}
      title={title}
      kicker={
        panel === "location"
          ? hours
          : (PANEL_KICKERS[panel] ??
            world?.cities.find((c) => c.id === city)?.name ??
            "Metro Life")
      }
      close={close}
      modal={["creator", "settings"].includes(panel)}
      primary={
        panel === "sim" && rentDue ? (
          <FirstRentPrimary />
        ) : panel === "location" ? (
          <LocationPrimary />
        ) : panel === "jobs" && hasJob ? (
          <JobPrimary />
        ) : panel === "mayor" ? (
          <MayorPrimary />
        ) : panel === "plots" ? (
          <PlotPrimary />
        ) : panel === "billboard" ? (
          <BillboardPrimary />
        ) : panel === "chat" ? (
          <ChatPrimary />
        ) : undefined
      }
      peek={panel === "location"}
      icon={
        panel === "location"
          ? selected === "home"
            ? "house"
            : place?.icon
          : (PANEL_ICONS[panel] ?? "compass")
      }
      tone={panel === "location" ? undefined : PANEL_TONES[panel]}
      color={
        panel === "location"
          ? world?.categories[place?.category ?? ""]?.color
          : undefined
      }
    >
      {panel === "city" ? (
        <>
          <p className="intro">
            One city, shared with everyone who opens this address.
          </p>
          <CommunityLinks />
          <CityServices />
          <CityMapPicker />
          <button
            className="secondary full"
            onClick={() => state().openPanel("settings")}
          >
            <Icon name="gear" />
            Settings and wardrobe
          </button>
          <p className="small-copy">
            Map data (c){" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap contributors
            </a>
          </p>
        </>
      ) : panel === "settings" ? (
        <Settings />
      ) : panel === "location" ? (
        <LocationPanel />
      ) : panel === "jobs" ? (
        <JobsPanel />
      ) : panel === "sim" && hasSim ? (
        <SimPanel />
      ) : panel === "mayor" ? (
        <MayorPanel />
      ) : panel === "plots" ? (
        <PlotsPanel />
      ) : panel === "billboard" ? (
        <BillboardPanel />
      ) : panel === "homes" ? (
        <HomesPanel />
      ) : panel === "travel" ? (
        <TravelPanel />
      ) : panel === "people" ? (
        <PeoplePanel />
      ) : panel === "chat" ? (
        <ChatPanel />
      ) : null}
    </Sheet>
  );
}

/**
 * Tell the camera how much of the screen the HUD covers, so the player stays
 * centred in the open part of the scene (left of a side sheet, between the
 * top strip and the dock).
 */
function useHudLayout(panel: unknown, search: boolean) {
  useEffect(() => {
    const measure = () => {
      const rect = (selector: string) =>
          document.querySelector(selector)?.getBoundingClientRect(),
        vitals = rect(".vitals"),
        controls = rect(".hud-controls"),
        dock = rect(".bottom-dock"),
        sheet = rect("[data-game-sheet],.map-tools"),
        side = !!sheet && sheet.left > innerWidth * 0.3 && sheet.top < 80,
        bottomSheet = !!sheet && !side;
      const next = {
          top: Math.max(vitals?.bottom ?? 0, controls?.bottom ?? 0) + 8,
          right: side && sheet ? innerWidth - sheet.left + 12 : 0,
          left: 0,
          bottom:
            bottomSheet && sheet
              ? innerHeight - sheet.top
              : dock && dock.height
                ? innerHeight - dock.top + 8
                : 0,
        },
        old = state().hudInsets;
      if (
        (Object.keys(next) as (keyof typeof next)[]).some(
          (k) => Math.abs(next[k] - old[k]) > 1,
        )
      )
        state().setHudInsets(next);
    };
    const observer = new ResizeObserver(measure);
    document
      .querySelectorAll(
        ".vitals,.hud-controls,.bottom-dock,[data-game-sheet],.map-tools",
      )
      .forEach((e) => observer.observe(e));
    window.addEventListener("resize", measure);
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [panel, search]);
}

function StoryBeat() {
  const beat = useStore((s) => s.sim?.pendingBeat);
  const closeBeat = useCallback(() => {}, []);
  if (!beat) return null;
  return (
    <Sheet
      modal
      dismissible={false}
      icon={beat.icon}
      tone="fun"
      title={beat.title}
      kicker={`A moment that matters${beat.chapter ? ` · ${beat.chapter} / ${beat.total}` : ""}`}
      close={closeBeat}
    >
      <StoryPanel beat={beat} />
    </Sheet>
  );
}

/** One fresh read when the tab becomes visible again; the socket keeps it current otherwise. */
function useSimRefresh(simId?: string, worldId?: string) {
  useEffect(() => {
    if (!simId) return;
    let active = true,
      inFlight = false;
    const update = async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const r = await api.sim();
        if (active && useStore.getState().worldInfo?.id === worldId) {
          useStore.getState().setSim(r.sim);
          useStore.setState({ clock: r.clock });
        }
      } catch {
        /* Preserve the last confirmed state during network loss. */
      } finally {
        inFlight = false;
      }
    };
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", update);
    };
  }, [simId, worldId]);
}

function HudBody() {
  const connection = useStore((s) => s.connection),
    ready = useStore((s) => s.ready),
    hasWorld = useStore((s) => !!s.world),
    hasUser = useStore((s) => !!s.user),
    panel = useStore((s) => s.panel),
    search = useStore((s) => s.searchOpen),
    view = useStore(
      useShallow((s) => ({
        hasSim: !!s.sim,
        simId: s.sim?.userId,
        worldId: s.sim?.worldId,
        introDone: s.sim?.introDone !== false,
        closing: !!s.sim?.firstDay?.complete && !s.sim.firstDay.closingSeen,
        trip: !!s.sim?.trip,
        beat: !!s.sim?.pendingBeat,
        inside: !!s.sim?.position?.room,
      })),
    );
  useGameFeedback();
  useHudLayout(panel, search && !panel);
  useSimRefresh(view.simId, view.worldId);
  const openSearch = () => {
    state().openPanel(null);
    state().setSearchOpen(true);
    sound("open");
  };
  if (
    connection === "ended" ||
    connection === "blocked" ||
    !ready ||
    !hasWorld ||
    !hasUser
  )
    return <ConnectionGate />;
  if (!view.hasSim) return <Creator />;
  if (!view.introDone) return <Intro />;
  if (view.closing) return <FirstDayClosing />;
  if (view.trip) return <TravelRideGate />;
  const covered = !!panel || search;
  return (
    <div
      className={`metro-hud is-playing ${view.inside ? "is-inside" : ""} ${covered ? "is-panel-open" : ""} ${view.beat ? "is-story" : ""}`}
    >
      <PortraitStudio />
      <Vitals />
      <TopControls />
      <LeftColumn />
      <SocialLifeHud />
      <Joystick />
      <Dock search={openSearch} />
      <ActionStack />
      <WalkHelp />
      <BuyMode />
      <PurchaseConfirmation />
      {search && !panel && (
        <MapTools close={() => state().setSearchOpen(false)} />
      )}
      <ActivePanel />
      <RewardFlight />
      <StoryBeat />
    </div>
  );
}

export default function Hud() {
  return (
    <>
      <AudioScene />
      <VenueMomentBridge />
      <HudBody />
    </>
  );
}
