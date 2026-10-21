import { ImageQuality } from './image-quality'
import { RoomLighting } from './room-lighting'
import { PoseStudio } from './pose-studio'
import type { CharacterPose } from './character'
import { HelpWanted } from './help-wanted'
import { Traffic } from './traffic'
import { ScaleRuler } from './scale-ruler'
import { metricPlacement } from './world-scale'
import { Interior } from './interior'
import { Walkways } from './walkways'
/* oxlint-disable react/immutability -- Three.js objects and shader uniforms are imperative renderer resources. */
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useProgress } from '@react-three/drei'
import type { OrbitControls as Controls } from 'three-stdlib'
import * as THREE from 'three'
import { useStore } from '../store'
import { sitesFor,homeSite } from './cities'
import type { CityId } from '../api/types'
import { landmarkGeometry } from './landmarks'
import { nycGeometry, bayGeometry } from './metropolitan-models'
import { MetropolitanFabric } from './metropolitan-fabric'
import { Fabric } from './fabric'
import { AtlantaSkyline, BlenderLandmark, KitInstances } from './kit-models'
import { blenderHeroes } from './hero-ids'
import { useNightLighting } from '../lighting'
import { CameraOcclusion } from './camera-occlusion'
import { Pins } from './pins'
import { WorldActivity, PlayerMarker } from './activity'
import { Residents } from './residents'
import { Walking } from './walking'
import { motion } from '../walking'
import { EconomyScene } from './economy'
import { plotSite, boardSites } from './economy-sites'

declare global {
  interface Window { __metroScene?: { effects:(enabled:boolean)=>void; occlusionDemo:(enabled:boolean)=>void; status:()=>{kits:{count:number;visible:boolean;parentVisible:boolean;bakedContact:boolean;windowVertices:number;bakeMs:number}[];terrain:{visible:boolean;color:string;emissive:string}|null;frameloop:string;frame:number}; tilt:(angle:number)=>void; flight:(id:string|null)=>void; resetMetrics:()=>void; refreshShadows:()=>void; focus: (id: string | null) => void; theme: (value: 'day' | 'night') => void; metrics: () => { calls: number; triangles: number; fps: number; p95Ms: number; renderer: string; dpr:number }; hidePins: (hidden: boolean) => void; project: (id: string) => { x: number; y: number }; geometry: () => Record<string, number> } }
}
const noPick = () => {}
const worldTarget = new THREE.Vector3(0, 0, 5)
// Own the ambient clock outside asset Suspense so loading never depends on input.
function AmbientTicker(){
 const invalidate=useThree(s=>s.invalidate),setFrameloop=useThree(s=>s.setFrameloop)
 useLayoutEffect(()=>{const visibility=()=>{setFrameloop(document.hidden?'never':'demand');if(!document.hidden)invalidate()};visibility();document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility)},[invalidate,setFrameloop])
 useEffect(()=>{let timer:ReturnType<typeof setInterval>|undefined;const update=()=>{if(timer)clearInterval(timer);timer=undefined;if(useProgress.getState().active)timer=setInterval(()=>{if(!document.hidden)invalidate()},100)};const off=useProgress.subscribe(update);update();return()=>{off();if(timer)clearInterval(timer)}},[invalidate])
 return null
}
function Terrain({night}:{night:boolean}){const geometry=useMemo(()=>{const g=new THREE.PlaneGeometry(1200,1200,64,64),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i),r=Math.hypot(x,z),rise=THREE.MathUtils.smoothstep(r,100,210)*(Math.sin(x*.022)*Math.cos(z*.019)*7+8);p.setZ(i,rise)}g.computeVertexNormals();return g},[]);useEffect(()=>()=>geometry.dispose(),[geometry]);return <mesh name="terrain" geometry={geometry} rotation={[-Math.PI/2,0,0]} receiveShadow raycast={noPick}><meshStandardMaterial color={night?'#343b39':'#8ebd75'} emissive={night?'#586c83':'#000000'} emissiveIntensity={night?.24:0} roughness={1}/></mesh>}

