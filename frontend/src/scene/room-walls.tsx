/* oxlint-disable react/immutability -- Owned visibility and shadow flags follow the camera. */
import { useEffect,useMemo,useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame,useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Builder } from './geometry'
import { useStore } from '../store'
import type { RoomPalette } from './room-surfaces'
function uv(geometry:THREE.BufferGeometry){const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),values=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){values[i*2]=(Math.abs(n.getZ(i))>.5?p.getX(i):p.getZ(i))*.65;values[i*2+1]=p.getY(i)*.65}geometry.setAttribute('uv',new THREE.BufferAttribute(values,2));return geometry}
export function RoomWalls({hw,hd,palette,paper,open=false}:{hw:number;hd:number;palette:RoomPalette;paper:THREE.Texture;open?:boolean}){
 const mode=useStore(s=>s.wallMode),{gl,invalidate}=useThree(),groups=useRef<(THREE.Group|null)[]>([])
 const walls=useMemo(()=>[0,1,2,3].map(side=>{
  const base=new Builder(),upper=new Builder(),axis=side<2?'x':'z',extent=axis==='x'?hw:hd,fixed=side===0?hd:side===1?-hd:side===2?-hw:hw
  const xs=side===0?[-extent,-.75,.75,extent]:side===1?[-extent,-1.55,.15,extent]:[-extent,extent],ys=side===0?[0,.65,2.1,3]:side===1?[0,.65,1.2,2.5,3]:[0,.65,3]
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
   const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2,w=xs[i+1]-xs[i],h=ys[j+1]-ys[j]
   if(side===0&&Math.abs(x)<.75&&y<2.1||side===1&&x>-1.55&&x<.15&&y>1.2&&y<2.5)continue
   const b=y<.65?base:upper;b.box(axis==='x'?x:fixed,y,axis==='x'?fixed:x,axis==='x'?w:.18,h,axis==='x'?.18:w,palette.wall)
  }
  for(let i=0;i<xs.length-1;i++){const x=(xs[i]+xs[i+1])/2;if(side===0&&Math.abs(x)<.75)continue;const w=xs[i+1]-xs[i];base.box(axis==='x'?x:fixed,.065,axis==='x'?fixed:x,axis==='x'?w:.2,.13,axis==='x'?.2:w,palette.trim)}
  return{base:uv(base.build({bakeAO:true})),upper:uv(upper.build({bakeAO:true})),side}
 }),[hw,hd,palette])
 useEffect(()=>{gl.shadowMap.needsUpdate=true;invalidate()},[mode,gl,invalidate])
 useEffect(()=>()=>walls.forEach(w=>{w.base.dispose();w.upper.dispose()}),[walls])
 useFrame(({camera})=>{let changed=false;walls.forEach(({side},i)=>{const group=groups.current[i];if(!group)return;const near=side===0?camera.position.z>0:side===1?camera.position.z<0:side===2?camera.position.x<0:camera.position.x>0,show=!open&&(mode==='up'||mode==='cutaway'&&!near),top=group.children[1],bottom=group.children[0],scale=mode==='down'?.25/.65:1;if(top.visible!==show||bottom.scale.y!==scale){top.visible=show;bottom.scale.y=scale;changed=true}});if(changed){gl.shadowMap.needsUpdate=true;invalidate()}})
 return <>{walls.map((w,i)=><group key={w.side} ref={g=>{groups.current[i]=g}} name={`room-wall-${['front','back','left','right'][w.side]}`}><mesh geometry={w.base} castShadow receiveShadow><meshStandardMaterial vertexColors map={paper} roughness={.95}/></mesh><mesh geometry={w.upper} castShadow receiveShadow><meshStandardMaterial vertexColors map={paper} roughness={.95}/></mesh></group>)}</>
}

/** Mounted art, signs, window glass and door trim follow their supporting wall. */
export function WallMounted({side,children}:{side:'front'|'back'|'left'|'right';children:ReactNode}){
 const group=useRef<THREE.Group>(null),mode=useStore(s=>s.wallMode),{gl,invalidate}=useThree()
 useFrame(({camera})=>{if(!group.current)return;const near=side==='front'?camera.position.z>0:side==='back'?camera.position.z<0:side==='left'?camera.position.x<0:camera.position.x>0,show=mode==='up'||mode==='cutaway'&&!near;if(group.current.visible!==show){group.current.visible=show;gl.shadowMap.needsUpdate=true;invalidate()}})
 return <group ref={group} name={`wall-mounted-${side}`}>{children}</group>
}
