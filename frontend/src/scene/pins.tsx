/* oxlint-disable react/immutability -- Point attributes and shader uniforms are Three.js renderer resources. */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useStore } from '../store'
import canonical from '../../../shared/world.json'
import { sitesFor,homeSite } from './cities'
import type { Site } from './cities/atl'
import { ICONS } from './icons'
import type { IconName, IconShape } from './icons'

const aliases: Record<string, IconName> = { 'trophy': 'ball', 'drama': 'music', 'palette': 'bulb', 'cpu': 'bulb', 'graduation-cap': 'school', 'book-open': 'book', 'shopping-bag': 'bag', 'landmark': 'building', 'flame': 'heart', 'disc-3': 'disc', 'heart-pulse': 'cross', 'soup': 'utensils', 'house':'home' }
const categories = [...Object.keys(canonical.categories),'home']
const catInfo:Record<string, { icon: string; color: string }> = {...canonical.categories,home:{icon:'house',color:'#2c7150'}}

function iconTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 64 * categories.length; canvas.height = 64
  const ctx = canvas.getContext('2d')!
  categories.forEach((category, i) => {
    ctx.save(); ctx.translate(i * 64, 0); ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#345b4c'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = catInfo[category].color; ctx.beginPath(); ctx.arc(49, 49, 6, 0, Math.PI * 2); ctx.fill()
    ctx.translate(17, 17); ctx.scale(1.25, 1.25); ctx.strokeStyle = '#244c3e'; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
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
  const city=useStore(s=>s.city),homeCity=useStore(s=>s.sim?.home.city),homeNeighborhood=useStore(s=>s.sim?.home.neighborhood)
  const hasHome=homeCity===city&&!!homeNeighborhood
  const locations=useMemo(()=>[...canonical.cities.find(c=>c.id===city)!.landmarks,...(hasHome?[{id:'home',name:'Your home',category:'home'}]:[])],[city,hasHome])
  const atlSites=useMemo<Record<string,Site>>(()=>{const site=homeSite(city,homeCity&&homeNeighborhood?{city:homeCity,neighborhood:homeNeighborhood,rent:0}:undefined);return {...sitesFor(city),...(site?{home:site}:{})}},[city,homeCity,homeNeighborhood])
  const {camera,size,gl}=useThree(),lastCamera=useRef(new THREE.Matrix4()),selected=useStore(s=>s.selectedLoc)
  const lastHover=useRef(0)
  const points=useRef<THREE.Points>(null)
  const data = useMemo(() => {
    const geometry = new THREE.BufferGeometry(), positions: number[] = [], icons: number[] = []
    locations.forEach(loc => { const site = atlSites[loc.id]; positions.push(site.x, site.height + 2, site.z); icons.push(categories.indexOf(loc.category)) })
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('iconIndex', new THREE.Float32BufferAttribute(icons, 1))
    geometry.setAttribute('pinVisible',new THREE.Float32BufferAttribute(locations.map(()=>1),1))
    const material = new THREE.ShaderMaterial({ uniforms: { atlas: { value: iconTexture() }, count: { value: categories.length }, size: { value: 34 * Math.min(devicePixelRatio, 1.5) } }, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'attribute float iconIndex; attribute float pinVisible; varying float vVisible; varying float vIcon; uniform float size; void main(){vIcon=iconIndex;vVisible=pinVisible;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size;}',
      fragmentShader: 'uniform sampler2D atlas; uniform float count; varying float vIcon;varying float vVisible; void main(){if(vVisible<.5)discard;vec4 c=texture2D(atlas,vec2((vIcon+gl_PointCoord.x)/count,1.-gl_PointCoord.y));if(c.a<.2)discard;gl_FragColor=c;}' })
    return { geometry, material }
  }, [locations,atlSites])
  const version=useRef('')
  useFrame(()=>{data.material.uniforms.size.value=(size.width<600?30:34)*gl.getPixelRatio();const key=`${selected}:${size.width}:${size.height}`;if(lastCamera.current.equals(camera.matrixWorld)&&version.current===key)return;lastCamera.current.copy(camera.matrixWorld);version.current=key;const accepted:{x:number;y:number}[]=[],visible=data.geometry.getAttribute('pinVisible');const order=locations.map((l,i)=>({l,i})).sort((a,b)=>Number(b.l.id===selected)-Number(a.l.id===selected));for(const{l,i}of order){const s=atlSites[l.id],v=new THREE.Vector3(s.x,s.height+2,s.z).project(camera),x=(v.x+1)*size.width/2,y=(1-v.y)*size.height/2;const show=v.z<1&&x>19&&x<size.width-19&&y>19&&y<size.height-19&&!accepted.some(p=>Math.hypot(x-p.x,y-p.y)<(size.width<600?35:37));visible.setX(i,show?1:0);if(show)accepted.push({x,y})}visible.needsUpdate=true})
  const pick = (e: ThreeEvent<PointerEvent>) => {if(performance.now()-lastHover.current<50)return;lastHover.current=performance.now();const index=e.index??-1,loc = locations[index]; if(loc&&data.geometry.getAttribute('pinVisible').getX(index)>.5) {e.stopPropagation();onHover(loc.name,e.clientX,e.clientY)} }
  return <points ref={points} geometry={data.geometry} material={data.material} renderOrder={20} raycast={(ray,results)=>{const start=results.length;THREE.Points.prototype.raycast.call(points.current!,ray,results);for(let i=results.length-1;i>=start;i--)if(data.geometry.getAttribute('pinVisible').getX(results[i].index??-1)<.5)results.splice(i,1)}}
    onPointerMove={pick} onPointerOut={() => onHover(null)}
    onClick={e => {const index=e.index??-1,loc=locations[index];if(loc&&data.geometry.getAttribute('pinVisible').getX(index)>.5){e.stopPropagation();useStore.getState().selectLocation(loc.id);useStore.getState().setFocus(loc.id)}}} />
}