function Sky({ night,room }: { night: boolean;room?:boolean }) {
  const ref=useRef<THREE.Mesh>(null)
  const material = useMemo(() => new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top;uniform vec3 bottom;varying vec3 vPosition;void main(){vec3 dir=normalize(vPosition);float h=clamp(dir.y*1.7,0.,1.);vec3 col=mix(bottom,top,pow(h,.65));vec2 cell=floor(dir.xz/(abs(dir.y)+.3)*350.);float star=step(.9988,fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453))*smoothstep(.12,.3,h)*(1.-step(.08,top.r));gl_FragColor=vec4(col+star*.65,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }), [])
  useEffect(() => {material.uniforms.top.value.set(room?(night?'#78697b':'#e4d5b8'):night?'#1d274b':'#8fc3e2');material.uniforms.bottom.value.set(room?(night?'#91818d':'#eee5dd'):night?'#70677e':'#f1dfc4')}, [material, night,room])
  useFrame(({camera})=>{ref.current?.position.copy(camera.position)})
  return <mesh ref={ref} renderOrder={-1000} material={material} raycast={noPick} frustumCulled={false}><sphereGeometry args={[450, 24, 16]} /></mesh>
}
function Lake({ night,city }: { night: boolean;city:CityId }) {
  const invalidate=useThree(s=>s.invalidate)
  useEffect(()=>{if(city==='atl')return;const motion=matchMedia('(prefers-reduced-motion: reduce)');const timer=setInterval(()=>{if(!document.hidden&&!motion.matches)invalidate()},1000/30);return()=>clearInterval(timer)},[city,invalidate])
  const mat = useMemo(() => new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, tint: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vPosition;void main(){vPosition=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float time;uniform vec3 tint;varying vec3 vPosition;void main(){float wave=sin(vPosition.x*.045+vPosition.z*.025+time*.12)*.55+sin(vPosition.z*.068-time*.09)*.25+sin((vPosition.x+vPosition.z)*.019+time*.06)*.2;wave*=1.-smoothstep(.05,.35,length(fwidth(vPosition.xz))*.07);float glint=pow(max(0.,wave),4.)*.012;gl_FragColor=vec4(tint+glint+wave*.008,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }), [])
  useEffect(() => {mat.uniforms.tint.value.set(night ? '#183744' : '#6098ad')}, [mat, night])
  useFrame(({ clock }) => {mat.uniforms.time.value=clock.elapsedTime})
  return city==='atl'?null:<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.3,0]} material={mat} raycast={noPick}><planeGeometry args={[1600,1600]}/></mesh>
}
function Architecture({city}:{city:CityId}) {
  const buildings = useMemo(() => Object.entries(sitesFor(city)).filter(([id])=>!blenderHeroes.has(id)).map(([id, site]) => ({ id, site, geometry: city==='atl'?landmarkGeometry(id):city==='nyc'?nycGeometry(id):bayGeometry(id) })), [city])
  useEffect(()=>()=>buildings.forEach(b=>b.geometry.dispose()),[buildings])
  return <group>{city==='atl'&&<Suspense fallback={null}><AtlantaSkyline/></Suspense>}{Object.entries(sitesFor(city)).filter(([id])=>blenderHeroes.has(id)).map(([id,s])=><Suspense key={id} fallback={null}><BlenderLandmark id={id} x={s.x} z={s.z} angle={s.angle}/></Suspense>)}{buildings.map(({ id, site, geometry }) => <mesh key={id} name={id} position={[site.x, 0, site.z]} rotation={[0, site.angle ?? 0, 0]} geometry={geometry} castShadow receiveShadow raycast={noPick} onUpdate={m => {m.userData.cameraOccluder=true;m.updateMatrix();m.matrixAutoUpdate=false}}><meshStandardMaterial vertexColors roughness={.72} metalness={.04} /></mesh>)}</group>
}
function Home({city}:{city:CityId}){const home=useStore(s=>s.sim?.home),night=useNightLighting(),site=homeSite(city,home),x=site?.x,z=site?.z,placements=useMemo(()=>x!==undefined&&z!==undefined?[metricPlacement('kaykit/building_B_withoutBase.gltf',{x,y:0,z,sx:1,sy:1,sz:1,angle:0,color:'#ffffff'})]:[],[x,z]);return site?<Suspense fallback={null}><group name="home"><KitInstances url="/models/kaykit/building_B_withoutBase.gltf" placements={placements} night={night}/></group></Suspense>:null}
function City({ onHover }: { onHover: (name: string | null, x?: number, y?: number) => void }) {
  const { camera, gl, invalidate, size, scene, frameloop } = useThree()
  const controls = useRef<Controls>(null)
  const city=useStore(s=>s.city),homeCity=useStore(s=>s.sim?.home.city),homeNeighborhood=useStore(s=>s.sim?.home.neighborhood),home=useMemo(()=>homeCity&&homeNeighborhood?{city:homeCity,neighborhood:homeNeighborhood,rent:0}:undefined,[homeCity,homeNeighborhood]),atlSites=sitesFor(city)
  const room=useStore(s=>s.sim?.city===s.city?s.sim.position?.room:null)
  const playing=useStore(s=>!!s.sim),insets=useStore(s=>s.hudInsets),panel=useStore(s=>s.panel),beat=useStore(s=>!!s.sim?.pendingBeat)
  const focus = useStore(s => s.focus), night = useNightLighting()
  const destination = useRef<{ eye: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const [pinsHidden, setPinsHidden] = useState(false)
  const timings = useRef<number[]>([]), lastFrame = useRef(0)
  useEffect(()=>{const perspective=camera as THREE.PerspectiveCamera;perspective.setViewOffset(size.width,size.height,(insets.right-insets.left)/2,(insets.bottom-insets.top)/2,size.width,size.height);perspective.updateProjectionMatrix();invalidate()},[camera,size.width,size.height,insets,invalidate])
  const overview = useCallback(() => {
    const preview=(camera as THREE.PerspectiveCamera).clone(),target=worldTarget.clone();let factor=1
    for(let attempt=0;attempt<30;attempt++){
      preview.position.set(95*factor,108*factor,130*factor);preview.lookAt(target);preview.updateMatrixWorld(true)
      const fits=Object.values(atlSites).every(s=>[-1,1].every(x=>[-1,1].every(z=>{const p=new THREE.Vector3(s.x+x*s.size*.5,s.height,s.z+z*s.size*.5).project(preview);const screenX=(p.x+1)*size.width/2,screenY=(1-p.y)*size.height/2;return screenX>insets.left+12&&screenX<size.width-insets.right-12&&screenY>Math.min(insets.top+8,size.height*.25)&&screenY<size.height-Math.min(insets.bottom+8,size.height*.7)})))
      if(fits)break;factor*=1.06
    }
    return {eye:preview.position.clone(),target}
  }, [camera,atlSites,insets,size.width,size.height])
  const view = useCallback((id: string | null, immediate = false, welcome = false) => {
    motion.follow=false
    const site = id==='home'||id==='homes'?homeSite(city,home):id==='plots'?plotSite(city):id?.startsWith('billboard-')?boardSites(city,city==='atl'?20:city==='nyc'?24:22)[Number(id.split('-')[1])-1]:id ? atlSites[id] : null
    const distance = site ? Math.max(22, site.size * 1.18, site.height*1.1) * 1.3 * Math.max(1, .85 / (Math.max(120,size.width-insets.left-insets.right) / Math.max(160,size.height-insets.top-insets.bottom))) * size.height/Math.max(size.height*.35,size.height-insets.top-insets.bottom) : 0
    const next = site ? { target: new THREE.Vector3(site.x, site.height * .5, site.z), eye: new THREE.Vector3(site.x + distance * .7, site.height * .5 + distance * .75, site.z + distance) } : overview()
    // A first phone view favours readable neighbourhoods; the overview button still fits every stop.
    if(!site&&welcome&&playing&&size.width<600)next.eye.lerp(next.target,.3)
    if(site){
      // Pick an unobstructed approach, including nearby landmarks and tall instanced filler.
      const obstacles: THREE.Box3[]=[],matrix=new THREE.Matrix4(),instance=new THREE.Matrix4()
      scene.updateMatrixWorld(true)
      scene.traverse(object=>{
        if(!(object instanceof THREE.Mesh)||object.name==='billboards'||object.name==='billboard-frames')return
        let owner:THREE.Object3D|null=object
        while(owner&&!Object.hasOwn(atlSites,owner.name)&&!owner.userData.cameraOccluder)owner=owner.parent
        if(owner?.name===id)return
        if(!(object instanceof THREE.InstancedMesh)&&!owner)return
        if(!object.geometry.boundingBox)object.geometry.computeBoundingBox()
        const bounds=object.geometry.boundingBox!
        if(object instanceof THREE.InstancedMesh){for(let i=0;i<object.count;i++){object.getMatrixAt(i,instance);matrix.multiplyMatrices(object.matrixWorld,instance);const box=bounds.clone().applyMatrix4(matrix);if(box.max.y-box.min.y>6)obstacles.push(box)}}
        else obstacles.push(bounds.clone().applyMatrix4(object.matrixWorld))
      })
      let bestScore=Infinity
      const angles=id?.startsWith('billboard-')?[0,-.61,.61]:['arena','grandCentral','met','ferryBuilding','paintedLadies','sfCityHall','apollo','broadway','williamsburgVenue','chinatown','sfChinatown','fifthAve','cityHall','dumbo','fillmore','oaklandFox','missionEats','wallStreet'].includes(id??'')?[0,-.61,.61]:id==='benz'?[-Math.PI/2,-1.2,-.61,.61,0,1.2,Math.PI/2,Math.PI]:id==='piedmont'?[Math.PI/2,1.2,.61,0,-.61,-1.2,-Math.PI/2,Math.PI]:[.61,0,-.61,1.2,-1.2,Math.PI/2,-Math.PI/2,Math.PI]
      for(const angle of angles)for(const elevation of [.75,1.05,1.4]){
        const eye=new THREE.Vector3(site.x+Math.sin(angle)*distance*1.22,site.height*.5+distance*elevation,site.z+Math.cos(angle)*distance*1.22)
        let score=0
        for(const [dx,dz] of [[0,0],[-.42,-.42],[.42,-.42],[-.42,.42],[.42,.42]])for(const height of [.2,.65,1]){const target=new THREE.Vector3(site.x+dx*site.size,site.height*height,site.z+dz*site.size),ray=new THREE.Ray(eye,target.clone().sub(eye).normalize());for(const box of obstacles){const hit=ray.intersectBox(box,new THREE.Vector3());if(hit&&hit.distanceTo(eye)<eye.distanceTo(target))score++}}
        score+=elevation*.01
        if(score<bestScore){bestScore=score;next.eye=eye}
      }
    }
    // A new flight starts a fresh frame interval; the previous interval may be idle.
    destination.current=null;lastFrame.current=0
    if(immediate||matchMedia('(prefers-reduced-motion: reduce)').matches) {camera.position.copy(next.eye);controls.current?.target.copy(next.target);controls.current?.update();useStore.getState().setCameraMoving(false);invalidate()} else {destination.current=next;useStore.getState().setCameraMoving(true);invalidate()}
  }, [camera,invalidate,overview,scene,size.width,size.height,atlSites,city,home,playing,insets])
  const latestView=useRef(view);useLayoutEffect(()=>{latestView.current=view},[view])
  useEffect(() => {const s=useStore.getState();if(s.sim?.city===city&&!s.panel){motion.follow=true;destination.current=null;invalidate();return}latestView.current(s.panel==='location'?s.selectedLoc:s.panel==='plots'?'plots':s.panel==='billboard'?`billboard-${s.selectedSlot??1}`:s.panel==='homes'?'home':s.panel==='mayor'?(city==='atl'?'capitol':city==='nyc'?'cityHall':'sfCityHall'):null,!s.sim,true)}, [city,invalidate])
  useEffect(() => {if(focus){if(!room){motion.follow=false;view(focus)}else{destination.current=null;motion.follow=true}useStore.getState().setFocus(null)}}, [focus,view,room])
  // Entering a room ends any outdoor intro/map flight before the walking camera takes over.
  useEffect(()=>{if(!room)return;destination.current=null;motion.follow=true;useStore.getState().setCameraMoving(false);invalidate()},[room,invalidate])
  useEffect(() => {gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=true;scene.fog=new THREE.Fog(room?(night?'#91818d':'#eee5dd'):night?'#70677e':'#f1dfc4',room?38:500,room?75:1100);invalidate()}, [gl,scene,night,city,room,invalidate])
  useEffect(() => {const wake=()=>{lastFrame.current=0;invalidate()};document.addEventListener('visibilitychange',wake);return()=>document.removeEventListener('visibilitychange',wake)},[invalidate])
  useFrame((_,dt)=>{
    const fog=scene.fog as THREE.Fog|null,range=camera.position.distanceTo(controls.current?.target??worldTarget);if(fog&&!room){fog.near=Math.max(500,range*1.1);fog.far=Math.max(1100,range*2.2)}
    const time=performance.now(),active=!!destination.current||(motion.moving&&(motion.x!==0||motion.z!==0));if(active&&lastFrame.current&&time-lastFrame.current<250){timings.current.push(time-lastFrame.current);if(timings.current.length>1200)timings.current.shift()}lastFrame.current=active?time:0
    const d=destination.current,c=controls.current
    if(d&&c){const t=1-Math.exp(-Math.min(dt,.05)*7);camera.position.lerp(d.eye,t);c.target.lerp(d.target,t);c.update();if(camera.position.distanceTo(d.eye)<.03){destination.current=null;useStore.getState().setCameraMoving(false)}invalidate()}
  })
  useEffect(()=>{
    if(!import.meta.env.DEV)return
    window.__metroScene={occlusionDemo:enabled=>{
      const player=scene.getObjectByName('controlled-player');if(!player)return
      const trees:THREE.Vector3[]=[],matrix=new THREE.Matrix4(),world=new THREE.Matrix4()
      scene.traverse(o=>{if(o instanceof THREE.InstancedMesh&&o.parent?.name.includes('tree-'))for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);world.multiplyMatrices(o.matrixWorld,matrix);const p=new THREE.Vector3().setFromMatrixPosition(world),distance=Math.hypot(p.x-player.position.x,p.z-player.position.z);if(distance>3&&distance<30)trees.push(p)}})
      trees.sort((a,b)=>a.distanceToSquared(player.position)-b.distanceToSquared(player.position));const tree=trees[0];if(!tree)return
      const direction=tree.clone().sub(player.position);direction.y=0;const length=direction.length();direction.normalize();camera.position.copy(player.position).addScaledVector(direction,length+6);camera.position.y=player.position.y+4;controls.current?.target.copy(player.position).add(new THREE.Vector3(0,1,0));destination.current=null;motion.follow=false;scene.userData.cameraOcclusionDisabled=!enabled;controls.current?.update();invalidate()
    },effects:enabled=>{scene.userData.withoutEffects=!enabled;invalidate()},status:()=>{const kits:{name?:string;triangles:number;shadow:boolean;count:number;visible:boolean;parentVisible:boolean;bakedContact:boolean;windowVertices:number;bakeMs:number}[]=[];scene.traverse(o=>{if(o instanceof THREE.InstancedMesh)kits.push({name:o.parent?.name,triangles:(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*o.count,shadow:o.castShadow,count:o.count,visible:o.visible,parentVisible:o.parent?.visible??true,bakedContact:!!o.geometry.userData.bakedContact,windowVertices:o.geometry.userData.litWindowVertices??0,bakeMs:o.geometry.userData.contactBake?.milliseconds??0})});const ground=scene.getObjectByName('terrain') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>|undefined;const plot=scene.getObjectByName('plots-field') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>|undefined;return{activity:(()=>{let pose='',head:number[]=[];scene.getObjectByName('controlled-player')?.traverse(o=>{if(o.userData.clip)pose=o.userData.clip;if(o instanceof THREE.Bone&&o.name==='Head')head=o.getWorldPosition(new THREE.Vector3()).toArray()});return{pose,head,slot:useStore.getState().sim?.activitySlot,position:scene.getObjectByName('controlled-player')?.position.toArray(),walls:['front','back','left','right'].map(n=>{const g=scene.getObjectByName('room-wall-'+n);return{name:n,upper:g?.children[1]?.visible,lower:g?.children[0]?.scale.y}})}})(),roomDetails:(()=>{let template="";scene.traverse(o=>{if(o.userData.template)template=o.userData.template});const staff=scene.getObjectByName("venue-staff-behind-counters") as THREE.InstancedMesh|undefined;const window=scene.getObjectByName("room-window") as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>|undefined;return{template,staff:staff?.count??0,staffRoles:staff?.userData.roles,wallDecor:["front","back","left","right"].map(side=>({side,visible:scene.getObjectByName("wall-mounted-"+side)?.visible})),window:window?.material.color.getHexString()}})(),cameraOcclusion:scene.userData.cameraOcclusion,atlantaModels:(()=>{const models:unknown[]=[];scene.traverse(o=>{if(o.userData.atlantaModel)models.push(o.userData.atlantaModel)});return models})(),nightLights:{pools:(scene.getObjectByName('street-light-pools') as THREE.InstancedMesh|undefined)?.count??0,cars:(scene.getObjectByName('car-head-and-tail-lights') as THREE.InstancedMesh|undefined)?.count??0},imageQuality:scene.userData.imageQuality,roomLighting:scene.getObjectByName('room-shadow-key')?{shadowSize:1024,environmentIntensity:scene.environmentIntensity}:null,plotTexture:plot?{url:(plot.material.map?.image as HTMLImageElement|undefined)?.src,width:(plot.material.map?.image as HTMLImageElement|undefined)?.width,version:plot.material.map?.version}:null,kits,terrain:ground?{visible:ground.visible,color:ground.material.color.getHexString(),emissive:ground.material.emissive.getHexString()}:null,camera:{eye:camera.position.toArray(),target:controls.current?.target.toArray(),offset:(camera as THREE.PerspectiveCamera).view},insets,playerParts:(()=>{const values:number[]=[];scene.getObjectByName('controlled-player')?.traverse(o=>{if(o instanceof THREE.Bone)values.push(...o.quaternion.toArray())});return values})(),residentActors:(()=>{const mesh=scene.getObjectByName('residents') as THREE.InstancedMesh|undefined;return mesh?{ids:mesh.userData.ids,matrices:Array.from(mesh.instanceMatrix.array),poses:Array.from(mesh.geometry.getAttribute('crowdPose').array),time:(mesh.material as THREE.MeshStandardMaterial).userData.crowdTime?.value}:null})(),traffic:(()=>{const cars:number[][]=[];scene.traverse(o=>{if(o instanceof THREE.InstancedMesh&&o.name==='driving-cars')cars.push(Array.from(o.instanceMatrix.array))});return cars})(),residentUpload:(scene.getObjectByName('residents') as THREE.InstancedMesh|undefined)?.instanceMatrix.version,memory:{...gl.info.memory},fog:scene.fog instanceof THREE.Fog?{near:scene.fog.near,far:scene.fog.far}:null,frameloop,frame:gl.info.render.frame}},tilt:angle=>{const target=controls.current?.target??worldTarget,radius=camera.position.distanceTo(target);camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle)*radius*.5,Math.cos(angle)*radius,Math.sin(angle)*radius*.866));controls.current?.update();invalidate()},flight:id=>view(id),resetMetrics:()=>{timings.current=[];lastFrame.current=0},refreshShadows:()=>{gl.shadowMap.needsUpdate=true;invalidate()},focus:id=>view(id,true),theme:value=>useStore.getState().setSceneTheme(value),hidePins:setPinsHidden,project:id=>{const [kind,cell]=id.split(':'),s=kind==='plots'?plotSite(city):kind.startsWith('billboard-')?boardSites(city,city==='atl'?20:city==='nyc'?24:22)[Number(kind.slice(10))-1]:atlSites[kind];let x=s.x,z=s.z;if(kind==='plots'&&cell){const [cx,cy]=cell.split(',').map(Number),cols=city==='atl'?48:56,rows=city==='atl'?28:30;x+=-s.size/2+(cx+.5)/cols*s.size;z+=-s.size*rows/cols/2+(cy+.5)/cols*s.size}const v=new THREE.Vector3(x,kind==='plots'?.3:kind.startsWith('billboard-')?3.25:s.height+2,z).project(camera);return{x:(v.x+1)*size.width/2,y:(1-v.y)*size.height/2}},geometry:()=>Object.fromEntries(Object.keys(atlSites).map(id=>{const m=scene.getObjectByName(id);let count=0;m?.traverse(o=>{if(o instanceof THREE.Mesh)count+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3});return[id,count]})),metrics:()=>{
      const times=[...timings.current].sort((a,b)=>a-b),context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info')
      return{calls:gl.info.render.calls,triangles:gl.info.render.triangles,fps:times.length?1000/(times.reduce((a,b)=>a+b,0)/times.length):0,p95Ms:times[Math.floor(times.length*.95)]??0,renderer:debug?context.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unknown',dpr:gl.getPixelRatio()}
    }}
    return()=>{delete window.__metroScene}
  },[camera,gl,scene,size.width,size.height,view,invalidate,atlSites,frameloop,insets,city])
  return <>
    <Sky night={night} room={!!room}/><hemisphereLight args={[night?'#a8b9dd':'#e0e9f2',night?'#4c566c':'#9cacbd',room?(room.startsWith('club:')?.16:.45):night?.65:1.2]}/>
    <directionalLight position={[-55,90,45]} intensity={room?0:night?.9:2.0} color={night?'#95b3ef':'#fff1dc'} castShadow={!room} shadow-mapSize={[2048,2048]} shadow-camera-left={-100} shadow-camera-right={100} shadow-camera-top={100} shadow-camera-bottom={-100} shadow-camera-near={1} shadow-camera-far={230} shadow-bias={-.0003} shadow-normalBias={.12}/>
    {room&&<><RoomLighting club={room.startsWith('club:')}/><Interior room={room}/></>}
    {/* Keep asset boundaries mounted across doors; late Suspense retries must not strand the exterior. */}
    <group name="outdoor-city" visible={!room}>{city==='atl'?<><mesh name="ground" position={[0,-.05,0]} rotation={[-Math.PI/2,0,0]} receiveShadow raycast={noPick}><planeGeometry args={[2000,2000]}/><meshStandardMaterial color={night?'#343b39':'#8ebd75'} emissive={night?'#586c83':'#000000'} emissiveIntensity={night?.24:0} roughness={1}/></mesh><Terrain night={night}/><Fabric night={night}/></>:<MetropolitanFabric key={city} city={city} night={night}/>}
    <Architecture key={`architecture-${city}`} city={city}/><Home city={city}/><Lake night={night} city={city}/>{!pinsHidden&&<Pins key={`pins-${city}`} onHover={onHover}/>}
    <HelpWanted/><Walkways city={city}/><Traffic city={city} night={night}/><EconomyScene night={night}/></group><CameraOcclusion/><Residents/><WorldActivity/><Walking controls={controls} cancelFlight={()=>{destination.current=null}}/><OrbitControls ref={controls} enabled={!beat&&panel!=='plots'&&!['play','setup','signup','login','worlds'].includes(panel??'')} makeDefault target={worldTarget} minDistance={9} maxDistance={1200} maxPolarAngle={1.25} minPolarAngle={.35} enableRotate={false} enableDamping={false} mouseButtons={{LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN}} touches={{ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN}} screenSpacePanning={false} zoomSpeed={.7} onStart={()=>{destination.current=null;motion.follow=false;useStore.getState().setCameraMoving(true)}} onEnd={()=>useStore.getState().setCameraMoving(false)} onChange={()=>{const c=controls.current;if(c){c.target.x=THREE.MathUtils.clamp(c.target.x,-105,125);c.target.z=THREE.MathUtils.clamp(c.target.z,-120,145)}invalidate()}}/>
  </>
}
function SceneLoading(){const {active,progress}=useProgress();return active?<div className="scene-loading" role="status">Bringing the city to life: {Math.round(progress)}%</div>:null}
export default function CityScene() {
  const ruler=import.meta.env.DEV?new URLSearchParams(location.search).get('scale-ruler'):null
  const pose=import.meta.env.DEV?new URLSearchParams(location.search).get('pose'):null
  const [hover,setHover]=useState<{name:string;x:number;y:number}|null>(null)
  return <div className="city-canvas"><Canvas frameloop="demand" shadows="soft" dpr={1} camera={{position:[95,108,130],fov:40,near:.1,far:2000}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} onCreated={({raycaster})=>{raycaster.params.Points.threshold=1.5}}><AmbientTicker/><ImageQuality/><Suspense fallback={null}>{pose?<PoseStudio pose={pose as CharacterPose} body={new URLSearchParams(location.search).get('body')??'f'}/>:ruler&&['atl','nyc','bay'].includes(ruler)?<ScaleRuler city={ruler as CityId}/>:<City onHover={(name,x=0,y=0)=>setHover(name?{name,x,y}:null)}/>}</Suspense></Canvas><SceneLoading/><PlayerMarker/>{hover&&<div className="map-tooltip" style={{left:Math.min(hover.x+14,innerWidth-220),top:Math.max(70,hover.y-40)}}>{hover.name}</div>}</div>
}
