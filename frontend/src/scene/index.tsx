/* oxlint-disable react/immutability -- Three.js objects and shader uniforms are imperative renderer resources. */
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as Controls } from 'three-stdlib'
import * as THREE from 'three'
import { useStore } from '../store'
import { sitesFor,homeSite } from './cities'
import type { CityId } from '../api/types'
import { landmarkGeometry } from './landmarks'
import { nycGeometry, bayGeometry } from './metropolitan-models'
import { MetropolitanFabric } from './metropolitan-fabric'
import { Fabric } from './fabric'
import { BlenderLandmark, KitInstances } from './kit-models'
import { blenderHeroes } from './hero-ids'
import { useNightLighting } from '../lighting'
import { Pins } from './pins'

declare global {
  interface Window { __metroScene?: { status:()=>{kits:{count:number;visible:boolean;parentVisible:boolean}[];terrain:{visible:boolean;color:string;emissive:string}|null;frameloop:string;frame:number}; refreshShadows:()=>void; focus: (id: string | null) => void; theme: (value: 'day' | 'night') => void; metrics: () => { calls: number; triangles: number; fps: number; p95Ms: number; renderer: string }; hidePins: (hidden: boolean) => void; project: (id: string) => { x: number; y: number }; geometry: () => Record<string, number> } }
}
const noPick = () => {}
const worldTarget = new THREE.Vector3(0, 0, 5)
// Own the ambient clock outside asset Suspense so loading never depends on input.
function AmbientTicker(){
  const invalidate=useThree(s=>s.invalidate),setFrameloop=useThree(s=>s.setFrameloop)
  useLayoutEffect(()=>{
    let frame=0
    const tick=()=>{if(document.hidden)return;invalidate();frame=requestAnimationFrame(tick)}
    const visibility=()=>{cancelAnimationFrame(frame);setFrameloop(document.hidden?'never':'demand');if(!document.hidden)tick()}
    visibility();document.addEventListener('visibilitychange',visibility)
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility)}
  },[invalidate,setFrameloop])
  return null
}
function Terrain({night}:{night:boolean}){const geometry=useMemo(()=>{const g=new THREE.PlaneGeometry(1200,1200,64,64),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i),r=Math.hypot(x,z),rise=THREE.MathUtils.smoothstep(r,100,210)*(Math.sin(x*.022)*Math.cos(z*.019)*7+8);p.setZ(i,rise)}g.computeVertexNormals();return g},[]);return <mesh name="terrain" geometry={geometry} rotation={[-Math.PI/2,0,0]} receiveShadow raycast={noPick}><meshStandardMaterial color={night?'#598065':'#8ebd75'} emissive={night?'#365238':'#000000'} emissiveIntensity={night?.18:0} roughness={1}/></mesh>}

