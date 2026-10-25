import { serverNow } from "../server-time";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import { apiUrl } from "../api/base";
import type { CityId, Rect } from "../api/types";
import { useStore } from "../store";
import {
  ReasonButton,
  Avatar,
  ErrorMessage,
  Icon,
  SectionTitle,
} from "./primitives";
import { money, useNow, useTask } from "./helpers";
import { sound } from "./sound";
import { plotRectangle } from "../plot-selection";
/** The server's own list of what is left on the first day, when it sends one. */
const firstDayLeft = (sim: { firstDay?: object | null }, fallback: string) =>
  (sim.firstDay as { remaining?: string } | null | undefined)?.remaining ||
  fallback;

const state = () => useStore.getState();
function useCivicBlock() {
  const sim = useStore((s) => s.sim),
    city = useStore((s) => s.city),
    acting = useStore((s) => s.acting);
  return !sim
    ? "Start your life first"
    : sim.city !== city
      ? "Travel here first"
      : acting
        ? "Sending…"
        : sim.busyUntil
          ? "Finish your activity first"
          : sim.pendingBeat
            ? "Choose your story first"
            : "";
}
const civicPlace = (city: CityId) =>
  city === "atl" ? "capitol" : city === "nyc" ? "cityHall" : "sfCityHall";
