/**
 * Development-only character lab (mounted by the scene only in dev builds with ?pose=...).
 *   ?pose=Sit&body=f            one person in a pose, with a seat or bed when needed
 *   ?pose=lab-hair              every hairstyle on both bodies
 *   ?pose=lab-outfits           every outfit cut on both bodies
 *   ?pose=lab-faces             face styles, close up
 *   ?pose=lab-crowd             a resident crowd with personalities
 */
import { Suspense, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RiggedCharacter, type CharacterPose } from "./character";
import type { Look } from "../api/types";
import * as THREE from "three";
import { residentLook, residentOptions } from "./character-life";
import { HAIR_STYLES } from "./characters/hair";
import { setCharacterRim } from "./characters/materials";
import { setActorTimeWarp } from "./characters/actor";

const query = () => new URLSearchParams(location.search);
function baseLook(body: string): Look {
  const q = query();
  return {
    body: body === "m" ? "m" : "f",
    skin: q.get("skin") ?? "#c08058",
    hair: q.get("hair") ?? (body === "m" ? "short" : "bob"),
    hairColor: q.get("hairColor") ?? "#3b2a20",
    top: q.get("top") ?? "#4e9f8a",
    bottom: q.get("bottom") ?? "#2f3e57",
    shoeColor: q.get("shoe") ?? "#e9e4da",
    style: q.get("style") ?? "casual",
    ...(q.get("face") ? { face: q.get("face")! } : {}),
  } as Look;
}

function Camera({ position, target }: { position: number[]; target: number[] }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(target[0], target[1], target[2]);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = Number(query().get("fov") ?? 32);
      camera.near = 0.05;
      camera.updateProjectionMatrix();
    }
  }, [camera, position, target]);
  return null;
}
function Lights() {
  const night = query().get("night") === "1";
  useEffect(() => setCharacterRim(night), [night]);
  return (
    <>
      <color attach="background" args={[night ? "#1d2333" : "#e4d6c0"]} />
      <hemisphereLight args={[night ? "#7a8cc4" : "#e0e9f2", night ? "#2a2a3a" : "#9c8c7d", night ? 0.6 : 1.1]} />
      <directionalLight position={[-3, 6, 4]} intensity={night ? 0.9 : 2.4} color={night ? "#9fb6ff" : "#fff0d8"} />
      <directionalLight position={[3, 2.5, -3]} intensity={0.6} color="#ffd9b0" />
    </>
  );
}
function Metrics() {
  const gl = useThree((s) => s.gl),
    scene = useThree((s) => s.scene);
  useFrame(() => {
    const info = gl.info;
    let triangles = 0,
      meshes = 0;
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh && o.visible) {
        meshes++;
        triangles += (o.geometry.index?.count ?? o.geometry.getAttribute("position").count) / 3;
      }
    });
    Object.assign(window, {
      __metroLabScene: scene,
      __metroLab: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        sceneTriangles: triangles,
        meshes,
        programs: info.programs?.length,
        textures: info.memory.textures,
        geometries: info.memory.geometries,
      },
    });
  });
  return null;
}
function Floor({ size = 12 }) {
  return (
    <mesh position={[0, -0.06, 0]} receiveShadow>
      <boxGeometry args={[size, 0.12, size]} />
      <meshStandardMaterial color="#d8c6ac" />
    </mesh>
  );
}

function Single({ pose, body }: { pose: CharacterPose; body: string }) {
  const { scene } = useThree(),
    q = query(),
    seated = ["Sit", "Type", "Eat", "SitTalk"].includes(pose),
    lying = ["Lie", "Sleep"].includes(pose),
    speed = Number(q.get("speed") ?? 0),
    look = useMemo(() => baseLook(body), [body]);
  useEffect(() => {
    Object.assign(window, {
      __metroPose: () => {
        const actor = scene.getObjectByName("rigged-character"),
          bones: Record<string, number[]> = {};
        actor?.traverse((o) => {
          if (
            o instanceof THREE.Bone &&
            ["Body", "Head", "WristL", "WristR", "FootL", "FootR"].includes(o.name)
          )
            bones[o.name] = o.getWorldPosition(new THREE.Vector3()).toArray();
        });
        return { pose, bones };
      },
    });
    return () => {
      Object.assign(window, { __metroPose: undefined });
    };
  }, [scene, pose]);
  const close = q.get("close") === "1";
  return (
    <>
      <Camera
        position={close ? [0.25, 1.62, 1.05] : lying ? [2.6, 2.6, 3.2] : [2.6, 1.9, 3.6]}
        target={close ? [0, 1.56, 0] : [0, lying ? 0.5 : 0.85, 0]}
      />
      <Suspense fallback={null}>
        <RiggedCharacter
          look={look}
          readPose={() => pose}
          readSpeed={() => speed}
          readHipHeight={() => (seated ? 0.5 : lying ? 0.62 : undefined)}
          selected={q.get("marker") === "1"}
        />
      </Suspense>
      <Floor />
      {seated && (
        <group>
          <mesh position={[0, 0.22, -0.05]}>
            <boxGeometry args={[0.7, 0.44, 0.65]} />
            <meshStandardMaterial color="#7f9c8c" />
          </mesh>
          <mesh position={[0, 0.65, -0.36]}>
            <boxGeometry args={[0.7, 0.5, 0.12]} />
            <meshStandardMaterial color="#7f9c8c" />
          </mesh>
        </group>
      )}
      {pose === "Cook" && (
        <mesh position={[0, 0.45, 0.62]}>
          <boxGeometry args={[0.7, 0.9, 0.6]} />
          <meshStandardMaterial color="#f0ece4" />
        </mesh>
      )}
      {lying && (
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[1.5, 0.5, 2.1]} />
          <meshStandardMaterial color="#f2e0c5" />
        </mesh>
      )}
    </>
  );
}

