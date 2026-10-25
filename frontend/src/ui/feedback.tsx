import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Airplane,
  AirplaneLanding,
  Barbell,
  Bed,
  BookOpen,
  Briefcase,
  ChatCircleDots,
  CheckCircle,
  Coins,
  CookingPot,
  ForkKnife,
  Gift,
  HandWaving,
  Handshake,
  House,
  Laptop,
  MapPin,
  Megaphone,
  MusicNotes,
  ShoppingBag,
  Shower,
  Sparkle,
  Star,
  Storefront,
  TShirt,
  Target,
  Trophy,
  WarningCircle,
  XCircle,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { onFeedback, type FeedbackEvent, type FeedbackKind } from "../feedback";
import { useStore } from "../store";
import { money } from "./helpers";
import { Icon } from "./primitives";
import {
  cue,
  sound,
  toggleSound,
  unlockAudio,
  type Cue,
  type SoundKind,
} from "./sound";
import { useAudioMix } from "./audio";
import {
  feedbackHold,
  projectFeedbackAnchor,
  type ScreenPoint,
} from "./feedback-anchor";
import "./feedback.css";

export function SoundButton() {
  const mix = useAudioMix(),
    off = mix.muted;
  return (
    <button
      className="icon-button plate-button sound-toggle"
      aria-label={
        off ? "Turn music and sound on (M)" : "Mute music and sound (M)"
      }
      title={off ? "Turn music on · M" : "Music and sound · M to mute"}
      aria-pressed={!off}
      onClick={() => {
        toggleSound();
        void unlockAudio();
      }}
    >
      <Icon name={off ? "speaker-off" : "speaker-high"} size={22} />
    </button>
  );
}

export function CashCounter({ cash }: { cash: number }) {
  const ref = useRef<HTMLSpanElement>(null),
    shown = useRef(cash),
    [initial] = useState(cash);
  useEffect(() => {
    const from = shown.current,
      target = cash,
      at = performance.now(),
      reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - at) / 650);
      shown.current = from + (target - from) * (1 - (1 - t) ** 3);
      if (ref.current) ref.current.textContent = money(shown.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cash]);
  return (
    <span ref={ref} className="cash-value">
      {money(initial)}
    </span>
  );
}

// ---- what each outcome looks and sounds like --------------------------------

type Tone = "good" | "money" | "bad" | "social" | "calm" | "big";
type Toast = {
  id: number;
  kind: FeedbackKind;
  tone: Tone;
  icon: PhosphorIcon;
  kicker: string;
  title: string;
  detail?: string;
  amount?: number;
  count: number;
  leaving: boolean;
  life: number;
};

/** Activity family from a label, shared by the toast icon and the foley sound. */
function activityFamily(label: string) {
  const l = label.toLowerCase();
  if (/sleep|nap|bed|rest/.test(l)) return "sleep";
  if (/shower|wash|bath/.test(l)) return "shower";
  if (/cook|prepare|bake/.test(l)) return "cook";
  if (/eat|meal|food|lunch|dinner|breakfast|snack|coffee|drink/.test(l))
    return "eat";
  if (/dance|concert|band|music|sing|perform|cheer/.test(l)) return "music";
  if (/gym|work ?out|train|run|jog|yoga|exercise/.test(l)) return "fitness";
  if (/read|study|learn|class|book/.test(l)) return "study";
  if (/work|shift|code|type|desk/.test(l)) return "work";
  return "other";
}
const familyIcon: Record<string, PhosphorIcon> = {
  sleep: Bed,
  shower: Shower,
  cook: CookingPot,
  eat: ForkKnife,
  music: MusicNotes,
  fitness: Barbell,
  study: BookOpen,
  work: Laptop,
  other: Sparkle,
};
const familyFoley: Partial<Record<string, SoundKind>> = {
  sleep: "sleep",
  shower: "shower",
  cook: "cook",
  eat: "eat",
  work: "type",
  music: "dance",
};
function purchaseIcon(title: string): PhosphorIcon {
  const t = title.toLowerCase();
  if (/plane|flight|ticket|bus|train/.test(t)) return Airplane;
  if (/home|rent|move/.test(t)) return House;
  if (/outfit|wardrobe|clothes|look/.test(t)) return TShirt;
  if (/plot|stall|market/.test(t)) return Storefront;
  if (/billboard|advert/.test(t)) return Megaphone;
  return ShoppingBag;
}
const socialWord = (e: FeedbackEvent) => String(e.data?.social ?? "wave");

