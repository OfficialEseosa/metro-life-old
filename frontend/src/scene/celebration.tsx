/* oxlint-disable react/immutability -- Celebration particles and camera offsets are transient renderer state. */
import { useEffect,useMemo,useRef } from 'react'
import { useFrame,useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls } from 'three-stdlib'
import { motion } from '../walking'

export function Celebration(){
 const {camera,invalidate,controls,scene}=useThree(),mesh=useRef<THREE.InstancedMesh>(null),started=useRef(-100),origin=useRef(new THREE.Vector3()),previousPush=useRef(new THREE.Vector3()),dummy=useMemo(()=>new THREE.Object3D(),[]),direction=useMemo(()=>new THREE.Vector3(),[]),reduced=useRef(false)
 const particles=useMemo(()=>Array.from({length:80},(_,i)=>({angle:i*2.39996,speed:1.3+(i*17%31)/14,lift:2.8+(i*23%31)/12,spin:i*.73,colour:new THREE.Color(['#2fa36b','#efb859','#df8597','#91b8c7','#fff1cd'][i%5])})),[])
 useEffect(()=>{reduced.current=matchMedia('(prefers-reduced-motion: reduce)').matches;const launch=()=>{started.current=performance.now();const at=motion.position;origin.current.set(at?.x??0,0,at?.z??0);scene.getObjectByName('controlled-player')?.getWorldPosition(origin.current);origin.current.y+=2.4;particles.forEach((p,i)=>mesh.current?.setColorAt(i,p.colour));if(mesh.current?.instanceColor)mesh.current.instanceColor.needsUpdate=true;invalidate()};window.addEventListener('metro-celebrate',launch);return()=>window.removeEventListener('metro-celebrate',launch)},[particles,invalidate,scene])
 useFrame(()=>{if(previousPush.current.lengthSq()){camera.position.add(previousPush.current);previousPush.current.set(0,0,0)}},-80)
 useFrame((_,dt)=>{const t=(performance.now()-started.current)/1000;if(!mesh.current)return;mesh.current.visible=t>=0&&t<2.4;if(!mesh.current.visible)return
  const count=reduced.current?20:particles.length
  particles.forEach((p,i)=>{const radius=p.speed*t;dummy.position.set(origin.current.x+Math.cos(p.angle)*radius,origin.current.y+p.lift*t-2.5*t*t,origin.current.z+Math.sin(p.angle)*radius);dummy.rotation.set(p.spin+t*4,p.spin+t*2,p.spin+t*3);dummy.scale.setScalar(i<count?Math.max(0,1-t/2.4):0);dummy.updateMatrix();mesh.current!.setMatrixAt(i,dummy.matrix)});mesh.current.instanceMatrix.needsUpdate=true;mesh.current.computeBoundingSphere();const material=mesh.current.material as THREE.MeshBasicMaterial;material.opacity=Math.max(0,1-t/2.4)
  if(t<1.2&&!reduced.current&&controls){const target=(controls as unknown as OrbitControls).target;if(target){direction.copy(camera.position).sub(target).normalize();previousPush.current.copy(direction).multiplyScalar(Math.sin(t/1.2*Math.PI)*.8);camera.position.sub(previousPush.current);camera.lookAt(target)}}
  if(dt<1)invalidate()
 },.5)
 return <instancedMesh name="celebration-confetti" ref={mesh} args={[undefined,undefined,80]} visible={false} raycast={()=>{}}><planeGeometry args={[.12,.2]}/><meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent opacity={1} depthWrite={false} toneMapped={false}/></instancedMesh>
}
