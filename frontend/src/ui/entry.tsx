import { useState } from "react";
import { QuickStart } from "./quick-start";
import { api } from "../api/client";
import type { FirstDayStep } from "../api/types";
import { useStore } from "../store";
import { CharacterCreator, PersonalitySummary } from "./character-creator";
import { ReasonButton, ErrorMessage, Icon, titleCase } from "./primitives";
import { money, useTask } from "./helpers";
import "./entry.css";
import { AudioSettings } from "./audio";
const state = () => useStore.getState();
export function Creator() {
  const [custom, setCustom] = useState(false);
  return custom ? (
    <CharacterCreator />
  ) : (
    <div className="life-start quick-start-shell">
      <QuickStart onCustomize={() => setCustom(true)} />
    </div>
  );
}
export function Intro() {
  const sim = useStore((s) => s.sim)!,
    world = useStore((s) => s.world)!,
    [card, setCard] = useState(0),
    { working, error, run } = useTask(),
    city = world.cities.find((c) => c.id === sim.city)!,
    subject =
      sim.pronouns === "she" ? "She" : sim.pronouns === "he" ? "He" : "They";
  const cards = [
    {
      title: `A beginning in ${city.id === "bay" ? "the " + city.name : city.name}`,
      text: `${sim.username} arrives with one suitcase and a key. ${subject} ${sim.pronouns === "they" ? "have" : "has"} a city to get to know.`,
      icon: "train-front",
    },
    {
      title: "Room to begin",
      text: "A bed, a stove, a shower and one chair. It is small, but for now it is yours.",
      icon: "house",
    },
    {
      title: "A little to live on",
      text: `You have $150. Your studio costs ${money(sim.home.rent)} a day. Entry shifts here pay ${money(city.startingLife?.payPerShift ?? 70)}. Make time for a meal and a roof over your head.`,
      icon: "wallet",
    },
    {
      title: "Your street is waiting",
      text: "Step outside. Look for a Help wanted sign. There are neighbours to meet and a first day to make your own.",
      icon: "footprints",
    },
  ];
  const c = cards[card];
  return (
    <div className="intro-story">
      <section
        className="plate"
        role="dialog"
        aria-modal="true"
        aria-label="Your arrival"
      >
        <span className="semantic-tile travel">
          <Icon name={c.icon} />
        </span>
        <span className="eyebrow">
          Your arrival · {card + 1} of {cards.length}
        </span>
        <h1>{c.title}</h1>
        <p>{c.text}</p>
        <div className="intro-dots" aria-hidden="true">
          {cards.map((_, i) => (
            <span key={i} aria-current={i === card ? "step" : undefined} />
          ))}
        </div>
        <ErrorMessage text={error} />
        <ReasonButton
          className="primary full"
          reason={working ? "Saving your life…" : ""}
          onClick={() => {
            if (card < 3) {
              setCard(card + 1);
              if (card === 2) state().setFocus("home");
            } else
              void run(async () => {
                const r = await api.finishIntro();
                state().setSim(r.sim);
              });
          }}
        >
          {card < 3 ? "Next" : "Turn the key"}
          <Icon name={card < 3 ? "arrow-right" : "key-round"} />
        </ReasonButton>
      </section>
    </div>
  );
}
const GOALS: { id: FirstDayStep; label: string; hint: string; icon: string }[] =
  [
    {
      id: "outside",
      label: "Step outside",
      hint: "Walk to your door and use the interact button.",
      icon: "footprints",
    },
    {
      id: "job",
      label: "Find your first job",
      hint: "Walk to a Help wanted sign. Apply at the workplace desk.",
      icon: "briefcase",
    },
    {
      id: "shift",
      label: "Work your first shift",
      hint: "Return to your work desk to begin.",
      icon: "briefcase",
    },
    {
      id: "meal",
      label: "Buy a cafe meal",
      hint: "Walk to the cafe and order at the counter.",
      icon: "utensils",
    },
    {
      id: "neighbour",
      label: "Meet a neighbour",
      hint: "Walk up to someone outside or in a public room and wave.",
      icon: "users",
    },
    {
      id: "rent",
      label: "Pay your first rent",
      hint: "Rent is taken at midnight. You can also pay ahead from Your life.",
      icon: "house",
    },
  ];
