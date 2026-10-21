/* oxlint-disable react/immutability -- Canvas textures and sprite positions are owned Three resources. */
import { useEffect,useMemo,useRef } from 'react'
import { useFrame,useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Billboard,RoundedBox } from '@react-three/drei'
import { WorldText } from './world-text'

function topicIcon(c:CanvasRenderingContext2D,topic:string,x:number,y:number){
 c.save();c.translate(x,y);c.strokeStyle='#47766c';c.fillStyle='#47766c';c.lineWidth=3.5;c.lineCap='round';c.lineJoin='round'
 c.beginPath()
 if(topic==='food'){c.moveTo(-12,-13);c.lineTo(-12,13);c.moveTo(-17,-13);c.lineTo(-17,-3);c.lineTo(-7,-3);c.lineTo(-7,-13);c.moveTo(11,-13);c.quadraticCurveTo(2,-3,11,1);c.lineTo(11,13)}
 else if(topic==='music'){c.moveTo(-7,8);c.lineTo(-7,-12);c.lineTo(13,-16);c.lineTo(13,4);c.moveTo(-7,-6);c.lineTo(13,-10);c.stroke();c.beginPath();c.ellipse(-12,10,6,4,-.4,0,Math.PI*2);c.ellipse(8,6,6,4,-.4,0,Math.PI*2);c.fill()}
 else if(topic==='sleep'){c.arc(0,0,14,.7,Math.PI*1.7);c.quadraticCurveTo(-2,6,11,9)}
 else if(topic==='water'){c.moveTo(0,-17);c.bezierCurveTo(-21,5,-13,16,0,16);c.bezierCurveTo(13,16,21,5,0,-17)}
 else if(topic==='work'){c.rect(-16,-10,32,22);c.moveTo(-6,-10);c.lineTo(-6,-16);c.lineTo(6,-16);c.lineTo(6,-10);c.moveTo(-16,0);c.lineTo(16,0)}
 else if(topic==='friendship'){c.moveTo(0,14);c.bezierCurveTo(-28,-2,-10,-24,0,-10);c.bezierCurveTo(10,-24,28,-2,0,14)}
 else{c.roundRect(-17,-13,34,23,7);c.moveTo(-8,10);c.lineTo(-12,17);c.lineTo(1,10);c.moveTo(-8,-2);c.lineTo(8,-2)}
 c.stroke();c.restore()
}
function topicTexture(topic:string){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!;c.scale(2,2);topicIcon(c,topic,32,32);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture}
/** Outlined SDF text remains readable as the camera changes distance and DPR. */
export function LifeBubble({name,label,topic='chat',speaking=false,readPosition,visible=()=>true}:{name:string;label:string;topic?:string;speaking?:boolean;readPosition:()=>{x:number;y?:number;z:number}|undefined;visible?:()=>boolean}){
 const ref=useRef<THREE.Group>(null),{invalidate}=useThree(),texture=useMemo(()=>topicTexture(topic),[topic])
 useEffect(()=>()=>texture.dispose(),[texture]);useEffect(()=>{invalidate()},[texture,invalidate])
 useFrame(({camera})=>{if(!ref.current)return;const p=readPosition();ref.current.visible=!!p&&visible();if(!p)return;ref.current.position.set(p.x,(p.y??0)+2.85,p.z);const distance=camera.position.distanceTo(ref.current.position),factor=Math.min(1.65,Math.max(.85,distance/20));ref.current.scale.setScalar(factor);if(distance>48)ref.current.visible=false})
 return <group ref={ref} renderOrder={30}><Billboard><RoundedBox args={[4.15,speaking?1.55:.98,.07]} radius={.15} smoothness={3} raycast={()=>{}}><meshBasicMaterial color="#fff9e9" transparent opacity={.97} depthTest={false} depthWrite={false}/></RoundedBox><WorldText position={[0,speaking?.46:.2,.055]} fontSize={.28} maxWidth={3.85} color="#263e39" outlineColor="#fff9e9" distance={70} depthTest={false} renderOrder={32}>{name.slice(0,24)}</WorldText><WorldText position={[0,speaking?.10:-.18,.055]} fontSize={.25} maxWidth={3.85} color="#4c6257" outlineColor="#fff9e9" distance={70} depthTest={false} renderOrder={32}>{label.slice(0,27)}</WorldText>{speaking&&<><mesh position={[-1.45,-.4,.065]} raycast={()=>{}}><planeGeometry args={[.55,.55]}/><meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false}/></mesh><WorldText position={[.25,-.4,.065]} fontSize={.3} maxWidth={2.9} color="#47766c" outlineColor="#fff9e9" distance={70} depthTest={false} renderOrder={32}>{topic==='sleep'?'Zzz...':'Bla ba, nibu ba!'}</WorldText></>}</Billboard></group>
}

export function StinkCloud({readPosition}:{readPosition:()=>{x:number;y?:number;z:number}|undefined}){
 const ref=useRef<THREE.InstancedMesh>(null),dummy=useMemo(()=>new THREE.Object3D(),[]),{invalidate}=useThree()
 useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)invalidate()},1000/20);return()=>clearInterval(timer)},[invalidate])
 useFrame(({clock})=>{const p=readPosition();if(!p||!ref.current)return;for(let i=0;i<7;i++){const t=(clock.elapsedTime*.27+i/7)%1,a=i*2.4+clock.elapsedTime*.4;dummy.position.set(p.x+Math.sin(a)*(.25+t*.17),(p.y??0)+.6+t*1.8,p.z+Math.cos(a)*.25);dummy.scale.setScalar(Math.sin(t*Math.PI)*.16);dummy.updateMatrix();ref.current.setMatrixAt(i,dummy.matrix)}ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere()})
 return <instancedMesh ref={ref} args={[undefined,undefined,7]} raycast={()=>{}}><sphereGeometry args={[1,6,4]}/><meshBasicMaterial color="#91a65f" transparent opacity={.26} depthWrite={false}/></instancedMesh>
}
