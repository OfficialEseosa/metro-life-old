/* oxlint-disable react/immutability -- Instance buffers are owned Three.js resources. */
import { useEffect,useLayoutEffect,useMemo,useRef } from 'react'
import * as THREE from 'three'
import type { Placement } from './fabric'
export function NightPools({placements}:{placements:Placement[]}){
 const ref=useRef<THREE.InstancedMesh>(null),texture=useMemo(()=>{const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!,g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,210,130,.48)');g.addColorStop(.45,'rgba(255,195,112,.24)');g.addColorStop(1,'rgba(255,195,112,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)},[])
 useLayoutEffect(()=>{const d=new THREE.Object3D();placements.forEach((p,i)=>{d.position.set(p.x,p.y+.022,p.z);d.rotation.set(-Math.PI/2,0,0);d.scale.set(10,10,1);d.updateMatrix();ref.current!.setMatrixAt(i,d.matrix)});ref.current!.instanceMatrix.needsUpdate=true;ref.current!.computeBoundingSphere()},[placements])
 useEffect(()=>()=>texture.dispose(),[texture])
 return <instancedMesh name="street-light-pools" ref={ref} args={[undefined,undefined,placements.length]} raycast={()=>{}}><planeGeometry/><meshBasicMaterial map={texture} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/></instancedMesh>
}
