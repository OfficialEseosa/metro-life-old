/* oxlint-disable react/immutability -- Point attributes and shader uniforms are Three.js renderer resources. */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useStore } from '../store'
import canonical from '../../../shared/world.json'
import { sitesFor,homeSite } from './cities'
import type { Site } from './cities/atl'
import { ICONS } from './icons'
import { WorldText } from './world-text'
import { venueName } from '../content-names'
import type { RefObject } from 'react'
import { matchesLens } from '../ui/action-rules'
import type { IconName, IconShape } from './icons'

const aliases: Record<string, IconName> = { 'trophy': 'ball', 'drama': 'music', 'palette': 'bulb', 'cpu': 'bulb', 'graduation-cap': 'school', 'book-open': 'book', 'shopping-bag': 'bag', 'landmark': 'building', 'flame': 'heart', 'disc-3': 'disc', 'heart-pulse': 'cross', 'soup': 'utensils', 'house':'home' }
const categories = [...Object.keys(canonical.categories),'home',...Array.from({length:31},(_,i)=>String(i+2))]
const catInfo:Record<string, { icon: string; color: string }> = {...canonical.categories,home:{icon:'house',color:'#2c7150'}}

function iconTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 64 * categories.length; canvas.height = 64
  const ctx = canvas.getContext('2d')!
  categories.forEach((category, i) => {
    ctx.save(); ctx.translate(i * 64, 0); ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#345b4c'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = catInfo[category]?.color??'#216546';ctx.beginPath();ctx.arc(32,32,24,0,Math.PI*2);ctx.fill();if(!catInfo[category]){ctx.restore();return}
    ctx.translate(17, 17); ctx.scale(1.25, 1.25); ctx.strokeStyle = '#fff7ea'; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const name = catInfo[category].icon; const shapes: IconShape[] = ICONS[(aliases[name] ?? name) as IconName] ?? ICONS.pin
    shapes.forEach(s => {
      ctx.beginPath()
      if(s.t === 'path') { ctx.stroke(new Path2D(s.d)); return }
      if(s.t === 'circle')ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2)
      if(s.t === 'rect')ctx.roundRect(s.x, s.y, s.w, s.h, s.rx)
      if(s.t === 'line'){ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2)}
      ctx.stroke()
    });ctx.restore()
  })
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture
}

