import data from '../../shared/navigation.json'
import type { CityId, Sim } from './api/types'
export type Position={x:number;z:number;face:number;place:string;room:string|null}
export const navigation=data.cities
export type Box={x:number;z:number;w:number;d:number;a:number}
export function inPolygon(x:number,z:number,poly:number[][]){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
export function inBox(x:number,z:number,b:Box,pad=.3){const dx=x-b.x,dz=z-b.z,c=Math.cos(b.a),s=Math.sin(b.a);return Math.abs(dx*c-dz*s)<b.w/2+pad&&Math.abs(dx*s+dz*c)<b.d/2+pad}
export function canStand(city:CityId,x:number,z:number,room:string|null=null){if(room)return Math.abs(x)<5.5&&Math.abs(z)<4.5;const n=navigation[city];return (n.land.some(p=>inPolygon(x,z,p))||n.bridges.some(b=>inBox(x,z,b,-.35)))&&!n.water.some(p=>inPolygon(x,z,p))&&!n.boxes.some(b=>inBox(x,z,b))}
export function slide(city:CityId,p:Position,dx:number,dz:number){const next={...p};const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));for(let i=0;i<steps;i++){if(canStand(city,next.x+dx/steps,next.z,next.room))next.x+=dx/steps;if(canStand(city,next.x,next.z+dz/steps,next.room))next.z+=dz/steps}if(dx||dz)next.face=Math.atan2(dx,dz);return next}
export function doorsFor(sim:Sim){const n=navigation[sim.city];return {...n.doors,...(sim.home.city===sim.city?{home:(n.homes as Record<string,{x:number;z:number;name:string}>)[sim.home.neighborhood]}:{})}}
export function nearbyDoor(sim:Sim,p:Position){return Object.entries(doorsFor(sim)).filter(([,d])=>Math.hypot(d.x-p.x,d.z-p.z)<3).sort((a,b)=>Math.hypot(a[1].x-p.x,a[1].z-p.z)-Math.hypot(b[1].x-p.x,b[1].z-p.z))[0]}