function useResource(kind: "mayor" | "plots" | "billboards" | "homes") {
  const city = useStore((s) => s.city),
    worldId = useStore((s) => s.worldInfo?.id),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const value =
          kind === "mayor"
            ? await api.mayor(city)
            : kind === "plots"
              ? await api.plots(city)
              : kind === "billboards"
                ? await api.billboards(city)
                : await api.homes(city);
        if (
          active &&
          state().city === city &&
          state().worldInfo?.id === worldId
        ) {
          useStore.setState({ [kind]: value });
          setError("");
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Could not read this city");
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [kind, city, worldId]);
  return error;
}
export function CityServices() {
  const city = useStore((s) => s.city);
  return (
    <>
      <SectionTitle icon="landmark">Life around the city</SectionTitle>
      <div className="city-services">
        {(
          [
            ["mayor", "City election", "landmark"],
            ["plots", "Book a plot", "map-pin"],
            ["billboard", "Billboards", "monitor-play"],
            ["homes", "Find a home", "house"],
            ["travel", "Travel between cities", "train-front"],
          ] as const
        ).map(([panel, label, icon]) => (
          <button
            className="secondary"
            key={panel}
            onClick={() => {
              if (panel === "mayor" && state().sim?.city === city) {
                void state()
                  .travelTo(civicPlace(city), "mayor")
                  .catch(() => {});
                return;
              }
              state().openPanel(panel);
              if (panel === "plots") state().setFocus("plots");
              if (panel === "billboard") {
                state().selectSlot(1);
                state().setFocus("billboard-1");
              }
            }}
          >
            <span className="semantic-tile">
              <Icon name={icon} />
            </span>
            {label}
            <Icon name="arrow-up-right" />
          </button>
        ))}
      </div>
    </>
  );
}
export function MayorPrimary() {
  const blocked = useCivicBlock();
  const m = useStore((s) => s.mayor),
    city = useStore((s) => s.city),
    sim = useStore((s) => s.sim);
  if (!m) return null;
  return m.running ? (
    <ReasonButton
      className="primary full"
      reason={
        blocked ||
        (!m.campaignReady
          ? "Campaign again tomorrow"
          : sim?.city !== city
            ? "Travel here first"
            : "")
      }
      title={blocked || undefined}
      onClick={() => {
        state().selectLocation(civicPlace(city));
        state().setFocus(civicPlace(city));
      }}
    >
      <Icon name="users" />
      Go campaign · Earn one support vote
      <Icon name="arrow-up-right" />
    </ReasonButton>
  ) : (
    <ReasonButton
      className="primary full"
      type="submit"
      form="mayor-run"
      reason={blocked || (m.canRun !== true ? m.canRun : "")}
      title={blocked || undefined}
    >
      <Icon name="landmark" />
      Join the ballot
      <Icon name="arrow-up-right" />
    </ReasonButton>
  );
}
export function MayorPanel() {
  const blocked = useCivicBlock();
  const userId = useStore((s) => s.sim?.userId),
    errorRead = useResource("mayor"),
    m = useStore((s) => s.mayor),
    city = useStore((s) => s.city),
    world = useStore((s) => s.world),
    now = useNow(),
    { working, error, run } = useTask(),
    [slogan, setSlogan] = useState(""),
    [message, setMessage] = useState(""),
    [notice, setNotice] = useState("");
  if (!m) return <p role="status">{errorRead || "Opening the ballot…"}</p>;
  const mutate = (
    kind: "run" | "vote" | "policy" | "announce",
    value: string,
  ) =>
    run(async () => {
      const next =
        kind === "run"
          ? await api.mayorRun(city, value)
          : kind === "vote"
            ? await api.mayorVote(city, value)
            : kind === "policy"
              ? await api.mayorPolicy(city, value)
              : await api.mayorAnnounce(city, value);
      state().setMayor(next);
      state().setSim((await api.sim()).sim);
      setNotice(
        kind === "vote"
          ? "Your vote is counted."
          : kind === "run"
            ? "You are on the ballot. Visit City Hall to campaign."
            : kind === "policy"
              ? "Your policy is in effect."
              : "Your announcement is posted.",
      );
      sound("tap");
    });
  const policy = world?.policies.find((p) => p.id === m.mayor?.policy);
  return (
    <>
      <div className="civic-hero">
        <span className="eyebrow">
          Term {m.term.id} · closes day {m.term.endsDay}
        </span>
        <h3>
          {m.mayor ? `${m.mayor.username}, Mayor` : "Your city. Your voice."}
        </h3>
        <p>
          Next result in {Math.max(0, Math.ceil((m.term.endsAt - now) / 60000))}{" "}
          real minutes. Most votes wins; a tie goes to the first candidate on
          the ballot. Results are saved even while you are away. Check this
          ballot when you return.
        </p>
        {policy && (
          <p className="notice">
            <Icon name={policy.icon} />
            {policy.banner}
            <br />
            {policy.effect}
          </p>
        )}
        {m.mayor?.announcement && (
          <blockquote>{m.mayor.announcement}</blockquote>
        )}
      </div>
      <p className="small-copy">
        One vote per term. Charisma 2 to run. Campaign once each game day for
        one support vote.
      </p>
      {blocked && (
        <p className="notice" role="status">
          {blocked}
        </p>
      )}
      <ErrorMessage text={errorRead || error} />
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {m.canVote !== true && (
        <p className="notice" role="status">
          {m.canVote}
        </p>
      )}
      <SectionTitle icon="users">The ballot</SectionTitle>
      {!m.candidates.length && (
        <p>No candidates yet. Be the first to stand for your city.</p>
      )}
      {m.candidates.map((candidate) => (
        <div className="candidate-row" key={candidate.id}>
          <Avatar look={candidate.look} size={44} />
          <div>
            <strong>{candidate.username}</strong>
            {candidate.id === userId && (
              <span className="candidate-self">
                You · You can vote for yourself
              </span>
            )}
            <p>{candidate.slogan}</p>
            <small>
              {candidate.votes} vote{candidate.votes === 1 ? "" : "s"}
            </small>
          </div>
          <ReasonButton
            className="secondary"
            reason={
              working
                ? "Counting your vote…"
                : blocked || (m.canVote !== true ? m.canVote : "")
            }
            title={blocked || (m.canVote === true ? undefined : m.canVote)}
            onClick={() => mutate("vote", candidate.id)}
          >
            {m.myVote === candidate.id
              ? "Voted"
              : candidate.id === userId
                ? "Vote for yourself"
                : "Vote"}
          </ReasonButton>
        </div>
      ))}
      {!m.running && (
        <form
          id="mayor-run"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate("run", slogan);
          }}
        >
          <SectionTitle icon="landmark">Stand for mayor</SectionTitle>
          <label className="field">
            Your slogan
            <input
              required
              minLength={3}
              maxLength={80}
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="What would you do for the city?"
            />
          </label>
          <small>Joining is free. Your term lasts three game days.</small>
        </form>
      )}
      {m.isMayor && (
        <>
          <SectionTitle icon="landmark">Your mayor's desk</SectionTitle>
          <p className="small-copy">
            Choose one policy for the week, active until this term ends.
          </p>
          {world?.policies.map((p) => (
            <ReasonButton
              key={p.id}
              className="policy-option secondary full"
              reason={
                working
                  ? "Saving your policy…"
                  : blocked ||
                    (m.mayor?.policy === p.id
                      ? "This policy is already active"
                      : m.mayor?.policy && now < m.term.endsAt
                        ? "Choose a new policy next term"
                        : "")
              }
              onClick={() => mutate("policy", p.id)}
            >
              <Icon name={p.icon} />
              <span>
                <strong>{p.label}</strong>
                <small>{p.effect}</small>
              </span>
              {m.mayor?.policy === p.id && <Icon name="check" />}
            </ReasonButton>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void mutate("announce", message);
            }}
          >
            <label className="field">
              City announcement
              <textarea
                required
                minLength={3}
                maxLength={140}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <ReasonButton
              className="secondary full"
              reason={working ? "Posting your announcement…" : blocked}
              title={blocked || undefined}
            >
              Post announcement
            </ReasonButton>
            <small>140 characters. No links. One per game hour.</small>
          </form>
        </>
      )}
    </>
  );
}
export function PlotPrimary() {
  const plots = useStore((s) => s.plots),
    rect = useStore((s) => s.plotSelection) ?? { x: 0, y: 0, w: 2, h: 2 },
    sim = useStore((s) => s.sim),
    city = useStore((s) => s.city),
    overlap = (a: Rect) =>
      rect.x < a.x + a.w &&
      rect.x + rect.w > a.x &&
      rect.y < a.y + a.h &&
      rect.y + rect.h > a.y,
    blocked = plots?.ads.some(overlap) || plots?.holds.some(overlap),
    owned = plots?.ads.some(
      (a) =>
        a.owner === sim?.username &&
        a.x === rect.x &&
        a.y === rect.y &&
        a.w === rect.w &&
        a.h === rect.h,
    ),
    cost = rect.w * rect.h * (plots?.price ?? 0),
    bounds =
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.w >= 1 &&
      rect.h >= 1 &&
      rect.w <= 12 &&
      rect.h <= 12 &&
      rect.x + rect.w <= (plots?.cols ?? 0) &&
      rect.y + rect.h <= (plots?.rows ?? 0);
  return (
    <ReasonButton
      type="submit"
      form="plot-booking"
      className="primary full"
      reason={
        !plots
          ? "Loading the plots…"
          : !sim
            ? "Start your life first"
            : sim.firstDay && !sim.firstDay.complete
              ? firstDayLeft(sim, "Finish your first-day goals before booking a plot")
              : sim.city !== city
                ? "Travel here before booking"
                : sim.busyUntil
                  ? "Finish your activity first"
                  : sim.pendingBeat
                    ? "Choose your story first"
                    : owned
                      ? "Your space is already booked"
                      : blocked
                        ? "Choose free cells"
                        : !bounds
                          ? "Choose cells inside the grid"
                          : sim.cash < cost
                            ? `Save ${money(cost)} to book these cells`
                            : ""
      }
    >
      <Icon name="wallet" />
      {`Book ${rect.w} × ${rect.h} cells · ${money(cost)}`}
      <Icon name="arrow-up-right" />
    </ReasonButton>
  );
}

