import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Look } from '../api/types'

type WardrobeLook = Look & {face?:string;outfits?:Partial<Record<'everyday'|'work'|'sleep',{top:string;bottom:string;style:string;shoeColor:string}>>}
/** Clothing is selected from the saved wardrobe; old browser lives retain their existing colours. */
export function dressedLook(look:Look,pose:string):Look {
 const wardrobe=(look as WardrobeLook).outfits
 const outfit=wardrobe?.[pose==='Sleep'||pose==='Lie'?'sleep':pose==='Type'?'work':'everyday']
 return outfit?{...look,...outfit}:look
}

function makeAppearance(look:Look){
 const group=new THREE.Group(),geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[]
 group.name='saved-character-hair-and-face'
 const hair=new THREE.MeshStandardMaterial({color:look.hairColor,roughness:.9}),eye=new THREE.MeshStandardMaterial({color:'#292622',roughness:.8}),white=new THREE.MeshStandardMaterial({color:'#fff5e7'}),lip=new THREE.MeshStandardMaterial({color:new THREE.Color(look.skin).multiplyScalar(.64)})
 materials.push(hair,eye,white,lip)
 const ball=(x:number,y:number,z:number,sx:number,sy:number,sz:number,mat=hair)=>{const geometry=new THREE.SphereGeometry(1,10,7),mesh=new THREE.Mesh(geometry,mat);geometries.push(geometry);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;group.add(mesh);return mesh}
 const strand=(x:number,y:number,z:number,length:number,width=.026)=>ball(x,y,z,width,length,width)
 const style=look.hair||'short'
 // The head joint is at the neck; every dimension below is in final character metres.
 if(style!=='bald'){
  if(style==='afro')ball(0,.205,-.005,.19,.18,.15)
  else if(style==='curly'){for(let row=0;row<3;row++)for(let i=0;i<8;i++){const a=i*Math.PI/4;ball(Math.cos(a)*(.105-row*.025),.19+row*.045,Math.sin(a)*(.09-row*.02)-.01,.052,.052,.045)}}
  else {
   ball(0,.22,-.015,.14,.085,.115)
   if(['bob','long','braids'].includes(style)){ball(-.115,.13,-.035,.045,style==='long'?.17:.10,.10);ball(.115,.13,-.035,.045,style==='long'?.17:.10,.10);ball(0,.13,-.10,.11,style==='long'?.17:.10,.035)}
   if(style==='bun')ball(0,.29,-.075,.075,.075,.065)
   if(style==='ponytail'){ball(0,.20,-.15,.065,.07,.065);strand(0,.08,-.17,.14,.046)}
   if(style==='braids'){for(const x of [-.13,.13])for(let i=0;i<5;i++)ball(x,.13-i*.043,-.025,.027,.031,.028)}
   if(style==='mohawk'){for(let i=0;i<5;i++)ball(0,.28,-.10+i*.046,.035,.075,.035)}
   if(style==='short'){ball(-.07,.24,.04,.065,.035,.07);ball(.045,.25,.045,.07,.04,.06)}
  }
 }
 const face=(look as WardrobeLook).face??'soft',wide=face==='bright'?.055:face==='angular'?.044:.049,y=face==='angular'?.142:.148
 for(const x of [-wide,wide]){
  ball(x,y,.103,.022,face==='bright'?.021:.016,.009,white)
  ball(x,y,.111,.010,face==='bright'?.014:.011,.004,eye)
  const brow=ball(x,y+.033,.104,.025,.006,.007,hair);brow.rotation.z=(x<0?1:-1)*(face==='angular'?.25:.08)
 }
 ball(0,.081,.109,face==='bright'?.036:.027,.007,.008,lip)
 if(face==='freckled')for(const sign of [-1,1])for(let i=0;i<4;i++)ball(sign*(.049+i*.012),.119-(i%2)*.012,.105,.003,.003,.003,lip)
 // A hairstyle is one draw per palette material, rather than one draw per curl.
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>()
 for(const object of [...group.children])if(object instanceof THREE.Mesh){object.updateMatrix();object.geometry.applyMatrix4(object.matrix);const material=object.material as THREE.Material;const parts=batches.get(material)??[];parts.push(object.geometry);batches.set(material,parts)}
 group.clear();const merged:THREE.BufferGeometry[]=[]
 for(const [material,parts]of batches){const geometry=mergeGeometries(parts,false);if(geometry){merged.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;group.add(mesh)}}
 geometries.forEach(geometry=>geometry.dispose());geometries.splice(0,geometries.length,...merged)
 return {group,dispose:()=>{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}}
}

/** Attach to the actual animated head bone, so hair and facial choices follow every pose. */
export function mountCharacterAppearance(root:THREE.Object3D,look:Look,actorScale:number){
 const head=root.getObjectByName('Head')??root.getObjectByName('head')
 if(!head)return ()=>{}
 root.updateMatrixWorld(true)
 const appearance=makeAppearance(look),scale=head.getWorldScale(new THREE.Vector3())
 // Fit to the skin vertices of this modular head, including its bind-pose transform.
 const inverse=head.matrixWorld.clone().invert(),point=new THREE.Vector3(),bounds=new THREE.Box3(),visited=new Set<number>()
 root.traverse(object=>{if(!(object instanceof THREE.Mesh)||!/Head/i.test(object.name))return;const palette=Array.isArray(object.material)?object.material:[object.material],geometry=object.geometry,index=geometry.index;visited.clear();for(const part of geometry.groups){if(!/^Skin/.test(palette[part.materialIndex??0]?.name??''))continue;for(let at=part.start;at<part.start+part.count;at++){const vertex=index?index.getX(at):at;if(visited.has(vertex))continue;visited.add(vertex);object.getVertexPosition(vertex,point);point.applyMatrix4(object.matrixWorld).applyMatrix4(inverse);bounds.expandByPoint(point)}}})
 if(!bounds.isEmpty()){
  const centre=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),physical=new THREE.Vector3(size.x*scale.x*actorScale,size.y*scale.y*actorScale,size.z*scale.z*actorScale)
  if(physical.x>.1&&physical.x<.8&&physical.y>.1&&physical.y<.8){appearance.group.position.set(centre.x,bounds.min.y,centre.z);appearance.group.scale.set(physical.x/.28,physical.y/.27,physical.z/.22)}
 }
 appearance.group.scale.divide(new THREE.Vector3(Math.max(.00001,scale.x*actorScale),Math.max(.00001,scale.y*actorScale),Math.max(.00001,scale.z*actorScale)))
 root.traverse(o=>{if(o instanceof THREE.Mesh&&/Head/i.test(o.name)){for(const material of Array.isArray(o.material)?o.material:[o.material])if(!/^Skin/.test(material.name))material.visible=false}})
 head.add(appearance.group)
 return ()=>{head.remove(appearance.group);appearance.dispose()}
}

/** Standalone head-local version for a procedural actor or editor. */
export function CharacterAppearance({look}:{look:Look}){
 const appearance=useMemo(()=>makeAppearance(look),[look.hair,look.hairColor,look.skin,(look as WardrobeLook).face])
 useEffect(()=>()=>appearance.dispose(),[appearance])
 return <primitive object={appearance.group}/>
}
