import { useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  ArrowUpRight as PhArrowUpRight,
  ArrowRight,
  BookOpen as PhBookOpen,
  Briefcase,
  Buildings,
  Check as PhCheck,
  Compass,
  Barbell,
  Heartbeat,
  House as PhHouse,
  MapPin as PhMapPin,
  Sparkle,
  Users as PhUsers,
  Wallet as PhWallet,
  Lightning,
  Bicycle,
  Bridge,
  ChartLineUp,
  VinylRecord,
  MaskHappy,
  Basketball,
  Fish,
  Fire,
  Footprints,
  GraduationCap,
  HandCoins,
  Key,
  Lamp,
  MonitorPlay,
  Sailboat,
  ShoppingBag,
  BowlFood,
  Sun,
  Target,
  Train,
  Tree,
  Waves,
  Drop,
  ChartBar,
  Moon,
  MusicNotes,
  Palette,
  Airplane,
  Rocket,
  Trophy,
  ForkKnife,
  Bank,
  ChatsCircle,
  SpeakerHigh,
  SpeakerSlash,
  Bed,
  Plant,
  PaintRoller,
  Armchair,
  CookingPot,
  Heart,
  Smiley,
  Confetti,
  DiceFive,
  X,
  Gear,
  Door,
  Warning,
  HandWaving,
  Gift,
  SmileyMeh,
  SmileySad,
  PaintBrushHousehold,
  DotsThreeOutline,
  ChatCircleDots,
  ArrowClockwise,
  WifiSlash,
  MagnifyingGlass,
  Storefront,
  Coins,
  Leaf,
  SunHorizon,
  Lightbulb,
  Ticket,
  Bus,
  Clock,
  PaperPlaneRight,
  Shower,
  Television,
  Coffee,
  Microphone,
  Laptop,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon, IconProps } from "@phosphor-icons/react";
import { CharacterPortrait } from "./character-preview";
import type { Look } from "../api/types";
import { getPanelTrigger } from "../store";
import { sound } from "./sound";

const icons: Record<string, PhosphorIcon> = {
  check: PhCheck,
  "arrow-up-right": PhArrowUpRight,
  bike: Bicycle,
  bridge: Bridge,
  "chart-candlestick": ChartLineUp,
  "disc-3": VinylRecord,
  drama: MaskHappy,
  dribbble: Basketball,
  "ferris-wheel": VinylRecord,
  fish: Fish,
  flame: Fire,
  footprints: Footprints,
  "graduation-cap": GraduationCap,
  "hand-coins": HandCoins,
  gear: Gear,
  door: Door,
  warning: Warning,
  "hand-waving": HandWaving,
  gift: Gift,
  "smiley-meh": SmileyMeh,
  "smiley-sad": SmileySad,
  decorate: PaintBrushHousehold,
  more: DotsThreeOutline,
  chat: ChatCircleDots,
  retry: ArrowClockwise,
  offline: WifiSlash,
  search: MagnifyingGlass,
  store: Storefront,
  "arrow-right": ArrowRight,
  x: X,
  leaf: Leaf,
  sunrise: SunHorizon,
  idea: Lightbulb,
  ticket: Ticket,
  bus: Bus,
  clock: Clock,
  send: PaperPlaneRight,
  shower: Shower,
  tv: Television,
  coffee: Coffee,
  mic: Microphone,
  laptop: Laptop,
  "key-round": Key,
  lamp: Lamp,
  "monitor-play": MonitorPlay,
  sailboat: Sailboat,
  "shopping-bag": ShoppingBag,
  soup: BowlFood,
  sun: Sun,
  target: Target,
  "train-front": Train,
  trees: Tree,
  waves: Waves,
  building: Buildings,
  "building-2": Buildings,
  home: PhHouse,
  droplets: Drop,
  wallet: PhWallet,
  coins: Coins,
  sparkles: Sparkle,
  "book-open": PhBookOpen,
  house: PhHouse,
  moon: Moon,
  "map-pin": PhMapPin,
  briefcase: Briefcase,
  "briefcase-business": Briefcase,
  users: PhUsers,
  "cooking-pot": CookingPot,
  utensils: ForkKnife,
  dumbbell: Barbell,
  music: MusicNotes,
  "mic-vocal": Microphone,
  cpu: Laptop,
  "messages-square": ChatsCircle,
  palette: Palette,
  landmark: Bank,
  rocket: Rocket,
  trophy: Trophy,
  "heart-pulse": Heartbeat,
  plane: Airplane,
  "chart-no-axes-combined": ChartBar,
  zap: Lightning,
  "speaker-high": SpeakerHigh,
  "speaker-off": SpeakerSlash,
  bed: Bed,
  plant: Plant,
  paint: PaintRoller,
  seating: Armchair,
  heart: Heart,
  smiley: Smiley,
  confetti: Confetti,
  dice: DiceFive,
  compass: Compass,
  buildings: Buildings,
};
/** One icon per need, used by every need display. */
export const NEED_ICONS: Record<string, string> = {
  energy: "zap",
  hunger: "utensils",
  fun: "sparkles",
  social: "users",
  hygiene: "droplets",
};
export const NEED_ORDER = [
  "energy",
  "hunger",
  "fun",
  "social",
  "hygiene",
] as const;
export const NEED_LABELS: Record<string, string> = {
  energy: "Energy",
  hunger: "Hunger",
  fun: "Fun",
  social: "Social",
  hygiene: "Hygiene",
};
/** "tech" -> "Tech", "music-lover" -> "Music lover". */
export const titleCase = (text: string) =>
  text ? text[0].toUpperCase() + text.slice(1).replace(/-/g, " ") : text;
