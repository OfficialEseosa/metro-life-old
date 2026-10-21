import { create } from 'zustand'
import type { Position } from './navigation'
export type InteractionIntent={kind:'act'|'apply'|'door'|'location'|'bench'|'social';label:string;city:string;room:string|null;loc:string;stationId?:string;actionId?:string;jobId?:string;targetId?:string;benchId?:string;enter?:boolean}
export const motion={interactionIntent:null as InteractionIntent|null,revision:0,teleport:0,x:0,z:0,run:false,position:null as Position|null,follow:true,moving:false,camera:null as {angle:number;distance:number;height:number}|null,useApproach:null as {slotId:string;x:number;z:number}|null,flush:async()=>{},wake:()=>{}}
export const useWalking=create<{position:Position|null;error:string;hint:boolean;transition:boolean}>(()=>({position:null,error:'',hint:false,transition:false}))
export const interact=()=>window.dispatchEvent(new CustomEvent('metro-interact',{detail:motion.interactionIntent}))
