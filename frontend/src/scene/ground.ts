import * as THREE from 'three'
import type { CityId } from '../api/types'
import { navigation, inBox } from '../navigation'
import survey from '../../../shared/resident-routes.json'
import { terrainHeight } from './terrain-height'

/** Picking is disabled on scenery; sample its real terrain geometry directly for feet. */
export function groundHeight(scene:THREE.Scene,city:CityId,x:number,z:number){
 const bridge=navigation[city].bridges.findIndex(b=>inBox(x,z,b,-.6))
 if(bridge>=0)return city==='nyc'?5.8:bridge===0?5.575:3.85
 const terrain=scene.getObjectByName('terrain') as THREE.Mesh|undefined
 if(!terrain)return 0
 const base=terrainHeight(terrain,x,z)
 const road=survey.cities[city].roads.find(r=>inBox(x,z,r,0))
 if(!road)return base
 const dx=x-road.x,dz=z-road.z,side=Math.abs(dx*Math.cos(road.a)-dz*Math.sin(road.a)),along=dx*Math.sin(road.a)+dz*Math.cos(road.a)
 return Math.max(base,road.y+.08-Math.sin(road.pitch)*along+(side>3.2?.15:0))
}
