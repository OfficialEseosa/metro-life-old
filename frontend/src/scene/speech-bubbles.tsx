/* oxlint-disable react/immutability -- Canvas textures and sprite positions are owned Three resources. */
import { useEffect,useMemo,useRef } from 'react'
import { useFrame,useThree } from '@react-three/fiber'
import * as THREE from 'three'

function topicIcon(c:CanvasRenderingContext2D,topic:string,x:number,y:number){
 c.save();c.translate(x,y);c.strokeStyle='#47766c';c.fillStyle='#47766c';c.lineWidth=3.5;c.lineCap='round';c.lineJoin='round'
 c.beginPath()
 if(topic==='food'){c.moveTo(-12,-13);c.lineTo(-12,13);c.moveTo(-17,-13);c.lineTo(-17,-3);c.lineTo(-7,-3);c.lineTo(-7,-13);c.moveTo(11,-13);c.quadraticCurveTo(2,-3,11,1);c.lineTo(11,13)}
 else if(topic==='music'){c.moveTo(-7,8);c.lineTo(-7,-12);c.lineTo(13,-16);c.lineTo(13,4);c.moveTo(-7,-6);c.lineTo(13,-10);c.stroke();c.beginPath();c.ellipse(-12,10,6,4,-.4,0,Math.PI*2);c.ellipse(8,6,6,4,-.4,0,Math.PI*2);c.fill()}
 else if(topic==='sleep'){c.font='bold 29px sans-serif';c.fillText('Z',-10,10)}
 else if(topic==='water'){c.moveTo(0,-17);c.bezierCurveTo(-21,5,-13,16,0,16);c.bezierCurveTo(13,16,21,5,0,-17)}
 else if(topic==='work'){c.rect(-16,-10,32,22);c.moveTo(-6,-10);c.lineTo(-6,-16);c.lineTo(6,-16);c.lineTo(6,-10);c.moveTo(-16,0);c.lineTo(16,0)}
 else if(topic==='friendship'){c.moveTo(0,14);c.bezierCurveTo(-28,-2,-10,-24,0,-10);c.bezierCurveTo(10,-24,28,-2,0,14)}
 else{c.roundRect(-17,-13,34,23,7);c.moveTo(-8,10);c.lineTo(-12,17);c.lineTo(1,10);c.moveTo(-8,-2);c.lineTo(8,-2)}
 c.stroke();c.restore()
}
function bubbleTexture(name:string,label:string,topic:string,speaking:boolean){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=speaking?180:116;const c=canvas.getContext('2d')!;c.scale(2,2)
 c.shadowColor='rgba(23,37,38,.16)';c.shadowBlur=7;c.shadowOffsetY=2;c.fillStyle='rgba(255,253,245,.96)';c.beginPath();c.roundRect(3,3,250,speaking?77:48,13);c.fill();c.shadowColor='transparent';c.strokeStyle='#d2dcd2';c.lineWidth=1;c.stroke();c.beginPath();c.moveTo(119,speaking?80:51);c.lineTo(128,speaking?88:57);c.lineTo(137,speaking?80:51);c.fill()
 c.fillStyle='#243b39';c.font='600 12px sans-serif';c.textAlign='center';c.fillText(name.slice(0,27),128,20);c.font='11px sans-serif';c.fillStyle='#53635e';c.fillText(label.slice(0,37),128,37)
 if(speaking){topicIcon(c,topic,39,60);c.font='600 15px sans-serif';c.textAlign='left';c.fillStyle='#47766c';c.fillText(topic==='sleep'?'Zzz...':'Bla ba, nibu ba!',65,65)}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture
}
/** Billboard labels track the rendered position rather than jumping between server updates. */
export function LifeBubble({name,label,topic='chat',speaking=false,readPosition,visible=()=>true}:{name:string;label:string;topic?:string;speaking?:boolean;readPosition:()=>{x:number;y?:number;z:number}|undefined;visible?:()=>boolean}){
 const ref=useRef<THREE.Sprite>(null),{invalidate}=useThree(),texture=useMemo(()=>bubbleTexture(name,label,topic,speaking),[name,label,topic,speaking])
 useEffect(()=>()=>texture.dispose(),[texture]);useEffect(()=>{invalidate()},[texture,invalidate])
 useFrame(({camera})=>{if(!ref.current)return;const p=readPosition();ref.current.visible=!!p&&visible();if(!p)return;ref.current.position.set(p.x,(p.y??0)+2.65,p.z);const distance=camera.position.distanceTo(ref.current.position),factor=Math.min(1.65,Math.max(.85,distance/20));ref.current.scale.set(3.2*factor,(speaking?1.125:.725)*factor,1);if(distance>48)ref.current.visible=false})
 return <sprite ref={ref} renderOrder={30} raycast={()=>{}}><spriteMaterial map={texture} transparent depthWrite={false} depthTest={false}/></sprite>
}

export function StinkCloud({readPosition}:{readPosition:()=>{x:number;y?:number;z:number}|undefined}){
 const ref=useRef<THREE.InstancedMesh>(null),dummy=useMemo(()=>new THREE.Object3D(),[]),{invalidate}=useThree()
 useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)invalidate()},1000/20);return()=>clearInterval(timer)},[invalidate])
 useFrame(({clock})=>{const p=readPosition();if(!p||!ref.current)return;for(let i=0;i<7;i++){const t=(clock.elapsedTime*.27+i/7)%1,a=i*2.4+clock.elapsedTime*.4;dummy.position.set(p.x+Math.sin(a)*(.25+t*.17),(p.y??0)+.6+t*1.8,p.z+Math.cos(a)*.25);dummy.scale.setScalar(Math.sin(t*Math.PI)*.16);dummy.updateMatrix();ref.current.setMatrixAt(i,dummy.matrix)}ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere()})
 return <instancedMesh ref={ref} args={[undefined,undefined,7]} raycast={()=>{}}><sphereGeometry args={[1,6,4]}/><meshBasicMaterial color="#91a65f" transparent opacity={.26} depthWrite={false}/></instancedMesh>
}
