/* oxlint-disable react/immutability -- Text visibility follows camera distance. */
import { useEffect,useRef } from 'react'
import { Billboard,Text } from '@react-three/drei'
import { useFrame,useThree } from '@react-three/fiber'
import { preloadFont } from 'troika-three-text'
import * as THREE from 'three'
import signFont from '@fontsource/fredoka/files/fredoka-latin-600-normal.woff?url'
import { fictionalText } from '../content-names'

const characters="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&'-.,!$:/+() "
export function WorldTextPreload(){const invalidate=useThree(s=>s.invalidate);useEffect(()=>{preloadFont({font:signFont,characters,sdfGlyphSize:128},invalidate)},[invalidate]);return null}
export type WorldTextProps={children:string|number;position?:[number,number,number];rotation?:[number,number,number];fontSize?:number;maxWidth?:number;color?:string;outlineColor?:string;billboard?:boolean;distance?:number;anchorX?:'left'|'center'|'right';anchorY?:'top'|'middle'|'bottom';renderOrder?:number;depthTest?:boolean}
/** Shared local-font SDF lettering for fascia, boards, wayfinding and character labels. */
export function WorldText({children,position,rotation,fontSize=.42,maxWidth=5,color='#fff7ea',outlineColor='#2a1f2b',billboard=false,distance=65,anchorX='center',anchorY='middle',renderOrder=2,depthTest=true}:WorldTextProps){
 const ref=useRef<THREE.Group>(null),point=useRef(new THREE.Vector3()),text=fictionalText(String(children))
 useFrame(({camera})=>{if(!ref.current)return;ref.current.getWorldPosition(point.current);ref.current.visible=camera.position.distanceTo(point.current)<distance})
 const label=<Text font={signFont} fontSize={fontSize} maxWidth={maxWidth} anchorX={anchorX} anchorY={anchorY} textAlign="center" color={color} outlineWidth="5%" outlineColor={outlineColor} outlineBlur="1%" sdfGlyphSize={128} characters={characters} renderOrder={renderOrder} raycast={()=>{}} material-toneMapped={false} material-depthTest={depthTest} material-depthWrite={false}>{text}</Text>
 return <group ref={ref} position={position} rotation={rotation}>{billboard?<Billboard>{label}</Billboard>:label}</group>
}
