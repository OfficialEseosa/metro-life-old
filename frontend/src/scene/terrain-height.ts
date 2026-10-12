import * as THREE from 'three'

type Field={triangles:number[][];cells:Map<string,number[]>}
const fields=new WeakMap<THREE.Mesh,Field>(),cellSize=8
/** Exact vertical triangle sampling, indexed once for the immutable city terrain. */
export function terrainHeight(mesh:THREE.Mesh,x:number,z:number){
 let field=fields.get(mesh)
 if(!field){
  mesh.updateWorldMatrix(true,false)
  field={triangles:[],cells:new Map()}
  const position=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,v=new THREE.Vector3(),count=index?.count??position.count
  for(let i=0;i<count;i+=3){
   const t:number[]=[]
   for(let j=0;j<3;j++){v.fromBufferAttribute(position,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld);t.push(v.x,v.y,v.z)}
   const area=(t[3]-t[0])*(t[8]-t[2])-(t[6]-t[0])*(t[5]-t[2]);if(Math.abs(area)<1e-8)continue
   const id=field.triangles.push(t)-1
   for(let cx=Math.floor(Math.min(t[0],t[3],t[6])/cellSize);cx<=Math.floor(Math.max(t[0],t[3],t[6])/cellSize);cx++)for(let cz=Math.floor(Math.min(t[2],t[5],t[8])/cellSize);cz<=Math.floor(Math.max(t[2],t[5],t[8])/cellSize);cz++){
    const key=cx+':'+cz,ids=field.cells.get(key)??[];ids.push(id);field.cells.set(key,ids)
   }
  }
  fields.set(mesh,field)
 }
 let height=-Infinity
 for(const id of field.cells.get(Math.floor(x/cellSize)+':'+Math.floor(z/cellSize))??[]){
  const t=field.triangles[id],dx=x-t[0],dz=z-t[2],bx=t[3]-t[0],bz=t[5]-t[2],cx=t[6]-t[0],cz=t[8]-t[2],det=bx*cz-cx*bz,u=(dx*cz-cx*dz)/det,w=(bx*dz-dx*bz)/det
  if(u>=-1e-7&&w>=-1e-7&&u+w<=1+1e-7)height=Math.max(height,t[1]+u*(t[4]-t[1])+w*(t[7]-t[1]))
 }
 return Number.isFinite(height)?height:0
}
