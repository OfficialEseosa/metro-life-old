import type { Sim } from "../api/types";
import { api } from "../api/client";
import { useStore } from "../store";
import { Check, ErrorMessage, Icon, SectionTitle } from "./primitives";
import { money, useTask } from "./helpers";

export function PromotionProgress({ sim }: { sim: Sim }) {
  const world = useStore((s) => s.world),
    job = sim.job!,
    next = world?.careers.find((c) => c.track === job.track)?.levels[job.level];
  const gaps = Object.entries(next?.requires.skills ?? {}).flatMap(
    ([id, level]) => {
      const skill = sim.skills[id as keyof Sim["skills"]];
      let xp = -skill.xp;
      for (let i = skill.level; i < level; i++) xp += 100 * (i + 1);
      return xp > 0
        ? [
            `${id} ${level}: about ${Math.ceil(xp / (sim.mood === "low" || sim.mood === "rough" ? 52 : 75))} more shifts of practice`,
          ]
        : [];
    },
  );
  return (
    <div className="dream-card promotion-progress">
      <span className="eyebrow">CAREER LEVEL {job.level} OF 5</span>
      {next ? (
        <>
          <h3>Next: {next.title}</h3>
          <p>
            {money(next.payPerHour)} per shift ·{" "}
            {world?.cities.find((c) => c.id === job.city)?.name}
          </p>
          <div className="requirement">
            <Icon
              name={job.shifts >= job.shiftsToPromote ? "check" : "briefcase"}
            />
            <span>
              {Math.min(job.shifts, job.shiftsToPromote)} /{" "}
              {job.shiftsToPromote} shifts in this role
            </span>
          </div>
          {Object.entries(next.requires.skills ?? {}).map(([skill, level]) => (
            <div className="requirement" key={skill}>
              <Icon
                name={
                  sim.skills[skill as keyof Sim["skills"]].level >= level
                    ? "check"
                    : "book-open"
                }
              />
              <span>
                {skill}: {sim.skills[skill as keyof Sim["skills"]].level} /{" "}
                {level}
              </span>
            </div>
          ))}
          <progress
            aria-label="Shifts toward promotion"
            max={job.shiftsToPromote}
            value={Math.min(job.shifts, job.shiftsToPromote)}
          />
          {gaps.length > 0 && job.shifts >= job.shiftsToPromote && (
            <p className="notice">Shifts complete. {gaps.join(" · ")}</p>
          )}
          <small>
            Promotions settle with the shift that meets both requirements.
          </small>
        </>
      ) : (
        <>
          <h3>You reached the top.</h3>
          <p>Keep building your skills, or explore a new career.</p>
        </>
      )}
    </div>
  );
}

export function AspirationProgress({ sim }: { sim: Sim }) {
  const world = useStore((s) => s.world),
    { working, error, run } = useTask(),
    a = sim.aspiration,
    definition = world?.aspirations.find((d) => d.id === a?.id);
  if (!a) return null;
  return (
    <>
      <SectionTitle icon={definition?.icon ?? "rocket"}>{a.label}</SectionTitle>
      <div className="dream-card">
        <span className="eyebrow">
          {a.step === a.total
            ? "DREAM COMPLETE"
            : `STEP ${a.step + 1} OF ${a.total}`}
        </span>
        <p>{a.current?.text ?? "You made your dream happen."}</p>
        {a.current && (
          <small>
            {money(a.current.reward.cash ?? 0)} + {a.current.reward.xp} XP when
            complete
          </small>
        )}
        <progress
          max={a.total}
          value={a.step}
          aria-label="Aspiration progress"
        />
        <ol className="milestone-list">
          {(
            a.milestones ??
            definition?.milestones.map((m, i) => ({
              ...m,
              status: i < a.step ? "done" : i === a.step ? "current" : "locked",
              progress: 0,
              target: 1,
            }))
          )?.map((m, i) => (
            <li
              key={m.id}
              className={m.status === "done" ? "complete" : m.status}
            >
              {(m.status === "done" || m.status === "ready") && (
                <Check size={16} />
              )}
              <span>{m.text}</span>
              <span className="milestone-state">
                {m.status === "done"
                  ? "Done"
                  : m.status === "current"
                    ? `Now · ${m.progress} / ${m.target}`
                    : m.status === "ready"
                      ? i === a.step
                        ? "Ready — do an activity to claim"
                        : "Ready — waiting for earlier steps"
                      : "Later"}
              </span>
              <small>
                {money(m.reward.cash ?? 0)} + {m.reward.xp} XP
              </small>
            </li>
          ))}
        </ol>
        <label className="field">
          Choose a dream
          <select
            aria-label="Choose a dream"
            value={a.id}
            disabled={working || !!sim.busyUntil || !!sim.pendingBeat}
            onChange={(e) => {
              const id = e.target.value;
              run(async () => {
                const r = await api.setAspiration(id);
                useStore.getState().setSim(r.sim);
              });
            }}
          >
            {world?.aspirations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {(working || sim.busyUntil || sim.pendingBeat) && (
          <p className="notice" role="status">
            {working
              ? "Saving your dream…"
              : sim.busyUntil
                ? "Finish your activity before choosing a dream"
                : "Choose your story before changing dreams"}
          </p>
        )}
        <small>
          Completed steps stay earned when you change dreams. New steps are
          checked after activities.
        </small>
      </div>
      <ErrorMessage text={error} />
    </>
  );
}

export function StoryJournal({ sim }: { sim: Sim }) {
  const world = useStore((s) => s.world);
  if (!sim.stories?.length) return null;
  return (
    <>
      <SectionTitle icon="book-open">Your city stories</SectionTitle>
      {sim.stories.map((story) => {
        const place = world?.cities
          .find((c) => c.id === story.city)
          ?.landmarks.find((l) => l.id === story.loc);
        return (
          <div className="story-journal" key={story.id}>
            <h3>{story.title}</h3>
            <span className="eyebrow">
              {story.status === "complete"
                ? "COMPLETE"
                : `${story.completedBeats} OF ${story.total} CHAPTERS COMPLETE`}
            </span>
            <progress
              aria-label={`${story.title} progress`}
              max={story.total}
              value={story.completedBeats}
            />
            {story.status === "waiting" && (
              <>
                <p>
                  {story.canContinue
                    ? `Return to ${place?.name ?? story.loc} for another activity.`
                    : `Do an activity somewhere else, then return to ${place?.name ?? story.loc}.`}
                </p>
                <button
                  className="secondary full"
                  onClick={() => {
                    if (story.canContinue) {
                      useStore.getState().selectLocation(story.loc);
                      useStore.getState().setFocus(story.loc);
                    } else {
                      useStore.getState().openPanel(null);
                      useStore.getState().setSearchOpen(true);
                    }
                  }}
                >
                  {story.canContinue
                    ? `Continue at ${place?.name ?? "this place"}`
                    : "Find another stop"}
                  <Icon name="arrow-up-right" />
                </button>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
