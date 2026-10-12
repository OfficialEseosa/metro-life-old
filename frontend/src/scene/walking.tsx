/* oxlint-disable react/immutability -- Three instances and motion refs are imperative animation resources. */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls } from 'three-stdlib'
import type { RefObject } from 'react'
import { api } from '../api/client'
import { useStore } from '../store'
import { doorsFor, slide, navigation, inBox } from '../navigation'
import { motion, useWalking, interact } from '../walking'

export function Walking({controls,cancelFlight}:{controls:RefObject<OrbitControls|null>;cancelFlight:()=>void}){
 const sim=useStore(s=>s.sim),city=useStore(s=>s.city),{invalidate,camera,gl,size,scene}=useThree(),ref=useRef<THREE.InstancedMesh>(null),doorRef=useRef<THREE.InstancedMesh>(null)
 const pending=useRef(false),sent=useRef(0),lastContext=useRef(0),lastPosition=useRef(''),cameraAngle=useRef(0),groundY=useRef(0),phase=useRef(0),key=sim?`${sim.worldId}:${sim.city}:${sim.position?.room??''}`:''
 // oxlint-disable-next-line react-hooks/exhaustive-deps -- Recompute layout on the primitive home/city identity, without subscribing to 5Hz positions.
 const doors=useMemo(()=>{const current=useStore.getState().sim;return current&&current.city===city?Object.entries(doorsFor(current)):[]},[sim?.home.city,sim?.home.neighborhood,sim?.city,city])
 const dummy=useMemo(()=>new THREE.Object3D(),[])
 useEffect(()=>{motion.wake=invalidate;return()=>{motion.wake=()=>{};motion.position=null;useWalking.setState({position:null})}},[invalidate])
 useEffect(()=>{const current=useStore.getState().sim;if(current?.position&&city===current.city){motion.position={...current.position};motion.follow=true;useWalking.setState({position:{...current.position},error:''});invalidate()}},[key,city,invalidate])
 useEffect(()=>{if(sim?.position&&motion.position&&Math.hypot(sim.position.x-motion.position.x,sim.position.z-motion.position.z)>4){motion.position={...sim.position};motion.follow=true;invalidate()}},[sim?.position,invalidate])
 useEffect(()=>{const keys=new Set<string>();const update=()=>{motion.x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));motion.z=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));motion.run=keys.has('shift');invalidate()};const down=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]'))return;if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(e.key.toLowerCase())){e.preventDefault();keys.add(e.key.toLowerCase());update()}else if((e.key.toLowerCase()==='e'||e.key==='Enter')&&!e.repeat){e.preventDefault();interact()}else if(e.key==='Escape'){useStore.getState().openPanel(null);useStore.getState().setSearchOpen(false)}};const up=(e:KeyboardEvent)=>{keys.delete(e.key.toLowerCase());update()};const clear=()=>{keys.clear();update()};window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);motion.x=motion.z=0}},[invalidate])
 useEffect(()=>{if(!doorRef.current)return;doors.forEach(([,d],i)=>{for(let part=0;part<3;part++){dummy.position.set(d.x+(part<2?(part===0?-.48:.48):0),part<2?1.15:2.3,d.z);dummy.scale.set(part<2?.09:1.05,part<2?2.3:.09,.09);dummy.rotation.set(0,0,0);dummy.updateMatrix();doorRef.current!.setMatrixAt(i*3+part,dummy.matrix)}});doorRef.current.instanceMatrix.needsUpdate=true;doorRef.current.computeBoundingSphere();invalidate()},[doors,dummy,invalidate])
 useFrame((_,dt)=>{
  if(!sim||sim.city!==city||!motion.position||!ref.current)return
  const s=useStore.getState(),blocked=!!s.sim?.busyUntil||!!s.sim?.pendingBeat||!!s.panel||s.searchOpen,p=motion.position,length=Math.hypot(motion.x,motion.z),moving=length>0&&!blocked
  motion.moving=moving
  if(moving){cancelFlight();motion.follow=true;const speed=motion.run?7.2:4.2;motion.position=slide(city,p,motion.x/length*speed*Math.min(dt,.04),motion.z/length*speed*Math.min(dt,.04));phase.current+=Math.min(dt,.04)*speed*2.5;invalidate()}
  const at=motion.position;const terrain=scene.getObjectByName('terrain');if(terrain){const hit=new THREE.Raycaster(new THREE.Vector3(at.x,60,at.z),new THREE.Vector3(0,-1,0)).intersectObject(terrain)[0];groundY.current=hit?.point.y??0}
  const body=ref.current,look=sim.look,bob=moving?Math.sin(phase.current*2)*.045:0
  const parts:[[number,number,number],[number,number,number],string,number][]=[[[0,1.32+bob,0],[.65,.8,.38],look.top,0],[[0,1.99+bob,0],[.46,.49,.43],look.skin,0],[[0,2.22+bob,-.05],[.48,.16,.42],look.hairColor,0],[[0,1.82+bob,.218],[.2,.07,.04],'#292e34',0],[[-.43,1.25+bob,0],[.19,.75,.22],look.top,Math.sin(phase.current)*.65*(moving?1:0)],[[.43,1.25+bob,0],[.19,.75,.22],look.top,-Math.sin(phase.current)*.65*(moving?1:0)],[[-.18,.47+bob,0],[.25,.9,.28],look.bottom,-Math.sin(phase.current)*.65*(moving?1:0)],[[.18,.47+bob,0],[.25,.9,.28],look.bottom,Math.sin(phase.current)*.65*(moving?1:0)]]
  parts.forEach(([pos,scale,color,angle],i)=>{dummy.position.set(...pos);dummy.position.applyAxisAngle(new THREE.Vector3(0,1,0),at.face).add(new THREE.Vector3(at.x,groundY.current,at.z));dummy.rotation.set(angle,at.face,0);dummy.scale.set(...scale);dummy.updateMatrix();body.setMatrixAt(i,dummy.matrix);body.setColorAt(i,new THREE.Color(color))});body.instanceMatrix.needsUpdate=true;if(body.instanceColor)body.instanceColor.needsUpdate=true;body.computeBoundingSphere()
  if(motion.follow&&controls.current){const target=new THREE.Vector3(at.x,groundY.current+1,at.z);let eye=target.clone().add(new THREE.Vector3(Math.sin(cameraAngle.current)*12,8,Math.cos(cameraAngle.current)*12));const clear=(eye:THREE.Vector3)=>navigation[city].boxes.every(b=>{for(let t=.1;t<1;t+=.08){const x=at.x+(eye.x-at.x)*t,z=at.z+(eye.z-at.z)*t,y=target.y+(eye.y-target.y)*t;if(inBox(x,z,b,.8)&&y<b.h+1.1)return false}return true});if(!clear(eye)){for(const angle of [0,.7,-.7,1.4,-1.4,Math.PI,2.1,-2.1]){const next=target.clone().add(new THREE.Vector3(Math.sin(angle)*12,8,Math.cos(angle)*12));if(clear(next)){cameraAngle.current=angle;eye=next;camera.position.copy(eye);break}}}const t=1-Math.exp(-Math.min(dt,.05)*9);camera.position.lerp(eye,t);controls.current.target.lerp(target,t);controls.current.update();if(camera.position.distanceTo(eye)>.02)invalidate()}
  const now=performance.now();if(now-lastContext.current>100&&lastPosition.current!==`${at.x}:${at.z}:${at.room}`){lastContext.current=now;lastPosition.current=`${at.x}:${at.z}:${at.room}`;useWalking.setState({position:{...at}})}
  if(now-sent.current>=200&&!pending.current&&(moving||Math.hypot(at.x-(s.sim?.position?.x??at.x),at.z-(s.sim?.position?.z??at.z))>.03)){
   pending.current=true;sent.current=now;const requested={...at},world=sim.worldId
   void api.move(city,requested).then(r=>{if(useStore.getState().sim?.worldId!==world)return;useStore.setState(s=>({sim:s.sim?{...s.sim,position:r.position,loc:r.position.place}:null}));useWalking.setState({error:''})}).catch(async e=>{useWalking.setState({error:e.message});try{const r=await api.sim();if(r.sim.worldId===world){motion.position={...r.sim.position!};useStore.getState().setSim(r.sim);invalidate()}}catch{/* Retry on next movement; keep last confirmed state. */}}).finally(()=>{pending.current=false;invalidate()})
  }
  const v=new THREE.Vector3(at.x,3.2,at.z).project(camera),el=document.querySelector<HTMLElement>('.walking-anchor');if(el){el.style.left=`${(v.x+1)*size.width/2}px`;el.style.top=`${(1-v.y)*size.height/2}px`}
  gl.shadowMap.autoUpdate=false
 })
 if(!sim||city!==sim.city)return null
 return <><instancedMesh name="controlled-player" ref={ref} args={[undefined,undefined,8]} frustumCulled={false}><boxGeometry/><meshStandardMaterial roughness={.8}/></instancedMesh><instancedMesh name="walk-doors" ref={doorRef} args={[undefined,undefined,doors.length*3]}><boxGeometry/><meshStandardMaterial color="#a5e4dc" emissive="#287f76" emissiveIntensity={.3}/></instancedMesh></>
}
