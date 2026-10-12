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
  const hw=type==='home'?3.5:6,hd=type==='home'?3:5;b.box(0,-.14,0,hw*2,.24,hd*2,floor);
  if(type==='home')for(let x=-3.2;x<3.5;x+=.6)b.box(x,-.012,0,.018,.012,6,'#b99a77');
  else if(type!=='club'){for(let x=-5;x<6;x+=1)b.box(x,-.012,0,.02,.012,10,type==='cafe'?'#d9aa7c':'#8ba5b0');for(let z=-4;z<5;z+=1)b.box(0,-.012,z,12,.012,.02,type==='cafe'?'#d9aa7c':'#8ba5b0');}
  b.box(0,1.65,-hd,hw*2,3.3,.18,wall);b.box(-hw,1.65,0,.18,3.3,hd*2,side);b.box(hw,.65,0,.18,1.3,hd*2,side);
  for(const x of [-1,1])b.box(x*(.75+(hw-.75)/2),.35,hd,hw-.75,.7,.18,wall);
  for(const x of [-.75,.75])b.box(x,.35,hd-.05,.12,.7,.18,'#528b79');b.box(0,.025,hd-.4,1.4,.04,.8,'#528b79');
  if(type==='home'){b.box(0,.015,-.15,1.8,.025,2.7,'#518f8b');for(const x of [-.8,.8])b.box(x,.034,-.15,.07,.02,2.5,'#f1d8ad');}
  if(type==='cafe'){
   b.box(-4.5,.41,-1.8,1.4,.82,4,'#b27b53');b.box(-4.5,.86,-1.8,1.6,.08,4.2,'#e4d8b8');b.box(-4.5,1.48,-3.2,.9,.6,.6,'#456a70');b.cylinder(-4.5,1.82,-3.2,.2,.12,'#e5c487',12);
   for(const [x,z] of [[2.2,.3],[3.8,-2.9]]){b.cylinder(x,.34,z,.08,.68,'#765c47',8);b.box(x,.715,z,1.5,.07,1.3,'#ba8b60');b.cylinder(x,.77,z,.3,.03,'#f5ebd5',16);b.sphere(x,.84,z,.2,'#d59b4f',1,.3,1);b.box(x,.39,z+1.3,.65,.12,.6,'#54827d');for(const dx of [-.24,.24])for(const dz of [-.2,.2])b.box(x+dx,.21,z+1.3+dz,.07,.42,.07,'#365b59');b.box(x,.8,z+1.56,.65,.65,.09,'#54827d');}
   b.box(0,2.1,-4.82,2.4,1.4,.08,'#335d50');for(let i=0;i<4;i++)b.box(0,1.65+i*.28,-4.74,1.7,.05,.02,'#e9d8aa');b.box(4.8,2,-4.83,1.2,1.5,.08,'#86bec6');
   return b.build()
  }
  if(type==='club'){
   b.box(0,.08,0,5,.12,4.6,'#8f6aab');for(const x of [-1.6,0,1.6])for(const z of [-1.6,0,1.6])b.box(x,.15,z,1.4,.02,1.4,(x+z)%3?'#ba8bab':'#7297a7');
   b.box(0,.18,-3.5,7,.35,2.4,'#655271');b.box(0,1.95,-4.82,6.7,2.5,.1,'#8e4f72');for(const x of [-3.2,3.2])b.box(x,1.95,-4.7,.25,2.6,.1,'#c89162');
   for(const x of [-4.6,4.6]){b.box(x,.85,-3.8,1.3,1.7,1.2,'#34434c');for(const y of [.45,1.2])b.sphere(x,y,-3.15,.34,'#172e36',1,1,.15);}
   b.cylinder(.9,1,-2.9,.04,1.7,'#7f969a',8);b.sphere(.9,1.86,-2.9,.12,'#d9dbcd',1.5,.7,.7);b.box(-4.5,.41,.4,1.5,.82,3,'#bd855b');b.box(-4.5,.86,.4,1.65,.08,3.1,'#e3c99a');
   b.box(0,3.7,-2.3,7.5,.1,.14,'#252e3c');for(const x of [-3.6,3.6])b.line([x,3.3,-4.9],[x,3.7,-2.3],.025,'#667887');for(const x of [-2.6,0,2.6]){b.cylinder(x,3.5,-2.3,.18,.3,'#293442',8);b.cylinder(x,3.33,-2.3,.14,.04,x===0?'#68d5dc':'#e57eae',8);}
   return b.build()
  }
  if(type==='work'){
   b.box(0,.71,-2.2,2,.08,.8,'#966e50');for(const x of [-1.2,1.2])b.box(x,.335,-2.2,.08,.67,.65,'#3f5b59');b.box(0,1.04,-2.4,.95,.55,.07,'#354a4c');b.box(0,1.04,-2.35,.85,.45,.02,'#84c8ce');b.box(0,.77,-1.93,.7,.03,.24,'#dde7dc');b.sphere(0,.38,.4,.5,'#536e71',.75,.14,.7);b.box(-4.7,1.2,-3.8,1.2,2.4,1.4,'#9d7659');for(const y of [.4,1.1,1.8])b.box(-4.68,y,-3.07,1.1,.08,.04,'#d8c5a3');b.cylinder(4.5,.5,-3.7,.65,1,'#d3aa7b',10);b.sphere(4.5,1.6,-3.7,.9,'#4c8868',.65,1.3,.65);b.box(2.8,1.8,-4.83,2.2,1.4,.1,'#487e80');for(let i=0;i<3;i++)b.box(2.8,1.4+i*.4,-4.75,1.6,.06,.02,'#e3e5cb');
   for(const x of [-3.5,3.5]){b.box(x,.71,.1,2,.08,.8,'#e4d8bf');for(const dx of [-.8,.8])b.box(x+dx,.335,.1,.1,.67,.7,'#4a656d');b.box(x,1.03,-.15,.8,.5,.1,'#345b67');b.box(x,1.03,-.09,.7,.4,.02,'#80bcc6');}
   b.cylinder(0,.25,.4,.065,.4,'#354b54',8);b.box(0,.065,.4,.7,.07,.08,'#354b54');b.box(0,.065,.4,.08,.07,.7,'#354b54');b.sphere(0,.88,.7,.5,'#536e71',.72,.7,.14);
   return b.build()
  }
  // A 7 x 6 metre starter studio, with only the essentials.
  b.box(2.25,.2,-1.65,2,.35,1.5,'#8e6345');b.box(2.25,.47,-1.65,1.96,.2,1.46,'#f4ead7');b.box(2.0,.61,-1.65,1.35,.08,1.43,'#d88d67');b.box(2.9,.63,-1.65,.45,.15,1.15,'#fff7e8');b.box(3.25,.65,-1.65,.1,1.1,1.6,'#8e6345');
  b.box(-2.7,.41,.1,.9,.82,1.1,'#f1dfb8');b.box(-2.7,.86,.1,1,.08,1.2,'#39484b');b.box(-2.23,.45,.1,.03,.5,.8,'#263e45');for(const z of [-.18,.38])b.cylinder(-2.7,.92,z,.18,.025,'#192d34',12);b.cylinder(-2.7,1.05,.38,.2,.24,'#ba8e57',12);
  b.box(-2.7,.08,-1.9,1.1,.16,1.7,'#e3f1ed');b.box(-3.3,1.2,-1.9,.08,2.4,1.7,'#a5ced1');b.box(-2.7,1.2,-2.8,1.1,2.4,.08,'#c0dedc');b.cylinder(-2.7,1.65,-2.65,.035,2.1,'#668c96',8);b.box(-2.7,2.35,-2.3,.58,.08,.68,'#74959b');
  b.box(2.5,.4,1,.65,.1,.65,'#bd7d63');b.box(2.8,.75,1,.1,.7,.65,'#a96e59');for(const x of [2.25,2.75])for(const z of [.75,1.25])b.box(x,.2,z,.06,.4,.06,'#93684c');
  b.box(-.7,2.1,-2.87,1.5,1.4,.08,'#79b8c4');for(const x of [-1.5,-.7,.1])b.box(x,2.1,-2.8,.07,1.55,.1,'#fff2d9');b.box(-.7,2.1,-2.77,1.7,.07,.1,'#fff2d9');
  return b.build()
 },[type])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return <>{type!=='home'&&<mesh position={[0,2.9,-4.83]}><planeGeometry args={[5.4,.675]}/><meshBasicMaterial map={sign} toneMapped={false}/></mesh>}<mesh name={`${type}-interior`} geometry={geometry}><meshStandardMaterial vertexColors roughness={.9}/></mesh><pointLight position={[0,5,0]} intensity={type==='club'?8:25} color={type==='work'?'#e4f3ff':'#ffe4bc'} distance={22} decay={2}/>{type==='club'&&<><pointLight position={[-2.6,3.1,-2.3]} intensity={55} color="#f568be" distance={14}/><pointLight position={[2.6,3.1,-2.3]} intensity={55} color="#55c9ed" distance={14}/></>}</>
}
