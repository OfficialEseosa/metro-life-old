import { useHomeDesign } from "../home-design";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityId } from "../api/types";
import {
  doorsFor,
  inBox,
  inPolygon,
  navigation,
  roomLayout,
  roomType,
  type RoomLayout,
} from "../navigation";
import { useStore } from "../store";
import survey from "../shared-data/resident-routes.json";
import { groundHeight } from "./ground";

export type PickTarget = {
  kind: "ground" | "furniture" | "person" | "door" | "bench";
  city: CityId;
  room: string | null;
  id: string;
  stationId?: string;
  point: { x: number; z: number };
  screen: { x: number; y: number };
};
type Furniture = RoomLayout["furniture"][number];
type Candidate = { target: PickTarget; distance: number };

function visible(object: THREE.Object3D) {
  for (let at: THREE.Object3D | null = object; at; at = at.parent)
    if (!at.visible) return false;
  return true;
}
function furnitureStation(furniture: Furniture, layout: RoomLayout) {
  // A cafe counter supports ordering as well as its separate staff/work slot.
  if (
    furniture.kind === "counter" &&
    layout.stations.some((s) => s.id === "counter")
  )
    return "counter";
  const slotStation = furniture.slots.find((slot) => slot.station)?.station;
  if (slotStation && layout.stations.some((s) => s.id === slotStation))
    return slotStation;
  if (layout.stations.some((s) => s.id === furniture.id)) return furniture.id;
  if (
    furniture.kind === "chair" &&
    layout.stations.some((s) => s.id === "couch")
  )
    return "couch";
  if (
    ["stadium", "arena"].includes(furniture.kind) &&
    layout.stations.some((s) => s.id === "stands")
  )
    return "stands";
  return undefined;
}
const heights: Record<string, number> = {
  bed: 1.15,
  chair: 1.15,
  bench: 1.15,
  stove: 1.15,
  shower: 2.45,
  desk: 1.4,
  table: 1,
  counter: 1.35,
  stall: 3.1,
  dance: 0.18,
  stage: 2.15,
  stands: 1.2,
  gallery: 2.8,
  games: 1.2,
  stadium: 0.18,
  arena: 1.9,
};