function describe(e: FeedbackEvent): Omit<Toast, "id" | "count" | "leaving"> {
  const base = { kind: e.kind, title: e.title, detail: e.detail };
  switch (e.kind) {
    case "actionStart":
      return {
        ...base,
        tone: "calm",
        icon: familyIcon[activityFamily(e.title)],
        kicker: "Started",
        amount: e.amount && e.amount < 0 ? e.amount : undefined,
        detail: undefined,
        life: 2200,
      };
    case "actionDone": {
      const cash = e.amount ?? 0;
      return {
        ...base,
        tone: cash > 0 ? "money" : "good",
        icon: cash > 0 ? Coins : familyIcon[activityFamily(e.title)],
        kicker: cash > 0 ? "Paid" : "Finished",
        amount: cash || undefined,
        life: 3600,
      };
    }
    case "cancel":
      return {
        ...base,
        tone: "calm",
        icon: XCircle,
        kicker: "Stopped",
        life: 2200,
      };
    case "error":
      return {
        ...base,
        tone: "bad",
        icon: WarningCircle,
        kicker: "Not just now",
        life: 3800,
      };
    case "social": {
      const kind = socialWord(e);
      return {
        ...base,
        tone: "social",
        icon:
          kind === "gift" ? Gift : kind === "hangout" ? Handshake : HandWaving,
        kicker:
          kind === "gift"
            ? "Gift sent"
            : kind === "hangout"
              ? "Hanging out"
              : "You waved",
        amount: e.amount,
        life: 2800,
      };
    }
    case "socialReceived": {
      const kind = socialWord(e);
      return {
        ...base,
        tone: "social",
        icon:
          kind === "gift" ? Gift : kind === "hangout" ? Handshake : HandWaving,
        kicker:
          kind === "gift"
            ? "A gift for you"
            : kind === "hangout"
              ? "Time together"
              : "Someone said hi",
        amount: kind === "gift" ? e.amount : undefined,
        life: 4600,
      };
    }
    case "purchase":
      return {
        ...base,
        tone: "money",
        icon: purchaseIcon(e.title),
        kicker: "Paid",
        amount: e.amount,
        life: 3200,
      };
    case "rent":
      return {
        ...base,
        tone: "money",
        icon: House,
        kicker: "Rent paid",
        amount: e.amount,
        life: 3600,
      };
    case "levelUp":
      return {
        ...base,
        tone: "big",
        icon: Star,
        kicker: "Level up",
        life: 4800,
      };
    case "promotion":
      return {
        ...base,
        tone: "big",
        icon: Briefcase,
        kicker: e.data?.hired ? "New job" : "Promotion",
        life: 5200,
      };
    case "milestone":
      return {
        ...base,
        tone: "big",
        icon: Trophy,
        kicker: "Milestone reached",
        amount: e.amount,
        life: 5200,
      };
    case "goal":
      return {
        ...base,
        tone: "good",
        icon: Target,
        kicker: "Goal complete",
        life: 4000,
      };
    case "arrival":
      return {
        ...base,
        tone: "calm",
        icon: MapPin,
        kicker: "You're here",
        life: 2600,
      };
    case "travel":
      return {
        ...base,
        tone: "good",
        icon: AirplaneLanding,
        kicker: "Welcome",
        life: 3800,
      };
    case "chat":
      return {
        kind: e.kind,
        tone: "calm",
        icon: ChatCircleDots,
        kicker: e.title,
        title: e.detail ?? "",
        life: 3800,
      };
  }
}

