import { create } from 'zustand'
import type { Position } from './navigation'
export const motion={x:0,z:0,run:false,position:null as Position|null,follow:true,moving:false,wake:()=>{}}
export const useWalking=create<{position:Position|null;error:string;hint:boolean}>(()=>({position:null,error:'',hint:false}))
export const interact=()=>window.dispatchEvent(new Event('metro-interact'))
