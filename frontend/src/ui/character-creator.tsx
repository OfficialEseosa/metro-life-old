import { useState } from "react";
import personality from "../shared-data/personality.json";
import { api, apiRequest } from "../api/client";
import type { CityId, Look } from "../api/types";
import { useStore } from "../store";
import { CharacterPreview } from "./character-preview";
import { StartCity } from "./start-city";
import { ErrorMessage, Icon, ReasonButton } from "./primitives";
import {
  BOTTOMS,
  HAIR_COLOURS,
  PASTELS,
  SHOES,
  SKIN_TONES,
  TOPS,
  colourName,
  pick,
} from "./looks";
import { useTask } from "./helpers";
import "./character-creator.css";

type Outfit = { top: string; bottom: string; style: string; shoeColor: string };
type CreatorLook = Look & {
  face: string;
  outfits: Record<"everyday" | "work" | "sleep", Outfit>;
};
type Occasion = "everyday" | "work" | "sleep";
const OCCASIONS: Record<Occasion, string> = {
  everyday: "Everyday",
  work: "Work",
  sleep: "Sleep",
};
const CUTS: Record<string, string> = {
  casual: "Casual",
  street: "Street",
  work: "Work",
  smart: "Smart",
};
function startingLook(look: Look): CreatorLook {
  const saved = look as Partial<CreatorLook>,
    outfit = {
      top: look.top,
      bottom: look.bottom,
      style: look.style,
      shoeColor: look.shoeColor,
    };
  return {
    ...look,
    face: saved.face ?? "soft",
    outfits: {
      everyday: saved.outfits?.everyday ?? outfit,
      work: saved.outfits?.work ?? {
        ...outfit,
        top: "#f4efe6",
        bottom: "#2f3e57",
        style: "work",
      },
      sleep: saved.outfits?.sleep ?? {
        ...outfit,
        top: "#c9d8ef",
        bottom: "#8c9aa8",
        style: "casual",
      },
    },
  };
}
/** Colour swatches with names, a check on the chosen one and 44px targets. */
function Swatches({
  label,
  values,
  value,
  change,
}: {
  label: string;
  values: readonly string[];
  value: string;
  change: (value: string) => void;
}) {
  const chosen = values.find((v) => v.toLowerCase() === value.toLowerCase());
  return (
    <fieldset className="creator-field">
      <legend>
        {label}
        <span>{chosen ? colourName(chosen, "") : "Custom"}</span>
      </legend>
      <div className="creator-swatches">
        {values.map((colour, i) => {
          const pressed = colour.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={colour}
              type="button"
              style={{ background: colour }}
              aria-label={`${label}: ${colourName(colour, String(i + 1))}`}
              title={colourName(colour, "")}
              aria-pressed={pressed}
              onClick={() => change(colour)}
            >
              {pressed && <Icon name="check" size={18} />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
function Choices<T extends string>({
  label,
  options,
  value,
  change,
  grid = false,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: string;
  change: (value: T) => void;
  grid?: boolean;
}) {
  return (
    <fieldset className="creator-field">
      <legend>{label}</legend>
      <div className={grid ? "creator-choice-grid" : "creator-options"}>
        {options.map(([id, text]) => (
          <button
            type="button"
            key={id}
            aria-pressed={value === id}
            onClick={() => change(id)}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const PAGES = [
  ["identity", "You"],
  ["appearance", "Look"],
  ["outfits", "Clothes"],
  ["traits", "Personality"],
  ["dream", "Dream"],
] as const;
export function CharacterCreator() {
  const world = useStore((s) => s.world)!,
    user = useStore((s) => s.user)!,
    [name, setName] = useState(""),
    [pronouns, setPronouns] = useState<"she" | "he" | "they">("they"),
    [city, setCity] = useState<CityId>("atl"),
    [choosingCity, setChoosingCity] = useState(false),
    [look, setLook] = useState(() => startingLook(user.look)),
    [traits, setTraits] = useState(["curious", "easygoing", "homebody"]),
    [aspiration, setAspiration] = useState(
      world.aspirations[0]?.id ?? "founder",
    ),
    [page, setPage] = useState<(typeof PAGES)[number][0]>("identity"),
    [occasion, setOccasion] = useState<Occasion>("everyday"),
    { working, error, run, clearError } = useTask();
  const valid =
    /^\p{L}[\p{L} '-]*\p{L}$/u.test(name.trim()) && name.trim().length <= 20;
  const preview = {
      ...look,
      ...look.outfits[occasion],
      outfits: { ...look.outfits, everyday: look.outfits[occasion] },
    },
    currentOutfit = look.outfits[occasion];
  const updateOutfit = (patch: Partial<Outfit>) =>
    setLook((current) => ({
      ...current,
      outfits: {
        ...current.outfits,
        [occasion]: { ...current.outfits[occasion], ...patch },
      },
    }));
  function toggleTrait(id: string) {
    setTraits((current) =>
      current.includes(id)
        ? current.filter((t) => t !== id)
        : current.length < 3
          ? [...current, id]
          : [...current.slice(1), id],
    );
  }
  function randomise() {
    clearError();
    if (page === "identity") {
      void run(async () => {
        const data = await apiRequest<{ name: string }>("GET", "/api/name");
        setName(data.name);
      });
      return;
    }
    if (page === "appearance") {
      setLook((current) => ({
        ...current,
        skin: pick(SKIN_TONES),
        hair: pick(personality.hair).id,
        hairColor: pick(HAIR_COLOURS),
        face: pick(personality.faces).id,
      }));
      return;
    }
    if (page === "outfits") {
      updateOutfit({
        top: pick(occasion === "sleep" ? PASTELS : TOPS),
        bottom: pick(BOTTOMS),
        shoeColor: pick(SHOES),
        style:
          occasion === "work"
            ? pick(["work", "smart"])
            : pick(["casual", "street"]),
      });
      return;
    }
    if (page === "traits") {
      const choices = [...personality.traits],
        next: string[] = [];
      for (let i = 0; i < 3; i++) {
        const index = Math.floor(Math.random() * choices.length);
        next.push(choices.splice(index, 1)[0].id);
      }
      setTraits(next);
      return;
    }
    setAspiration(pick(world.aspirations).id);
  }
  async function begin() {
    const selected = world.cities.find((c) => c.id === city)!;
    await api.setupSim({
      username: name.trim(),
      pronouns,
      city,
      neighborhood:
        selected.startingLife?.neighborhood ?? selected.neighborhoods[0].id,
      aspiration,
      look: { ...look, ...look.outfits.everyday },
      traits,
    });
    await useStore.getState().syncSession();
    useStore.getState().setFocus("home");
  }
  if (choosingCity)
    return (
      <StartCity
        cities={world.cities}
        selected={city}
        look={{ ...look, ...look.outfits.everyday }}
        name={name.trim()}
        choose={(next) => {
          setCity(next);
          void useStore.getState().setCity(next);
        }}
        back={() => {
          setChoosingCity(false);
          clearError();
        }}
        begin={() => void run(begin)}
        working={working}
        error={error}
      />
    );
  const pageIndex = PAGES.findIndex(([id]) => id === page),
    nextPage = PAGES[pageIndex + 1];
  return (
    <div className="life-start">
      <section
        className="creator-card deep-creator plate"
        role="dialog"
        aria-modal="true"
        aria-label="Create your character"
      >
        <aside>
          <CharacterPreview look={preview} />
          {page === "outfits" && (
            <span className="preview-outfit-label">
              {OCCASIONS[occasion]} outfit
            </span>
          )}
          <button
            className="secondary randomise"
            type="button"
            disabled={working}
            onClick={randomise}
          >
            <Icon name="dice" />
            {page === "identity"
              ? "Suggest a name"
              : page === "appearance"
                ? "Surprise me"
                : page === "outfits"
                  ? "New colours"
                  : page === "traits"
                    ? "Pick for me"
                    : "Surprise me"}
          </button>
        </aside>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && traits.length === 3) setChoosingCity(true);
          }}
        >
          <nav
            className="creator-tabs"
            aria-label="Character creation sections"
          >
            {PAGES.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-current={page === id ? "step" : undefined}
                onClick={() => setPage(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="creator-fields">
            <h1>
              {page === "identity"
                ? "Who will you be?"
                : page === "appearance"
                  ? "Make it yours."
                  : page === "outfits"
                    ? "A look for every day."
                    : page === "traits"
                      ? "What makes you, you?"
                      : "What are you dreaming of?"}
            </h1>
            {page === "identity" && (
              <>
                <label className="field" htmlFor="life-name">
                  Your name
                </label>
                <input
                  id="life-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearError();
                  }}
                  disabled={working}
                  minLength={2}
                  maxLength={20}
                  required
                  autoComplete="given-name"
                  placeholder="A name of your own"
                />
                <small>
                  2–20 letters. Spaces, hyphens and apostrophes are welcome.
                </small>
                <Choices
                  label="Pronouns"
                  options={[
                    ["she", "She"],
                    ["he", "He"],
                    ["they", "They"],
                  ]}
                  value={pronouns}
                  change={setPronouns}
                />
                <Choices
                  label="Body"
                  options={[
                    ["f", "Body 1"],
                    ["m", "Body 2"],
                  ]}
                  value={look.body}
                  change={(body) => setLook({ ...look, body })}
                />
                <small>
                  Body, pronouns and every appearance choice are independent.
                </small>
              </>
            )}
            {page === "appearance" && (
              <>
                <Choices
                  label="Hair style"
                  grid
                  options={personality.hair.map(
                    (hair) => [hair.id, hair.label] as const,
                  )}
                  value={look.hair}
                  change={(hair) => setLook({ ...look, hair })}
                />
                <Swatches
                  label="Hair colour"
                  values={HAIR_COLOURS}
                  value={look.hairColor}
                  change={(hairColor) => setLook({ ...look, hairColor })}
                />
                <Swatches
                  label="Skin tone"
                  values={SKIN_TONES}
                  value={look.skin}
                  change={(skin) => setLook({ ...look, skin })}
                />
                <Choices
                  label="Face"
                  grid
                  options={personality.faces.map(
                    (face) => [face.id, face.label] as const,
                  )}
                  value={look.face}
                  change={(face) => setLook({ ...look, face })}
                />
              </>
            )}
            {page === "outfits" && (
              <>
                <Choices
                  label="Outfit for"
                  options={(Object.keys(OCCASIONS) as Occasion[]).map(
                    (key) => [key, OCCASIONS[key]] as const,
                  )}
                  value={occasion}
                  change={setOccasion}
                />
                <Choices
                  label="Cut"
                  options={(occasion === "work"
                    ? ["work", "smart"]
                    : ["casual", "street"]
                  ).map((style) => [style, CUTS[style]] as const)}
                  value={currentOutfit.style}
                  change={(style) => updateOutfit({ style })}
                />
                <Swatches
                  label="Top"
                  values={occasion === "sleep" ? [...PASTELS, ...TOPS] : TOPS}
                  value={currentOutfit.top}
                  change={(top) => updateOutfit({ top })}
                />
                <Swatches
                  label="Bottoms"
                  values={BOTTOMS}
                  value={currentOutfit.bottom}
                  change={(bottom) => updateOutfit({ bottom })}
                />
                <Swatches
                  label="Shoes"
                  values={SHOES}
                  value={currentOutfit.shoeColor}
                  change={(shoeColor) => updateOutfit({ shoeColor })}
                />
                <small>
                  Your work and sleep outfits appear during those activities.
                </small>
              </>
            )}
            {page === "traits" && (
              <>
                <p className="trait-help">
                  Pick three. They change skill gains, need drain and what
                  makes an activity feel good. Picking a fourth swaps out your
                  earliest choice.
                </p>
                <strong className="trait-count" aria-live="polite">
                  {traits.length} of 3 chosen:{" "}
                  {traits
                    .map(
                      (id) =>
                        personality.traits.find((t) => t.id === id)?.label ??
                        id,
                    )
                    .join(", ")}
                </strong>
                <div className="creator-traits">
                  {personality.traits.map((trait) => (
                    <button
                      type="button"
                      key={trait.id}
                      aria-pressed={traits.includes(trait.id)}
                      onClick={() => toggleTrait(trait.id)}
                    >
                      <Icon name={trait.icon} />
                      <span>
                        <strong>{trait.label}</strong>
                        <small>{trait.detail}</small>
                      </span>
                      {traits.includes(trait.id) && <Icon name="check" />}
                    </button>
                  ))}
                </div>
              </>
            )}
            {page === "dream" && (
              <>
                <p className="trait-help">
                  Your dream sets a long journey and three small daily wants.
                  You can change it later.
                </p>
                <div className="creator-dreams">
                  {world.aspirations.map((dream) => (
                    <button
                      type="button"
                      key={dream.id}
                      aria-pressed={aspiration === dream.id}
                      onClick={() => setAspiration(dream.id)}
                    >
                      <Icon name={dream.icon} />
                      <span>
                        <strong>{dream.label}</strong>
                        <small>{dream.blurb}</small>
                      </span>
                      {aspiration === dream.id && <Icon name="check" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <footer>
            <ErrorMessage text={error} />
            <div className="creator-footer-row">
              {nextPage && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setPage(nextPage[0])}
                >
                  {nextPage[1]}
                  <Icon name="arrow-right" />
                </button>
              )}
              <ReasonButton
                className="primary"
                reason={
                  working
                    ? "Packing your suitcase…"
                    : !valid
                      ? "Add a name in You"
                      : traits.length !== 3
                        ? "Choose three traits"
                        : ""
                }
              >
                {working ? "Packing your suitcase…" : "Choose my city"}
                <Icon name="arrow-right" />
              </ReasonButton>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function PersonalitySummary() {
  const sim = useStore((s) => s.sim);
  if (!sim) return null;
  const life = sim as typeof sim & {
    traits?: string[];
    wants?: {
      id: string;
      text: string;
      progress: number;
      target: number;
      done: boolean;
    }[];
  };
  return (
    <section className="personality-summary">
      <h3>Your personality</h3>
      <div className="saved-trait-list">
        {(life.traits ?? ["curious", "easygoing", "homebody"]).map((id) => {
          const trait = personality.traits.find((t) => t.id === id);
          return trait ? (
            <div key={id}>
              <Icon name={trait.icon} />
              <span>
                <strong>{trait.label}</strong>
                <small>{trait.detail}</small>
              </span>
            </div>
          ) : null;
        })}
      </div>
      {life.wants && (
        <>
          <h3>Today's wants</h3>
          <p className="small-copy">
            Small steps inspired by {sim.aspiration?.label ?? "your dream"}.
          </p>
          {life.wants.map((want) => (
            <div
              className={`daily-want ${want.done ? "done" : ""}`}
              key={want.id}
            >
              <Icon name={want.done ? "check" : "sparkles"} />
              <span>{want.text}</span>
              <b>
                {want.progress} / {want.target}
              </b>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
