import { useEffect,useMemo } from 'react'
import type { CityId } from '../api/types'
import { streets } from '../street-network'
import { Builder } from './geometry'

export function Streets({city}:{city:CityId}){
 const geometry=useMemo(()=>{const graph=streets[city],b=new Builder(),strip=(a:number[],c:number[],width:number,y:number,color:string)=>{const dx=c[0]-a[0],dz=c[2]-a[2],len=Math.hypot(dx,dz);if(!len)return;const x=-dz/len*width/2,z=dx/len*width/2,A=[a[0]+x,a[1]+y,a[2]+z],B=[a[0]-x,a[1]+y,a[2]-z],C=[c[0]+x,c[1]+y,c[2]+z],D=[c[0]-x,c[1]+y,c[2]-z];b.triangle([...A,...B,...C,...B,...D,...C],color)}
  for(const [a,c] of graph.edges){const p=graph.nodes[a],q=graph.nodes[c];strip(p,q,graph.width+1.8,.027,'#d6d3c4');strip(p,q,graph.width,.055,'#566066');const dx=q[0]-p[0],dz=q[2]-p[2];if((a+c)%3===0){const t=.30,ex=.64;strip([p[0]+dx*t,p[1]+(q[1]-p[1])*t,p[2]+dz*t],[p[0]+dx*ex,p[1]+(q[1]-p[1])*ex,p[2]+dz*ex],.075,.066,'#efd999')}}
  for(let i=0;i<graph.nodes.length;i++){const [x,y,z]=graph.nodes[i];if(graph.links[i].length>=3)b.box(x,y+.027,z,graph.width,.06,graph.width,'#566066');if(graph.links[i].length===1){b.cylinder(x,y+.025,z,2.6,.045,'#d5d0bd',20);b.cylinder(x,y+.055,z,1.8,.045,'#566066',20)}}
  for(const id of graph.plazas){const [x,y,z]=graph.nodes[id];b.cylinder(x,y+.035,z,2.5,.05,'#c7c0a9',20);for(const dx of [-1.7,1.7])b.box(x+dx,y+.065,z,.2,.025,1.4,'#f2ead3')}
  for(const entry of Object.values(graph.access)){const points=entry.points.map(([x,z])=>[x,graph.nodes[entry.node][1],z]);if(points.length>1)strip(points[0],points[1],1.35,.075,'#ddd3bd')}
  return b.build()
 },[city])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return <mesh name="connected-street-network" geometry={geometry} receiveShadow raycast={()=>{}}><meshStandardMaterial vertexColors roughness={.94} side={2}/></mesh>
}