export function Icon({ name, size = 22 }: { name?: string; size?: number }) {
  const Component = icons[name ?? ""] ?? Compass;
  return <Component size={size} weight="duotone" aria-hidden="true" />;
}
export const ArrowUpRight = (props: IconProps) => (
  <PhArrowUpRight {...props} weight="duotone" />
);
export const BookOpen = (props: IconProps) => (
  <PhBookOpen {...props} weight="duotone" />
);
export const BriefcaseBusiness = (props: IconProps) => (
  <Briefcase {...props} weight="duotone" />
);
export const Check = (props: IconProps) => (
  <PhCheck {...props} weight="duotone" />
);
export const ChevronRight = (props: IconProps) => (
  <ArrowRight {...props} weight="duotone" />
);
export const CircleUserRound = (props: IconProps) => (
  <Smiley {...props} weight="duotone" />
);
export const House = (props: IconProps) => (
  <PhHouse {...props} weight="duotone" />
);
export const MapPin = (props: IconProps) => (
  <PhMapPin {...props} weight="duotone" />
);
export const Sparkles = (props: IconProps) => (
  <Sparkle {...props} weight="duotone" />
);
export const Users = (props: IconProps) => (
  <PhUsers {...props} weight="duotone" />
);
export const Wallet = (props: IconProps) => (
  <PhWallet {...props} weight="duotone" />
);
export const Zap = (props: IconProps) => (
  <Lightning {...props} weight="duotone" />
);
export function ErrorMessage({ text }: { text: string }) {
  return text ? (
    <p className="error-message" role="alert">
      {text}
    </p>
  ) : null;
}
/** Keep each gate visible on touch screens and associated with its own control. */
export function ReasonButton({
  reason,
  children,
  className = "",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> & {
  reason: string;
}) {
  const id = useId();
  return (
    <button
      {...props}
      className={`${className}${reason ? " has-gate-reason" : ""}`}
      disabled={!!reason}
      aria-describedby={
        reason
          ? [props["aria-describedby"], id].filter(Boolean).join(" ")
          : props["aria-describedby"]
      }
      title={reason || props.title}
    >
      {children}
      {reason && (
        <small id={id} className="gate-reason">
          {reason}
        </small>
      )}
    </button>
  );
}
export function Avatar({ look, size = 60 }: { look: Look; size?: number }) {
  return <CharacterPortrait look={look} size={size} />;
}
export function Sheet({
  title,
  kicker,
  children,
  close,
  modal = false,
  primary,
  icon = "map-pin",
  color,
  tone,
  peek = false,
  notice,
  dismissible = true,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
  close: () => void;
  modal?: boolean;
  primary?: ReactNode;
  icon?: string;
  color?: string;
  tone?: string;
  peek?: boolean;
  notice?: ReactNode;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLElement>(null),
    [extent, setExtent] = useState<"peek" | "half" | "full">(
      peek ? "peek" : "half",
    ),
    start = useRef(0),
    dragged = useRef(false);
  useEffect(() => {
    sound("open");
  }, []);
  useEffect(() => {
    const previous =
      getPanelTrigger() ?? (document.activeElement as HTMLElement | null);
    const el = ref.current;
    el?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        close();
        return;
      }
      if (e.key === "Tab" && modal && el) {
        const items = Array.from(
          el.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
          ),
        );
        const first = items[0],
          last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === el)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el?.addEventListener("keydown", key);
    return () => {
      el?.removeEventListener("keydown", key);
      requestAnimationFrame(() => {
        if (document.activeElement?.closest(".sheet")) return;
        if (previous?.isConnected) previous.focus();
        else {
          const label = previous?.getAttribute("aria-label"),
            text = previous?.textContent;
          Array.from(document.querySelectorAll<HTMLElement>("button"))
            .find((b) =>
              label
                ? b.getAttribute("aria-label") === label
                : b.textContent === text,
            )
            ?.focus();
        }
      });
    };
  }, [close, modal, dismissible]);
  const step = (direction = 1) =>
    setExtent((e) => {
      const index = ["peek", "half", "full"].indexOf(e);
      return ["peek", "half", "full"][
        Math.max(0, Math.min(2, index + direction))
      ] as typeof extent;
    });
  return (
    <div className={modal ? "modal-wrap" : "sheet-wrap"}>
      {modal && <div className="scrim" />}
      <section
        ref={ref}
        data-game-sheet={modal ? undefined : true}
        data-extent={extent}
        tabIndex={-1}
        className={`sheet ${modal ? "modal" : ""} ${primary ? "has-primary" : ""}`}
        role={modal ? "dialog" : "region"}
        aria-modal={modal || undefined}
        aria-label={title}
      >
        {!modal && (
          <button
            className="sheet-handle"
            aria-label={`Resize panel: ${extent}. Tap to ${extent === "full" ? "peek" : "expand"}`}
            onPointerDown={(e) => {
              start.current = e.clientY;
              dragged.current = false;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerUp={(e) => {
              const delta = start.current - e.clientY;
              if (Math.abs(delta) > 30) {
                dragged.current = true;
                step(delta > 0 ? 1 : -1);
              }
            }}
            onClick={() => {
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              setExtent((e) =>
                e === "peek" ? "half" : e === "half" ? "full" : "peek",
              );
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                step(e.key === "ArrowUp" ? 1 : -1);
              }
            }}
          >
            <span />
          </button>
        )}
        <div className="sheet-heading">
          <span
            className={`semantic-tile ${tone ?? ""}`}
            style={color ? { background: color, color: "#fff" } : undefined}
          >
            <Icon name={icon} />
          </span>
          <div>
            <h2>{title}</h2>
            {kicker && <span className="sheet-kicker">{kicker}</span>}
          </div>
          {dismissible && (
            <button
              className="icon-button"
              onClick={close}
              aria-label="Close panel"
            >
              <X size={20} weight="bold" />
            </button>
          )}
        </div>
        {primary && <div className="sheet-primary">{primary}</div>}
        <div className="sheet-body">
          {notice}
          {children}
        </div>
      </section>
    </div>
  );
}
export function SectionTitle({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: string;
}) {
  return (
    <h3 className="section-title">
      <Icon name={icon} size={17} />
      {children}
    </h3>
  );
}
