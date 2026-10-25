import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js";
import { timeOfDay } from "../lighting";

const vertexShader =
  "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";
const sample = "uniform sampler2D source;varying vec2 vUv;";

/**
 * One quarter-size blur instead of a five-level pyramid, plus the colour grade.
 * Threshold and strength follow the clock: by day only sun glints bloom, after
 * dusk lit windows and lamps get a small halo.
 */
export class GentleBloom extends Pass {
  private a = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
  private b = this.a.clone();
  private extract = new THREE.ShaderMaterial({
    vertexShader,
    uniforms: { source: { value: null }, threshold: { value: 1.6 } },
    fragmentShader:
      sample +
      "uniform float threshold;void main(){vec3 c=texture2D(source,vUv).rgb;float peak=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*clamp((peak-threshold)/max(peak,.001),0.,1.),1.);}",
  });
  private blur = new THREE.ShaderMaterial({
    vertexShader,
    uniforms: {
      source: { value: null },
      stepSize: { value: new THREE.Vector2() },
    },
    fragmentShader:
      sample +
      "uniform vec2 stepSize;void main(){vec3 c=texture2D(source,vUv).rgb*.227027;c+=(texture2D(source,vUv+stepSize*1.384615).rgb+texture2D(source,vUv-stepSize*1.384615).rgb)*.316216;c+=(texture2D(source,vUv+stepSize*3.230769).rgb+texture2D(source,vUv-stepSize*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}",
  });
  private combine = new THREE.ShaderMaterial({
    vertexShader,
    uniforms: {
      source: { value: null },
      bloom: { value: null },
      strength: { value: 0.1 },
      saturation: { value: 1.1 },
      contrast: { value: 1.06 },
      vignette: { value: 0.05 },
      shadowTint: { value: new THREE.Color("#5a4a8a") },
      highlightTint: { value: new THREE.Color("#ffd9a0") },
    },
    fragmentShader:
      sample +
      `uniform sampler2D bloom;uniform float strength;uniform float saturation;uniform float contrast;uniform float vignette;uniform vec3 shadowTint;uniform vec3 highlightTint;
      void main(){
        vec4 c=texture2D(source,vUv);
        c.rgb+=texture2D(bloom,vUv).rgb*strength;
        float l=dot(c.rgb,vec3(.2126,.7152,.0722));
        c.rgb=mix(vec3(l),c.rgb,saturation);
        c.rgb=max(vec3(0.),(c.rgb-vec3(.18))*contrast+vec3(.18));
        l=dot(c.rgb,vec3(.2126,.7152,.0722));
        c.rgb+=shadowTint*(1.-smoothstep(0.,.35,l))*.035+highlightTint*smoothstep(.55,1.,l)*.03;
        vec2 edge=(vUv-.5)*2.;
        c.rgb*=1.-vignette*smoothstep(.3,1.3,dot(edge,edge));
        gl_FragColor=c;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  private quad = new FullScreenQuad(this.extract);
  constructor() {
    super();
  }
  setSize(width: number, height: number) {
    const w = Math.max(1, Math.round(width / 4)),
      h = Math.max(1, Math.round(height / 4));
    this.a.setSize(w, h);
    this.b.setSize(w, h);
  }
  render(
    renderer: THREE.WebGLRenderer,
    write: THREE.WebGLRenderTarget,
    read: THREE.WebGLRenderTarget,
  ) {
    const draw = (
      material: THREE.ShaderMaterial,
      target: THREE.WebGLRenderTarget | null,
    ) => {
      this.quad.material = material;
      renderer.setRenderTarget(target);
      this.quad.render(renderer);
    };
    const p = timeOfDay,
      dusk = p.lights,
      u = this.combine.uniforms;
    this.extract.uniforms.threshold.value = 1.6 + (1.05 - 1.6) * dusk;
    u.strength.value = 0.1 + (0.22 - 0.1) * dusk;
    u.saturation.value = p.saturation;
    u.vignette.value = p.vignette;
    (u.shadowTint.value as THREE.Color).copy(p.shadowTint);
    (u.highlightTint.value as THREE.Color).copy(p.highlightTint);
    this.extract.uniforms.source.value = read.texture;
    draw(this.extract, this.a);
    this.blur.uniforms.source.value = this.a.texture;
    this.blur.uniforms.stepSize.value.set(1 / this.a.width, 0);
    draw(this.blur, this.b);
    this.blur.uniforms.source.value = this.b.texture;
    this.blur.uniforms.stepSize.value.set(0, 1 / this.a.height);
    draw(this.blur, this.a);
    u.source.value = read.texture;
    u.bloom.value = this.a.texture;
    draw(this.combine, this.renderToScreen ? null : write);
  }
  dispose() {
    this.a.dispose();
    this.b.dispose();
    this.extract.dispose();
    this.blur.dispose();
    this.combine.dispose();
    this.quad.dispose();
  }
}
