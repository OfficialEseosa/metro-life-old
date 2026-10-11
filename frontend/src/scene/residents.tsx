/* oxlint-disable react/immutability -- Crowd motion updates instance matrices outside React. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { sitesFor } from './cities'

export function Residents(){
 const players=useStore(s=>s.players),city=useStore(s=>s.city),ref=useRef<THREE.InstancedMesh>(null),positions=useRef(new Map<string,THREE.Vector3>()),{scene}=useGLTF('/models/landmarks/resident-lod.glb')
 const model=useMemo(()=>{let mesh:THREE.Mesh|undefined;scene.traverse(o=>{if(o instanceof THREE.Mesh)mesh=o});if(!mesh)throw Error('Resident model has no mesh');const geometry=mesh.geometry.clone();scene.updateMatrixWorld(true);geometry.applyMatrix4(mesh.matrixWorld);geometry.computeBoundingBox();const box=geometry.boundingBox!,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(2.8/size.y,2.8/size.y,2.8/size.y);return{geometry,material:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85})}},[scene])
 const crowd=useMemo(()=>players.filter(p=>(p.npc||p.online)&&p.city===city&&p.loc&&sitesFor(city)[p.loc]).slice(0,48).map(p=>{const site=sitesFor(city)[p.loc!],seed=[...p.id].reduce((a,c)=>a+c.charCodeAt(0),0),bridge=/Bridge|goldenGate/.test(p.loc!),angle=site.angle??0;let x=(seed%9-4)*.65,z=(/piedmont|centennial|centralPark|ggPark|beltline/.test(p.loc!)?site.size*.26:site.size*.62+1)+(seed%3)*.9,y=0;if(bridge){x=(seed%3-1)*.35;z=(seed%13-6)*1.3;y=p.loc==='goldenGate'?5.6:5.8}else if(p.loc==='liberty'){x=7+(seed%3-1)*.3;z=(seed%3-1)*.7;y=.35}else if(p.loc==='alcatraz'){x=-1+(seed%5-2)*.5;z=-4;y=2.85}return{id:p.id,target:new THREE.Vector3(site.x+x*Math.cos(angle)+z*Math.sin(angle),y,site.z+z*Math.cos(angle)-x*Math.sin(angle)),color:new THREE.Color(p.look.top).lerp(new THREE.Color('#ffffff'),.65)}}),[players,city])
 useLayoutEffect(()=>{if(!ref.current)return;for(let i=0;i<crowd.length;i++){ref.current.setColorAt(i,crowd[i].color);if(!positions.current.has(crowd[i].id))positions.current.set(crowd[i].id,crowd[i].target.clone())}if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;const ids=new Set(crowd.map(p=>p.id));for(const id of positions.current.keys())if(!ids.has(id))positions.current.delete(id)},[crowd])
 const dummy=useMemo(()=>new THREE.Object3D(),[])
 useFrame((_,dt)=>{const mesh=ref.current;if(!mesh)return;for(let i=0;i<crowd.length;i++){const p=crowd[i],at=positions.current.get(p.id);if(!at)continue;at.lerp(p.target,Math.min(1,dt*2));dummy.position.copy(at);dummy.rotation.y=i*.8;dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere()})
 useEffect(()=>()=>{model.geometry.dispose();model.material.dispose()},[model])
 if(!crowd.length)return null
 return <instancedMesh name="residents" ref={ref} args={[model.geometry,model.material,crowd.length]} raycast={()=>{}}/>
}
