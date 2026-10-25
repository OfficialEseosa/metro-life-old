import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import type { Look } from "../api/types";
import { characterStudio } from "../scene/characters/studio";

/** Finished portraits by look, shared by every avatar on screen. */
const usePortraits = create<{ images: Record<string, string> }>()(() => ({
  images: {},
}));
const requested = new Set<string>();
function request(key: string, look: Look) {
  if (requested.has(key)) return;
  requested.add(key);
  void characterStudio.portrait(key, look).then((url) =>
    usePortraits.setState((s) => ({ images: { ...s.images, [key]: url } })),
  );
}

/**
 * Turning full-body preview for the creator and the city picker. It draws from the shared
 * character studio, so changing hair, skin or clothes swaps the person without a blank frame.
 */
export function CharacterPreview({ look }: { look: Look }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    view = useRef<ReturnType<typeof characterStudio.attach> | null>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const attached = characterStudio.attach(canvas.current, "#ecd2af");
    view.current = attached;
    return () => {
      attached.detach();
      view.current = null;
    };
  }, []);
  useEffect(() => {
    view.current?.setLook(look);
  }, [look]);
  return (
    <div
      className="character-preview"
      aria-label="Turning 3D preview of your character"
    >
      <canvas
        ref={canvas}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}

/** Portraits are drawn by the shared studio; nothing needs mounting any more. */
export function PortraitStudio() {
  return null;
}

export function CharacterPortrait({
  look,
  size = 60,
}: {
  look: Look;
  size?: number;
}) {
  const key = JSON.stringify(look),
    src = usePortraits((s) => s.images[key]),
    ref = useRef<HTMLSpanElement>(null),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver((rows) => {
      if (rows.some((p) => p.isIntersecting)) setVisible(true);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (visible) request(key, look);
  }, [visible, key, look]);
  return (
    <span
      ref={ref}
      className="character-portrait"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img width={size} height={size} src={src} alt="Character portrait" />
      ) : (
        <span aria-label="Drawing character portrait" />
      )}
    </span>
  );
}
