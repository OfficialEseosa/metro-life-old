import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { X } from "@phosphor-icons/react";
import {
  useInteractions,
  chooseObjectAction,
  closeObjectMenu,
  cancelInteraction,
} from "../interactions";
import { useStore } from "../store";
import { Icon, ReasonButton } from "./primitives";
import "./object-actions.css";
import { FriendshipMeter } from "./friendships";

function useViewport() {
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  useEffect(() => {
    const resize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return viewport;
}

function moveMenuFocus(event: KeyboardEvent<HTMLElement>) {
  event.stopPropagation();
  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    ),
  );
  if (!buttons.length) return;
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  let next: number | undefined;
  if (event.key === "ArrowRight" || event.key === "ArrowDown")
    next = (index + 1) % buttons.length;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp")
    next = (index - 1 + buttons.length) % buttons.length;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = buttons.length - 1;
  if (event.key === "Tab")
    next =
      (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
  if (next !== undefined) {
    event.preventDefault();
    buttons[next].focus({ preventScroll: true });
  }
}

export function ObjectActions() {
  const menu = useInteractions((s) => s.menu),
    current = useInteractions((s) => s.current),
    waiting = useInteractions((s) => s.waiting),
    phase = useInteractions((s) => s.phase);
  const playing = useStore(
      (s) =>
        !!s.sim &&
        s.sim.introDone !== false &&
        !s.sim.pendingBeat &&
        !s.panel,
    ),
    busyUntil = useStore((s) => s.sim?.busyUntil),
    busyLabel = useStore((s) => s.sim?.busyLabel),
    viewport = useViewport(),
    menuRef = useRef<HTMLElement>(null);
  const showMenu = playing && !!menu;
  useEffect(() => {
    if (!showMenu) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeObjectMenu();
      }
    };
    window.addEventListener("keydown", escape, true);
    const first =
      menuRef.current?.querySelector<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ??
      menuRef.current?.querySelector<HTMLButtonElement>(".object-pie-close");
    first?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", escape, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [showMenu, menu]);
  if (!playing) return null;
  const active =
      current ??
      (busyUntil
        ? {
            id: "external",
            label: busyLabel || "Current activity",
            icon: "footprints",
          }
        : null),
    queued = waiting.slice(0, 3),
    items = [...(active ? [active] : []), ...queued];
  const size = Math.max(
      220,
      Math.min(360, viewport.width - 24, viewport.height - 132),
    ),
    margin = 12;
  // A menu opened without a tap point (keyboard, scripted) sits at the screen centre.
  const anchor = menu?.target.screen ?? {
    x: viewport.width / 2,
    y: viewport.height / 2,
  };
  // A short screen has no room for the ring, whose choices would spill past the edge.
  const list =
    !!menu &&
    (viewport.height < 520 ||
      menu.options.length > 6 ||
      menu.options.some((option) => option.reason.length > 65));
  // On a short screen the list runs wide so every choice shows without scrolling.
  const width =
    list && viewport.height < 520
      ? Math.min(viewport.width - 2 * margin, 480)
      : size;
  const left = menu
    ? Math.max(
        margin,
        Math.min(viewport.width - width - margin, anchor.x - width / 2),
      )
    : margin;
  const top = menu
    ? Math.max(
        margin,
        Math.min(viewport.height - size - 108, anchor.y - size / 2),
      )
    : margin;
  const queueStyle = {
    "--action-count": Math.max(1, items.length),
  } as CSSProperties;
  return (
    <>
      {items.length > 0 && (
        <section
          className="object-action-queue"
          aria-label="Action queue"
          style={queueStyle}
          onPointerDownCapture={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="object-queue-heading">
            <strong>Your actions</strong>
            {active && <span role="status">{phase || "In progress"}</span>}
          </div>
          {items.length > 0 && (
            <ol>
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className={active && index === 0 ? "is-current" : ""}
                >
                  <div className="object-queue-label">
                    <Icon name={item.icon} size={16} />
                    <span>
                      <small>
                        {active && index === 0
                          ? "Now"
                          : `Next ${active ? index : index + 1}`}
                      </small>
                      <strong>{item.label}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="object-queue-cancel"
                    aria-label={`Cancel ${item.label}`}
                    title={`Cancel ${item.label}`}
                    onClick={() => void cancelInteraction(item.id)}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {showMenu && menu && (
        <div
          className="object-actions-layer"
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <div
            className="object-menu-outside"
            aria-hidden="true"
            onPointerDownCapture={(event) => {
              event.preventDefault();
              event.stopPropagation();
              closeObjectMenu();
            }}
            onClickCapture={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          />
          <section
            ref={menuRef}
            className={`object-pie${list ? " is-list" : ""}`}
            role="menu"
            aria-label={`${menu.title} actions`}
            style={{ left, top, width, height: size }}
            onPointerDownCapture={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={moveMenuFocus}
          >
            <div className="object-pie-center">
              <strong>{menu.title}</strong>
              {menu.target.kind === "person" && (
                <FriendshipMeter targetId={menu.target.id} compact />
              )}
              <button
                type="button"
                className="object-pie-close"
                aria-label="Close object actions"
                onClick={closeObjectMenu}
              >
                <X size={20} />
              </button>
            </div>
            <div className="object-pie-options">
              {menu.options.map((option, index) => {
                const angle =
                    -Math.PI / 2 +
                    (index * Math.PI * 2) / Math.max(1, menu.options.length),
                  radius = size * 0.35;
                const style = list
                  ? undefined
                  : {
                      left: size / 2 + Math.cos(angle) * radius,
                      top: size / 2 + Math.sin(angle) * radius,
                    };
                return (
                  <ReasonButton
                    key={option.id}
                    type="button"
                    role="menuitem"
                    className="object-pie-choice"
                    reason={option.reason}
                    style={style}
                    onClick={() => void chooseObjectAction(option.id)}
                  >
                    <Icon name={option.icon} size={20} />
                    <span>{option.label}</span>
                  </ReasonButton>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default ObjectActions;
