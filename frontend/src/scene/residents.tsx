import { groundHeight } from './ground'
/* oxlint-disable react/immutability -- Three instance buffers and shader uniforms are imperative animation resources. */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { activeLifeAction,lifeLabel,lifePose,lifeTopic } from '../life-actions'
import { bodyCondition,crowdPose,movingPose,residentLook,velocityFacing } from './character-life'
import { RiggedCharacter,type CharacterPose } from './character'
import type { Player } from '../api/types'
import { motion } from '../walking'
import { roomLayout,roomType } from '../navigation'
import { LifeBubble,StinkCloud } from './speech-bubbles'
import { roomFloorHeight } from './venue-zones'

type ResidentMotion={position:THREE.Vector3;speed:number;yaw:number;distance:number;pose:CharacterPose;hidden:boolean;hip?:number}
function NearResident({person,read,ready}:{person:Player;read:()=>ResidentMotion|undefined;ready:Set<string>}){
 const ref=useRef<THREE.Group>(null),look=useMemo(()=>person.npc?residentLook(person.id,person.look):person.look,[person.id,person.npc,person.look])
 useEffect(()=>{ready.add(person.id);return()=>{ready.delete(person.id)}},[person.id,ready])
 useFrame(()=>{const state=read();if(!ref.current)return;ref.current.visible=!!state&&!state.hidden;if(state){ref.current.position.copy(state.position);ref.current.rotation.y=state.yaw}})
 return <group ref={ref} name={'resident-'+person.id} visible={false} userData={{playerId:person.id,rigged:true}}><RiggedCharacter look={look} readPose={()=>read()?.pose??'Idle'} readHipHeight={()=>read()?.hip} readSpeed={()=>read()?.speed??0} readDistance={()=>read()?.distance??0} readCondition={()=>bodyCondition(person)} readStartedAt={()=>(person.lifeAction as {startedAt?:number}|null|undefined)?.startedAt}/></group>
}

