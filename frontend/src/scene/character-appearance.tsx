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
 // A continuous scalp cap follows the forehead and nape. Every style grows from it.
 const cap=(width=.145,rise=.135,depth=.118)=>{
  const points:number[]=[],rings=8,segments=20
  const point=(ring:number,segment:number)=>{const az=segment/segments*Math.PI*2,edge=1.28+(1-Math.sin(az))*.38,theta=ring/rings*edge;return [Math.sin(theta)*Math.cos(az)*width,.15+Math.cos(theta)*rise,Math.sin(theta)*Math.sin(az)*depth-.008]}
  for(let ring=0;ring<rings;ring++)for(let segment=0;segment<segments;segment++){const a=point(ring,segment),b=point(ring+1,segment),c=point(ring+1,segment+1),d=point(ring,segment+1);points.push(...a,...c,...b,...a,...d,...c)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.computeVertexNormals();geometries.push(geometry);const mesh=new THREE.Mesh(geometry,hair);mesh.castShadow=true;group.add(mesh)
 }
 if(style!=='bald'){
  cap(style==='afro'?.19:.145,style==='afro'?.185:.135,style==='afro'?.16:.118)
  if(style==='curly'){for(let row=0;row<3;row++)for(let i=0;i<9;i++){const a=i*Math.PI*2/9;ball(Math.cos(a)*(.105-row*.028),.218+row*.025,Math.sin(a)*(.085-row*.02)-.015,.043,.045,.04)}}
  if(['bob','long','braids'].includes(style)){ball(-.115,.13,-.035,.043,style==='long'?.16:.09,.085);ball(.115,.13,-.035,.043,style==='long'?.16:.09,.085);ball(0,.13,-.10,.108,style==='long'?.16:.09,.033)}
  if(style==='bun')ball(0,.267,-.077,.067,.067,.059)
  if(style==='ponytail'){ball(0,.192,-.13,.055,.065,.055);strand(0,.075,-.155,.135,.041)}
  if(style==='braids'){for(const x of [-.13,.13])for(let i=0;i<5;i++)ball(x,.13-i*.041,-.025,.026,.03,.027)}
  if(style==='mohawk'){for(let i=0;i<5;i++)ball(0,.27,-.10+i*.044,.033,.065,.033)}
  if(style==='short'){ball(-.055,.263,.02,.065,.025,.065);ball(.045,.264,.025,.06,.025,.06)}
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
 for(const object of [...group.children])if(object instanceof THREE.Mesh){object.updateMatrix();const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();geometry.applyMatrix4(object.matrix);geometry.deleteAttribute('uv');const material=object.material as THREE.Material;const parts=batches.get(material)??[];parts.push(geometry);batches.set(material,parts)}
 group.clear();const merged:THREE.BufferGeometry[]=[]
 for(const [material,parts]of batches){const geometry=mergeGeometries(parts,false);parts.forEach(part=>part.dispose());if(geometry){merged.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.name=material===hair?'character-hair-'+style:material===eye?'character-face-pupils':material===white?'character-face-eyes':'character-face-details';mesh.userData.appearancePart=material===hair?'hair':'face';mesh.castShadow=true;group.add(mesh)}}
 geometries.forEach(geometry=>geometry.dispose());geometries.splice(0,geometries.length,...merged)
 return {group,dispose:()=>{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}}
}

const softenedHeads=new WeakMap<THREE.BufferGeometry,THREE.BufferGeometry>()
function skinIndices(object:THREE.Mesh){const palette=Array.isArray(object.material)?object.material:[object.material],index=object.geometry.index,vertices=new Set<number>();for(const part of object.geometry.groups)if(/^Skin/.test(palette[part.materialIndex??0]?.name??''))for(let at=part.start;at<part.start+part.count;at++)vertices.add(index?index.getX(at):at);return vertices}
/** Keep the original skinned head, with a rounded ear silhouette and welded face normals. */
export function softenCharacterHeads(root:THREE.Object3D){
 root.updateMatrixWorld(true);const rootInverse=root.matrixWorld.clone().invert(),point=new THREE.Vector3()
 root.traverse(object=>{
  if(!(object instanceof THREE.SkinnedMesh)||!/Head/i.test(object.name))return
  const source=object.geometry,cached=softenedHeads.get(source);if(cached){object.geometry=cached;return}
  const vertices=skinIndices(object),coordinates=new Map<number,THREE.Vector3>(),xs:number[]=[]
  for(const vertex of vertices){object.getVertexPosition(vertex,point);point.applyMatrix4(object.matrixWorld).applyMatrix4(rootInverse);coordinates.set(vertex,point.clone());xs.push(point.x)}
  const matrices=object.skeleton.boneMatrices;if(!xs.length||!matrices)return
  xs.sort((a,b)=>a-b);const left=xs[Math.floor(xs.length*.06)],right=xs[Math.floor(xs.length*.94)],centre=(left+right)/2,half=(right-left)*.54,geometry=source.clone(),positions=geometry.getAttribute('position'),skinIndex=geometry.getAttribute('skinIndex'),skinWeight=geometry.getAttribute('skinWeight'),meshInverse=object.matrixWorld.clone().invert(),weighted=new THREE.Matrix4(),bone=new THREE.Matrix4()
  for(const [vertex,at]of coordinates){if(Math.abs(at.x-centre)<=half)continue;at.x=THREE.MathUtils.clamp(at.x,centre-half,centre+half);weighted.elements.fill(0)
   for(let component=0;component<4;component++){const i=skinIndex.getComponent(vertex,component),weight=skinWeight.getComponent(vertex,component);if(!weight)continue;bone.fromArray(matrices,i*16);for(let k=0;k<16;k++)weighted.elements[k]+=bone.elements[k]*weight}
   weighted.premultiply(object.bindMatrixInverse).multiply(object.bindMatrix);at.applyMatrix4(root.matrixWorld).applyMatrix4(meshInverse).applyMatrix4(weighted.invert());positions.setXYZ(vertex,at.x,at.y,at.z)
  }
  const index=geometry.index,count=index?.count??positions.count,sums=new Map<string,THREE.Vector3>(),keys=Array.from({length:positions.count},(_,i)=>`${Math.round(positions.getX(i)*100000)}:${Math.round(positions.getY(i)*100000)}:${Math.round(positions.getZ(i)*100000)}`),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3()
  for(let face=0;face<count;face+=3){const ids=[0,1,2].map(j=>index?index.getX(face+j):face+j);a.fromBufferAttribute(positions,ids[0]);b.fromBufferAttribute(positions,ids[1]);c.fromBufferAttribute(positions,ids[2]);normal.subVectors(b,a).cross(c.sub(a));for(const vertex of ids){const key=keys[vertex];if(!sums.has(key))sums.set(key,new THREE.Vector3());sums.get(key)!.add(normal)}}
  const normals=new Float32Array(positions.count*3);for(let i=0;i<positions.count;i++)sums.get(keys[i])!.normalize().toArray(normals,i*3);geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();softenedHeads.set(source,geometry);object.geometry=geometry
 })
}

/** Fit in the body's upright frame, then convert the finished attachment into the animated bone frame. */
export function mountCharacterAppearance(root:THREE.Object3D,look:Look,_actorScale:number){
 const head=root.getObjectByName('Head')??root.getObjectByName('head');if(!head)return ()=>{}
 root.updateMatrixWorld(true)
 const appearance=makeAppearance(look),rootInverse=root.matrixWorld.clone().invert(),point=new THREE.Vector3(),bounds=new THREE.Box3()
 root.traverse(object=>{if(!(object instanceof THREE.Mesh)||!/Head/i.test(object.name))return;for(const vertex of skinIndices(object)){object.getVertexPosition(vertex,point);bounds.expandByPoint(point.applyMatrix4(object.matrixWorld).applyMatrix4(rootInverse))}})
 if(bounds.isEmpty()){appearance.dispose();return ()=>{}}
 const centre=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),frame=new THREE.Matrix4().compose(new THREE.Vector3(centre.x,bounds.min.y,centre.z),new THREE.Quaternion(),new THREE.Vector3(size.x/.28,size.y/.27,size.z/.22)),attachment=head.matrixWorld.clone().invert().multiply(root.matrixWorld).multiply(frame)
 attachment.decompose(appearance.group.position,appearance.group.quaternion,appearance.group.scale)
 root.traverse(object=>{if(object instanceof THREE.Mesh&&/Head/i.test(object.name))for(const material of Array.isArray(object.material)?object.material:[object.material])if(!/^Skin/.test(material.name))material.visible=false})
 head.add(appearance.group)
 return ()=>{head.remove(appearance.group);appearance.dispose()}
}

/** Standalone head-local version for a procedural actor or editor. */
export function CharacterAppearance({look}:{look:Look}){
 const appearance=useMemo(()=>makeAppearance(look),[look.hair,look.hairColor,look.skin,(look as WardrobeLook).face])
 useEffect(()=>()=>appearance.dispose(),[appearance])
 return <primitive object={appearance.group}/>
}
