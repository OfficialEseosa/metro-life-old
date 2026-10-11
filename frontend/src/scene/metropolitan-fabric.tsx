import { Suspense, useLayoutEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { Builder } from './geometry'
import { KitInstances } from './kit-models'
import type { Placement } from './fabric'
import { sitesFor } from './cities'
import { nycEast,nycLand } from './cities/nyc'
import { bayWest,bayEast,bayMarin } from './cities/bay'
import { suspension } from './metropolitan-models'
import osm from './city-osm.json'
const noPick=()=>{}
function inside(x:number,z:number,poly:number[][]){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
function land(b:Builder,poly:number[][],color:string){const s=new THREE.Shape();poly.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:.8,bevelEnabled:true,bevelSize:.7,bevelThickness:.2,bevelSegments:1});g.rotateX(-Math.PI/2);b.add(g,color,0,-.95,0)}
function dataFor(city:'nyc'|'bay'){
 const b=new Builder(),shore=new Builder(),sites=sitesFor(city),polys=city==='nyc'?[nycLand,nycEast]:[bayWest,bayEast,bayMarin]
 let seed=city==='nyc'?57:89;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
 const p=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string,angle=0):Placement=>({x,y,z,sx,sy,sz,color,angle})
 const homes:Placement[]=[],blocks:Placement[]=[],towers:Placement[]=[],trees:Placement[]=[],cars:Placement[]=[],roads:Placement[]=[]
 const isLand=(x:number,z:number)=>polys.some(poly=>inside(x,z,poly))
 const footprints:Record<string,[number,number]>={empire:[14,11],oneWtc:[19,19],grandCentral:[21,15],met:[29,20],cityHall:[18,12],centralPark:[25,34],brooklynBridge:[10,43],goldenGate:[10,64],ferryBuilding:[27,12],salesforce:[15,22],sfCityHall:[30,18],paintedLadies:[20,14],ggPark:[25,13],dolores:[18,14],highLine:[4,21]}
 const clearSite=(x:number,z:number,pad:number)=>Object.entries(sites).every(([id,s])=>{const a=s.angle??0,dx=x-s.x,dz=z-s.z,lx=dx*Math.cos(a)-dz*Math.sin(a),lz=dx*Math.sin(a)+dz*Math.cos(a),[w,d]=footprints[id]??[s.size*.9,s.size*.9];return Math.abs(lx)>w*.5+pad||Math.abs(lz)>d*.5+pad})
 for(const poly of polys){land(shore,poly,city==='nyc'?'#b8c7c2':'#b7c6a7');for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length];shore.line([a[0],.2,a[1]],[c[0],.2,c[1]],.75,'#d7d9cd')}}
 // Separate island and hills: geometry, not a flat square edge.
 if(city==='nyc'){shore.sphere(-51,0,79,1,'#a7c28e',9,.7,8);b.box(-20,.25,-45,22,.1,34,'#82b478')}
 else {for(const[x,z,s]of[[-75,-85,19],[-42,-92,17],[-65,27,12]])shore.sphere(x,-1,z,1,'#9db68d',s,4,s);const bridge=suspension(new Builder(),'#9daeb2',49,14).build();bridge.rotateY(Math.PI/2);bridge.translate(33,0,-8);b.add(bridge,'#a4b2b3')}
 for(let z=-83;z<118;z+=8)for(let x=-83;x<114;x+=8){
  if(!isLand(x,z)||city==='bay'&&z<-49||city==='nyc'&&x>-33&&x<-7&&z>-65&&z<-27)continue
  const clear=clearSite(x,z,3.2);if(!clear)continue
  const px=x+(rand()-.5),pz=z+(rand()-.5),downtown=city==='nyc'?x<9&&z>-27&&z<53:x>-24&&x<13&&z>-25&&z<39
  const brownstone=city==='nyc'&&(x>25||z<-58),victorian=city==='bay'&&(x<-26&&z<58)
  const type=downtown&&rand()>.25?towers:brownstone||!victorian&&rand()>.45?blocks:homes,h=type===towers?7+rand()*(city==='bay'?9:17):type===blocks?3+rand()*4:2+rand()*1.5,w=2.6+rand()*2.3,d=2.5+rand()*2
  const color=type===towers?['#98b4c1','#b2c2c9','#d0d6d1'][Math.floor(rand()*3)]:brownstone?['#976c59','#b88c6d','#9f7968'][Math.floor(rand()*3)]:victorian?['#d6c8b3','#c9b8ba','#adbec1','#b6c3a7'][Math.floor(rand()*4)]:'#cabfa9'
  const visibleHeight=type===towers&&Object.values(sites).some(s=>Math.abs(px-s.x)<s.size*.7&&pz-s.z>s.size*.35&&pz-s.z<s.size*.6+15)?Math.min(h,5):h
  const hill=city==='bay'&&x<-35?Math.max(0,Math.sin(x*.1)*Math.cos(z*.1)*1.5):0;type.push(p(px,hill,pz,w,visibleHeight,d,color))
  // Preserve the district seed while avoiding hundreds of unused window buffers.
  for(let y=1;y<h;y+=1.5)for(let xx=-w/2+.5;xx<w/2;xx+=.9)rand()
  if(brownstone){b.box(px,hill+.5,pz+d/2+.4,1,1,1,'#ac9278');for(let y=2;y<h;y+=1.7)b.box(px,hill+y,pz+d/2+.2,w,.1,.5,'#615d54')}
  roads.push(p(x-4,.03,z,2.3,.1,8,'#ffffff'));if((z+83)%16===0)roads.push(p(x,.03,z-4,2.3,.1,8,'#ffffff',Math.PI/2))
  if(rand()>.6)cars.push(p(x-4,.5,z,.65,.4,1.2,['#e6c98e','#b0806f','#b7cbc6'][Math.floor(rand()*3)]))
 }
 for(let i=0;i<470;i++){const x=rand()*210-95,z=rand()*220-98;if(!isLand(x,z)||!clearSite(x,z,.8))continue;const inPark=city==='nyc'&&x>-33&&x<-7&&z>-65&&z<-27;if(city==='nyc'&&!inPark&&rand()>.22)continue;const s=.6+rand()*.6;trees.push(p(x,0,z,s,s,s,['#76946b','#879d76','#64866c'][Math.floor(rand()*3)]))}
 // Retain surveyed bearings around the successful OSM extracts. Larger landmark
 // footprints require local clearance in this deliberately compressed city map.
 const mainRoads:Placement[]=[]
 for(const street of osm.cities[city].streets){
  if(!(city==='nyc'?/^(West Street|Church Street|Broadway)$/:/^(The Embarcadero|Market Street)$/).test(street.name))continue
  for(let i=1;i<street.points.length;i++){
   const a=street.points[i-1],c=street.points[i],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(length/3))
   for(let j=0;j<n;j++){const t=(j+.5)/n,x=a[0]+dx*t,z=a[1]+dz*t;if(!isLand(x,z)||Object.values(sites).some(s=>Math.hypot(x-s.x,z-s.z)<s.size*.48+1)||mainRoads.some(r=>Math.hypot(r.x-x,r.z-z)<1.2))continue;mainRoads.push(p(x,.05,z,2.3,.1,length/n+.15,'#ffffff',Math.atan2(dx,dz)))}
  }
 }
 // Street network exists independently of buildable lots, so landmark clearings
 // do not leave disconnected strips of asphalt around every building.
 for(let z=-83;z<118;z+=8)for(let x=-87;x<114;x+=8){
  if(!isLand(x,z)||city==='bay'&&z<-49||city==='nyc'&&x>-33&&x<-7&&z>-65&&z<-27)continue
  if(!clearSite(x,z,1.3))continue
  if(!roads.some(r=>Math.hypot(r.x-x,r.z-z)<2))roads.push(p(x,.025,z,2.3,.1,8,'#ffffff'))
 }
 const connectedRoads=roads.filter(r=>!mainRoads.some(m=>Math.hypot(m.x-r.x,m.z-r.z)<3)).concat(mainRoads)
 return{land:shore.build(),streets:b.build(),homes,blocks,towers,trees,cars,roads:connectedRoads}
}
export function MetropolitanFabric({city,night}:{city:'nyc'|'bay';night:boolean}){
 const data=useMemo(()=>dataFor(city),[city])
 const groups=useMemo(()=>{
  const result:Record<string,Placement[]>={},add=(url:string,p:Placement)=>{(result[url]??=[]).push(p)},sample=(p:Placement[],n:number)=>p.filter((_,i)=>Math.floor((i+1)*n/p.length)>Math.floor(i*n/p.length)),soft=(p:Placement)=>({...p,color:'#'+new THREE.Color(p.color).lerp(new THREE.Color('#ffffff'),.72).getHexString(),angle:Math.round((p.x+p.z)/8)%4*Math.PI/2})
  sample(data.homes,city==='bay'?40:60).forEach((p,i)=>add(city==='bay'&&i%3===0?'world/suburban/building-type-c.glb':'kaykit/building_'+['A','B','C'][i%3]+'_withoutBase.gltf',soft(p)))
  sample(data.blocks,city==='bay'?40:55).forEach((p,i)=>add('kaykit/building_'+['C','D','E'][i%3]+'_withoutBase.gltf',soft(p)))
  sample(data.towers,city==='bay'?18:27).forEach((p,i)=>add('world/commercial/building-skyscraper-'+['a','b','e'][i%3]+'.glb',{...soft(p),sy:Math.min(p.sy,19)}))
  data.trees.filter((_,i)=>city==='nyc'||i%2===0).forEach((p,i)=>add('world/suburban/tree-'+(i%2?'small':'large')+'.glb',{...p,sx:p.sx*2,sy:p.sy*3,sz:p.sz*2,color:'#f0ffe9'}))
  data.cars.filter((_,i)=>i%12===0).forEach((p,i)=>add('kaykit/car_'+(i%2?'sedan':'hatchback')+'.gltf',{...p,sx:.7,sy:.55,sz:1.3,color:'#ffffff'}))
  data.roads.forEach((p,i)=>{add('kaykit/road_straight.gltf',p);if(i%28===0)add('kaykit/streetlight.gltf',{...p,x:p.x+1.5,sx:.8,sy:2.5,sz:.25})})
  return result
 },[data,city])
 useLayoutEffect(()=>{Object.keys(groups).forEach(url=>useGLTF.preload(`/models/${url}`))},[groups])
 return <group><mesh name="terrain" geometry={data.land} matrixAutoUpdate={false} receiveShadow raycast={noPick}><meshStandardMaterial vertexColors emissive={night?'#365238':'#000000'} emissiveIntensity={night?.18:0} roughness={1}/></mesh><mesh geometry={data.streets} matrixAutoUpdate={false} receiveShadow castShadow raycast={noPick}><meshStandardMaterial vertexColors roughness={.85}/></mesh>{Object.entries(groups).map(([url,placements])=><Suspense key={url} fallback={null}><KitInstances url={'/models/'+url} placements={placements} night={night} shadow={/building-skyscraper/.test(url)}/></Suspense>)}</group>
}
