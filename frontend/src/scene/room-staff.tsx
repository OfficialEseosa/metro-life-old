import { Suspense, useMemo } from "react";
import type { Look } from "../api/types";
import type { RoomLayout } from "../navigation";
import { useStore } from "../store";
import { serverNow } from "../server-time";
import { RiggedCharacter, type CharacterPose } from "./character";
import { identitySeed, residentLook } from "./character-life";
import { LifeBubble, setLabelHover, clearLabelHover } from "./speech-bubbles";
import { roomType } from "../navigation";
import { roomFloorHeight } from "./venue-zones";

function staffWork(name: string): {
  pose: CharacterPose;
  label: string;
  topic: string;
} {
  if (/cook|chef|barista|bartend|vendor|stall|kitchen|food/i.test(name))
    return { pose: "Cook", label: "Preparing an order", topic: "food" };
  if (/music|perform|stage/i.test(name))
    return { pose: "Play", label: "Playing for the room", topic: "music" };
  if (/curator|gallery|guide/i.test(name))
    return { pose: "Browse", label: "Showing the collection", topic: "chat" };
  if (/nurse|doctor|health/i.test(name))
    return { pose: "Interact", label: "Getting care ready", topic: "work" };
  // Standing behind a counter, so a talking idle rather than the seated typing pose.
  return { pose: "Talk", label: "Helping the next visitor", topic: "work" };
}

/** Named staff use the same skinned body and purposeful activity loops as every resident. */
export function RoomStaff({
  staff,
}: {
  staff: NonNullable<RoomLayout["staff"]>;
}) {
  const room = useStore((s) => s.sim?.position?.room ?? "room"),
    city = useStore((s) => s.city);
  const people = useMemo(
    () =>
      staff.map((person) => {
        const key = room + ":staff:" + person.id,
          seed = identitySeed(key),
          base: Look = {
            body: "f",
            skin: "#b47752",
            hair: "short",
            hairColor: "#302820",
            top: "#326957",
            bottom: "#313c4b",
            style: "work",
            shoeColor: "#393840",
          },
          look = residentLook(key, base),
          top = /nurse|health/i.test(person.id) ? "#97c9c7" : "#dfc9a3",
          outfit = {
            top,
            bottom: "#394650",
            style: "work",
            shoeColor: "#393840",
          };
        return {
          ...person,
          role: person.name,
          look: {
            ...look,
            ...outfit,
            outfits: { everyday: outfit, work: outfit, sleep: outfit },
          },
          name:
            ["Mira", "Theo", "Imani", "Felix", "Priya", "Nina", "Oscar", "Ada"][
              seed % 8
            ] +
            " " +
            ["Calder", "Sato", "Grant", "Mercer", "Vega", "Kim"][
              (seed >>> 4) % 6
            ],
          work: staffWork(person.id + " " + person.name),
          phase: seed % 12,
          options: { seed, personality: true },
        };
      }),
    [room, staff],
  );
  return (
    <group
      name="venue-staff-behind-counters"
      userData={{ roles: staff.map((person) => person.name) }}
    >
      {people.map((person) => (
        <group
          key={person.id}
          position={[
            person.x,
            roomFloorHeight(city, roomType(room) ?? "work", person.x, person.z),
            person.z,
          ]}
          rotation={[0, person.face, 0]}
          userData={{
            staff: true,
            role: person.name,
            purpose: person.work.label,
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            setLabelHover(room + ":staff:" + person.id);
          }}
          onPointerOut={() => clearLabelHover(room + ":staff:" + person.id)}
        >
          <Suspense fallback={null}>
            <RiggedCharacter
              look={person.look}
              options={person.options}
              readPose={() =>
                Math.floor(serverNow() / 1000 + person.phase) % 14 < 11
                  ? person.work.pose
                  : "Idle"
              }
            />
          </Suspense>
        </group>
      ))}
      {people.map((person) => (
        <LifeBubble
          id={room + ":staff:" + person.id}
          kind="staff"
          key={"name-" + person.id}
          name={person.name}
          label={person.role + " · " + person.work.label}
          topic={person.work.topic}
          readPosition={() => ({
            x: person.x,
            y: roomFloorHeight(
              city,
              roomType(room) ?? "work",
              person.x,
              person.z,
            ),
            z: person.z,
          })}
        />
      ))}
    </group>
  );
}