/** The single sound a batch of simultaneous outcomes deserves (plus an optional coin layer). */
const priority: Record<FeedbackKind, number> = {
  promotion: 10,
  milestone: 9,
  levelUp: 8,
  goal: 7,
  travel: 6,
  socialReceived: 6,
  error: 5,
  arrival: 4,
  actionDone: 4,
  purchase: 3,
  rent: 3,
  social: 3,
  cancel: 2,
  actionStart: 2,
  chat: 1,
};
const moneyKinds = new Set<FeedbackKind>([
  "actionDone",
  "purchase",
  "rent",
  "milestone",
  "social",
  "socialReceived",
  "actionStart",
]);
function primaryCue(e: FeedbackEvent): Cue {
  switch (e.kind) {
    case "actionStart":
      return "confirm";
    case "actionDone":
      return (e.amount ?? 0) > 0 ? "coinGain" : "done";
    case "cancel":
      return "cancel";
    case "error":
      return "error";
    case "social":
      return "pluck";
    case "socialReceived":
      return "ding";
    case "purchase":
    case "rent":
      return "coinSpend";
    case "levelUp":
      return "level";
    case "promotion":
      return "promotion";
    case "milestone":
      return "milestone";
    case "goal":
      return "goal";
    case "arrival":
    case "travel":
      return "whoosh";
    case "chat":
      return "chat";
  }
}
function playBatch(batch: FeedbackEvent[]) {
  const top = batch.reduce((a, b) =>
    priority[b.kind] > priority[a.kind] ? b : a,
  );
  const main = primaryCue(top);
  cue(main, top.kind === "rent" ? { rate: 0.86 } : undefined);
  if (top.kind === "arrival" || top.kind === "travel")
    cue("arrive", { delay: top.kind === "travel" ? 0.26 : 0.16 });
  if (top.kind === "actionStart") {
    const foley = familyFoley[activityFamily(top.title)];
    if (foley) window.setTimeout(() => sound(foley), 140);
  }
  if (main === "coinGain" || main === "coinSpend") return;
  const cash = batch
    .filter((e) => moneyKinds.has(e.kind))
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);
  if (cash > 0)
    cue("coinGain", { delay: top.kind === "milestone" ? 0.75 : 0.3 });
  else if (cash < 0) cue("coinSpend", { delay: 0.18, gain: 0.8 });
}

/** While the older HUD toasts are still mounted, do not show the same moment twice. */
function legacyShowing(e: FeedbackEvent) {
  if (e.kind === "actionDone")
    return !!document.querySelector(
      ".result-toast:not(.inline-result):not(.social-notice)",
    );
  if (e.kind === "goal") return !!document.querySelector(".celebration-toast");
  if (
    e.kind === "social" ||
    e.kind === "socialReceived" ||
    e.kind === "promotion"
  ) {
    // Only when the older notice shows this very moment (same sentence or job title).
    const text = document.querySelector(".social-notice")?.textContent ?? "";
    const key =
      e.kind === "promotion"
        ? e.title.replace(/^(Promoted to|Hired as) /, "")
        : e.title;
    return !!text && !!key && text.includes(key);
  }
  return false;
}

const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
const signed = (amount: number) =>
  `${amount < 0 ? "−" : "+"}$${Math.abs(Math.round(amount)).toLocaleString("en-US")}`;
const holdFor = (life: number) => feedbackHold() || life,
  slowFor = (ms: number) => (feedbackHold() ? ms * 12 : ms);
const COINS = 6,
  FLOATS = 4;
let activeLayers = 0;

// ---- the layer ---------------------------------------------------------------

/**
 * Toasts, floating money labels and the coin flight for every feedback-bus outcome.
 * Mount once inside the HUD. Rendering happens only when an outcome arrives.
 */
