declare module 'n8ao' {
 import type { Scene,Camera,WebGLRenderTarget } from 'three'
 import { Pass } from 'three/addons/postprocessing/Pass.js'
 export class N8AOPass extends Pass {
  constructor(scene:Scene,camera:Camera,width:number,height:number)
  configuration:{depthAwareUpsampling:boolean;halfRes:boolean;gammaCorrection:boolean;transparencyAware:boolean;autoRenderBeauty:boolean;aoRadius:number;distanceFalloff:number;intensity:number}
  autoDetectTransparency:boolean
  beautyRenderTarget:WebGLRenderTarget
  setQualityMode(mode:'Performance'|'Low'|'Medium'|'High'|'Ultra'):void
 }
}
