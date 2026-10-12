import { groundHeight } from './ground'
/* oxlint-disable react/immutability -- Three instance buffers and shader uniforms are imperative animation resources. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'

/** One kit-model batch, with per-instance gait and activity deformation in the vertex shader. */
export function Residents(){
 const {invalidate,scene:cityScene}=useThree(),room=useStore(s=>s.sim?.city===s.city?s.sim.position?.room:null),self=useStore(s=>s.sim?.userId),players=useStore(s=>s.players),city=useStore(s=>s.city),ref=useRef<THREE.InstancedMesh>(null),positions=useRef(new Map<string,THREE.Vector3>()),dirty=useRef(true),lastCamera=useRef(new THREE.Matrix4()),lastHeight=useRef(0),{scene}=useGLTF('/models/landmarks/resident-lod.glb')
 const model=useMemo(()=>{let mesh:THREE.Mesh|undefined;scene.traverse(o=>{if(o instanceof THREE.Mesh)mesh=o});if(!mesh)throw Error('Resident model has no mesh');scene.updateMatrixWorld(true);const geometry=mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);geometry.computeBoundingBox();const box=geometry.boundingBox!,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(1.78/size.y,1.78/size.y,1.78/size.y);
 const poses=new THREE.InstancedBufferAttribute(new Float32Array(48),1),phases=new THREE.InstancedBufferAttribute(new Float32Array(48),1),shirts=new THREE.InstancedBufferAttribute(new Float32Array(48*3),3);geometry.setAttribute('crowdPose',poses);geometry.setAttribute('crowdPhase',phases);geometry.setAttribute('shirtColor',shirts);const time={value:0},material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85});material.onBeforeCompile=shader=>{shader.uniforms.crowdTime=time;shader.vertexShader='uniform float crowdTime;attribute float crowdPose;attribute float crowdPhase;attribute vec3 shirtColor;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\nif(position.y>1.0&&position.y<1.7)vColor.rgb=shirtColor;');shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float phase=crowdTime*(crowdPose==2.?10.:7.)+crowdPhase;
 if(crowdPose==1.||crowdPose==2.){if(position.y<1.)transformed.z+=sin(phase+step(0.,position.x)*3.14159)*(crowdPose==2.?.43:.24)*(1.-position.y);if(abs(position.x)>.32&&position.y>1.0&&position.y<1.8)transformed.z+=sin(phase+step(0.,position.x)*3.14159)*.13;transformed.y+=sin(phase*2.)*(crowdPose==2.?.07:.025);if(crowdPose==2.)transformed.z+=max(0.,position.y-1.)*.18;}
 if(crowdPose==3.){if(position.y<1.){transformed.z+=.42*(1.-position.y);transformed.y*=.58;}else transformed.y-=.42;}
 if(crowdPose==4.&&abs(position.x)>.32&&position.y>1.0&&position.y<1.8){transformed.z-=.28;transformed.y+=sin(phase)*.04;}
 if(crowdPose==5.){transformed.y+=sin(phase)*.07;if(abs(position.x)>.32&&position.y>1.0&&position.y<1.8){transformed.y+=.18+sin(phase)*.15;transformed.x+=sign(position.x)*.15;}}
 if(crowdPose==6.&&abs(position.x)>.32&&position.y>1.0&&position.y<1.8){transformed.y+=.55+sin(phase)*.1;transformed.x+=sign(position.x)*.16;}
 if(crowdPose==7.&&abs(position.x)>.32&&position.y>1.0&&position.y<1.8){transformed.y+=.2+sin(phase)*.12;transformed.z+=.15;}
 `)};material.userData.crowdTime=time;material.customProgramCacheKey=()=> 'metro-crowd-gait-v1';return{geometry,material,poses,phases,shirts,time}},[scene])
 const crowd=useMemo(()=>players.filter(p=>(p.npc||p.online)&&p.id!==self&&p.city===city&&p.position&&(p.position.room??null)===(room??null)).slice(0,48).map(p=>({id:p.id,target:new THREE.Vector3(p.position!.x,p.position!.room?.startsWith('club:')&&p.position!.z< -2.3?.36:0,p.position!.z),face:p.position!.face,activity:p.activity??'idle',color:new THREE.Color(p.look.top)})),[players,city,self,room])
 useLayoutEffect(()=>{dirty.current=true;if(ref.current)ref.current.userData.ids=crowd.map(p=>p.id);for(let i=0;i<crowd.length;i++){const p=crowd[i];if(!positions.current.has(p.id))positions.current.set(p.id,p.target.clone());model.phases.setX(i,[...p.id].reduce((a,c)=>a+c.charCodeAt(0),0));model.shirts.setXYZ(i,p.color.r,p.color.g,p.color.b)}model.phases.needsUpdate=model.shirts.needsUpdate=true;const ids=new Set(crowd.map(p=>p.id));for(const id of positions.current.keys())if(!ids.has(id))positions.current.delete(id);invalidate()},[crowd,model,invalidate])
 const animated=crowd.some(p=>p.activity!=='idle')
 useEffect(()=>{if(!animated)return;const timer=setInterval(()=>{if(!document.hidden)invalidate()},1000/30);return()=>clearInterval(timer)},[animated,invalidate])
 const dummy=useMemo(()=>new THREE.Object3D(),[]),point=useMemo(()=>new THREE.Vector3(),[])
 useFrame(({camera,size,clock},dt)=>{const mesh=ref.current;if(!mesh)return;model.time.value=clock.elapsedTime;let moving=false,changed=dirty.current||animated||!lastCamera.current.equals(camera.matrixWorld)||lastHeight.current!==size.height;
 for(let i=0;i<crowd.length;i++){const p=crowd[i],at=positions.current.get(p.id);if(!at)continue;const walking=at.distanceToSquared(p.target)>.0004;if(walking){if(at.distanceToSquared(p.target)>100)at.copy(p.target);else at.lerp(p.target,1-Math.exp(-Math.min(dt,.05)*12));moving=true;changed=true}const pose=walking?(p.activity==='jog'?2:1):({walk:1,jog:2,sit:3,type:4,work:4,dance:5,fun:5,cheer:6,food:7} as Record<string,number>)[p.activity]??0;model.poses.setX(i,pose)}
 if(!changed)return;dirty.current=false;lastCamera.current.copy(camera.matrixWorld);lastHeight.current=size.height;
 for(let i=0;i<crowd.length;i++){const at=positions.current.get(crowd[i].id);if(!at)continue;dummy.position.copy(at);if(!room)dummy.position.y=groundHeight(cityScene,city,at.x,at.z);const distance=camera.position.distanceTo(at);point.copy(at);point.y+=1.3;point.project(camera);const clip=distance<6||distance<24&&point.y<(size.width<700?-.28:-.66);dummy.scale.setScalar(clip?0:1);dummy.rotation.y=crowd[i].face;dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}mesh.instanceMatrix.needsUpdate=model.poses.needsUpdate=true;mesh.computeBoundingSphere();if(moving)invalidate()})
 useEffect(()=>()=>{model.geometry.dispose();model.material.dispose()},[model])
 if(!crowd.length)return null
 return <instancedMesh name="residents" ref={ref} args={[model.geometry,model.material,crowd.length]} raycast={()=>{}}/>
}
