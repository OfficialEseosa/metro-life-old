/* oxlint-disable react/immutability -- Composer, GPU queries and Three resources are owned by this renderer. */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { Pass } from 'three/addons/postprocessing/Pass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { GentleBloom } from './gentle-bloom'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { N8AOPass } from 'n8ao'
import { useStore } from '../store'

class BeautyPass extends Pass {
  private scene:THREE.Scene;private camera:THREE.Camera;private target:THREE.WebGLRenderTarget;private ready:()=>void
  constructor(scene:THREE.Scene,camera:THREE.Camera,target:THREE.WebGLRenderTarget,ready:()=>void){super();this.scene=scene;this.camera=camera;this.target=target;this.ready=ready;this.needsSwap=false}
  render(renderer:THREE.WebGLRenderer){renderer.setRenderTarget(this.target);renderer.clear();renderer.render(this.scene,this.camera);this.ready()}
}

/** One render of the city; the remaining passes operate on pixels. Native resolution in both modes. */
export function ImageQuality(){
 const {gl,scene,camera,size,invalidate}=useThree(),quality=useStore(s=>s.sceneQuality),pipeline=useRef<EffectComposer|null>(null)
 useEffect(()=>{
  const composer=new EffectComposer(gl),ao=quality==='normal'?new N8AOPass(scene,camera,size.width,size.height):null
  const context=gl.getContext() as WebGL2RenderingContext,extension=import.meta.env.DEV?context.getExtension('EXT_disjoint_timer_query_webgl2'):null
  const queries:{query:WebGLQuery;kind:string}[]=[],samples:number[]=[],beautySamples:number[]=[];let active:WebGLQuery|null=null,activeKind=""
  const begin=(kind:string)=>{if(extension&&queries.length<8){active=context.createQuery();activeKind=kind;if(active)context.beginQuery(extension.TIME_ELAPSED_EXT,active)}}
  const end=()=>{if(active){context.endQuery(extension.TIME_ELAPSED_EXT);queries.push({query:active,kind:activeKind});active=null}}
  const beautyDone=()=>{end();begin("post")}
  if(ao){
   ao.autoDetectTransparency=false;ao.configuration.halfRes=true;ao.configuration.depthAwareUpsampling=false;ao.setQualityMode('Performance');ao.configuration.gammaCorrection=false;ao.configuration.transparencyAware=false
   ao.configuration.autoRenderBeauty=false;ao.configuration.aoRadius=.65;ao.configuration.distanceFalloff=1;ao.configuration.intensity=1.35
   composer.addPass(new BeautyPass(scene,camera,ao.beautyRenderTarget,beautyDone));composer.addPass(ao)
  }else{
   const beauty=new RenderPass(scene,camera),render=beauty.render.bind(beauty)
   beauty.render=(...args)=>{render(...args);beautyDone()};composer.addPass(beauty)
  }
  composer.addPass(new SMAAPass())
  composer.addPass(new GentleBloom());composer.addPass(new OutputPass());composer.setPixelRatio(1);composer.setSize(size.width,size.height)
  gl.toneMapping=THREE.AgXToneMapping;gl.toneMappingExposure=1;gl.info.autoReset=false
  const render=composer.render.bind(composer)
  composer.render=(dt?:number)=>{
   while(queries.length&&context.getQueryParameter(queries[0].query,context.QUERY_RESULT_AVAILABLE)){
    const {query,kind}=queries.shift()!;if(!context.getParameter(extension.GPU_DISJOINT_EXT)){const list=kind==="post"?samples:beautySamples;list.push(context.getQueryParameter(query,context.QUERY_RESULT)/1e6);if(list.length>120)list.shift()}context.deleteQuery(query)
   }
   const start=performance.now();begin("beauty");render(dt);end()
   scene.userData.imageQuality={quality,halfResolutionAO:!!ao,transparencyAware:ao?.configuration.transparencyAware??false,automaticBeauty:ao?.configuration.autoRenderBeauty??false,dpr:gl.getPixelRatio(),postGpuMs:samples.length?samples.reduce((a,b)=>a+b,0)/samples.length:null,beautyGpuMs:beautySamples.length?beautySamples.reduce((a,b)=>a+b,0)/beautySamples.length:null,frameCpuMs:performance.now()-start,passes:['beauty',...(ao?['N8AO half']:[]),'SMAA','gentle bloom','warm grade','AgX output']}
  }
  pipeline.current=composer;invalidate()
  return()=>{
   pipeline.current=null;queries.forEach(q=>context.deleteQuery(q.query));composer.passes.forEach(p=>p.dispose());composer.dispose()
   // N8AO 2.0.1 inherits an empty Pass.dispose. Release its owned top-level targets/quads/materials.
   if(ao)for(const [key,value]of Object.entries(ao)){if(key==='scene'||key==='camera')continue;if(value&&typeof value==='object'&&'dispose'in value&&typeof value.dispose==='function')value.dispose()}
   delete scene.userData.imageQuality;gl.info.autoReset=true
  }
 },[gl,scene,camera,quality,size.width,size.height,invalidate])
 useFrame(()=>gl.info.reset(),-100)
 useFrame((_,dt)=>{if(import.meta.env.DEV&&scene.userData.withoutEffects){gl.setRenderTarget(null);gl.render(scene,camera)}else pipeline.current?.render(dt)},1)
 return null
}