export function Pins({ onHover }: { onHover: (name: string | null, x?: number, y?: number) => void }) {
  const world=useStore(s=>s.world),insets=useStore(s=>s.hudInsets),city=useStore(s=>s.city),homeCity=useStore(s=>s.sim?.home.city),homeNeighborhood=useStore(s=>s.sim?.home.neighborhood)
  const hasHome=homeCity===city&&!!homeNeighborhood
  const locations=useMemo(()=>[...(world?.cities??canonical.cities).find(c=>c.id===city)!.landmarks,...(hasHome?[{id:'home',name:'Your home',category:'home'}]:[])],[city,hasHome,world])
  const atlSites=useMemo<Record<string,Site>>(()=>{const site=homeSite(city,homeCity&&homeNeighborhood?{city:homeCity,neighborhood:homeNeighborhood,rent:0}:undefined);return {...sitesFor(city),...(site?{home:site}:{})}},[city,homeCity,homeNeighborhood])
  const {camera,size,gl}=useThree(),lastCamera=useRef(new THREE.Matrix4()),selected=useStore(s=>s.selectedLoc)
  const lastHover=useRef(0),clusters=useRef<number[]>([]),lens=useStore(s=>s.mapLens),sim=useStore(s=>s.sim)
  const points=useRef<THREE.Points>(null)
  const data = useMemo(() => {
    const geometry = new THREE.BufferGeometry(), positions: number[] = [], icons: number[] = []
    locations.forEach(loc => { const site = atlSites[loc.id]; positions.push(site.x, site.height + 2, site.z); icons.push(categories.indexOf(loc.category)) })
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('iconIndex', new THREE.Float32BufferAttribute(icons, 1))
    geometry.setAttribute('pinMatch',new THREE.Float32BufferAttribute(locations.map(()=>1),1))
    geometry.setAttribute('pinVisible',new THREE.Float32BufferAttribute(locations.map(()=>1),1))
    geometry.userData.locationIds=locations.map(location=>location.id)
    const material = new THREE.ShaderMaterial({ uniforms: { atlas: { value: iconTexture() }, count: { value: categories.length }, size: { value: 34 * Math.min(devicePixelRatio, 1.5) } }, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'attribute float iconIndex; attribute float pinVisible;attribute float pinMatch;varying float vMatch; varying float vVisible; varying float vIcon; uniform float size; void main(){vIcon=iconIndex;vVisible=pinVisible;vMatch=pinMatch;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size;}',
      fragmentShader: 'uniform sampler2D atlas; uniform float count; varying float vIcon;varying float vVisible;varying float vMatch; void main(){if(vVisible<.5)discard;vec4 c=texture2D(atlas,vec2((vIcon+gl_PointCoord.x)/count,1.-gl_PointCoord.y));if(c.a<.2)discard;gl_FragColor=vec4(c.rgb,c.a*vMatch);}' })
    return { geometry, material }
  }, [locations,atlSites])
  useEffect(()=>()=>{data.geometry.dispose();data.material.uniforms.atlas.value.dispose();data.material.dispose()},[data])
  const version=useRef('')
  useFrame(()=>{data.material.uniforms.size.value=36*gl.getPixelRatio();const key=`${selected}:${size.width}:${size.height}:${lens}:${sim?.cash}:${sim?.job?.track}:${!!world}:${insets.top}:${insets.right}:${insets.bottom}:${insets.left}`;if(lastCamera.current.equals(camera.matrixWorld)&&version.current===key)return;lastCamera.current.copy(camera.matrixWorld);version.current=key;const accepted:{x:number;y:number;i:number;count:number}[]=[],visible=data.geometry.getAttribute('pinVisible'),icons=data.geometry.getAttribute('iconIndex'),match=data.geometry.getAttribute('pinMatch');const order=locations.map((l,i)=>({l,i})).sort((a,b)=>Number(b.l.id===selected)-Number(a.l.id===selected));clusters.current=locations.map(()=>1);for(const{l,i}of order){const site=atlSites[l.id],v=new THREE.Vector3(site.x,site.height+2,site.z).project(camera),x=(v.x+1)*size.width/2,y=(1-v.y)*size.height/2;const nearby=accepted.find(p=>Math.hypot(x-p.x,y-p.y)<48),show=v.z<1&&x>Math.max(18,insets.left+18)&&x<size.width-Math.max(18,insets.right+18)&&y>Math.max(18,insets.top+18)&&y<size.height-Math.max(18,insets.bottom+18)&&!(x>size.width-80&&y>size.height-180);visible.setX(i,show&&!nearby?1:0);icons.setX(i,categories.indexOf(l.category));const landmark=world?.cities.find(c=>c.id===city)?.landmarks.find(p=>p.id===l.id);match.setX(i,!landmark||matchesLens(landmark,lens,sim)?1:.28);if(show&&nearby){nearby.count++;clusters.current[nearby.i]=nearby.count;icons.setX(nearby.i,categories.indexOf(String(Math.min(32,nearby.count))));match.setX(nearby.i,Math.max(match.getX(nearby.i),match.getX(i)))}else if(show)accepted.push({x,y,i,count:1})}visible.needsUpdate=true;icons.needsUpdate=true;match.needsUpdate=true})
  const pick = (e: ThreeEvent<PointerEvent>) => {if(performance.now()-lastHover.current<50)return;lastHover.current=performance.now();const index=e.index??-1,loc = locations[index]; if(loc&&data.geometry.getAttribute('pinVisible').getX(index)>.5) {e.stopPropagation();onHover(clusters.current[index]>1?`${clusters.current[index]} places · tap to explore`:venueName(loc.id,loc.name),e.clientX,e.clientY)} }
  return <><points name="map-pins" ref={points} geometry={data.geometry} material={data.material} renderOrder={20} raycast={(ray,results)=>{const pointer=ray.ray.at(1,new THREE.Vector3()).project(camera),px=(pointer.x+1)*size.width/2,py=(1-pointer.y)*size.height/2;locations.forEach((loc,index)=>{if(data.geometry.getAttribute('pinVisible').getX(index)<.5)return;const site=atlSites[loc.id],point=new THREE.Vector3(site.x,site.height+2,site.z),p=point.clone().project(camera);if(Math.hypot((p.x+1)*size.width/2-px,(1-p.y)*size.height/2-py)<24)results.push({distance:camera.position.distanceTo(point),point,index,object:points.current!})})}}
    onPointerMove={pick} onPointerOut={() => onHover(null)}
    onClick={e => {const index=e.index??-1,loc=locations[index];if(loc&&data.geometry.getAttribute('pinVisible').getX(index)>.5){e.stopPropagation();if(clusters.current[index]>1){useStore.getState().setFocus(loc.id)}else{useStore.getState().selectLocation(loc.id);useStore.getState().setFocus(loc.id)}}}} />{locations.map((loc,i)=><PinLabel key={loc.id} name={loc.id==='home'?'Your home':venueName(loc.id,loc.name)} site={atlSites[loc.id]} geometry={data.geometry} index={i} clusters={clusters} selected={selected===loc.id}/>)}</>
}

function PinLabel({name,site,geometry,index,clusters,selected}:{name:string;site:Site;geometry:THREE.BufferGeometry;index:number;clusters:RefObject<number[]>;selected:boolean}){
 const ref=useRef<THREE.Group>(null),[count,setCount]=useState(1),point=useMemo(()=>new THREE.Vector3(site.x,site.height+2,site.z),[site])
 useFrame(({camera})=>{const n=clusters.current[index]??1;if(n!==count)setCount(n);if(ref.current)ref.current.visible=geometry.getAttribute('pinVisible').getX(index)>.5&&(n>1||selected||camera.position.distanceTo(point)<36)})
 const title=name.length>22?name.slice(0,21)+'...':name
 return <group ref={ref} position={[site.x,site.height+(count>1?2:2.7),site.z]}><WorldText billboard fontSize={count>1?.7:.4} maxWidth={count>1?1.5:6} distance={count>1?400:65}>{count>1?String(count):title}</WorldText></group>
}
