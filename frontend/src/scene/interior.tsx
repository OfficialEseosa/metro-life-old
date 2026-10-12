import { useEffect, useMemo } from 'react'
import { Builder } from './geometry'
/** One shared, vertex-coloured cutaway home; furniture is built once into one draw. */
export function Interior(){
 const geometry=useMemo(()=>{const b=new Builder();
  b.box(0,-.14,0,12,.24,10,'#d5b792');for(let x=-5.5;x<6;x+=.6)b.box(x,-.012,0,.018,.012,10,'#b99a77');
  b.box(0,1.65,-5,12,3.3,.18,'#f1dfc1');b.box(-6,1.65,0,.18,3.3,10,'#e8d3b5');b.box(6,.65,0,.18,1.3,10,'#e8d3b5');
  for(const x of [-3.6,3.6])b.box(x,.35,5,4.8,.7,.18,'#f1dfc1');
  for(const x of [-.75,.75])b.box(x,.35,4.95,.12,.7,.18,'#528b79');b.box(0,.025,4.6,1.4,.04,.8,'#528b79');
  b.box(0,.015,-.15,3.3,.025,4.4,'#518f8b');for(const x of [-1.4,1.4])b.box(x,.034,-.15,.1,.02,4.1,'#f1d8ad');
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
 },[])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return <><mesh name="home-interior" geometry={geometry}><meshStandardMaterial vertexColors roughness={.9}/></mesh><pointLight position={[0,5,0]} intensity={25} color="#ffe4bc" distance={22} decay={2}/></>
}