export function FeedbackLayer() {
  const [toasts, setToasts] = useState<Toast[]>([]),
    list = useRef<Toast[]>([]),
    coins = useRef<(HTMLSpanElement | null)[]>([]),
    floats = useRef<(HTMLSpanElement | null)[]>([]),
    nextFloat = useRef(0),
    point = useRef<ScreenPoint>({ x: 0, y: 0, visible: false });

  useEffect(() => {
    // Only one mounted layer reacts (the HUD may mount both FeedbackLayer and the RewardFlight alias).
    if (activeLayers > 0) return;
    activeLayers++;
    let id = 0,
      pending: FeedbackEvent[] = [],
      flush: number | undefined;
    const timers = new Set<number>(),
      later = (fn: () => void, ms: number) => {
        const t = window.setTimeout(() => {
          timers.delete(t);
          fn();
        }, ms);
        timers.add(t);
      },
      lastChat = { at: 0 };

    const commit = (next: Toast[]) => {
      list.current = next;
      setToasts(next);
    };
    const dismiss = (toastId: number) => {
      commit(
        list.current.map((t) =>
          t.id === toastId ? { ...t, leaving: true } : t,
        ),
      );
      later(() => commit(list.current.filter((t) => t.id !== toastId)), 240);
    };

    const showToast = (e: FeedbackEvent) => {
      const look = describe(e);
      if (!look.title.trim()) return;
      const max = innerWidth <= 700 ? 2 : 3,
        same = list.current.find(
          (t) => !t.leaving && t.kind === look.kind && t.title === look.title,
        );
      if (same) {
        // Repeats merge into one card with a count instead of stacking.
        commit(
          list.current.map((t) =>
            t === same
              ? {
                  ...t,
                  count: t.count + 1,
                  amount: (t.amount ?? 0) + (look.amount ?? 0) || undefined,
                }
              : t,
          ),
        );
        return;
      }
      const created = ++id,
        next = [
          ...list.current.filter((t) => !t.leaving),
          { ...look, id: created, count: 1, leaving: false },
        ];
      // Big moments outlive small ones when space runs out.
      while (next.length > max) {
        const drop = next.findIndex((t) => t.tone !== "big");
        next.splice(drop >= 0 ? drop : 0, 1);
      }
      commit(next);
      later(() => dismiss(created), holdFor(look.life));
    };

    const floatLabel = (
      text: string,
      tone: "gain" | "spend" | "level",
      at: ScreenPoint,
    ) => {
      const el = floats.current[nextFloat.current++ % FLOATS];
      if (!el) return;
      el.textContent = text;
      el.dataset.tone = tone;
      el.getAnimations().forEach((a) => a.cancel());
      const x = Math.max(40, Math.min(innerWidth - 40, at.x)),
        y = Math.max(70, Math.min(innerHeight - 60, at.y));
      el.animate(
        reducedMotion()
          ? [
              {
                transform: `translate(${x}px,${y}px) translate(-50%,-100%)`,
                opacity: 0,
              },
              { opacity: 1, offset: 0.2 },
              { opacity: 1, offset: 0.8 },
              {
                transform: `translate(${x}px,${y}px) translate(-50%,-100%)`,
                opacity: 0,
              },
            ]
          : [
              {
                transform: `translate(${x}px,${y + 14}px) translate(-50%,-100%) scale(.6)`,
                opacity: 1,
              },
              {
                transform: `translate(${x}px,${y - 6}px) translate(-50%,-100%) scale(1.08)`,
                opacity: 1,
                offset: 0.18,
              },
              {
                transform: `translate(${x}px,${y - 22}px) translate(-50%,-100%) scale(1)`,
                opacity: 1,
                offset: 0.7,
              },
              {
                transform: `translate(${x}px,${y - 46}px) translate(-50%,-100%) scale(.96)`,
                opacity: 0,
              },
            ],
        {
          duration: slowFor(1500),
          easing: "cubic-bezier(.2,.7,.2,1)",
          fill: "forwards",
        },
      );
    };

    const flyCoins = (amount: number, at: ScreenPoint) => {
      const counter = document.querySelector<HTMLElement>("[data-cash]");
      if (!counter || reducedMotion()) return;
      const box = counter.getBoundingClientRect();
      if (!box.width) return;
      const cx = box.left + Math.min(box.width / 2, 40),
        cy = box.top + box.height / 2,
        gain = amount > 0,
        count = Math.min(
          COINS,
          2 + Math.floor(Math.log10(Math.abs(amount) + 1) * 1.6),
        );
      for (let i = 0; i < count; i++) {
        const el = coins.current[i];
        if (!el) continue;
        el.getAnimations().forEach((a) => a.cancel());
        const jitter = (i - count / 2) * 14,
          fromX = gain ? at.x + jitter : cx,
          fromY = gain ? at.y : cy,
          toX = gain ? cx : at.x + jitter,
          toY = gain ? cy : at.y,
          midX = (fromX + toX) / 2 + (gain ? -30 : 30),
          midY = Math.min(fromY, toY) - 70 - i * 6;
        el.animate(
          [
            {
              transform: `translate(${fromX}px,${fromY}px) scale(.4)`,
              opacity: 1,
            },
            {
              transform: `translate(${fromX}px,${fromY - 10}px) scale(1)`,
              opacity: 1,
              offset: 0.12,
            },
            {
              transform: `translate(${midX}px,${midY}px) scale(1)`,
              opacity: 1,
              offset: 0.55,
            },
            {
              transform: `translate(${toX}px,${toY}px) scale(${gain ? 0.7 : 0.5})`,
              opacity: gain ? 1 : 0,
            },
          ],
          {
            duration: slowFor(760),
            delay: 160 + i * 75,
            easing: "cubic-bezier(.45,.05,.35,1)",
            fill: "forwards",
          },
        ).onfinish = (event) => {
          (event.target as Animation | null)?.cancel();
          if (gain && i === count - 1)
            counter.animate(
              [
                { transform: "scale(1)" },
                { transform: "scale(1.12)" },
                { transform: "scale(1)" },
              ],
              { duration: 260, easing: "ease-out" },
            );
        };
      }
    };

    const visualise = (e: FeedbackEvent) => {
      if (e.kind === "chat") {
        if (e.data?.npc || useStore.getState().panel === "chat") return;
        if (performance.now() - lastChat.at < 2500) return;
        lastChat.at = performance.now();
      }
      if (legacyShowing(e)) {
        // The older HUD toast already shows it; still give the world response.
      } else showToast(e);
      const amount = e.amount ?? 0;
      if (moneyKinds.has(e.kind) && amount !== 0 && Math.abs(amount) >= 1) {
        const at = projectFeedbackAnchor(
          e.kind === "socialReceived" ? undefined : e.anchor,
          2.3,
          point.current,
        );
        if (at) {
          floatLabel(signed(amount), amount > 0 ? "gain" : "spend", at);
          flyCoins(amount, { ...at });
        }
      } else if (e.kind === "levelUp" || e.kind === "promotion") {
        const at = projectFeedbackAnchor(undefined, 2.4, point.current);
        if (at)
          floatLabel(e.kind === "levelUp" ? e.title : "New role", "level", at);
      }
    };

    if (import.meta.env.DEV)
      (window as unknown as { __feedbackClear?: () => void }).__feedbackClear =
        () => commit([]);
    const off = onFeedback((e) => {
      if (
        e.kind === "chat" &&
        (e.data?.npc || useStore.getState().panel === "chat")
      )
        return;
      // Older toasts render a frame after the store changes; look once React has painted.
      later(() => visualise(e), 90);
      pending.push(e);
      if (flush === undefined)
        flush = window.setTimeout(() => {
          const batch = pending;
          pending = [];
          flush = undefined;
          playBatch(batch);
        }, 40);
    });
    return () => {
      activeLayers--;
      off();
      timers.forEach((t) => clearTimeout(t));
      if (flush !== undefined) clearTimeout(flush);
    };
  }, []);

  return (
    <div className="feedback-layer">
      <ol className="feedback-toasts" aria-live="polite">
        {toasts.map((t) => (
          <FeedbackToast key={t.id} toast={t} />
        ))}
      </ol>
      {Array.from({ length: COINS }, (_, i) => (
        <span
          key={`coin-${i}`}
          className="feedback-coin"
          aria-hidden="true"
          ref={(el) => {
            coins.current[i] = el;
          }}
        >
          <Coins size={18} weight="fill" />
        </span>
      ))}
      {Array.from({ length: FLOATS }, (_, i) => (
        <span
          key={`float-${i}`}
          className="feedback-float"
          aria-hidden="true"
          ref={(el) => {
            floats.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}

function FeedbackToast({ toast }: { toast: Toast }): ReactNode {
  const IconComponent = toast.icon;
  return (
    <li
      className={`feedback-toast tone-${toast.tone}${toast.leaving ? " is-leaving" : ""}`}
      data-kind={toast.kind}
      role={toast.kind === "error" ? "alert" : undefined}
    >
      <span className="feedback-icon" aria-hidden="true">
        <IconComponent size={22} weight="duotone" />
        {toast.kind === "goal" && (
          <CheckCircle className="feedback-badge" size={16} weight="fill" />
        )}
      </span>
      <span className="feedback-text">
        <small>
          {toast.kicker}
          {toast.count > 1 ? ` ×${toast.count}` : ""}
        </small>
        <strong>{toast.title}</strong>
        {toast.detail && (
          <span className="feedback-detail">{toast.detail}</span>
        )}
      </span>
      {toast.amount !== undefined && toast.amount !== 0 && (
        <b
          className={`feedback-amount ${toast.amount > 0 ? "is-gain" : "is-spend"}`}
        >
          {signed(toast.amount)}
        </b>
      )}
    </li>
  );
}

/** Kept for the HUD's existing mount point; renders the whole feedback layer. */
export const RewardFlight = FeedbackLayer;