/** Compact first-day cue for the HUD. Re-renders only when a step changes. */
function FirstDayCue() {
  const steps = useStore((s) => {
    const f = s.sim?.firstDay;
    if (!f) return "";
    if (f.complete) return s.sim!.home.kind === "studio" ? "next" : "";
    return GOALS.map((g) => (f[g.id] ? "1" : "0")).join("");
  });
  if (!steps) return null;
  if (steps === "next")
    return (
      <button
        className="first-day-cue plate"
        onClick={() => state().openPanel("homes")}
      >
        <span className="semantic-tile rest">
          <Icon name="house" />
        </span>
        <span>
          <small>Next chapter</small>
          <strong>Save for a better home</strong>
        </span>
      </button>
    );
  const done = [...steps].filter((c) => c === "1").length,
    next = GOALS[steps.indexOf("0")] ?? GOALS[GOALS.length - 1];
  return (
    <button
      className="first-day-cue plate"
      aria-label={`First day, ${done} of ${GOALS.length} done. Next: ${next.label}`}
      onClick={() => state().openPanel("sim")}
    >
      <span className="semantic-tile work">
        <Icon name={next.icon} />
      </span>
      <span>
        <small>
          First day {done}/{GOALS.length}
        </small>
        <strong>{next.label}</strong>
      </span>
    </button>
  );
}
export function FirstDayGoals({ compact = false }: { compact?: boolean }) {
  const sim = useStore((s) => (compact ? null : s.sim));
  if (compact) return <FirstDayCue />;
  if (!sim?.firstDay || sim.firstDay.complete) return null;
  const next = GOALS.find((g) => !sim.firstDay![g.id])!;
  return (
    <section className="first-day-goals">
      <h3>Your first day</h3>
      {GOALS.map((g) => (
        <div
          key={g.id}
          className={
            sim.firstDay![g.id]
              ? "done"
              : next.id === g.id
                ? "current"
                : "later"
          }
        >
          <Icon name={sim.firstDay![g.id] ? "check" : g.icon} />
          <span>
            <strong>{g.label}</strong>
            <small>
              {g.id === "rent"
                ? `${money(sim.home.rent)} a day, taken at midnight. You can also pay ahead from Your life.`
                : g.hint}
            </small>
          </span>
          <small>
            {sim.firstDay![g.id] ? "Done" : next.id === g.id ? "Now" : "Later"}
          </small>
        </div>
      ))}
    </section>
  );
}
export function FirstRentPrimary() {
  const sim = useStore((s) => s.sim)!,
    { working, error, run } = useTask(true);
  if (sim.firstDay?.rent) return null;
  const inside = sim.position?.room?.startsWith("home:");
  return (
    <>
      <ReasonButton
        className="primary full"
        reason={
          working
            ? "Paying your rent…"
            : !inside
              ? "Return home to pay rent"
              : sim.busyUntil
                ? "Finish your activity first"
                : sim.pendingBeat
                  ? "Choose your story first"
                  : sim.cash < sim.home.rent
                    ? `Save ${money(sim.home.rent)} to pay your first rent`
                    : ""
        }
        onClick={() =>
          run(async () => {
            const r = await api.payFirstRent();
            state().setSim(r.sim);
          })
        }
      >{`Pay first rent · ${money(sim.home.rent)}`}</ReasonButton>
      <ErrorMessage text={error} />
    </>
  );
}
export function Settings() {
  const quality = useStore((s) => s.sceneQuality),
    walls = useStore((s) => s.wallMode),
    sim = useStore((s) => s.sim)!,
    [confirm, setConfirm] = useState(false),
    { working, error, run } = useTask();
  return (
    <>
      <AudioSettings />
      <PersonalitySummary />
      <h3>Image quality</h3>
      <p className="small-copy">
        Both settings keep the image at full resolution. Low uses less battery
        and turns off ambient occlusion. Sustained slow play switches to Low
        automatically.
      </p>
      <div className="creator-options">
        {(["normal", "low"] as const).map((q) => (
          <button
            className="secondary"
            key={q}
            aria-pressed={quality === q}
            onClick={() => state().setSceneQuality(q)}
          >
            {q === "normal" ? "Cozy" : "Low"}
          </button>
        ))}
      </div>
      <h3>Room walls</h3>
      <div className="creator-options">
        {(["up", "cutaway", "down"] as const).map((mode) => (
          <button
            className="secondary"
            key={mode}
            aria-pressed={walls === mode}
            onClick={() => state().setWallMode(mode)}
          >
            {mode === "up"
              ? "Walls up"
              : mode === "down"
                ? "Walls down"
                : "Cutaway"}
          </button>
        ))}
      </div>
      <h3>Your wardrobe</h3>
      <p className="small-copy">
        Casual and street are yours. A job unlocks work clothes.
      </p>
      <div className="wardrobe">
        {["casual", "street", "work", "smart", "party"].map((style) => {
          const owned =
              ["casual", "street"].includes(style) ||
              !!sim.outfits?.[style] ||
              (style === "work" && !!sim.job),
            cost = style === "party" ? 90 : 120;
          return (
            <ReasonButton
              key={style}
              className="secondary"
              reason={
                working
                  ? "Updating your wardrobe…"
                  : sim.busyUntil
                    ? "Finish your activity first"
                    : sim.pendingBeat
                      ? "Choose your story first"
                      : style === "work" && !sim.job
                        ? "Find a job to unlock work clothes"
                        : !owned && sim.cash < cost
                          ? `Save ${money(cost)} to buy this outfit`
                          : ""
              }
              aria-pressed={sim.look.style === style}
              onClick={() =>
                run(async () => {
                  const r = await api.outfit(style);
                  state().setSim(r.sim);
                })
              }
            >
              {titleCase(style)}
              <small>
                {owned
                  ? "Owned"
                  : style === "work"
                    ? "Find a job"
                    : money(cost)}
              </small>
            </ReasonButton>
          );
        })}
      </div>
      <h3>Start a new life</h3>
      <p>
        This city keeps going. Starting again replaces your character, home,
        money and progress on this browser.
      </p>
      {confirm ? (
        <div
          className="new-life-confirm"
          role="group"
          aria-label="Confirm new life"
        >
          <strong>Leave this life behind?</strong>
          <ReasonButton
            className="secondary full"
            reason={working ? "Saving your life…" : ""}
            onClick={() => setConfirm(false)}
          >
            Keep my life
          </ReasonButton>
          <ReasonButton
            className="primary full"
            reason={working ? "Saving your life…" : ""}
            onClick={() =>
              run(() => state().changeSession(() => api.newLife()))
            }
          >
            Yes, start a new life
          </ReasonButton>
        </div>
      ) : (
        <button className="secondary full" onClick={() => setConfirm(true)}>
          Start a new life
        </button>
      )}
      <ErrorMessage text={error} />
      <p className="small-copy">
        Your life is saved for this browser on this local server. Keep this
        browser’s site data to return to your character and progress.
      </p>
    </>
  );
}

