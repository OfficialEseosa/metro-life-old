import residentRoutes from '../../shared/resident-routes.json'
import venues from '../../shared/venues.json'
import rooms from '../../shared/interiors.json'
import data from '../../shared/navigation.json'
import type { CityId, Sim, World } from './api/types'
export type Position={x:number;z:number;face:number;place:string;room:string|null}
export const interiors=rooms
export type RoomLayout={name:string;exit:{x:number;z:number};stations:{id:string;name:string;action:string;x:number;z:number;face:number}[];boxes:Box[];furniture:{id:string;kind:string;x:number;z:number;w:number;d:number;angle:number;slots:import('./api/types').ActivitySlot[]}[];slots:import('./api/types').ActivitySlot[]}
export function roomLayout(city:CityId,type:keyof typeof rooms):RoomLayout{const base=rooms[type];return (city==='atl'?base:base.variants[city]) as RoomLayout}
export function interiorType(world:World|null,city:CityId,loc:string){if(loc==='home')return 'home';if(venues[city].cafe===loc)return 'cafe';if(venues[city].club===loc)return 'club';const place=world?.cities.find(c=>c.id===city)?.landmarks.find(l=>l.id===loc);return place?.actions.some(a=>a.requires?.job)?'work':undefined}
export function roomType(room:string|null|undefined){return room?.split(':')[0] as keyof typeof interiors|undefined}
export function nearbyStation(p:Position,city:CityId='atl'){const type=roomType(p.room);if(!type)return;const room=roomLayout(city,type);if(Math.hypot(p.x-room.exit.x,p.z-room.exit.z)<1.5)return {id:'exit',name:type==='home'?'Leave home':'Leave building',action:'exit',x:room.exit.x,z:room.exit.z,face:0};return room.stations.filter(s=>Math.hypot(s.x-p.x,s.z-p.z)<1.45).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]}
export const navigation=data.cities
export type Box={x:number;z:number;w:number;d:number;a:number}
export function inPolygon(x:number,z:number,poly:number[][]){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
export function inBox(x:number,z:number,b:Box,pad=.3){const dx=x-b.x,dz=z-b.z,c=Math.cos(b.a),s=Math.sin(b.a);return Math.abs(dx*c-dz*s)<b.w/2+pad&&Math.abs(dx*s+dz*c)<b.d/2+pad}
export function canStand(city:CityId,x:number,z:number,room:string|null=null){if(room){const type=roomType(room);return !!type&&Math.abs(x)<(type==='home'?3.25:5.5)&&Math.abs(z)<(type==='home'?2.75:4.5)&&!roomLayout(city,type).boxes.some(b=>inBox(x,z,b))};const n=navigation[city];return (n.land.some(p=>inPolygon(x,z,p))||n.bridges.some(b=>inBox(x,z,b,-.35)))&&!n.water.some(p=>inPolygon(x,z,p))&&!n.boxes.some(b=>inBox(x,z,b))}
export function slide(city:CityId,p:Position,dx:number,dz:number){const next={...p};const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));for(let i=0;i<steps;i++){if(canStand(city,next.x+dx/steps,next.z,next.room))next.x+=dx/steps;if(canStand(city,next.x,next.z+dz/steps,next.room))next.z+=dz/steps}if(dx||dz)next.face=Math.atan2(dx,dz);return next}
export function doorsFor(sim:Sim){const n=navigation[sim.city];return {...n.doors,...(sim.home.city===sim.city?{home:(n.homes as Record<string,{x:number;z:number;name:string}>)[sim.home.neighborhood]}:{})}}
export function nearbyDoor(sim:Sim,p:Position){return Object.entries(doorsFor(sim)).filter(([,d])=>Math.hypot(d.x-p.x,d.z-p.z)<3).sort((a,b)=>Math.hypot(a[1].x-p.x,a[1].z-p.z)-Math.hypot(b[1].x-p.x,b[1].z-p.z))[0]}

export function nearbyBench(city:CityId,p:Position){if(p.room)return;return Object.entries(residentRoutes.cities[city].parks).flatMap(([park,row])=>row.benches.map(([x,z],i)=>({id:`${park}:${i}`,x,z}))).filter(b=>Math.hypot(b.x-p.x,b.z-p.z)<2).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]}