export function PlotsPanel() {
  const errorRead = useResource("plots"),
    plots = useStore((s) => s.plots),
    city = useStore((s) => s.city),
    sim = useStore((s) => s.sim),
    selection = useStore((s) => s.plotSelection),
    { working, error, run } = useTask(),
    [title, setTitle] = useState(""),
    [link, setLink] = useState(""),
    [notice, setNotice] = useState(""),
    drag = useRef<[number, number] | null>(null);
  if (!plots) return <p role="status">{errorRead || "Opening the plots…"}</p>;
  const rect = selection ?? { x: 0, y: 0, w: 2, h: 2 },
    overlap = (a: Rect) =>
      rect.x < a.x + a.w &&
      rect.x + rect.w > a.x &&
      rect.y < a.y + a.h &&
      rect.y + rect.h > a.y,
    blocked = plots.ads.some(overlap) || plots.holds.some(overlap),
    owned = plots.ads.some(
      (a) =>
        a.owner === sim?.username &&
        a.x === rect.x &&
        a.y === rect.y &&
        a.w === rect.w &&
        a.h === rect.h,
    ),
    cost = rect.w * rect.h * plots.price;
  const change = (key: keyof Rect, value: number) =>
    state().setPlotSelection({ ...rect, [key]: value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    void run(async () => {
      const r = await api.buyPlot({ city, ...rect, title, link });
      state().setSim(r.sim);
      await state().refresh("plots");
      setNotice(
        `Your ${rect.w} × ${rect.h} plot is booked for ${plots.days} game days.`,
      );
    });
  };
  return (
    <form id="plot-booking" onSubmit={submit}>
      <p>
        Drag across the grid to choose your rectangle. This is the community
        market: book a space for your idea. {money(plots.price)} per cell for{" "}
        {plots.days} game days. All purchases use your game cash.
      </p>
      <button
        type="button"
        aria-label="Choose plot cells. Arrow keys move the selection."
        className="plot-atlas"
        onKeyDown={(e) => {
          const dx =
              e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0,
            dy = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
          if (dx || dy) {
            e.preventDefault();
            state().setPlotSelection({
              ...rect,
              x: Math.max(0, Math.min(plots.cols - rect.w, rect.x + dx)),
              y: Math.max(0, Math.min(plots.rows - rect.h, rect.y + dy)),
            });
          }
        }}
        onPointerDown={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          drag.current = [
            Math.min(
              plots.cols - 1,
              Math.max(
                0,
                Math.floor(((e.clientX - b.left) / b.width) * plots.cols),
              ),
            ),
            Math.min(
              plots.rows - 1,
              Math.max(
                0,
                Math.floor(((e.clientY - b.top) / b.height) * plots.rows),
              ),
            ),
          ];
          e.currentTarget.setPointerCapture(e.pointerId);
          state().setPlotSelection(
            plotRectangle(drag.current, drag.current, plots.cols, plots.rows),
          );
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const b = e.currentTarget.getBoundingClientRect(),
            cell: [number, number] = [
              Math.min(
                plots.cols - 1,
                Math.max(
                  0,
                  Math.floor(((e.clientX - b.left) / b.width) * plots.cols),
                ),
              ),
              Math.min(
                plots.rows - 1,
                Math.max(
                  0,
                  Math.floor(((e.clientY - b.top) / b.height) * plots.rows),
                ),
              ),
            ];
          state().setPlotSelection(
            plotRectangle(drag.current, cell, plots.cols, plots.rows),
          );
        }}
        onPointerUp={(e) => {
          if (drag.current) {
            const b = e.currentTarget.getBoundingClientRect(),
              cell: [number, number] = [
                Math.min(
                  plots.cols - 1,
                  Math.max(
                    0,
                    Math.floor(((e.clientX - b.left) / b.width) * plots.cols),
                  ),
                ),
                Math.min(
                  plots.rows - 1,
                  Math.max(
                    0,
                    Math.floor(((e.clientY - b.top) / b.height) * plots.rows),
                  ),
                ),
              ];
            state().setPlotSelection(
              plotRectangle(drag.current, cell, plots.cols, plots.rows),
            );
          }
          drag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        style={{ aspectRatio: `${plots.cols}/${plots.rows}` }}
      >
        <img
          src={apiUrl(plots.atlas)}
          draggable={false}
          alt="Community market grid: pale paving is free; coloured posters are booked"
        />
        <div
          className={`plot-selection ${owned ? "owned" : blocked ? "blocked" : ""}`}
          style={{
            left: `${(rect.x / plots.cols) * 100}%`,
            top: `${(rect.y / plots.rows) * 100}%`,
            width: `${(rect.w / plots.cols) * 100}%`,
            height: `${(rect.h / plots.rows) * 100}%`,
          }}
        />
      </button>
      <details className="plot-exact">
        <summary>Enter exact cells</summary>
        <div className="plot-fields">
          {(["x", "y", "w", "h"] as const).map((key) => (
            <label className="field" key={key}>
              {{ x: "Column", y: "Row", w: "Width", h: "Height" }[key]}
              <input
                type="number"
                min={key === "x" || key === "y" ? 0 : 1}
                max={
                  key === "x"
                    ? plots.cols - rect.w
                    : key === "y"
                      ? plots.rows - rect.h
                      : 12
                }
                required
                value={rect[key]}
                onChange={(e) => change(key, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      </details>
      <p className={blocked && !owned ? "error-message" : "price-tag"}>
        {owned
          ? "Your space is booked. Choose another rectangle to book more."
          : blocked
            ? "Those cells are booked. Choose another rectangle."
            : `${rect.w} × ${rect.h} cells · ${money(cost)} total`}
      </p>
      {sim?.city !== city && (
        <p className="notice">Travel here before booking.</p>
      )}
      <label className="field">
        Plot title
        <input
          required
          minLength={3}
          maxLength={48}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A little idea for this city"
        />
      </label>
      <label className="field">
        Website (optional)
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://example.org"
        />
      </label>
      <ErrorMessage text={errorRead || error} />
      {working && <p role="status">Booking your cells…</p>}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <SectionTitle icon="map-pin">Around the grid</SectionTitle>
      {plots.ads.length ? (
        plots.ads.slice(0, 20).map((ad) => (
          <button
            type="button"
            className="secondary full plot-listing"
            key={ad.id}
            onClick={() => state().setPlotSelection(ad)}
          >
            <span>
              {ad.title}
              <small>
                By {ad.owner} · {ad.w} × {ad.h}
              </small>
            </span>
            <Icon name="map-pin" />
          </button>
        ))
      ) : (
        <p>Be the first to put an idea on the map.</p>
      )}
    </form>
  );
}
function useBillboardBlock() {
  const idle = useCivicBlock(),
    sim = useStore((s) => s.sim),
    boards = useStore((s) => s.billboards),
    slot = useStore((s) => s.selectedSlot) ?? 1,
    selected = boards?.slots.find((b) => b.slot === slot);
  return (
    idle ||
    (sim?.firstDay && !sim.firstDay.complete
      ? firstDayLeft(sim, "Finish your first-day goals")
      : !boards
        ? "Loading billboards…"
        : selected?.bookedByMe
          ? "You already booked this board"
          : (selected?.queue ?? 0) + (selected?.ad ? 1 : 0) >= 4
            ? "This board is fully booked"
            : sim!.cash < boards.price
              ? `You need ${money(boards.price)} for this board`
              : "")
  );
}
export function BillboardPrimary() {
  const blocked = useBillboardBlock(),
    boards = useStore((s) => s.billboards);
  return (
    <ReasonButton
      type="submit"
      form="billboard-booking"
      className="primary full"
      reason={blocked}
    >
      <Icon name="wallet" />
      {`Book billboard · ${money(boards?.price ?? 0)}`}
      <Icon name="arrow-up-right" />
    </ReasonButton>
  );
}
export function BillboardPanel() {
  const blocked = useBillboardBlock();
  const errorRead = useResource("billboards"),
    boards = useStore((s) => s.billboards),
    slot = useStore((s) => s.selectedSlot) ?? 1,
    now = useNow(),
    city = useStore((s) => s.city),
    { working, error, run } = useTask(),
    [title, setTitle] = useState(""),
    [link, setLink] = useState(""),
    [notice, setNotice] = useState("");
  if (!boards)
    return <p role="status">{errorRead || "Finding a billboard…"}</p>;
  const selected = boards.slots.find((b) => b.slot === slot);
  return (
    <form
      id="billboard-booking"
      onSubmit={(e) => {
        e.preventDefault();
        if (blocked) return;
        void run(async () => {
          const r = await api.bookBillboard(city, slot, title, link);
          state().setSim(r.sim);
          await state().refresh("billboards");
          setNotice(
            (r.ad.startsAt ?? 0) > serverNow() + 1000
              ? "Booked. Your message starts after the current bookings."
              : "Your message is now on the board.",
          );
        });
      }}
    >
      <label className="field">
        Billboard
        <select
          aria-label="Billboard"
          value={slot}
          onChange={(e) => {
            state().selectSlot(Number(e.target.value));
            state().setFocus("billboard-" + e.target.value);
          }}
        >
          {boards.slots.map((b) => (
            <option key={b.slot} value={b.slot}>
              Board {b.slot} ·{" "}
              {b.ad
                ? `${b.queue + 1} booking${b.queue ? "s" : ""} ahead`
                : "Available now"}
            </option>
          ))}
        </select>
      </label>
      {selected?.ad ? (
        <>
          <img
            className="billboard-preview"
            src={apiUrl(selected.ad.image)}
            alt={selected.ad.title}
          />
          <p>
            Now showing: <strong>{selected.ad.title}</strong> by{" "}
            {selected.ad.owner}.
          </p>
        </>
      ) : (
        <div className="empty-board">
          <Icon name="monitor-play" size={36} />
          <strong>Your idea goes here.</strong>
        </div>
      )}
      <p>
        {money(boards.price)} for {boards.days} game days.{" "}
        {selected?.ad
          ? `Starts in ${Math.max(1, Math.ceil((selected.freeFrom - now) / 60000))} real minutes.`
          : "Starts now."}{" "}
        Bookings run one after another.
      </p>
      <label className="field">
        Your message
        <input
          minLength={3}
          maxLength={48}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A club, a project, a new beginning"
        />
      </label>
      <label className="field">
        Website (optional)
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://example.org"
        />
      </label>
      <ErrorMessage text={errorRead || error} />
      {working && <p role="status">Booking your board…</p>}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
    </form>
  );
}
export function HomesPanel() {
  const blocked = useCivicBlock(),
    errorRead = useResource("homes"),
    city = useStore((s) => s.city),
    world = useStore((s) => s.world),
    sim = useStore((s) => s.sim),
    homes = useStore((s) => s.homes),
    { working, error, run } = useTask(),
    [notice, setNotice] = useState(""),
    [review, setReview] = useState<string | null>(null),
    destination = world?.cities.find((c) => c.id === city),
    choice = destination?.neighborhoods.find((n) => n.id === review);
  const reason = (rent: number, current = false) =>
    working
      ? "Moving your home…"
      : current
        ? "This is already your home"
        : !sim
          ? "Start your life first"
          : sim.firstDay && !sim.firstDay.complete
            ? firstDayLeft(sim, "Finish your first-day goals before moving")
            : blocked ||
              ((sim.rentDebt ?? 0) > 0
                ? "Clear your rent balance before moving"
                : sim.cash < rent
                  ? `Save ${money(rent)} to move`
                  : "");
  return (
    <>
      <p>
        Rent is charged each game midnight. Moving costs one day's rent upfront;
        daily rent starts at the next midnight. A trip is always a visit until
        you confirm a move here.
      </p>
      {sim && (
        <div className="civic-hero">
          <h3>
            Your home in{" "}
            {world?.cities.find((c) => c.id === sim.home.city)?.name}
          </h3>
          <p>
            {
              world?.cities
                .find((c) => c.id === sim.home.city)
                ?.neighborhoods.find((n) => n.id === sim.home.neighborhood)
                ?.name
            }{" "}
            · {money(sim.home.rent)} per game day
          </p>
          {sim.city !== sim.home.city && (
            <p>
              You are visiting{" "}
              {world?.cities.find((c) => c.id === sim.city)?.name}. This lease
              stays yours.
            </p>
          )}
          {(sim.rentDebt ?? 0) > 0 && (
            <p className="notice">
              Rent balance: {money(sim.rentDebt ?? 0)}. Available cash pays it
              automatically; your cash stays above zero.
            </p>
          )}
        </div>
      )}
      <ErrorMessage text={errorRead || error} />
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {destination?.neighborhoods.map((n) => {
        const current =
          sim?.home.city === city &&
          sim.home.neighborhood === n.id &&
          sim.home.kind !== "studio";
        return (
          <div className="home-option" key={n.id}>
            <span className="semantic-tile rest">
              <Icon name="house" />
            </span>
            <div>
              <h3>{n.name}</h3>
              <p>
                {money(n.rent)} per game day · {money(n.rent)} upfront to move
              </p>
              <small>
                {errorRead
                  ? "Resident list unavailable"
                  : homes
                    ? `${homes.homes.filter((h) => h.neighborhood === n.id).length} residents`
                    : "Finding residents…"}
              </small>
            </div>
            <ReasonButton
              className="secondary"
              reason={reason(n.rent, current)}
              onClick={() => setReview(n.id)}
            >
              {current ? "Your home" : "Review move"}
            </ReasonButton>
          </div>
        );
      })}
      {choice && (
        <section
          className="travel-review"
          role="group"
          aria-label="Confirm moving home"
        >
          <h3>
            Make {choice.name}, {destination?.name} your home?
          </h3>
          <p>
            This replaces your current lease. Pay {money(choice.rent)} now, then{" "}
            {money(choice.rent)} each game midnight. Travelling here alone never
            changes your home.
          </p>
          {sim && sim.cash - choice.rent < choice.rent && (
            <p className="notice">
              After this move you would have {money(sim.cash - choice.rent)}{" "}
              left, less than the next day's rent.
            </p>
          )}
          <div className="travel-review-actions">
            <button className="secondary" onClick={() => setReview(null)}>
              Keep my current home
            </button>
            <ReasonButton
              className="primary"
              reason={reason(choice.rent)}
              onClick={() =>
                void run(async () => {
                  const owner = sim?.userId,
                    r = await api.moveHome(city, choice.id);
                  if (state().sim?.userId !== owner) return;
                  state().setSim(r.sim);
                  await state().refresh("homes");
                  setReview(null);
                  setNotice(
                    `Your home is now ${choice.name}. Paid ${money(choice.rent)} upfront.`,
                  );
                  state().setFocus("home");
                })
              }
            >
              Confirm move · {money(choice.rent)}
            </ReasonButton>
          </div>
        </section>
      )}
      {sim?.city !== city && (
        <p className="notice">
          Visit this city by bus or plane before moving here.
        </p>
      )}
    </>
  );
}