export function FirstDayClosing() {
  const sim = useStore((s) => s.sim)!,
    world = useStore((s) => s.world)!,
    { working, error, run } = useTask();
  const city = world.cities.find((c) => c.id === sim.city)!;
  return (
    <div className="intro-story">
      <section
        className="plate"
        role="dialog"
        aria-modal="true"
        aria-label="Your first day is complete"
      >
        <span className="semantic-tile money">
          <Icon name="sun" />
        </span>
        <span className="eyebrow">A life taking shape</span>
        <h1>
          Your first day in {city.id === "bay" ? "the " + city.name : city.name}
          .
        </h1>
        <p>Rent paid, a job, a friend. You have made a beginning.</p>
        <p>
          <strong>Next: save for a better home.</strong>
          <br />
          Keep working, look after yourself, and find a place with room to grow.
        </p>
        <ErrorMessage text={error} />
        <ReasonButton
          className="primary full"
          reason={working ? "Saving your life…" : ""}
          onClick={() =>
            run(async () => {
              const r = await api.finishFirstDay();
              state().setSim(r.sim);
              state().setLastResult(null);
              useStore.setState({ socialNotice: "" });
              state().openPanel("homes");
            })
          }
        >
          See what comes next
          <Icon name="arrow-right" />
        </ReasonButton>
      </section>
    </div>
  );
}
