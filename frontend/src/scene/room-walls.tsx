/* oxlint-disable react/immutability -- Owned visibility and shadow flags follow the camera. */
import { useEffect,useMemo,useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame,useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Builder } from './geometry'
import { useStore } from '../store'
import type { RoomPalette } from './room-surfaces'
function uv(geometry:THREE.BufferGeometry){const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),values=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){values[i*2]=(Math.abs(n.getZ(i))>.5?p.getX(i):p.getZ(i))*.65;values[i*2+1]=p.getY(i)*.65}geometry.setAttribute('uv',new THREE.BufferAttribute(values,2));return geometry}
export function RoomWalls({hw,hd,palette,paper,open=false,height=3,floor,windows=true}:{hw:number;hd:number;palette:RoomPalette;paper:THREE.Texture;open?:boolean;height?:number;floor?:number[][];windows?:boolean}){
 const mode=useStore(s=>s.wallMode),{gl,invalidate}=useThree(),groups=useRef<(THREE.Group|null)[]>([])
 const walls=useMemo(()=>{
  const polygon=floor??[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]]
  return polygon.map((a,index)=>{const z=polygon[(index+1)%polygon.length],dx=z[0]-a[0],dz=z[1]-a[1],length=Math.hypot(dx,dz),cx=(a[0]+z[0])/2,cz=(a[1]+z[1])/2,base=new Builder(),upper=new Builder(),front=Math.abs(cz-hd)<.05&&Math.abs(dx)>.1,back=Math.abs(cz+hd)<.05&&Math.abs(dx)>.1,door=front&&Math.abs(cx)<length/2,window=windows&&back,angle=-Math.atan2(dz,dx)
   const xs=door?[-length/2,-.75-cx,.75-cx,length/2]:window?[-length/2,-1.55-cx,.15-cx,length/2]:[-length/2,length/2],ys=door?[0,.65,2.1,height]:window?[0,.65,1.2,2.5,height]:[0,.65,height]
   for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2,w=xs[i+1]-xs[i],h=ys[j+1]-ys[j];if(w<=0||h<=0||door&&Math.abs(x+cx)<.75&&y<2.1||window&&x+cx>-1.55&&x+cx<.15&&y>1.2&&y<2.5)continue;(y<.65?base:upper).box(x,y,0,w,h,.18,palette.wall)}
   for(let i=0;i<xs.length-1;i++){const x=(xs[i]+xs[i+1])/2,w=xs[i+1]-xs[i];if(w<=0||door&&Math.abs(x+cx)<.75)continue;base.box(x,.065,0,w,.13,.2,palette.trim)}
   return {base:uv(base.build({bakeAO:true})),upper:uv(upper.build({bakeAO:true})),cx,cz,angle,nx:dz/length,nz:-dx/length}
  })
 },[hw,hd,palette,height,floor,windows])
 useEffect(()=>{gl.shadowMap.needsUpdate=true;invalidate()},[mode,gl,invalidate])
 useEffect(()=>()=>walls.forEach(w=>{w.base.dispose();w.upper.dispose()}),[walls])
 useFrame(({camera})=>{let changed=false;walls.forEach((wall,i)=>{const group=groups.current[i];if(!group)return;const near=(camera.position.x-wall.cx)*wall.nx+(camera.position.z-wall.cz)*wall.nz>0,show=!open&&(mode==='up'||mode==='cutaway'&&!near),top=group.children[1],bottom=group.children[0],scale=mode==='down'?.25/.65:1;if(top.visible!==show||bottom.scale.y!==scale){top.visible=show;bottom.scale.y=scale;changed=true}});if(changed){gl.shadowMap.needsUpdate=true;invalidate()}})
 return <>{walls.map((w,i)=><group key={i} ref={g=>{groups.current[i]=g}} name={`room-wall-${i}`} position={[w.cx,0,w.cz]} rotation={[0,w.angle,0]}><mesh geometry={w.base} castShadow receiveShadow><meshStandardMaterial vertexColors map={paper} roughness={.95}/></mesh><mesh geometry={w.upper} castShadow receiveShadow><meshStandardMaterial vertexColors map={paper} roughness={.95}/></mesh></group>)}</>
}

/** Mounted art, signs, window glass and door trim follow their supporting wall. */
export function WallMounted({side,children}:{side:'front'|'back'|'left'|'right';children:ReactNode}){
 const group=useRef<THREE.Group>(null),mode=useStore(s=>s.wallMode),{gl,invalidate}=useThree()
 useFrame(({camera})=>{if(!group.current)return;const near=side==='front'?camera.position.z>0:side==='back'?camera.position.z<0:side==='left'?camera.position.x<0:camera.position.x>0,show=mode==='up'||mode==='cutaway'&&!near;if(group.current.visible!==show){group.current.visible=show;gl.shadowMap.needsUpdate=true;invalidate()}})
 return <group ref={group} name={`wall-mounted-${side}`}>{children}</group>
}
