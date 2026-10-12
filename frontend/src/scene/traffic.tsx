import { Suspense, useMemo } from 'react'
import survey from '../../../shared/resident-routes.json'
import { canStand, inBox } from '../navigation'
import type { CityId } from '../api/types'
import { KitInstances, type DriveRoute } from './kit-models'
import { metricPlacement } from './world-scale'

/** Surveyed asphalt spans only: cars turn at their ends, never cross landmark clearings. */
export function Traffic({city,night}:{city:CityId;night:boolean}){
 const routes=useMemo(()=>{
  const roads=survey.cities[city].roads,lines=new Map<string,typeof roads>();
  for(const r of roads){const a=Math.round(r.a/(Math.PI/2))*Math.PI/2;if(Math.abs(a-r.a)>.01)continue;const cross=Math.abs(Math.sin(a))>.5?r.z:r.x,key=a+':'+cross.toFixed(2);const line=lines.get(key)??[];line.push(r);lines.set(key,line)}
  const candidates:DriveRoute[]=[];
  for(const line of lines.values()){
   const a=line[0].a,s=Math.sin(a),c=Math.cos(a),cross=line[0].x*c-line[0].z*s,spans=line.map(r=>({lo:r.x*s+r.z*c-r.d/2,hi:r.x*s+r.z*c+r.d/2})).sort((a,b)=>a.lo-b.lo);
   const merged:{lo:number;hi:number}[]=[];for(const span of spans){const last=merged.at(-1);if(last&&span.lo-last.hi<.25)last.hi=Math.max(last.hi,span.hi);else merged.push({...span})}
   for(const span of merged){const lo=span.lo+1.5,hi=span.hi-1.5,point=(t:number)=>({x:s*t+c*(cross+1.6),z:c*t-s*(cross+1.6)});
    const height=(p:{x:number;z:number})=>{const r=roads.find(r=>inBox(p.x,p.z,r))!;return r.y+.085-Math.sin(r.pitch)*((p.x-r.x)*Math.sin(r.a)+(p.z-r.z)*Math.cos(r.a))};
    let run:number|null=null;const add=(end:number)=>{if(run===null||end-run<9)return;const start=point(run),finish=point(end);candidates.push({...start,ex:finish.x,ez:finish.z,y:height(start),ey:height(finish)})};
    for(let t=lo;t<=hi+.5;t+=.5){const p=point(t),road=roads.find(r=>inBox(p.x,p.z,r,.02)),clear=t<=hi&&canStand(city,p.x,p.z)&&!!road&&Math.abs(road.pitch)<.2;if(clear){if(run===null)run=t}else{add(t-.5);run=null}}
   }
  }
  return candidates.sort((a,b)=>Math.hypot(b.ex-b.x,b.ez-b.z)-Math.hypot(a.ex-a.x,a.ez-a.z)).filter((p,i,all)=>all.slice(0,i).every(q=>Math.hypot(q.x-p.x,q.z-p.z)>8)).slice(0,8)
 },[city])
 const placements=useMemo(()=>routes.map((p,i)=>metricPlacement('vehicles/sedan.glb',{x:p.x,y:p.y,z:p.z,sx:1,sy:1,sz:1,angle:0,color:['#e7d3ad','#a5c4d8','#e5aaa0','#e3e9de'][i%4]})),[routes])
 return <group name="traffic"><Suspense fallback={null}><KitInstances url="/models/vehicles/sedan.glb" placements={placements} drive={routes} shadow={false} night={night}/></Suspense></group>
}
