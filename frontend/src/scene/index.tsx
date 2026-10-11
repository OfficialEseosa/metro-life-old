/* oxlint-disable react/immutability -- Three.js objects and shader uniforms are imperative renderer resources. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as Controls } from 'three-stdlib'
import * as THREE from 'three'
import { useStore } from '../store'
import { atlSites } from './cities/atl'
import { landmarkGeometry } from './landmarks'
import { Fabric } from './fabric'
import { Pins } from './pins'

declare global {
  interface Window { __metroScene?: { focus: (id: string | null) => void; theme: (value: 'day' | 'night') => void; metrics: () => { calls: number; triangles: number; fps: number; p95Ms: number; renderer: string }; hidePins: (hidden: boolean) => void; project: (id: string) => { x: number; y: number }; geometry: () => Record<string, number> } }
}
const noPick = () => {}
const worldTarget = new THREE.Vector3(0, 0, 5)

function Sky({ night }: { night: boolean }) {
  const material = useMemo(() => new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top;uniform vec3 bottom;varying vec3 vPosition;void main(){float h=clamp(normalize(vPosition).y*1.7,0.,1.);gl_FragColor=vec4(mix(bottom,top,pow(h,.65)),1.);}' }), [])
  useEffect(() => {material.uniforms.top.value.set(night ? '#112b43' : '#8eb8c5');material.uniforms.bottom.value.set(night ? '#77958e' : '#e5e5cb')}, [material, night])
  return <mesh material={material} raycast={noPick}><sphereGeometry args={[450, 24, 16]} /></mesh>
}
function Lake({ night }: { night: boolean }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, tint: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float time;uniform vec3 tint;varying vec3 vPosition;void main(){float wave=sin(vPosition.x*10.+vPosition.z*13.+time*.55)*sin(vPosition.z*19.-time*.3);float glint=pow(max(0.,wave),9.)*.18;gl_FragColor=vec4(tint+glint+wave*.025,1.);}' }), [])
  useEffect(() => {mat.uniforms.tint.value.set(night ? '#406b78' : '#537f88')}, [mat, night])
  useFrame(({ clock }) => {mat.uniforms.time.value=clock.elapsedTime})
  return <mesh position={[22, .45, -36]} scale={[7.5, .012, 5.3]} material={mat} raycast={noPick}><sphereGeometry args={[1, 32, 12]} /></mesh>
}
function Architecture() {
  const buildings = useMemo(() => Object.entries(atlSites).map(([id, site]) => ({ id, site, geometry: landmarkGeometry(id) })), [])
  return <group>{buildings.map(({ id, site, geometry }) => <mesh key={id} name={id} position={[site.x, 0, site.z]} rotation={[0, site.angle ?? 0, 0]} geometry={geometry} castShadow receiveShadow raycast={noPick} onUpdate={m => {m.updateMatrix();m.matrixAutoUpdate=false}}><meshStandardMaterial vertexColors roughness={.72} metalness={id === 'benz' ? .3 : .04} /></mesh>)}</group>
}
function City({ onHover }: { onHover: (name: string | null, x?: number, y?: number) => void }) {
  const { camera, gl, invalidate, size, scene, setDpr } = useThree()
  const controls = useRef<Controls>(null)
  const focus = useStore(s => s.focus), theme = useStore(s => s.sceneTheme), hour = useStore(s => s.clock?.hour ?? 11)
  const night = theme === 'night' || theme === 'auto' && (hour < 6 || hour >= 19)
  const destination = useRef<{ eye: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const [pinsHidden, setPinsHidden] = useState(false)
  const timings = useRef<number[]>([]), lastFrame = useRef(0)
  const overview = useCallback(() => {
    const factor = size.width < 600 ? 1.35 : 1
    return { eye: new THREE.Vector3(95 * factor, 108 * factor, 130 * factor), target: worldTarget.clone() }
  }, [size.width])
  const view = useCallback((id: string | null, immediate = false) => {
    const site = id ? atlSites[id] : null
    const distance = site ? Math.max(12, site.size * .95) * 1.3 * Math.max(1, .85 / (size.width / size.height)) : 0
    const next = site ? { target: new THREE.Vector3(site.x, site.height * .5, site.z), eye: new THREE.Vector3(site.x + distance * .7, site.height * .5 + distance * .75, site.z + distance) } : overview()
    if(site){
      // Pick an unobstructed approach, including nearby landmarks and tall instanced filler.
      const obstacles: THREE.Box3[]=[],matrix=new THREE.Matrix4(),instance=new THREE.Matrix4()
      scene.updateMatrixWorld(true)
      scene.traverse(object=>{
        if(!(object instanceof THREE.Mesh)||object.name===id)return
        if(!(object instanceof THREE.InstancedMesh)&&!Object.hasOwn(atlSites,object.name))return
        if(!object.geometry.boundingBox)object.geometry.computeBoundingBox()
        const bounds=object.geometry.boundingBox!
        if(object instanceof THREE.InstancedMesh){for(let i=0;i<object.count;i++){object.getMatrixAt(i,instance);matrix.multiplyMatrices(object.matrixWorld,instance);const box=bounds.clone().applyMatrix4(matrix);if(box.max.y-box.min.y>6)obstacles.push(box)}}
        else obstacles.push(bounds.clone().applyMatrix4(object.matrixWorld))
      })
      let bestScore=Infinity
      for(const angle of [.61,0,-.61,1.2,-1.2,Math.PI/2,-Math.PI/2,Math.PI]){
        const eye=new THREE.Vector3(site.x+Math.sin(angle)*distance*1.22,site.height*.5+distance*.75,site.z+Math.cos(angle)*distance*1.22)
        let score=0
        for(const height of [.35,.75]){const target=new THREE.Vector3(site.x,site.height*height,site.z),ray=new THREE.Ray(eye,target.clone().sub(eye).normalize());for(const box of obstacles){const hit=ray.intersectBox(box,new THREE.Vector3());if(hit&&hit.distanceTo(eye)<eye.distanceTo(target))score++}}
        if(score<bestScore){bestScore=score;next.eye=eye}
      }
    }
    destination.current=null
    if(immediate) {camera.position.copy(next.eye);controls.current?.target.copy(next.target);controls.current?.update();invalidate()} else {destination.current=next;invalidate()}
  }, [camera,invalidate,overview,scene,size.width,size.height])
  useEffect(() => {view(null,true)}, [view])
  useEffect(() => {if(focus){view(focus);useStore.getState().setFocus(null)}}, [focus,view])
  useEffect(() => {gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=true;scene.fog=new THREE.Fog(night?'#6f8c86':'#d8dfc6',140,330);invalidate()}, [gl,scene,night,invalidate])
  useEffect(() => {
    let frame=0
    const tick=()=>{if(!document.hidden)invalidate();frame=requestAnimationFrame(tick)}
    frame=requestAnimationFrame(tick);const wake=()=>{lastFrame.current=0;invalidate()};document.addEventListener('visibilitychange',wake)
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',wake)}
  },[invalidate])
  useFrame((_,dt)=>{
    const time=performance.now();if(lastFrame.current&&time-lastFrame.current<250){timings.current.push(time-lastFrame.current);if(timings.current.length>300)timings.current.shift()}lastFrame.current=time
    if(timings.current.length===300&&gl.getPixelRatio()>1&&timings.current.reduce((a,b)=>a+b,0)/300>23){setDpr(1);timings.current=[]}
    const d=destination.current,c=controls.current
    if(d&&c){const t=1-Math.exp(-dt*7);camera.position.lerp(d.eye,t);c.target.lerp(d.target,t);c.update();if(camera.position.distanceTo(d.eye)<.03)destination.current=null;invalidate()}
  })
  useEffect(()=>{
    if(!import.meta.env.DEV)return
    window.__metroScene={focus:id=>view(id,true),theme:value=>useStore.getState().setSceneTheme(value),hidePins:setPinsHidden,project:id=>{const s=atlSites[id],v=new THREE.Vector3(s.x,s.height+2,s.z).project(camera);return{x:(v.x+1)*size.width/2,y:(1-v.y)*size.height/2}},geometry:()=>Object.fromEntries(Object.keys(atlSites).map(id=>{const m=scene.getObjectByName(id) as THREE.Mesh;return[id,m.geometry.getAttribute('position').count/3]})),metrics:()=>{
      const times=[...timings.current].sort((a,b)=>a-b),context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info')
      return{calls:gl.info.render.calls,triangles:gl.info.render.triangles,fps:times.length?1000/(times.reduce((a,b)=>a+b,0)/times.length):0,p95Ms:times[Math.floor(times.length*.95)]??0,renderer:debug?context.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unknown'}
    }}
    return()=>{delete window.__metroScene}
  },[camera,gl,scene,size.width,size.height,view])
  return <>
    <Sky night={night}/><hemisphereLight args={[night?'#9fb9cd':'#f4f0d6',night?'#567968':'#879872',night?1.3:2.1]}/>
    <directionalLight position={[-55,90,45]} intensity={night?.8:2.5} color={night?'#b0c6db':'#fff0cf'} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-100} shadow-camera-right={100} shadow-camera-top={100} shadow-camera-bottom={-100} shadow-camera-near={1} shadow-camera-far={230} shadow-bias={-.0003} shadow-normalBias={.12}/>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow raycast={noPick}><planeGeometry args={[1000,1000]}/><meshStandardMaterial color={night?'#6c8a72':'#9eaf80'} roughness={1}/></mesh>
    <Fabric night={night}/><Architecture/><Lake night={night}/>{!pinsHidden&&<Pins onHover={onHover}/>}
    <OrbitControls ref={controls} makeDefault target={worldTarget} minDistance={9} maxDistance={310} maxPolarAngle={1.25} minPolarAngle={.35} enableDamping dampingFactor={.12} screenSpacePanning={false} zoomSpeed={.7} onChange={()=>{const c=controls.current;if(c){c.target.x=THREE.MathUtils.clamp(c.target.x,-75,75);c.target.z=THREE.MathUtils.clamp(c.target.z,-85,90)}invalidate()}}/>
  </>
}
export default function CityScene() {
  const [hover,setHover]=useState<{name:string;x:number;y:number}|null>(null)
  return <div className="city-canvas"><Canvas frameloop="demand" shadows="soft" dpr={[1,1.5]} camera={{position:[95,108,130],fov:40,near:.1,far:600}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} onCreated={({raycaster})=>{raycaster.params.Points.threshold=1.5}}><City onHover={(name,x=0,y=0)=>setHover(name?{name,x,y}:null)}/></Canvas>{hover&&<div className="map-tooltip" style={{left:Math.min(hover.x+14,innerWidth-220),top:Math.max(70,hover.y-40)}}>{hover.name}</div>}</div>
}
