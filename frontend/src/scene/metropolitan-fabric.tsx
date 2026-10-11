import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { Builder } from './geometry'
import { KitInstances } from './kit-models'
import type { Placement } from './fabric'
import { sitesFor } from './cities'
import { nycEast,nycLand } from './cities/nyc'
import { bayWest,bayEast,bayMarin } from './cities/bay'
import { suspension } from './metropolitan-models'
const noPick=()=>{}
function inside(x:number,z:number,poly:number[][]){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
function land(b:Builder,poly:number[][],color:string){const s=new THREE.Shape();poly.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:.8,bevelEnabled:true,bevelSize:.7,bevelThickness:.2,bevelSegments:1});g.rotateX(-Math.PI/2);b.add(g,color,0,-.95,0)}
function dataFor(city:'nyc'|'bay'){
 const b=new Builder(),windows=new Builder(),shore=new Builder(),sites=sitesFor(city),polys=city==='nyc'?[nycLand,nycEast]:[bayWest,bayEast,bayMarin]
 let seed=city==='nyc'?57:89;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
 const p=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string,angle=0):Placement=>({x,y,z,sx,sy,sz,color,angle})
 const homes:Placement[]=[],blocks:Placement[]=[],towers:Placement[]=[],trees:Placement[]=[],cars:Placement[]=[],roads:Placement[]=[]
 const isLand=(x:number,z:number)=>polys.some(poly=>inside(x,z,poly))
 for(const poly of polys){land(shore,poly,city==='nyc'?'#a7afa1':'#b8bda2');for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length];shore.line([a[0],.2,a[1]],[c[0],.2,c[1]],.75,'#d1cfb6')}}
 // Separate island and hills: geometry, not a flat square edge.
 if(city==='nyc'){shore.sphere(-51,0,79,1,'#9fac8d',9,.7,8);b.box(-20,.25,-45,22,.1,34,'#799264')}
 else {for(const[x,z,s]of[[-75,-85,19],[-42,-92,17],[-65,27,12]])shore.sphere(x,-1,z,1,'#9ba58b',s,4,s);shore.sphere(17,0,-46,1,'#a2a898',11,1,8);const bridge=suspension(new Builder(),'#9daeb2',49,14).build();bridge.rotateY(Math.PI/2);bridge.translate(33,0,-8);b.add(bridge,'#a4b2b3')}
 for(let z=-83;z<118;z+=8)for(let x=-83;x<114;x+=8){
  if(!isLand(x,z)||city==='nyc'&&x>-33&&x<-7&&z>-65&&z<-27)continue
  const clear=Object.values(sites).every(s=>Math.hypot(x-s.x,z-s.z)>s.size*.55+(s.height>10?8:4));if(!clear)continue
  const px=x+(rand()-.5),pz=z+(rand()-.5),downtown=city==='nyc'?x<9&&z>-27&&z<53:x>-24&&x<13&&z>-25&&z<39
  const brownstone=city==='nyc'&&(x>25||z<-58),victorian=city==='bay'&&(x<-26&&z<58)
  const type=downtown&&rand()>.25?towers:brownstone||!victorian&&rand()>.45?blocks:homes,h=type===towers?7+rand()*(city==='bay'?9:17):type===blocks?3+rand()*4:2+rand()*1.5,w=2.6+rand()*2.3,d=2.5+rand()*2
  const color=type===towers?['#98b4c1','#b2c2c9','#d0d6d1'][Math.floor(rand()*3)]:brownstone?['#976c59','#b88c6d','#9f7968'][Math.floor(rand()*3)]:victorian?['#d6c8b3','#c9b8ba','#adbec1','#b6c3a7'][Math.floor(rand()*4)]:'#cabfa9'
  const hill=city==='bay'&&x<-35?Math.max(0,Math.sin(x*.1)*Math.cos(z*.1)*1.5):0;type.push(p(px,hill,pz,w,h,d,color))
  for(let y=1;y<h;y+=1.5)for(let xx=-w/2+.5;xx<w/2;xx+=.9)if(rand()>.3)windows.box(px+xx,hill+y,pz+d/2+.02,.35,.55,.04,'#a8bdc5')
  if(brownstone){b.box(px,hill+.5,pz+d/2+.4,1,1,1,'#ac9278');for(let y=2;y<h;y+=1.7)b.box(px,hill+y,pz+d/2+.2,w,.1,.5,'#615d54')}
  roads.push(p(x-4,.03,z,2.3,.1,8,'#ffffff'));if((z+83)%16===0)roads.push(p(x,.03,z-4,2.3,.1,8,'#ffffff',Math.PI/2))
  if(rand()>.6)cars.push(p(x-4,.5,z,.65,.4,1.2,['#e6c98e','#b0806f','#b7cbc6'][Math.floor(rand()*3)]))
 }
 for(let i=0;i<470;i++){const x=rand()*210-95,z=rand()*220-98;if(!isLand(x,z)||!Object.values(sites).every(s=>Math.hypot(x-s.x,z-s.z)>s.size*.52))continue;const inPark=city==='nyc'&&x>-33&&x<-7&&z>-65&&z<-27;if(city==='nyc'&&!inPark&&rand()>.22)continue;const s=.6+rand()*.6;trees.push(p(x,0,z,s,s,s,['#76946b','#879d76','#64866c'][Math.floor(rand()*3)]))}
 return{land:shore.build(),streets:b.build(),windows:windows.build(),homes,blocks,towers,trees,cars,roads}
}
export function MetropolitanFabric({city,night}:{city:'nyc'|'bay';night:boolean}){
 const data=useMemo(()=>dataFor(city),[city])
 const groups=useMemo(()=>{
  const result:Record<string,Placement[]>={},add=(url:string,p:Placement)=>{(result[url]??=[]).push(p)},sample=(p:Placement[],n:number)=>p.filter((_,i)=>Math.floor((i+1)*n/p.length)>Math.floor(i*n/p.length)),soft=(p:Placement)=>({...p,color:'#'+new THREE.Color(p.color).lerp(new THREE.Color('#ffffff'),.72).getHexString(),angle:Math.round((p.x+p.z)/8)%4*Math.PI/2})
  sample(data.homes,48).forEach((p,i)=>add(city==='bay'&&i%3===0?'world/suburban/building-type-c.glb':'kaykit/building_'+['A','B','C'][i%3]+'_withoutBase.gltf',soft(p)))
  sample(data.blocks,36).forEach((p,i)=>add('kaykit/building_'+['C','D','E'][i%3]+'_withoutBase.gltf',soft(p)))
  sample(data.towers,18).forEach((p,i)=>add('world/commercial/building-skyscraper-'+['a','b','e'][i%3]+'.glb',{...soft(p),sy:Math.min(p.sy,19)}))
  data.trees.forEach((p,i)=>add('world/suburban/tree-'+(i%2?'small':'large')+'.glb',{...p,sx:p.sx*2,sy:p.sy*3,sz:p.sz*2,color:'#f0ffe9'}))
  data.cars.filter((_,i)=>i%3===0).forEach((p,i)=>add('kaykit/car_'+(i%2?'sedan':'hatchback')+'.gltf',{...p,sx:.7,sy:.55,sz:1.3,color:'#ffffff'}))
  data.roads.forEach((p,i)=>{add('kaykit/road_straight.gltf',p);if(i%7===0)add('kaykit/streetlight.gltf',{...p,x:p.x+1.5,sx:.8,sy:2.5,sz:.25})})
  return result
 },[data,city])
 return <group><mesh geometry={data.land} matrixAutoUpdate={false} receiveShadow raycast={noPick}><meshStandardMaterial vertexColors roughness={1}/></mesh><mesh geometry={data.streets} matrixAutoUpdate={false} receiveShadow castShadow raycast={noPick}><meshStandardMaterial vertexColors roughness={.85}/></mesh><Suspense fallback={null}>{Object.entries(groups).map(([url,placements])=><KitInstances key={url} url={'/models/'+url} placements={placements} night={night} shadow={!/road_|tree-|car_|building_[ABC]_|building-type/.test(url)}/>)}</Suspense></group>
}
