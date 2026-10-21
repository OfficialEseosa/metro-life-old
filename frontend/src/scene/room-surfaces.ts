import * as THREE from 'three'
import type { CityId } from '../api/types'
export type RoomPalette={wall:string;accent:string;wood:string;floor:string;trim:string;fabric:string}
const colours:Record<CityId,Record<string,RoomPalette>>={
 atl:{home:{wall:'#f4e5c9',accent:'#4b938d',wood:'#ab7852',floor:'#d7b58a',trim:'#fff1da',fabric:'#d98c67'},work:{wall:'#e2e9e4',accent:'#3b7a83',wood:'#ad855e',floor:'#c3cfcc',trim:'#fff3df',fabric:'#588c82'},cafe:{wall:'#f4dec2',accent:'#487a62',wood:'#b87e50',floor:'#cc9368',trim:'#fff1d5',fabric:'#6b9a83'},club:{wall:'#463345',accent:'#e09abc',wood:'#a77868',floor:'#655778',trim:'#e3b897',fabric:'#b5729c'}},
 nyc:{home:{wall:'#e8dfd1',accent:'#47778a',wood:'#94684d',floor:'#bd986e',trim:'#fff2da',fabric:'#bf6c59'},work:{wall:'#e4e0d7',accent:'#596a8e',wood:'#9c6e50',floor:'#c2b6a1',trim:'#fff2db',fabric:'#6d789a'},cafe:{wall:'#edcfb7',accent:'#a25248',wood:'#8e654b',floor:'#e2cdb1',trim:'#fff2dd',fabric:'#ba7561'},club:{wall:'#4b2e3b',accent:'#cf8d5d',wood:'#8c5b48',floor:'#765267',trim:'#d8a576',fabric:'#ad5b74'}},
 bay:{home:{wall:'#eee7d5',accent:'#71947b',wood:'#b58c63',floor:'#dfc79e',trim:'#fff3dc',fabric:'#e0b16a'},work:{wall:'#e5eadb',accent:'#4f8a76',wood:'#ba9169',floor:'#cbd2be',trim:'#fff2d8',fabric:'#6e9d83'},cafe:{wall:'#f0e4cd',accent:'#548c8c',wood:'#bb9169',floor:'#d5c5a3',trim:'#fff3d8',fabric:'#71988b'},club:{wall:'#304d50',accent:'#81c5b4',wood:'#bd9270',floor:'#657c7c',trim:'#e4c398',fabric:'#63988b'}}
}
export function roomPalette(city:CityId,type:string){return colours[city][type]}
/** Small owned tiling surfaces: no downloaded images or per-frame texture work. */
export function roomTexture(kind:'wood'|'tile'|'paper',palette:RoomPalette,seed:number){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d')!;let value=seed+1;const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296}
 x.fillStyle=kind==='paper'?'#fff7e5':palette.floor;x.fillRect(0,0,256,256)
 if(kind==='wood'){
  for(let row=0;row<4;row++){x.fillStyle=`rgba(95,58,30,${.035+random()*.07})`;x.fillRect(0,row*64,256,64);x.fillStyle='rgba(65,45,28,.22)';x.fillRect(0,row*64,256,2);const joint=(row%2)*128+50;x.fillRect(joint,row*64,2,64);for(let grain=0;grain<9;grain++){x.strokeStyle=`rgba(100,65,35,${.025+random()*.06})`;x.beginPath();const y=row*64+5+random()*54;x.moveTo(0,y);x.bezierCurveTo(80,y+random()*4,180,y-random()*4,256,y);x.stroke()}}
 }else if(kind==='tile'){
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){x.fillStyle=`rgba(${(i+j)%2?'255,248,225':'90,83,62'},${.04+random()*.07})`;x.fillRect(i*64+2,j*64+2,60,60)}x.fillStyle='rgba(80,78,64,.22)';for(let i=0;i<=4;i++){x.fillRect(i*64,0,2,256);x.fillRect(0,i*64,256,2)}
 }else{for(let i=0;i<16;i++){x.fillStyle='rgba(161,128,93,.08)';x.fillRect(i*16,0,2,256)}for(let i=0;i<40;i++){x.fillStyle='rgba(147,112,73,.045)';x.beginPath();x.arc(random()*256,random()*256,1+random()*2,0,Math.PI*2);x.fill()}}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;return texture
}
