import * as THREE from 'three'
import type { CityId } from '../api/types'
import { navigation, inBox } from '../navigation'

const ray=new THREE.Raycaster(),hits:THREE.Intersection[]=[]
/** Picking is disabled on scenery; sample its real terrain geometry directly for feet. */
export function groundHeight(scene:THREE.Scene,city:CityId,x:number,z:number){
 const bridge=navigation[city].bridges.findIndex(b=>inBox(x,z,b,-.6))
 if(bridge>=0)return city==='nyc'?5.8:bridge===0?5.575:3.85
 const terrain=scene.getObjectByName('terrain') as THREE.Mesh|undefined
 if(!terrain)return 0
 ray.set(new THREE.Vector3(x,60,z),new THREE.Vector3(0,-1,0));hits.length=0
 THREE.Mesh.prototype.raycast.call(terrain,ray,hits)
 return hits.length?Math.max(...hits.map(h=>h.point.y)):0
}
