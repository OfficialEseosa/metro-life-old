import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useStore } from '../store'
import canonical from '../../../shared/world.json'
import { atlSites } from './cities/atl'
import { ICONS } from './icons'
import type { IconName, IconShape } from './icons'

const aliases: Record<string, IconName> = { 'trophy': 'ball', 'drama': 'music', 'palette': 'bulb', 'cpu': 'bulb', 'graduation-cap': 'school', 'book-open': 'book', 'shopping-bag': 'bag', 'landmark': 'building', 'flame': 'heart', 'disc-3': 'disc', 'heart-pulse': 'cross', 'soup': 'utensils' }
const categories = Object.keys(canonical.categories)
const catInfo = canonical.categories as Record<string, { icon: string; color: string }>

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
  const locations = canonical.cities[0].landmarks
  const lastHover=useRef(0)
  const data = useMemo(() => {
    const geometry = new THREE.BufferGeometry(), positions: number[] = [], icons: number[] = []
    locations.forEach(loc => { const site = atlSites[loc.id]; positions.push(site.x, site.height + 2, site.z); icons.push(categories.indexOf(loc.category)) })
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('iconIndex', new THREE.Float32BufferAttribute(icons, 1))
    const material = new THREE.ShaderMaterial({ uniforms: { atlas: { value: iconTexture() }, count: { value: categories.length }, size: { value: 34 * Math.min(devicePixelRatio, 1.5) } }, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'attribute float iconIndex; varying float vIcon; uniform float size; void main(){vIcon=iconIndex;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size;}',
      fragmentShader: 'uniform sampler2D atlas; uniform float count; varying float vIcon; void main(){vec4 c=texture2D(atlas,vec2((vIcon+gl_PointCoord.x)/count,1.-gl_PointCoord.y));if(c.a<.2)discard;gl_FragColor=c;}' })
    return { geometry, material }
  }, [locations])
  const pick = (e: ThreeEvent<PointerEvent>) => {if(performance.now()-lastHover.current<50)return;lastHover.current=performance.now();const loc = locations[e.index ?? -1]; if(loc) {e.stopPropagation();onHover(loc.name,e.clientX,e.clientY)} }
  return <points geometry={data.geometry} material={data.material} renderOrder={20}
    onPointerMove={pick} onPointerOut={() => onHover(null)}
    onClick={e => {const loc=locations[e.index ?? -1];if(loc){e.stopPropagation();useStore.getState().selectLocation(loc.id);useStore.getState().setFocus(loc.id)}}} />
}
