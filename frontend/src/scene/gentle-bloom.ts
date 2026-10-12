import * as THREE from 'three'
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js'

const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}'
const sample='uniform sampler2D source;varying vec2 vUv;'

/** Small highlights need one quarter-size blur, rather than a five-level bloom pyramid. */
export class GentleBloom extends Pass {
 private a=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false})
 private b=this.a.clone()
 private extract=new THREE.ShaderMaterial({vertexShader,uniforms:{source:{value:null}},fragmentShader:sample+'void main(){vec3 c=texture2D(source,vUv).rgb;float peak=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*clamp((peak-1.6)/max(peak,.001),0.,1.),1.);}'})
 private blur=new THREE.ShaderMaterial({vertexShader,uniforms:{source:{value:null},stepSize:{value:new THREE.Vector2()}},fragmentShader:sample+'uniform vec2 stepSize;void main(){vec3 c=texture2D(source,vUv).rgb*.227027;c+=(texture2D(source,vUv+stepSize*1.384615).rgb+texture2D(source,vUv-stepSize*1.384615).rgb)*.316216;c+=(texture2D(source,vUv+stepSize*3.230769).rgb+texture2D(source,vUv-stepSize*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}'})
 private combine=new THREE.ShaderMaterial({vertexShader,uniforms:{source:{value:null},bloom:{value:null}},fragmentShader:sample+'uniform sampler2D bloom;void main(){vec4 c=texture2D(source,vUv);c.rgb+=texture2D(bloom,vUv).rgb*.1;float l=dot(c.rgb,vec3(.2126,.7152,.0722));c.rgb=mix(vec3(l),c.rgb,1.045)*vec3(1.025,1.,.975);gl_FragColor=c;}'})
 private quad=new FullScreenQuad(this.extract)
 constructor(){super()}
 setSize(width:number,height:number){const w=Math.max(1,Math.round(width/4)),h=Math.max(1,Math.round(height/4));this.a.setSize(w,h);this.b.setSize(w,h)}
 render(renderer:THREE.WebGLRenderer,write:THREE.WebGLRenderTarget,read:THREE.WebGLRenderTarget){
  const draw=(material:THREE.ShaderMaterial,target:THREE.WebGLRenderTarget|null)=>{this.quad.material=material;renderer.setRenderTarget(target);this.quad.render(renderer)}
  this.extract.uniforms.source.value=read.texture;draw(this.extract,this.a)
  this.blur.uniforms.source.value=this.a.texture;this.blur.uniforms.stepSize.value.set(1/this.a.width,0);draw(this.blur,this.b)
  this.blur.uniforms.source.value=this.b.texture;this.blur.uniforms.stepSize.value.set(0,1/this.a.height);draw(this.blur,this.a)
  this.combine.uniforms.source.value=read.texture;this.combine.uniforms.bloom.value=this.a.texture;draw(this.combine,this.renderToScreen?null:write)
 }
 dispose(){this.a.dispose();this.b.dispose();this.extract.dispose();this.blur.dispose();this.combine.dispose();this.quad.dispose()}
}
