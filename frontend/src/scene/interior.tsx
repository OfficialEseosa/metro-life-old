import { useEffect, useMemo } from 'react'
import { roomType } from '../navigation'
import * as THREE from 'three'
import { useStore } from '../store'
import { Builder } from './geometry'
/** One shared, vertex-coloured cutaway home; furniture is built once into one draw. */
export function Interior({room}:{room:string}){
 const type=roomType(room),world=useStore(s=>s.world),city=useStore(s=>s.city),name=world?.cities.find(c=>c.id===city)?.landmarks.find(l=>l.id===room.split(':')[1])?.name??'Welcome home'
 const sign=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle=type==='club'?'#3d285b':type==='cafe'?'#774b32':'#315b63';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#fff0ce';ctx.font='bold 52px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,512,66,980);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t},[name,type]);useEffect(()=>()=>sign.dispose(),[sign])
 const geometry=useMemo(()=>{const b=new Builder();
  // The room sits in its own small garden and street apron, rather than a void.
  b.box(0,-.4,0,38,.12,34,'#9bbd83');b.box(0,-.31,10,38,.05,3,'#bcc3af');b.box(0,-.32,13.5,38,.05,4,'#53676d');for(const x of [-11,-7,7,11]){b.cylinder(x,.9,-9,.12,2.2,'#876c4d',6);b.sphere(x,2.2,-9,.95,'#5e966b',1,1.2,1);}
  const floor=type==='work'?'#b9cbd1':type==='cafe'?'#bd7c57':type==='club'?'#202839':'#d5b792',wall=type==='work'?'#d2e0e4':type==='cafe'?'#f2dcb8':type==='club'?'#252b45':'#f1dfc1',side=type==='work'?'#9fb7c2':type==='cafe'?'#467b72':type==='club'?'#37304c':'#e8d3b5';
  b.box(0,-.14,0,12,.24,10,floor);
  if(type==='home')for(let x=-5.5;x<6;x+=.6)b.box(x,-.012,0,.018,.012,10,'#b99a77');
  else if(type!=='club'){for(let x=-5;x<6;x+=1)b.box(x,-.012,0,.02,.012,10,type==='cafe'?'#d9aa7c':'#8ba5b0');for(let z=-4;z<5;z+=1)b.box(0,-.012,z,12,.012,.02,type==='cafe'?'#d9aa7c':'#8ba5b0');}
  b.box(0,1.65,-5,12,3.3,.18,wall);b.box(-6,1.65,0,.18,3.3,10,side);b.box(6,.65,0,.18,1.3,10,side);
  for(const x of [-3.6,3.6])b.box(x,.35,5,4.8,.7,.18,wall);
  for(const x of [-.75,.75])b.box(x,.35,4.95,.12,.7,.18,'#528b79');b.box(0,.025,4.6,1.4,.04,.8,'#528b79');
  if(type==='home'){b.box(0,.015,-.15,3.3,.025,4.4,'#518f8b');for(const x of [-1.4,1.4])b.box(x,.034,-.15,.1,.02,4.1,'#f1d8ad');}
  if(type==='cafe'){
   b.box(-4.5,.55,-1.8,1.4,1.1,4,'#b27b53');b.box(-4.5,1.16,-1.8,1.6,.12,4.2,'#e4d8b8');b.box(-4.5,1.48,-3.2,.9,.6,.6,'#456a70');b.cylinder(-4.5,1.82,-3.2,.2,.12,'#e5c487',12);
   for(const [x,z] of [[2.2,.3],[3.8,-2.9]]){b.cylinder(x,.58,z,.11,1.1,'#765c47',8);b.box(x,1.15,z,1.5,.14,1.3,'#ba8b60');b.cylinder(x,1.26,z,.35,.04,'#f5ebd5',16);b.sphere(x,1.34,z,.23,'#d59b4f',1,.3,1);b.box(x,.45,z+1.3,.65,.12,.6,'#54827d');for(const dx of [-.24,.24])for(const dz of [-.2,.2])b.box(x+dx,.21,z+1.3+dz,.07,.42,.07,'#365b59');b.box(x,.8,z+1.56,.65,.65,.09,'#54827d');}
   b.box(0,2.1,-4.82,2.4,1.4,.08,'#335d50');for(let i=0;i<4;i++)b.box(0,1.65+i*.28,-4.74,1.7,.05,.02,'#e9d8aa');b.box(4.8,2,-4.83,1.2,1.5,.08,'#86bec6');
   return b.build()
  }
  if(type==='club'){
   b.box(0,.08,0,5,.12,4.6,'#8f6aab');for(const x of [-1.6,0,1.6])for(const z of [-1.6,0,1.6])b.box(x,.15,z,1.4,.02,1.4,(x+z)%3?'#ba8bab':'#7297a7');
   b.box(0,.18,-3.5,7,.35,2.4,'#655271');b.box(0,1.95,-4.82,6.7,2.5,.1,'#8e4f72');for(const x of [-3.2,3.2])b.box(x,1.95,-4.7,.25,2.6,.1,'#c89162');
   for(const x of [-4.6,4.6]){b.box(x,.85,-3.8,1.3,1.7,1.2,'#34434c');for(const y of [.45,1.2])b.sphere(x,y,-3.15,.34,'#172e36',1,1,.15);}
   b.cylinder(.9,1,-2.9,.04,1.7,'#7f969a',8);b.sphere(.9,1.86,-2.9,.12,'#d9dbcd',1.5,.7,.7);b.box(-4.5,.62,.4,1.5,1.2,3,'#bd855b');b.box(-4.5,1.27,.4,1.65,.1,3.1,'#e3c99a');
   b.box(0,3.7,-2.3,7.5,.1,.14,'#252e3c');for(const x of [-3.6,3.6])b.line([x,3.3,-4.9],[x,3.7,-2.3],.025,'#667887');for(const x of [-2.6,0,2.6]){b.cylinder(x,3.5,-2.3,.18,.3,'#293442',8);b.cylinder(x,3.33,-2.3,.14,.04,x===0?'#68d5dc':'#e57eae',8);}
   return b.build()
  }
  if(type==='work'){
   b.box(0,.82,-2.2,2.8,.16,1,'#966e50');for(const x of [-1.2,1.2])b.box(x,.4,-2.2,.12,.8,.75,'#3f5b59');b.box(0,1.35,-2.4,1.15,.65,.09,'#354a4c');b.box(0,1.36,-2.34,1,.5,.02,'#84c8ce');b.box(0,.95,-1.93,.9,.04,.28,'#dde7dc');b.sphere(0,.48,.4,.5,'#536e71',.75,.14,.7);b.box(-4.7,1.2,-3.8,1.2,2.4,1.4,'#9d7659');for(const y of [.4,1.1,1.8])b.box(-4.68,y,-3.07,1.1,.08,.04,'#d8c5a3');b.cylinder(4.5,.5,-3.7,.65,1,'#d3aa7b',10);b.sphere(4.5,1.6,-3.7,.9,'#4c8868',.65,1.3,.65);b.box(2.8,1.8,-4.83,2.2,1.4,.1,'#487e80');for(let i=0;i<3;i++)b.box(2.8,1.4+i*.4,-4.75,1.6,.06,.02,'#e3e5cb');
   for(const x of [-3.5,3.5]){b.box(x,.85,.1,2,.15,1,'#e4d8bf');for(const dx of [-.8,.8])b.box(x+dx,.4,.1,.1,.8,.8,'#4a656d');b.box(x,1.35,-.15,.8,.5,.1,'#345b67');b.box(x,1.35,-.09,.7,.4,.02,'#80bcc6');}
   b.cylinder(0,.25,.4,.065,.4,'#354b54',8);b.box(0,.065,.4,.7,.07,.08,'#354b54');b.box(0,.065,.4,.08,.07,.7,'#354b54');b.sphere(0,.88,.7,.5,'#536e71',.72,.7,.14);
   return b.build()
  }
  // Bed: timber frame, mattress, blanket, pillow and headboard.
  b.box(3.7,.28,-2.4,3.2,.45,1.9,'#8e6345');b.box(3.7,.62,-2.4,3.1,.28,1.8,'#f4ead7');b.box(3.25,.81,-2.4,2.1,.12,1.78,'#d88d67');b.box(4.77,.85,-2.4,.65,.2,1.45,'#fff7e8');b.box(5.25,.87,-2.4,.14,1.4,2,'#8e6345');
  // Stove and oven, with four burners and a pot.
  b.box(-4.4,.52,.1,1.3,1,2,'#f1dfb8');b.box(-4.4,1.08,.1,1.4,.12,2.1,'#39484b');b.box(-3.73,.55,.1,.03,.55,1.45,'#263e45');b.box(-3.68,.91,.1,.08,.06,1.35,'#d4c7a8');
  for(const x of [-4.75,-4.12])for(const z of [-.45,.65])b.cylinder(x,1.16,z,.22,.04,'#192d34',12);b.cylinder(-4.15,1.35,.65,.25,.32,'#ba8e57',12);b.box(-4.15,1.53,.65,.6,.04,.6,'#e4c38a');
  // Walk-up shower, tiled tray and overhead rose.
  b.box(-4.4,.08,-2.9,1.4,.16,1.8,'#e3f1ed');b.box(-5.13,1.45,-2.9,.08,2.8,1.8,'#a5ced1');b.box(-4.4,1.45,-3.84,1.4,2.8,.08,'#c0dedc');b.cylinder(-4.4,1.65,-3.7,.035,2.1,'#668c96',8);b.box(-4.4,2.75,-3.35,.58,.08,.68,'#74959b');
  // Soft couch, side table and reading lamp.
  b.box(3.8,.42,1.1,1.4,.6,2.4,'#bd7d63');b.box(4.45,.93,1.1,.26,1.2,2.5,'#a96e59');for(const z of [-.14,2.34])b.box(3.8,.85,z,1.5,.7,.24,'#a96e59');for(const z of [.5,1.7])b.box(3.7,.77,z,1.1,.15,1,'#d9a080');b.cylinder(4.7,.48,3.4,.55,.85,'#93684c',12);b.cylinder(4.7,1.25,3.4,.05,.8,'#495853',8);b.cylinder(4.7,1.8,3.4,.35,.45,'#efc780',12);
  // A window and small original geometric print.
  b.box(-1.8,2.1,-4.87,2.7,1.4,.08,'#79b8c4');for(const x of [-3.2,-1.8,-.4])b.box(x,2.1,-4.8,.09,1.55,.1,'#fff2d9');b.box(-1.8,2.1,-4.77,2.9,.09,.1,'#fff2d9');b.box(2,2.05,-4.83,1.6,1.3,.1,'#876443');b.box(2,2.05,-4.75,1.4,1.1,.03,'#ecc78d');b.box(2,2.05,-4.72,.5,.65,.03,'#518f8b');
  return b.build()
 },[type])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return <>{type!=='home'&&<mesh position={[0,2.9,-4.83]}><planeGeometry args={[5.4,.675]}/><meshBasicMaterial map={sign} toneMapped={false}/></mesh>}<mesh name={`${type}-interior`} geometry={geometry}><meshStandardMaterial vertexColors roughness={.9}/></mesh><pointLight position={[0,5,0]} intensity={type==='club'?8:25} color={type==='work'?'#e4f3ff':'#ffe4bc'} distance={22} decay={2}/>{type==='club'&&<><pointLight position={[-2.6,3.1,-2.3]} intensity={55} color="#f568be" distance={14}/><pointLight position={[2.6,3.1,-2.3]} intensity={55} color="#55c9ed" distance={14}/></>}</>
}
