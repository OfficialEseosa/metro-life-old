import * as THREE from 'three'

/** Mark small vertical glass faces in the actual atlas geometry. Roofs and blank facades cannot glow. */
export function windowMask(geometry:THREE.BufferGeometry,map:THREE.Texture|null,atlas:string,materialName:string){
 const positions=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv'),index=geometry.index,mask=new Float32Array(positions.count),ids=new Float32Array(positions.count)
 const image=map?.image as CanvasImageSource&{width:number;height:number}|undefined
 if(image&&uv){
  const count=index?.count??positions.count
  for(let face=0;face<count;face+=3){
   const vertices=[0,1,2].map(i=>index?index.getX(face+i):face+i),xs=vertices.map(i=>positions.getX(i)),ys=vertices.map(i=>positions.getY(i)),zs=vertices.map(i=>positions.getZ(i))
   const w=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs)),h=Math.max(...ys)-Math.min(...ys)
   if(Math.abs(normal.getY(vertices[0]))>.2||w<.025||w>.65||h<.04||h>.65||h/w<.3||h/w>3.5)continue
   const u=vertices.reduce((n,i)=>n+uv.getX(i),0)/3,v=vertices.reduce((n,i)=>n+uv.getY(i),0)/3
   // The KayKit glass has diagonal reflection streaks in the bottom-left atlas tile.
   // Blue paint lives elsewhere; colour alone cannot distinguish it from glass.
   const glass=atlas==='kaykit'?u<.245&&v>.755:/glass|window/i.test(materialName)
   if(!glass)continue
   const id=Math.floor((Math.min(...xs)+Math.max(...xs))*50)+Math.floor((Math.min(...ys)+Math.max(...ys))*50)*17+Math.floor((Math.min(...zs)+Math.max(...zs))*50)*31
   for(const i of vertices){mask[i]=1;ids[i]=id}
  }
 }
 geometry.setAttribute('windowMask',new THREE.BufferAttribute(mask,1));geometry.setAttribute('windowId',new THREE.BufferAttribute(ids,1));geometry.userData.litWindowVertices=mask.reduce((a,b)=>a+b,0)
}
