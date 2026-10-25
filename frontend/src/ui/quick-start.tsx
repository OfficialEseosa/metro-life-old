import { useState } from "react";
import { useStore } from "../store";
import { api } from "../api/client";
import type { CityId, Look, Sim, User, Clock } from "../api/types";
import { readyLook } from "./looks";
import { CharacterPreview } from "./character-preview";
import { ErrorMessage, Icon, ReasonButton } from "./primitives";
import { socialRequest } from "./social-life";
import { sound, unlockAudio } from "./sound";
import "./social-life.css";
export function inviteFromText(text: string) {
  const value = text.trim();
  try {
    const u = new URL(value, location.origin);
    return u.searchParams.get("invite") ?? u.searchParams.get("join") ?? value;
  } catch {
    return value;
  }
}
export function QuickStart({ onCustomize }: { onCustomize?: () => void }) {
  const world = useStore((s) => s.world),
    [look, setLook] = useState<Look>(readyLook),
    [city, setCity] = useState<CityId>("atl"),
    [joining, setJoining] = useState(
      () => !!new URLSearchParams(location.search).get("invite"),
    ),
    [invite, setInvite] = useState(
      () => new URLSearchParams(location.search).get("invite") ?? "",
    ),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  const play = async () => {
    if (working) return;
    setWorking(true);
    setError("");
    void unlockAudio();
    try {
      const state = useStore.getState();
      if (state.sim) {
        if (joining) {
          const r = await socialRequest<{ sim: Sim; clock: Clock }>(
            "invite/join",
            { code: inviteFromText(invite) },
          );
          state.setSim(r.sim);
        }
        state.openPanel(null);
        return;
      }
      if (!state.user) {
        const r = await api.guest();
        useStore.getState().setUser(r.user);
      }
      const r = await socialRequest<{ sim: Sim; clock: Clock; user: User }>(
        "quick-start",
        { city, look, invite: joining ? inviteFromText(invite) : undefined },
      );
      if (r.user) useStore.getState().setUser(r.user);
      await useStore.getState().syncSession();
      useStore.getState().openPanel(null);
      sound("arrival");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The city is taking a moment. Try again.",
      );
    } finally {
      setWorking(false);
    }
  };
  return (
    <section className="quick-start" aria-label="A city to call your own">
      <div className="quick-start-character">
        <CharacterPreview look={look} />
        <button
          className="secondary"
          disabled={working}
          onClick={() => {
            setLook(readyLook());
            sound("tap");
          }}
        >
          <Icon name="dice" />A fresh look
        </button>
      </div>
      <div className="quick-start-story">
        <span className="eyebrow">A little life. A big city.</span>
        <h1>
          Your story starts <br />
          with a hello.
        </h1>
        <p>
          A good-looking you, a busy city corner, and neighbours with room for
          one more. Make yourself at home.
        </p>
        <div
          className="quick-city-options"
          role="group"
          aria-label="Your starting city"
        >
          {(
            world?.cities ?? [
              { id: "atl", name: "Atlanta" },
              { id: "nyc", name: "New York" },
              { id: "bay", name: "Bay Area" },
            ]
          ).map((c) => (
            <button
              className="secondary"
              key={c.id}
              aria-pressed={city === c.id}
              onClick={() => setCity(c.id as CityId)}
            >
              {c.name}
            </button>
          ))}
        </div>
        {joining && (
          <label className="field">
            Your friend's invitation
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="Paste their link or invitation code"
              autoComplete="off"
              autoFocus
            />
          </label>
        )}
        <ErrorMessage text={error} />
        <ReasonButton
          className="primary full quick-start-play"
          reason={
            working
              ? "Opening the city…"
              : joining && !invite.trim()
                ? "Paste your friend’s invitation"
                : ""
          }
          onClick={() => void play()}
        >
          <Icon name={joining ? "users" : "sparkles"} />
          {joining ? "Join your friend" : "Play"}
          <Icon name="arrow-right" />
        </ReasonButton>
        <div className="quick-start-more">
          <button
            className="text-button"
            disabled={working}
            onClick={() => setJoining(!joining)}
          >
            <Icon name={joining ? "house" : "users"} />
            {joining ? "Start on my own" : "Join a friend"}
          </button>
          <button
            className="text-button"
            disabled={working}
            onClick={() => {
              if (onCustomize) onCustomize();
              else useStore.getState().openPanel("creator");
            }}
          >
            <Icon name="palette" />
            Make every detail my own
          </button>
        </div>
        <small>No account needed. This browser remembers your life.</small>
      </div>
    </section>
  );
}