function Sky({ night }: { night: boolean }) {
  const ref=useRef<THREE.Mesh>(null)
  const material = useMemo(() => new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top;uniform vec3 bottom;varying vec3 vPosition;void main(){vec3 dir=normalize(vPosition);float h=clamp(dir.y*1.7,0.,1.);vec3 col=mix(bottom,top,pow(h,.65));vec2 cell=floor(dir.xz/(abs(dir.y)+.3)*350.);float star=step(.9988,fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453))*smoothstep(.12,.3,h)*(1.-step(.08,top.r));gl_FragColor=vec4(col+star*.65,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }), [])
  useEffect(() => {material.uniforms.top.value.set(night ? '#061428' : '#83b6d3');material.uniforms.bottom.value.set(night ? '#223752' : '#d7e0dd')}, [material, night])
  useFrame(({camera})=>{ref.current?.position.copy(camera.position)})
  return <mesh ref={ref} renderOrder={-1000} material={material} raycast={noPick} frustumCulled={false}><sphereGeometry args={[450, 24, 16]} /></mesh>
}
function Lake({ night,city }: { night: boolean;city:CityId }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, tint: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vPosition;void main(){vPosition=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float time;uniform vec3 tint;varying vec3 vPosition;void main(){float wave=sin(vPosition.x*.4+vPosition.z*.55+time*.55)*sin(vPosition.z*.65-time*.3);float glint=pow(max(0.,wave),9.)*.035;gl_FragColor=vec4(tint+glint+wave*.008,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }), [])
  useEffect(() => {mat.uniforms.tint.value.set(night ? '#183744' : '#6098ad')}, [mat, night])
  useFrame(({ clock }) => {mat.uniforms.time.value=clock.elapsedTime})
  return city==='atl'?null:<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.3,0]} material={mat} raycast={noPick}><planeGeometry args={[1600,1600]}/></mesh>
}
function Architecture({city}:{city:CityId}) {
  const buildings = useMemo(() => Object.entries(sitesFor(city)).filter(([id])=>!blenderHeroes.has(id)).map(([id, site]) => ({ id, site, geometry: city==='atl'?landmarkGeometry(id):city==='nyc'?nycGeometry(id):bayGeometry(id) })), [city])
  return <group>{Object.entries(sitesFor(city)).filter(([id])=>blenderHeroes.has(id)).map(([id,s])=><Suspense key={id} fallback={null}><BlenderLandmark id={id} x={s.x} z={s.z} angle={s.angle}/></Suspense>)}{buildings.map(({ id, site, geometry }) => <mesh key={id} name={id} position={[site.x, 0, site.z]} rotation={[0, site.angle ?? 0, 0]} geometry={geometry} castShadow receiveShadow raycast={noPick} onUpdate={m => {m.updateMatrix();m.matrixAutoUpdate=false}}><meshStandardMaterial vertexColors roughness={.72} metalness={.04} /></mesh>)}</group>
}
function Home({city}:{city:CityId}){const home=useStore(s=>s.sim?.home),site=homeSite(city,home),x=site?.x,z=site?.z,placements=useMemo(()=>x!==undefined&&z!==undefined?[{x,y:0,z,sx:3.4,sy:3,sz:3,angle:0,color:'#ffffff'}]:[],[x,z]);return site?<Suspense fallback={null}><group name="home"><KitInstances url="/models/world/suburban/building-type-a.glb" placements={placements}/></group></Suspense>:null}
function City({ onHover }: { onHover: (name: string | null, x?: number, y?: number) => void }) {
  const { camera, gl, invalidate, size, scene, setDpr, frameloop } = useThree()
  const controls = useRef<Controls>(null)
  const city=useStore(s=>s.city),homeCity=useStore(s=>s.sim?.home.city),homeNeighborhood=useStore(s=>s.sim?.home.neighborhood),home=useMemo(()=>homeCity&&homeNeighborhood?{city:homeCity,neighborhood:homeNeighborhood,rent:0}:undefined,[homeCity,homeNeighborhood]),atlSites=sitesFor(city)
  const playing=useStore(s=>!!s.sim)
  const focus = useStore(s => s.focus), night = useNightLighting()
  const destination = useRef<{ eye: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const [pinsHidden, setPinsHidden] = useState(false)
  const timings = useRef<number[]>([]), lastFrame = useRef(0)
  useEffect(()=>{const perspective=camera as THREE.PerspectiveCamera;perspective.setViewOffset(size.width,size.height,0,size.width<600?size.height*(playing?-.05:.12):0,size.width,size.height);perspective.updateProjectionMatrix()},[camera,size.width,size.height,playing])
  const overview = useCallback(() => {
    const preview=(camera as THREE.PerspectiveCamera).clone(),target=worldTarget.clone();let factor=1
    for(let attempt=0;attempt<30;attempt++){
      preview.position.set(95*factor,108*factor,130*factor);preview.lookAt(target);preview.updateMatrixWorld(true)
      const fits=Object.values(atlSites).every(s=>[-1,1].every(x=>[-1,1].every(z=>{const p=new THREE.Vector3(s.x+x*s.size*.5,s.height,s.z+z*s.size*.5).project(preview);return Math.abs(p.x)<.88&&Math.abs(p.y)<.77})))
      if(fits)break;factor*=1.06
    }
    return {eye:preview.position.clone(),target}
  }, [camera,atlSites])
  const view = useCallback((id: string | null, immediate = false, welcome = false) => {
    const site = id==='home'?homeSite(city,home):id ? atlSites[id] : null
    const distance = site ? Math.max(12, site.size * .95, site.height*1.1) * 1.3 * Math.max(1, .85 / (size.width / size.height)) : 0
    const next = site ? { target: new THREE.Vector3(site.x, site.height * .5, site.z), eye: new THREE.Vector3(site.x + distance * .7, site.height * .5 + distance * .75, site.z + distance) } : overview()
    // A first phone view favours readable neighbourhoods; the overview button still fits every stop.
    if(!site&&welcome&&playing&&size.width<600)next.eye.lerp(next.target,.3)
    if(site){
      // Pick an unobstructed approach, including nearby landmarks and tall instanced filler.
      const obstacles: THREE.Box3[]=[],matrix=new THREE.Matrix4(),instance=new THREE.Matrix4()
      scene.updateMatrixWorld(true)
      scene.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return
        let owner:THREE.Object3D|null=object
        while(owner&&!Object.hasOwn(atlSites,owner.name))owner=owner.parent
        if(owner?.name===id)return
        if(!(object instanceof THREE.InstancedMesh)&&!owner)return
        if(!object.geometry.boundingBox)object.geometry.computeBoundingBox()
        const bounds=object.geometry.boundingBox!
        if(object instanceof THREE.InstancedMesh){for(let i=0;i<object.count;i++){object.getMatrixAt(i,instance);matrix.multiplyMatrices(object.matrixWorld,instance);const box=bounds.clone().applyMatrix4(matrix);if(box.max.y-box.min.y>6)obstacles.push(box)}}
        else obstacles.push(bounds.clone().applyMatrix4(object.matrixWorld))
      })
      let bestScore=Infinity
      const angles=id==='arena'?[0,-.61,.61]:id==='benz'?[-Math.PI/2,-1.2,-.61,.61,0,1.2,Math.PI/2,Math.PI]:id==='piedmont'?[Math.PI/2,1.2,.61,0,-.61,-1.2,-Math.PI/2,Math.PI]:[.61,0,-.61,1.2,-1.2,Math.PI/2,-Math.PI/2,Math.PI]
      for(const angle of angles){
        const eye=new THREE.Vector3(site.x+Math.sin(angle)*distance*1.22,site.height*.5+distance*.75,site.z+Math.cos(angle)*distance*1.22)
        let score=0
        for(const [dx,dz] of [[0,0],[-.23,-.23],[.23,-.23],[-.23,.23],[.23,.23]])for(const height of [.2,.65]){const target=new THREE.Vector3(site.x+dx*site.size,site.height*height,site.z+dz*site.size),ray=new THREE.Ray(eye,target.clone().sub(eye).normalize());for(const box of obstacles){const hit=ray.intersectBox(box,new THREE.Vector3());if(hit&&hit.distanceTo(eye)<eye.distanceTo(target))score++}}
        if(score<bestScore){bestScore=score;next.eye=eye}
      }
    }
    destination.current=null
    if(immediate) {camera.position.copy(next.eye);controls.current?.target.copy(next.target);controls.current?.update();invalidate()} else {destination.current=next;invalidate()}
  }, [camera,invalidate,overview,scene,size.width,size.height,atlSites,city,home,playing])
  useEffect(() => {view(null,true,true)}, [view])
  useEffect(() => {if(focus){view(focus);useStore.getState().setFocus(null)}}, [focus,view])
  useEffect(() => {gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=true;scene.fog=new THREE.Fog(night?'#223752':'#d7e0dd',500,1100);invalidate()}, [gl,scene,night,city,invalidate])
  useEffect(() => {const wake=()=>{lastFrame.current=0;invalidate()};document.addEventListener('visibilitychange',wake);return()=>document.removeEventListener('visibilitychange',wake)},[invalidate])
  useFrame((_,dt)=>{
    const time=performance.now();if(lastFrame.current&&time-lastFrame.current<250){timings.current.push(time-lastFrame.current);if(timings.current.length>300)timings.current.shift()}lastFrame.current=time
    if(timings.current.length===300&&gl.getPixelRatio()>1&&timings.current.reduce((a,b)=>a+b,0)/300>18.5){setDpr(1);timings.current=[]}
    const d=destination.current,c=controls.current
    if(d&&c){const t=1-Math.exp(-dt*7);camera.position.lerp(d.eye,t);c.target.lerp(d.target,t);c.update();if(camera.position.distanceTo(d.eye)<.03)destination.current=null;invalidate()}
  })
  useEffect(()=>{
    if(!import.meta.env.DEV)return
    window.__metroScene={status:()=>{const kits:{count:number;visible:boolean;parentVisible:boolean}[]=[];scene.traverse(o=>{if(o instanceof THREE.InstancedMesh)kits.push({count:o.count,visible:o.visible,parentVisible:o.parent?.visible??true})});const ground=scene.getObjectByName('terrain') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>|undefined;return{kits,terrain:ground?{visible:ground.visible,color:ground.material.color.getHexString(),emissive:ground.material.emissive.getHexString()}:null,frameloop,frame:gl.info.render.frame}},refreshShadows:()=>{gl.shadowMap.needsUpdate=true;invalidate()},focus:id=>view(id,true),theme:value=>useStore.getState().setSceneTheme(value),hidePins:setPinsHidden,project:id=>{const s=atlSites[id],v=new THREE.Vector3(s.x,s.height+2,s.z).project(camera);return{x:(v.x+1)*size.width/2,y:(1-v.y)*size.height/2}},geometry:()=>Object.fromEntries(Object.keys(atlSites).map(id=>{const m=scene.getObjectByName(id);let count=0;m?.traverse(o=>{if(o instanceof THREE.Mesh)count+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3});return[id,count]})),metrics:()=>{
      const times=[...timings.current].sort((a,b)=>a-b),context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info')
      return{calls:gl.info.render.calls,triangles:gl.info.render.triangles,fps:times.length?1000/(times.reduce((a,b)=>a+b,0)/times.length):0,p95Ms:times[Math.floor(times.length*.95)]??0,renderer:debug?context.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unknown'}
    }}
    return()=>{delete window.__metroScene}
  },[camera,gl,scene,size.width,size.height,view,invalidate,atlSites,frameloop])
  return <>
    <Sky night={night}/><hemisphereLight args={[night?'#9bb0d1':'#d6e6ef',night?'#3a4d63':'#afc8dc',1.7]}/>
    <directionalLight position={[-55,90,45]} intensity={night?.65:2.1} color={night?'#8aa7df':'#ffffff'} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-100} shadow-camera-right={100} shadow-camera-top={100} shadow-camera-bottom={-100} shadow-camera-near={1} shadow-camera-far={230} shadow-bias={-.0003} shadow-normalBias={.12}/>
    {city==='atl'?<><mesh name="ground" position={[0,-.05,0]} rotation={[-Math.PI/2,0,0]} receiveShadow raycast={noPick}><planeGeometry args={[2000,2000]}/><meshStandardMaterial color={night?'#598065':'#8ebd75'} emissive={night?'#365238':'#000000'} emissiveIntensity={night?.18:0} roughness={1}/></mesh><Terrain night={night}/><Fabric night={night}/></>:<MetropolitanFabric city={city} night={night}/>}
    <Architecture key={`architecture-${city}`} city={city}/><Home city={city}/><Lake night={night} city={city}/>{!pinsHidden&&<Pins key={`pins-${city}`} onHover={onHover}/>}
    <OrbitControls ref={controls} makeDefault target={worldTarget} minDistance={9} maxDistance={1200} maxPolarAngle={1.25} minPolarAngle={.35} enableRotate={false} enableDamping={false} mouseButtons={{LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN}} touches={{ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN}} screenSpacePanning={false} zoomSpeed={.7} onStart={()=>{destination.current=null}} onChange={()=>{const c=controls.current;if(c){c.target.x=THREE.MathUtils.clamp(c.target.x,-105,125);c.target.z=THREE.MathUtils.clamp(c.target.z,-120,145)}invalidate()}}/>
  </>
}
export default function CityScene() {
  const [hover,setHover]=useState<{name:string;x:number;y:number}|null>(null)
  return <div className="city-canvas"><Canvas frameloop="demand" shadows="soft" dpr={[1,1.25]} camera={{position:[95,108,130],fov:40,near:.1,far:2000}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} onCreated={({raycaster})=>{raycaster.params.Points.threshold=1.5}}><AmbientTicker/><Suspense fallback={null}><City onHover={(name,x=0,y=0)=>setHover(name?{name,x,y}:null)}/></Suspense></Canvas>{hover&&<div className="map-tooltip" style={{left:Math.min(hover.x+14,innerWidth-220),top:Math.max(70,hover.y-40)}}>{hover.name}</div>}</div>
}