function Grid({
  looks,
  columns,
  spacing,
  pose = () => "Idle",
  options,
}: {
  looks: Look[];
  columns: number;
  spacing: number;
  pose?: (i: number) => CharacterPose;
  options?: (i: number) => Parameters<typeof RiggedCharacter>[0]["options"];
}) {
  return (
    <>
      {looks.map((look, i) => {
        const col = i % columns,
          row = Math.floor(i / columns),
          speed = pose(i) === "Walk" ? 1.3 : 0;
        return (
          <group
            key={i}
            position={[(col - (columns - 1) / 2) * spacing, 0, -row * spacing * 1.2]}
          >
            <Suspense fallback={null}>
              <RiggedCharacter
                look={look}
                readPose={() => pose(i)}
                readSpeed={() => speed}
                options={options?.(i)}
              />
            </Suspense>
          </group>
        );
      })}
    </>
  );
}

export function PoseStudio({ pose, body }: { pose: CharacterPose | string; body: string }) {
  const q = query();
  useEffect(() => {
    setActorTimeWarp(Number(q.get("warp") ?? 1));
    return () => setActorTimeWarp(1);
  }, [q]);
  const content = useMemo(() => {
    if (pose === "lab-hair") {
      const looks: Look[] = [];
      for (const sex of ["f", "m"])
        for (const hair of HAIR_STYLES)
          looks.push({ ...baseLook(sex), hair, hairColor: ["#3b2a20", "#b07c45", "#1f1a17", "#a33b24"][looks.length % 4] });
      return {
        camera: [0, 3.2, 4.6],
        target: [0, 1.25, -1.6],
        node: <Grid looks={looks} columns={7} spacing={0.62} />,
      };
    }
    if (pose === "lab-outfits") {
      const looks: Look[] = [];
      for (const sex of ["f", "m"])
        for (const style of ["casual", "street", "smart", "party", "work"])
          looks.push({ ...baseLook(sex), style, top: ["#e46f5a", "#5b8fd1", "#2f4858", "#d97aa6", "#4e9f8a"][looks.length % 5] });
      return {
        camera: [0, 1.8, 7.2],
        target: [0, 0.9, -0.6],
        node: <Grid looks={looks} columns={5} spacing={0.9} />,
      };
    }
    if (pose === "lab-faces") {
      const looks: Look[] = [];
      for (const sex of (q.get("sex") ? [q.get("sex")!] : ["f", "m"]))
        for (const face of ["soft", "bright", "angular", "freckled"])
          looks.push({ ...baseLook(sex), face, skin: ["#f0c8a8", "#c08058", "#844e33", "#dda67c"][looks.length % 4], hair: sex === "f" ? ["bob", "long", "ponytail", "curly"][looks.length % 4] : ["short", "quiff", "spiky", "messy"][looks.length % 4] } as Look);
      return {
        camera: [0, 1.62, 3.4],
        target: [0, 1.38, -0.2],
        node: <Grid looks={looks} columns={4} spacing={0.5} />,
      };
    }
    if (pose === "lab-crowd") {
      const count = Number(q.get("count") ?? 24),
        ids = Array.from({ length: count }, (_, i) => "npc-" + (i * 7919 + 13));
      const looks = ids.map((id) => residentLook(id, baseLook("f")));
      return {
        camera: [0, 3.2, 8.5],
        target: [0, 0.9, -1.6],
        node: (
          <Grid
            looks={looks}
            columns={8}
            spacing={0.85}
            pose={(i) => (["Idle", "Walk", "Talk", "Idle", "Phone", "Wave"] as CharacterPose[])[i % 6]}
            options={(i) => residentOptions(ids[i])}
          />
        ),
      };
    }
    return null;
  }, [pose, q]);
  return (
    <>
      <Lights />
      <Metrics />
      {content ? (
        <>
          <Camera position={content.camera} target={content.target} />
          <Floor size={30} />
          {content.node}
        </>
      ) : (
        <Single pose={pose as CharacterPose} body={body} />
      )}
    </>
  );
}
