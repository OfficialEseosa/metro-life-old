import { useEffect,useMemo } from 'react'
import * as THREE from 'three'
import { navigation } from '../navigation'
import type { CityId } from '../api/types'
import { Builder } from './geometry'

/** Small paved lots and surveyed collision-free approaches anchor the close walking view. */
export function Walkways({city}:{city:CityId}){
 const geometry=useMemo(()=>{const b=new Builder(),n=navigation[city];
  for(const box of n.boxes){if(!('y' in box))continue;const g=new THREE.BoxGeometry(box.w+1.4,.035,box.d+1.4);g.rotateY(box.a);b.add(g,'#d0cdc1',box.x,(box.y??0)+.018,box.z);
   if(!box.windows)continue;
   for(const side of [0,1,2])for(const col of [-.23,.23])for(const row of [.38,.66]){
    const local=side===0?new THREE.Vector3(col*box.w,box.h*row,-box.d/2-.012):new THREE.Vector3((side===1?-1:1)*(box.w/2+.012),box.h*row,col*box.d);
    const plane=new THREE.PlaneGeometry(Math.min(.48,(side===0?box.w:box.d)*.19),Math.min(.78,box.h*.18));plane.rotateY(side===0?Math.PI:side===1?-Math.PI/2:Math.PI/2);plane.translate(local.x,local.y,local.z);plane.rotateY(box.a);b.add(plane,'#7cabb7',box.x,box.y??0,box.z);
   }
  }
  for(const d of Object.values(n.homes))b.box(d.x,.016,d.z-4.1,5.8,.035,5.2,'#c9c8b6');
  for(const path of n.paths)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],c=path.points[i],dx=c[0]-a[0],dz=c[1]-a[1],g=new THREE.BoxGeometry(1.15,.035,Math.hypot(dx,dz)+.18);g.rotateY(Math.atan2(dx,dz));b.add(g,'#d6d1c3',(a[0]+c[0])/2,.045,(a[1]+c[1])/2)}
  return b.build()
 },[city])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return <mesh name="walking-paths" geometry={geometry} receiveShadow raycast={()=>{}}><meshStandardMaterial vertexColors roughness={.95}/></mesh>
}