/** Full Quaternius actors near the player, inexpensive impostors only at street-view distance. */
export function Residents(){
 const {invalidate,scene:cityScene}=useThree(),room=useStore(s=>s.sim?.city===s.city?s.sim.position?.room:null),self=useStore(s=>s.sim?.userId),players=useStore(s=>s.players),city=useStore(s=>s.city),ref=useRef<THREE.InstancedMesh>(null),positions=useRef(new Map<string,THREE.Vector3>()),rendered=useRef(new Map<string,THREE.Vector3>()),hidden=useRef(new Set<string>()),dirty=useRef(true),lastCamera=useRef(new THREE.Matrix4()),lastHeight=useRef(0),{scene}=useGLTF('/models/landmarks/resident-lod.glb')
 const [nearIds,setNearIds]=useState<string[]>([]),nearSet=useRef(new Set<string>()),ready=useRef(new Set<string>()),states=useRef(new Map<string,ResidentMotion>()),lodAt=useRef(0)
 const model=useMemo(()=>{let mesh:THREE.Mesh|undefined;scene.traverse(o=>{if(o instanceof THREE.Mesh)mesh=o});if(!mesh)throw Error('Resident model has no mesh');scene.updateMatrixWorld(true);const geometry=mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);geometry.computeBoundingBox();const box=geometry.boundingBox!,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(1.78/size.y,1.78/size.y,1.78/size.y);
 const conditions=new THREE.InstancedBufferAttribute(new Float32Array(48),1),poses=new THREE.InstancedBufferAttribute(new Float32Array(48),1),phases=new THREE.InstancedBufferAttribute(new Float32Array(48),1),shirts=new THREE.InstancedBufferAttribute(new Float32Array(48*3),3),skins=new THREE.InstancedBufferAttribute(new Float32Array(48*3),3),hairs=new THREE.InstancedBufferAttribute(new Float32Array(48*3),3),bottoms=new THREE.InstancedBufferAttribute(new Float32Array(48*3),3),near=new THREE.InstancedBufferAttribute(new Float32Array(48),1);geometry.setAttribute('crowdPose',poses);geometry.setAttribute('crowdCondition',conditions);geometry.setAttribute('crowdPhase',phases);geometry.setAttribute('shirtColor',shirts);geometry.setAttribute('skinColor',skins);geometry.setAttribute('hairColor',hairs);geometry.setAttribute('bottomColor',bottoms);geometry.setAttribute('crowdNear',near);const time={value:0},material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85});material.onBeforeCompile=shader=>{shader.uniforms.crowdTime=time;shader.vertexShader='uniform float crowdTime;attribute float crowdPose;attribute float crowdCondition;attribute float crowdPhase;attribute vec3 shirtColor;attribute vec3 skinColor;attribute vec3 hairColor;attribute vec3 bottomColor;attribute float crowdNear;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\nif(position.y>.85&&position.y<1.4)vColor.rgb=shirtColor;if(position.y>1.4)vColor.rgb=skinColor;if(position.y>1.69)vColor.rgb=hairColor;if(position.y>.15&&position.y<.85)vColor.rgb=bottomColor;');shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float phase=crowdTime*(crowdPose==2.?10.:7.)+crowdPhase;
 if(crowdPose==1.||crowdPose==2.){if(position.y<1.)transformed.z+=sin(phase+step(0.,position.x)*3.14159)*(crowdPose==2.?.43:.24)*(1.-position.y);if(abs(position.x)>.32&&position.y>1.0&&position.y<1.8)transformed.z+=sin(phase+step(0.,position.x)*3.14159)*.13;transformed.y+=sin(phase*2.)*(crowdPose==2.?.07:.025);if(crowdPose==2.)transformed.z+=max(0.,position.y-1.)*.18;}
 if(crowdPose==3.||crowdPose==4.||crowdPose==7.){if(position.y<1.){transformed.z+=.42*(1.-position.y);transformed.y*=.58;}else transformed.y-=.42;}
 if(crowdPose==4.&&abs(position.x)>.32&&position.y>1.0&&position.y<1.8){transformed.z-=.28;transformed.y+=sin(phase)*.04;}
 if(crowdPose==5.){transformed.y+=sin(phase)*.07;if(abs(position.x)>.32&&position.y>1.0&&position.y<1.8){transformed.y+=.18+sin(phase)*.15;transformed.x+=sign(position.x)*.15;}}
 if(crowdPose==6.&&abs(position.x)>.32&&position.y>1.0&&position.y<1.8){transformed.y+=.55+sin(phase)*.1;transformed.x+=sign(position.x)*.16;}
 if(crowdPose==7.&&abs(position.x)>.32&&position.y>1.0&&position.y<1.8){transformed.y+=.2+sin(phase)*.12;transformed.z+=.15;}
 if(crowdPose==8.){float sy=transformed.y;transformed.y=.35+transformed.z*.55;transformed.z=(sy-.85)*.9;}
 if(crowdPose==9.&&position.x<-.3&&position.y>1.){transformed.y+=.55;transformed.x-=.13+sin(phase)*.12;transformed.z+=cos(phase)*.1;}
 if(crowdPose==10.&&abs(position.x)>.3&&position.y>1.&&position.y<1.8){transformed.z+=.28;transformed.y+=sin(phase+position.x*3.)*.1;}
 if(crowdPose==11.&&abs(position.x)>.3&&position.y>1.&&position.y<1.8){transformed.y+=.5;transformed.x+=sign(position.x)*sin(phase)*.14;}
 if(crowdPose==12.&&abs(position.x)>.3&&position.y>1.&&position.y<1.8){transformed.z+=.3;transformed.y+=sin(phase+position.x*3.)*.08;}
 if(mod(crowdCondition,2.)>.5&&crowdPose!=8.){transformed.z+=max(0.,position.y-.8)*.22;transformed.y-=max(0.,position.y-1.)*.08;}
 if(crowdCondition>=2.&&position.x<-.3&&position.y>1.&&position.y<1.8&&crowdPose<3.){transformed.x+=.2;transformed.z+=.3;}
 transformed*=1.-step(.5,crowdNear);
 `)};material.userData.crowdTime=time;material.customProgramCacheKey=()=> 'metro-crowd-life-v3';return{geometry,material,conditions,poses,phases,shirts,skins,hairs,bottoms,near,time}},[scene])
 const crowd=useMemo(()=>players.filter(p=>!p.tripId&&(p.npc||p.online)&&p.id!==self&&p.city===city&&p.position&&(p.position.room??null)===(room??null)).slice(0,48).map(p=>({id:p.id,target:new THREE.Vector3(p.activitySlot?.x??p.position!.x,p.activitySlot&&['Sit','Type','Eat'].includes(p.activitySlot.pose)?Math.max(0,(p.activitySlot.y??.61)-.61):p.activitySlot?.pose==='Cheer'?(p.activitySlot.y??0):p.position!.room?.startsWith('club:')&&(p.activitySlot?.z??p.position!.z)< -2.3?.36:0,p.activitySlot?.z??p.position!.z),face:p.activitySlot?.face??p.position!.face,person:p,look:p.npc?residentLook(p.id,p.look):p.look,activity:lifePose(p).toLowerCase(),label:lifeLabel(p),topic:lifeTopic(p),condition:bodyCondition(p),color:new THREE.Color((p.npc?residentLook(p.id,p.look):p.look).top)})),[players,city,self,room])
 useLayoutEffect(()=>{dirty.current=true;if(ref.current)ref.current.userData.ids=crowd.map(p=>p.id);for(let i=0;i<crowd.length;i++){const p=crowd[i];if(!positions.current.has(p.id))positions.current.set(p.id,p.target.clone());model.conditions.setX(i,(p.condition.tired?1:0)+(p.condition.hungry?2:0));model.phases.setX(i,[...p.id].reduce((a,c)=>a+c.charCodeAt(0),0));model.shirts.setXYZ(i,p.color.r,p.color.g,p.color.b);for(const [attribute,colour]of [[model.skins,p.look.skin],[model.hairs,p.look.hairColor],[model.bottoms,p.look.bottom]] as const){const c=new THREE.Color(colour);attribute.setXYZ(i,c.r,c.g,c.b)}}model.conditions.needsUpdate=model.phases.needsUpdate=model.shirts.needsUpdate=model.skins.needsUpdate=model.hairs.needsUpdate=model.bottoms.needsUpdate=true;const ids=new Set(crowd.map(p=>p.id));for(const id of positions.current.keys())if(!ids.has(id)){positions.current.delete(id);rendered.current.delete(id);hidden.current.delete(id);states.current.delete(id)};invalidate()},[crowd,model,invalidate])
 const animated=crowd.some(p=>p.activity!=='idle')
 useEffect(()=>{if(!animated)return;const timer=setInterval(()=>{if(!document.hidden)invalidate()},1000/30);return()=>clearInterval(timer)},[animated,invalidate])
 const dummy=useMemo(()=>new THREE.Object3D(),[]),point=useMemo(()=>new THREE.Vector3(),[])
 useFrame(({camera,size,clock},dt)=>{const mesh=ref.current;if(!mesh)return;model.time.value=clock.elapsedTime;const player=motion.position??useStore.getState().sim?.position;let changed=dirty.current||animated||!lastCamera.current.equals(camera.matrixWorld)||lastHeight.current!==size.height;
 for(let i=0;i<crowd.length;i++){
  const person=crowd[i],at=positions.current.get(person.id);if(!at)continue;const oldX=at.x,oldZ=at.z,gap=at.distanceToSquared(person.target),snapped=gap>100;
  if(gap>.0001){if(snapped)at.copy(person.target);else at.lerp(person.target,1-Math.exp(-Math.min(dt,.05)*10));changed=true}
  const vx=at.x-oldX,vz=at.z-oldZ,speed=snapped?0:Math.hypot(vx,vz)/Math.max(.001,dt),distance=player?Math.hypot(at.x-player.x,at.z-player.z):camera.position.distanceTo(at),previous=states.current.get(person.id),settled=at.distanceToSquared(person.target)<.0025;
  const yaw=velocityFacing(previous?.yaw??person.face,speed>.08?Math.atan2(vx,vz):settled?person.face:previous?.yaw??person.face,dt,speed>.08);
  dummy.position.copy(at);dummy.position.y=room?roomFloorHeight(city,roomType(room)!,at.x,at.z):groundHeight(cityScene,city,at.x,at.z);if(room&&settled&&person.person.activitySlot?.y!==undefined&&!['Sit','Type','Eat','Sleep','Lie'].includes(person.person.activitySlot.pose))dummy.position.y=person.person.activitySlot.y;point.copy(dummy.position);point.y+=1;point.project(camera);
  const clip=distance>70||camera.position.distanceTo(dummy.position)<.85||point.z>1||point.z< -1;if(clip)hidden.current.add(person.id);else hidden.current.delete(person.id);
  const state:ResidentMotion={position:dummy.position.clone(),speed,yaw,distance,pose:movingPose(person.person,speed),hidden:clip,hip:settled&&person.person.activitySlot&&['Sit','Type','Eat','Sleep','Lie'].includes(person.person.activitySlot.pose)&&person.person.activitySlot.y!==undefined?person.person.activitySlot.y-dummy.position.y:undefined};states.current.set(person.id,state);rendered.current.set(person.id,state.position);
  model.poses.setX(i,speed>.08?(state.pose==='Run'?2:1):crowdPose(lifePose(person.person)));model.near.setX(i,nearSet.current.has(person.id)&&ready.current.has(person.id)?1:0);
  dummy.scale.setScalar(clip?0:1);dummy.rotation.y=yaw;dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
 }
 if(clock.elapsedTime-lodAt.current>.25||dirty.current){lodAt.current=clock.elapsedTime;const selected=crowd.filter(p=>{const state=states.current.get(p.id);return state&&!state.hidden&&state.distance<=30}).sort((a,b)=>states.current.get(a.id)!.distance-states.current.get(b.id)!.distance).slice(0,Math.max(0,20-(room?(roomLayout(city,roomType(room)!).staff?.length??0):0))).map(p=>p.id);if(selected.join('|')!==[...nearSet.current].join('|')){nearSet.current=new Set(selected);setNearIds(selected)}}
 if(changed||nearIds.length){dirty.current=false;lastCamera.current.copy(camera.matrixWorld);lastHeight.current=size.height;mesh.instanceMatrix.needsUpdate=model.poses.needsUpdate=model.near.needsUpdate=true;mesh.computeBoundingSphere()}
 })
 useEffect(()=>()=>{model.geometry.dispose();model.material.dispose()},[model])
 if(!crowd.length)return null
 return <><instancedMesh name="residents" ref={ref} args={[model.geometry,model.material,crowd.length]} raycast={()=>{}}/>{crowd.filter(p=>nearIds.includes(p.id)).map(p=><Suspense key={p.id} fallback={null}><NearResident person={p.person} read={()=>states.current.get(p.id)} ready={ready.current}/></Suspense>)}{crowd.filter(p=>nearIds.slice(0,10).includes(p.id)).map(p=>{const role=p.person.job??(p.person.npc?(room?.startsWith('cafe:')||room?.startsWith('foodhall:')?'Market patron':room?.startsWith('work:')?'Neighbour at work':room?.startsWith('theatre:')?'Theatre guest':room?.startsWith('arena:')||room?.startsWith('stadium:')?'Supporter':'Neighbour'):'Neighbour');return <group key={p.id}><LifeBubble name={p.person.username} label={role+(p.label?' · '+p.label:'')} topic={p.topic} speaking={['talk','wave','sleep','cheer'].includes(p.activity)} readPosition={()=>rendered.current.get(p.id)} visible={()=>!hidden.current.has(p.id)&&(!p.person.lifeAction||!!activeLifeAction(p.person))}/>{p.condition.dirty&&<StinkCloud readPosition={()=>rendered.current.get(p.id)}/>}</group>})}</>
}
