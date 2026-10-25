import { useEffect, useMemo } from 'react'
import { useHomeDesign } from '../home-design'
import { roomLayout } from '../navigation'
import { useStore } from '../store'
import { Builder } from './geometry'
import { RoomWalls } from './room-walls'
import { roomPalette, roomTexture } from './room-surfaces'

/** Furniture pieces are local authored geometry; the same dimensions drive Buy mode and collision. */
export function FurnishedHome(){
 const city=useStore(s=>s.city),design=useHomeDesign(s=>s.design),open=useHomeDesign(s=>s.open),layout=roomLayout(city,'home'),bounds=layout.bounds??{w:7,d:6},hw=bounds.w/2,hd=bounds.d/2
 const palette=useMemo(()=>({...roomPalette(city,'home'),wall:design?.wallColor??'#e5d8bf',floor:design?.floorColor??'#ad8b69'}),[city,design?.wallColor,design?.floorColor])
 const textures=useMemo(()=>({floor:roomTexture('wood',palette,28),paper:roomTexture('paper',palette,17)}),[palette])
 useEffect(()=>()=>{textures.floor.dispose();textures.paper.dispose()},[textures])
 const pieces=useMemo(()=>layout.furniture.map(f=>{const b=new Builder(),colour=(f as typeof f&{color?:string}).color??palette.fabric,w=f.w,d=f.d
  const legs=(h:number)=>{for(const x of [-w*.38,w*.38])for(const z of [-d*.35,d*.35])b.box(x,h/2,z,.075,h,.075,palette.wood)}
  if(f.kind==='bed'){b.box(0,.22,0,w,.38,d,palette.wood);b.box(0,.48,0,w-.05,.22,d-.06,'#f2eadb');b.box(-w*.14,.64,0,w*.68,.13,d-.08,colour);b.box(w*.34,.66,0,w*.23,.16,d*.8,'#fff4e2');b.box(w/2,.62,0,.1,1.05,d+.06,palette.wood)}
  else if(['chair','sofa','bench'].includes(f.kind)){legs(.35);b.box(0,.4,0,w,.18,d,colour);b.box(0,.83,-d*.43,w,.78,.16,colour);for(const x of [-w*.44,w*.44])b.box(x,.65,0,.15,.35,d,colour);b.box(0,.53,0,w*.8,.12,d*.8,'#d4ccb9')}
  else if(f.kind==='stove'){b.box(0,.43,0,w,.86,d,colour);b.box(0,.89,0,w+.04,.06,d+.04,'#384b4e');b.box(0,.45,d*.505,w*.7,.4,.03,'#253a42');for(const x of [-w*.25,w*.25])for(const z of [-d*.25,d*.25])b.cylinder(x,.94,z,.14,.025,'#1b2a30',12);b.cylinder(w*.25,1.03,-d*.25,.17,.18,'#b5a184',12)}
  else if(f.kind==='fridge'){b.box(0,1,0,w,2,d,colour);b.box(0,1.45,d*.51,w*.95,.035,.025,'#6e7d7a');b.box(w*.34,1.2,d*.53,.05,.5,.06,'#d7dad0')}
  else if(f.kind==='shower'){b.box(0,.08,0,w,.16,d,'#dae3db');b.box(0,1.15,-d/2,w,2.3,.08,colour);b.cylinder(0,1.3,-d*.42,.035,2.1,'#9caeaf',8);b.box(0,2.25,-d*.25,.42,.07,.4,'#9aa8a8');for(const x of [-w/2,w/2]){b.box(x,1.1,0,.04,2.2,d,'#b5d1cd');b.box(x,2.2,0,.07,.07,d,palette.trim)}}
  else if(f.kind==='tub'){b.box(0,.28,0,w,.5,d,colour);b.box(0,.55,0,w*.84,.06,d*.72,'#7fb4ba');for(const z of [-d*.46,d*.46])b.box(0,.5,z,w,.15,.08,'#e1e8dc');for(const x of [-w*.46,w*.46])b.box(x,.5,0,.08,.15,d,'#e1e8dc');b.cylinder(w*.4,.8,-d*.3,.035,.6,'#a2b1b3',8)}
  else if(f.kind==='sink'){b.box(0,.38,0,w*.8,.76,d*.8,colour);b.box(0,.8,0,w,.12,d,'#e5e9df');b.cylinder(0,1,-d*.3,.03,.3,'#a1b0b0',8)}
  else if(f.kind==='table'||f.kind==='desk'){legs(.7);b.box(0,.75,0,w,.09,d,colour);if(f.kind==='desk'){b.box(0,1.05,-d*.3,w*.55,.48,.06,'#374e59');b.box(0,1.05,-d*.24,w*.48,.4,.02,'#9bcbc6');b.box(0,.83,d*.2,w*.4,.04,.18,'#657a79')}}
  else if(f.kind==='lamp'){b.cylinder(0,.06,0,w*.45,.12,'#7f8273',12);b.cylinder(0,.85,0,.028,1.6,'#8c8c79',8);b.cylinder(0,1.55,0,w*.55,.5,colour,12,w*.35)}
  else if(f.kind==='rug'){b.box(0,.025,0,w,.03,d,colour);b.box(0,.044,0,w*.75,.006,d*.7,palette.trim)}
  else if(f.kind==='shelf'){for(const x of [-w*.45,w*.45])b.box(x,.8,0,.06,1.6,d,palette.wood);for(const y of [.1,.55,1,1.45]){b.box(0,y,0,w,.06,d,palette.wood);for(let i=0;i<5;i++)b.box(-w*.35+i*w*.17,y+.17,0,w*.12,.27,d*.7,i%2?colour:'#c8a675')}}
  else if(f.kind==='sculpture'){b.box(0,.15,0,w,.3,d,palette.wood);b.torus(0,.8,0,w*.46,.1,colour);b.sphere(0,1.35,0,w*.25,colour)}
  else{b.cylinder(0,.2,0,w*.37,.4,palette.wood,10,w*.46);b.cylinder(0,.7,0,.03,1.2,'#63825a',6);for(let i=0;i<7;i++){const a=i*2.4;b.sphere(Math.sin(a)*w*.35,.65+i*.09,Math.cos(a)*d*.35,w*.4,f.kind==='flowers'&&i>2?'#c98e9d':colour,.8,.65,.8)}}
  return {f,geometry:b.build({bakeAO:true})}
 }),[layout,palette])
 useEffect(()=>()=>pieces.forEach(p=>p.geometry.dispose()),[pieces])
 return <group name="furnished-home"><mesh position={[0,-.13,0]} receiveShadow><boxGeometry args={[bounds.w,.25,bounds.d]}/><meshStandardMaterial color={palette.floor} map={textures.floor} roughness={.9}/></mesh><RoomWalls hw={hw} hd={hd} palette={palette} paper={textures.paper}/>{pieces.map(({f,geometry})=><mesh key={f.id} name={`home-furniture:${f.id}`} geometry={geometry} position={[f.x,0,f.z]} rotation={[0,f.angle,0]} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.78}/></mesh>)}<mesh position={[0,.012,hd-.22]}><boxGeometry args={[1.4,.035,.3]}/><meshStandardMaterial color="#d4ad67"/></mesh>{open&&<gridHelper args={[Math.max(bounds.w,bounds.d),Math.round(Math.max(bounds.w,bounds.d)*4),'#688477','#b5b39a']} position={[0,.045,0]}/>}</group>
}
