/* oxlint-disable react/immutability -- Mixer, skeletons and materials are owned Three resources. */
import { useEffect,useMemo,useRef } from 'react'
import { useFrame,useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { Look } from '../api/types'
import { METRES } from './world-scale'

export type CharacterPose='Idle'|'Walk'|'Run'|'Wave'|'Interact'
function characterUrl(look:Look){return `/models/chars/${look.body==='f'?'f':'m'}_${look.style==='street'?'street':look.style==='smart'?'smart':look.style==='work'?'work':look.style==='party'?'party':'casual'}.glb`}
function footShadow(){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d')!,g=c.createRadialGradient(32,32,3,32,32,31);g.addColorStop(0,'rgba(35,26,30,.3)');g.addColorStop(.45,'rgba(35,26,30,.18)');g.addColorStop(1,'rgba(35,26,30,0)');c.fillStyle=g;c.fillRect(0,0,64,64);return new THREE.CanvasTexture(canvas)}
/** Same renderer for controlled people, previews, portraits and near residents. */
export function RiggedCharacter({look,readPose=()=> 'Idle'}:{look:Look;readPose?:()=>CharacterPose}){
 const {scene,animations}=useGLTF(characterUrl(look)),invalidate=useThree(s=>s.invalidate)
 const actor=useMemo(()=>{
  const root=clone(scene),materials:THREE.Material[]=[],skeletons=new Set<THREE.Skeleton>();root.updateMatrixWorld(true)
  const box=new THREE.Box3().setFromObject(root),scale=METRES.person/box.getSize(new THREE.Vector3()).y
  root.traverse(o=>{if(o instanceof THREE.SkinnedMesh){skeletons.add(o.skeleton);o.frustumCulled=false;o.castShadow=o.receiveShadow=true;const recolour=(source:THREE.MeshStandardMaterial)=>{const m=source.clone();m.roughness=.8;materials.push(m);if(m.name==='Skin')m.color.set(look.skin);else if(/^Hair_/.test(m.name))m.color.set(look.hairColor);else if(/Body/.test(o.name)&&!['Grey','Brown'].includes(m.name))m.color.set(look.top);else if(/Legs/.test(o.name))m.color.set(look.bottom);else if(/Feet/.test(o.name)&&m.name==='Brown')m.color.set(look.shoeColor);return m};o.material=Array.isArray(o.material)?o.material.map(m=>recolour(m as THREE.MeshStandardMaterial)):recolour(o.material as THREE.MeshStandardMaterial)}})
  const mixer=new THREE.AnimationMixer(root),actions=new Map<CharacterPose,THREE.AnimationAction>();for(const name of ['Idle','Walk','Run','Wave','Interact'] as const){const clip=animations.find(a=>a.name.split('|').at(-1)===name);if(!clip)throw Error('Missing character clip '+name);actions.set(name,mixer.clipAction(clip))}
  return {owners:0,root,scale,floor:-box.min.y,materials,skeletons,mixer,actions,shadow:footShadow()}
 },[scene,animations,look.skin,look.hairColor,look.top,look.bottom,look.shoeColor])
 const current=useRef<THREE.AnimationAction|null>(null),previous=useRef<{action:THREE.AnimationAction;left:number}|null>(null)
 useEffect(()=>{actor.owners++;current.current=null;previous.current=null;const timer=setInterval(()=>{if(!document.hidden)invalidate()},1000/30);return()=>{clearInterval(timer);actor.owners--;actor.mixer.stopAllAction();queueMicrotask(()=>{if(actor.owners)return;actor.mixer.uncacheRoot(actor.root);actor.materials.forEach(m=>m.dispose());actor.skeletons.forEach(s=>s.dispose());actor.shadow.dispose()})}},[actor,invalidate])
 useFrame((_,dt)=>{const pose=readPose(),next=actor.actions.get(pose)!;if(current.current!==next){next.reset().play();if(current.current){current.current.crossFadeTo(next,.2,false);previous.current={action:current.current,left:.2}}else next.fadeIn(.2);current.current=next;actor.root.userData.clip=pose;actor.root.userData.crossFadeSeconds=.2}actor.mixer.update(Math.min(dt,.05));if(previous.current){previous.current.left-=dt;if(previous.current.left<=0){previous.current.action.stop();previous.current=null}}})
 return <group name="rigged-character" userData={{heightMetres:METRES.person}}><group scale={actor.scale}><primitive object={actor.root} position={[0,actor.floor,0]}/></group><mesh rotation={[-Math.PI/2,0,0]} position={[0,.014,0]} raycast={()=>{}}><planeGeometry args={[1.1,1.1]}/><meshBasicMaterial map={actor.shadow} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1}/></mesh></group>
}