/** Input-only picking: no scene nodes, frame subscriptions or React frame state. */
export function ObjectPicking({
  onPick,
}: {
  onPick: (target: PickTarget) => void;
}) {
  const { gl, scene, camera } = useThree(),
    callback = useRef(onPick);
  useEffect(() => {
    callback.current = onPick;
  }, [onPick]);
  useEffect(() => {
    const canvas = gl.domElement,
      raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      hit = new THREE.Vector3(),
      inverse = new THREE.Matrix4(),
      transform = new THREE.Matrix4(),
      localRay = new THREE.Ray(),
      box = new THREE.Box3(),
      plane = new THREE.Plane(),
      instance = new THREE.Matrix4(),
      world = new THREE.Matrix4(),
      scale = new THREE.Vector3(),
      position = new THREE.Vector3(),
      rotation = new THREE.Quaternion();
    let gesture: {
      id: number;
      x: number;
      y: number;
      dragged: boolean;
      city: CityId;
      room: string | null;
      user: string;
    } | null = null;
    const down = (event: PointerEvent) => {
      if (
        event.target !== canvas ||
        document.elementFromPoint(event.clientX, event.clientY) !== canvas ||
        event.button !== 0 ||
        !event.isPrimary
      ) {
        gesture = null;
        return;
      }
      const state = useStore.getState(),
        sim = state.sim;
      if (useHomeDesign.getState().open || !sim || sim.city !== state.city) {
        gesture = null;
        return;
      }
      gesture = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dragged: false,
        city: state.city,
        room: sim.position?.room ?? null,
        user: sim.userId,
      };
    };
    const move = (event: PointerEvent) => {
      if (
        gesture?.id === event.pointerId &&
        Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 6
      )
        gesture.dragged = true;
    };
    const cancel = () => {
      gesture = null;
    };
    const up = (event: PointerEvent) => {
      const start = gesture;
      gesture = null;
      if (
        event.target !== canvas ||
        document.elementFromPoint(event.clientX, event.clientY) !== canvas ||
        !start ||
        start.id !== event.pointerId ||
        start.dragged ||
        event.button !== 0 ||
        !event.isPrimary ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6
      )
        return;
      const state = useStore.getState(),
        sim = state.sim,
        city = state.city,
        room = sim?.position?.room ?? null;
      if (
        useHomeDesign.getState().open ||
        !sim ||
        sim.city !== city ||
        start.city !== city ||
        start.room !== room ||
        start.user !== sim.userId
      )
        return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        return;
      camera.updateWorldMatrix(true, false);
      scene.updateMatrixWorld(true);
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const screen = { x: event.clientX, y: event.clientY },
        candidates: Candidate[] = [];
      const target = (
        kind: PickTarget["kind"],
        id: string,
        point: { x: number; z: number },
        stationId?: string,
      ): PickTarget => ({
        kind,
        city,
        room,
        id,
        point,
        screen,
        ...(stationId ? { stationId } : {}),
      });
      const addBox = (
        kind: PickTarget["kind"],
        id: string,
        x: number,
        z: number,
        width: number,
        depth: number,
        height: number,
        angle = 0,
        y = 0,
        stationId?: string,
        anchor?: { x: number; z: number },
      ) => {
        transform.compose(
          position.set(x, y, z),
          rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle),
          scale.set(1, 1, 1),
        );
        inverse.copy(transform).invert();
        localRay.copy(raycaster.ray).applyMatrix4(inverse);
        box.min.set(-width / 2, 0, -depth / 2);
        box.max.set(width / 2, height, depth / 2);
        if (!localRay.intersectBox(box, hit)) return;
        hit.applyMatrix4(transform);
        candidates.push({
          target: target(kind, id, anchor ?? { x: hit.x, z: hit.z }, stationId),
          distance: hit.distanceTo(raycaster.ray.origin),
        });
      };
      let ground: THREE.Vector3 | null = null;
      const acceptGround = (point: THREE.Vector3) => {
        if (
          !ground ||
          point.distanceToSquared(raycaster.ray.origin) <
            ground.distanceToSquared(raycaster.ray.origin)
        )
          ground = point.clone();
      };
      if (room) {
        const type = roomType(room);
        if (!type) return;
        const layout = roomLayout(city, type),
          halfWidth = (layout.bounds?.w ?? (type === "home" ? 7 : 12)) / 2,
          halfDepth = (layout.bounds?.d ?? (type === "home" ? 6 : 10)) / 2;
        plane.set(THREE.Object3D.DEFAULT_UP, 0);
        if (
          raycaster.ray.intersectPlane(plane, hit) &&
          Math.abs(hit.x) <= halfWidth &&
          Math.abs(hit.z) <= halfDepth
        )
          acceptGround(hit);
        // The room doorway is open: select its actual jambs/lintel, not an
        // invisible solid panel that would swallow floor clicks through the gap.
        const doorTrim = scene.getObjectByName("wall-mounted-front"),
          trimVisible = doorTrim
            ? visible(doorTrim)
            : state.wallMode === "up" ||
              (state.wallMode === "cutaway" && camera.position.z <= 0);
        if (trimVisible) {
          for (const side of [-1, 1])
            addBox(
              "door",
              "exit",
              layout.exit.x + side * 0.77,
              halfDepth - 0.05,
              0.14,
              0.3,
              2.15,
              0,
              0,
              "exit",
              layout.exit,
            );
          addBox(
            "door",
            "exit",
            layout.exit.x,
            halfDepth - 0.05,
            1.7,
            0.3,
            0.16,
            0,
            2.08,
            "exit",
            layout.exit,
          );
        }
        // The floor marker is selectable even when the front wall is cut away.
        addBox(
          "door",
          "exit",
          layout.exit.x,
          layout.exit.z,
          1.15,
          0.7,
          0.12,
          0,
          0,
          "exit",
          layout.exit,
        );
        for (const furniture of layout.furniture) {
          const stationId = furnitureStation(furniture, layout);
          if (!stationId) continue;
          addBox(
            "furniture",
            furniture.id,
            furniture.x,
            furniture.z,
            furniture.w,
            furniture.d,
            heights[furniture.kind] ?? 1.2,
            furniture.angle,
            0,
            stationId,
          );
          // Desks/tables contain a rendered chair outside their top's footprint.
          for (const slot of furniture.slots)
            if (["Sit", "Type", "Eat"].includes(slot.pose))
              addBox(
                "furniture",
                furniture.id,
                slot.x,
                slot.z,
                0.72,
                0.72,
                1.15,
                slot.face,
                0,
                stationId,
              );
        }
      } else {
        const nav = navigation[city],
          doors = doorsFor(sim);
        for (const [id, door] of Object.entries(doors)) {
          const y = groundHeight(scene, city, door.x, door.z);
          addBox(
            "door",
            id,
            door.x,
            door.z - 0.35,
            1.6,
            1,
            0.2,
            0,
            y,
            undefined,
            door,
          );
          const root = scene.getObjectByName(id);
          if (!root || !visible(root)) continue;
          const intersections: THREE.Intersection[] = [];
          root.traverse((object) => {
            if (!(object instanceof THREE.Mesh) || !visible(object)) return;
            if (object instanceof THREE.InstancedMesh)
              THREE.InstancedMesh.prototype.raycast.call(
                object,
                raycaster,
                intersections,
              );
            else
              THREE.Mesh.prototype.raycast.call(
                object,
                raycaster,
                intersections,
              );
          });
          for (const intersection of intersections)
            candidates.push({
              target: target("door", id, door),
              distance: intersection.distance,
            });
        }
        for (const [park, row] of Object.entries(survey.cities[city].parks))
          row.benches.forEach(([x, z], index) =>
            addBox(
              "bench",
              `${park}:${index}`,
              x,
              z,
              1.8,
              0.85,
              1.2,
              0,
              groundHeight(scene, city, x, z),
              undefined,
              { x, z },
            ),
          );
        const terrain = scene.getObjectByName("terrain"),
          base = scene.getObjectByName("ground");
        for (const surface of [terrain, base])
          if (surface instanceof THREE.Mesh && visible(surface)) {
            const intersections: THREE.Intersection[] = [];
            THREE.Mesh.prototype.raycast.call(
              surface,
              raycaster,
              intersections,
            );
            for (const intersection of intersections)
              acceptGround(intersection.point);
          }
        nav.bridges.forEach((bridge, index) => {
          const y = city === "nyc" ? 5.8 : index === 0 ? 5.575 : 3.85;
          plane.set(THREE.Object3D.DEFAULT_UP, -y);
          if (
            raycaster.ray.intersectPlane(plane, hit) &&
            inBox(hit.x, hit.z, bridge, -0.35)
          )
            acceptGround(hit);
        });
        if (!ground) {
          plane.set(THREE.Object3D.DEFAULT_UP, 0);
          if (
            raycaster.ray.intersectPlane(plane, hit) &&
            nav.land.some((p) => inPolygon(hit.x, hit.z, p)) &&
            !nav.water.some((p) => inPolygon(hit.x, hit.z, p))
          )
            acceptGround(hit);
        }
      }
      const people = state.players.filter(
          (person) =>
            (person.npc || person.online) &&
            person.id !== sim.userId &&
            person.city === city &&
            person.position &&
            (person.position.room ?? null) === room,
        ),
        residents = scene.getObjectByName("residents");
      if (residents instanceof THREE.InstancedMesh && visible(residents)) {
        const ids = residents.userData.ids as string[] | undefined;
        for (let i = 0; i < residents.count; i++) {
          const person = people.find((p) => p.id === ids?.[i]);
          if (!person) continue;
          residents.getMatrixAt(i, instance);
          world.multiplyMatrices(residents.matrixWorld, instance);
          world.decompose(position, rotation, scale);
          if (
            Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z)) <
            0.1
          )
            continue;
          const x = position.x,
            y = position.y,
            z = position.z,
            height =
              person.activitySlot &&
              ["Sit", "Type", "Eat"].includes(person.activitySlot.pose)
                ? 1.35
                : 1.85;
          addBox(
            "person",
            person.id,
            x,
            z,
            0.72,
            0.65,
            height,
            0,
            y,
            undefined,
            { x, z },
          );
        }
      } else if (!residents) {
        for (const person of people) {
          const p = person.activitySlot ?? person.position!;
          addBox(
            "person",
            person.id,
            p.x,
            p.z,
            0.72,
            0.65,
            1.85,
            0,
            room ? 0 : groundHeight(scene, city, p.x, p.z),
            undefined,
            { x: p.x, z: p.z },
          );
        }
      }
      // A hill/floor in front of a proxy prevents picking through its surface.
      const floorPoint = ground as THREE.Vector3 | null,
        maxDistance = floorPoint
          ? floorPoint.distanceTo(raycaster.ray.origin) + 0.25
          : Infinity;
      const picked = candidates
        .filter((candidate) => candidate.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)[0];
      // R3F owns map-pin clicks. Honor its actual visibility/cluster hit test,
      // while allowing unrelated closer geometry to retain ordinary picking.
      const pins = !room ? scene.getObjectByName("map-pins") : undefined;
      if (pins instanceof THREE.Points && visible(pins)) {
        const pinHits: THREE.Intersection[] = [];
        pins.raycast(raycaster, pinHits);
        pinHits.sort((a, b) => a.distance - b.distance);
        const pin = pinHits[0],
          locationIds = pins.geometry.userData.locationIds as
            string[] | undefined;
        const sameDoor =
          pin &&
          picked?.target.kind === "door" &&
          picked.target.id === locationIds?.[pin.index ?? -1];
        const nearestDistance =
          picked?.distance ??
          (floorPoint ? floorPoint.distanceTo(raycaster.ray.origin) : Infinity);
        if (pin && (sameDoor || pin.distance <= nearestDistance + 0.001))
          return;
      }
      if (picked) {
        callback.current(picked.target);
        return;
      }
      if (floorPoint)
        callback.current(
          target("ground", "ground", { x: floorPoint.x, z: floorPoint.z }),
        );
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    return () => {
      gesture = null;
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
    };
  }, [gl, scene, camera]);
  return null;
}
