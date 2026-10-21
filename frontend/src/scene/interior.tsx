import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { roomLayout, roomType } from '../navigation'
import { useStore } from '../store'
import { Builder } from './geometry'
import { bakeContact } from './baked-contact'
import { useNightLighting } from '../lighting'
import { roomPalette, roomTexture } from './room-surfaces'
import { RoomWalls, WallMounted } from './room-walls'
import { RoomStaff } from './room-staff'
import { FurnishedHome } from './furnished-home'

/** Room-specific furniture, collisions and use points come from one authored layout. */
export function Interior({room}:{room:string}){return roomType(room)==='home'?<FurnishedHome/>:<PublicInterior room={room}/>}
function PublicInterior({room}:{room:string}){
 const night=useNightLighting(),type=roomType(room)!,world=useStore(s=>s.world),city=useStore(s=>s.city),layout=roomLayout(city,type),palette=roomPalette(city,type),hw=(layout.bounds?.w??12)/2,hd=(layout.bounds?.d??10)/2,height=layout.height??3,windowed=['work','cafe','hospital','airport'].includes(type)
 const name=world?.cities.find(c=>c.id===city)?.landmarks.find(l=>l.id===room.split(':')[1])?.name??'Welcome home'
 const surfaces=useMemo(()=>({floor:roomTexture(['cafe','foodhall','hospital','airport','museum','arena','stadium'].includes(type)?'tile':'wood',palette,city.length+type.length),paper:roomTexture('paper',palette,city.charCodeAt(0))}),[type,palette,city])
 useEffect(()=>()=>{surfaces.floor.dispose();surfaces.paper.dispose()},[surfaces])
 const signs=useMemo(()=>[{text:name,x:0,y:Math.min(height-.3,3.4),z:-hd+.13},...(layout.labels??[])].map(row=>{const c=document.createElement('canvas');c.width=1024;c.height=128;const x=c.getContext('2d')!;x.fillStyle=palette.accent;x.fillRect(0,0,1024,128);x.fillStyle='#fff1d9';x.font='bold 48px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(row.text,512,64,980);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return {...row,texture}}),[layout.labels,name,palette,hd,height])
 useEffect(()=>()=>signs.forEach(s=>s.texture.dispose()),[signs])
 const built=useMemo(()=>{
  const b=new Builder(),glass=new Builder(),glow=new Builder(),back=new Builder(),front=new Builder(),wallglow=new Builder()
  const chair=(x:number,z:number,face:number,width=.65,baseY=0)=>{const c=new Builder();c.box(0,.405,0,width,.09,.65,palette.fabric);c.box(0,.76,-.29,width,.65,.08,palette.fabric);for(const dx of [-width*.38,width*.38])for(const dz of [-.25,.25])c.box(dx,.2,dz,.065,.4,.065,palette.wood);const g=c.build();g.rotateY(face);const colour=g.getAttribute('color').clone();b.add(g,'#ffffff',x,baseY,z);b.parts.at(-1)!.setAttribute('color',colour)}
  const plant=(x:number,z:number,size=1)=>{b.cylinder(x,.22,z,.24*size,.44,palette.fabric,8,.32*size);b.cylinder(x,.8*size,z,.035,1.2*size,'#67845a',6);for(let i=0;i<5;i++){const a=i*2.4;b.sphere(x+Math.sin(a)*.2*size,(.7+i*.12)*size,z+Math.cos(a)*.2*size,.27*size,'#68916b',.6,1,.6)}}
  const shape=new THREE.Shape();(layout.floor??[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]]).forEach((p,i)=>i?shape.lineTo(p[0],-p[1]):shape.moveTo(p[0],-p[1]));shape.closePath();const slab=new THREE.ExtrudeGeometry(shape,{depth:.25,bevelEnabled:false,steps:1});slab.rotateX(-Math.PI/2);b.add(slab,palette.floor,0,-.27,0)
  if(!['stadium','arena','foodhall','museum','hospital','airport'].includes(type))b.box(0,.012,.5,hw*.75,.024,hd*.72,palette.accent)
  for(const x of [-.77,.77])front.box(x,1.05,hd-.04,.1,2.1,.2,palette.trim);front.box(0,2.15,hd-.04,1.64,.1,.2,palette.trim)
  if(windowed){for(const x of [-1.6,.2])back.box(x,1.85,-hd+.1,.08,1.4,.13,palette.trim);for(const y of [1.17,1.85,2.53])back.box(-.7,y,-hd+.1,1.85,.07,.13,palette.trim)}
  for(const f of layout.furniture){const {x,z}=f
   if(f.kind==='bed'){
    b.box(x,.2,z,2,.35,1.5,palette.wood);b.box(x,.48,z,1.96,.2,1.46,'#f6edd9');const direction=f.angle?-1:1
    b.box(x-direction*.25,.79,z,1.36,.16,1.44,palette.fabric);b.box(x+direction*.68,.67,z,.46,.19,1.16,'#fff5e2');b.box(x+direction*.98,.62,z,.1,1.05,1.6,palette.wood)
   }else if(f.kind==='chair')chair(x,z,f.angle,f.w,(f as typeof f&{baseY?:number}).baseY??0)
   else if(f.kind==='bench')chair(x,z,Math.PI,f.w)
   else if(f.kind==='stove'){
    b.box(x,.41,z,.9,.82,1.1,palette.trim);b.box(x,.86,z,1,.08,1.2,'#435354');b.box(x+(x>0?-.46:.46),.45,z,.035,.5,.75,'#34494b');for(const dz of [-.28,.28])b.cylinder(x,.915,z+dz,.18,.025,'#24363a',12);b.cylinder(x,1.04,z+.28,.2,.22,palette.wood,12)
   }else if(f.kind==='shower'){
    b.box(x,.08,z,1.1,.16,1.5,'#e8f0e7');b.box(x,1.2,z-.75,1.1,2.4,.08,palette.accent);b.cylinder(x,1.3,z-.65,.035,2.1,'#7f9799',8);b.box(x,2.3,z-.35,.5,.07,.55,'#8da2a0')
    glass.box(x,1.1,z+.72,1.1,2.2,.035,'#b8d6d1');for(const dx of [-.55,.55])glass.box(x+dx,1.1,z,.035,2.2,1.5,'#b8d6d1')
   }else if(f.kind==='desk'){
    b.box(x,.715,z,f.w,.07,f.d,palette.wood);for(const dx of [-f.w*.425,f.w*.425])b.box(x+dx,.35,z,.08,.7,.68,palette.accent)
    b.box(x,1.04,z-.18,.9,.55,.07,'#32494e');glow.box(x,1.04,z-.135,.79,.44,.012,'#a8d9d8');b.box(x,.77,z+.22,.7,.035,.24,palette.trim);b.box(x+.58,.78,z+.22,.12,.04,.2,'#557176');chair(x,z+.9,Math.PI);b.cylinder(x-.72,.84,z,.1,.16,palette.fabric,10)
   }else if(f.kind==='table'){
    b.cylinder(x,.35,z,.08,.7,palette.wood,8);b.box(x,.715,z,f.w,.07,f.d,palette.wood);b.cylinder(x,.77,z+.2,.29,.025,'#fff0d5',16);b.sphere(x,.82,z+.2,.18,'#ca9154',1,.25,1);b.cylinder(x-.4,.83,z-.25,.075,.15,palette.trim,10);chair(x,z+f.d/2+.5,Math.PI)
   }else if(f.kind==='counter'||f.kind==='stall'){
    b.box(x,.425,z,f.w,.85,f.d,palette.wood);b.box(x,.895,z,f.w+.15,.09,f.d+.1,palette.trim);b.box(x+.25,1.1,z-.15,.4,.35,.32,palette.accent);b.box(x+.25,1.3,z-.15,.48,.05,.38,'#435354')
    if(f.kind==='stall'){
     for(const dx of [-f.w/2,f.w/2])b.box(x+dx,1.9,z,.08,2.05,.08,palette.accent)
     b.box(x,2.92,z,f.w+.2,.15,1.4,palette.accent);for(let i=-2;i<=2;i++)b.box(x+i*.55,3.0,z,.25,.07,1.4,palette.trim)
     for(const dx of [-.6,.1,.8]){b.cylinder(x+dx,.98,z+.2,.23,.07,'#f1d49d',12);b.sphere(x+dx,1.05,z+.2,.16,'#bd7955',1,.5,1)}
    }
   }else if(f.kind==='shelf'){
    for(const dx of [-.6,.6])b.box(x+dx,1.2,z,.08,2.4,.7,palette.wood);for(const y of [.2,.8,1.4,2]){b.box(x,y,z,1.2,.08,.7,palette.wood);for(let i=0;i<4;i++)b.box(x-.42+i*.22,y+.19,z,.13,.3,.35,i%2?palette.accent:palette.fabric)}
   }else if(f.kind==='plant')plant(x,z,1.2)
   else if(f.kind==='dance'){b.box(x,.06,z,f.w,.12,f.d,palette.fabric);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)glow.box(x+i*1.45,.124,z+j*1.15,1.3,.006,1.02,(i+j)%2?'#e3a8cd':'#91d6d4')}
   else if(f.kind==='stage'){
    b.box(x,.18,z,f.w,.36,f.d,palette.wood);for(const dx of [-2.8,2.8]){b.box(x+dx,.92,z-.5,.75,1.1,.65,'#34464d');for(const y of [.65,1.05])b.sphere(x+dx,y,z-.16,.22,'#263038',1,1,.1)}b.cylinder(x+.8,1.2,z+.5,.025,1.7,'#a6b2ac',8);b.sphere(x+.8,2.05,z+.5,.08,palette.trim,1.5,.8,1)
   }else if(f.kind==='stadium'||f.kind==='arena'){
    b.box(x,.035,z,f.w,.07,f.d,f.kind==='stadium'?'#548a61':'#d1a66e');b.box(x,.05,z,.04,.02,f.d-.15,'#f4f0d6')
    for(const dx of [-f.w/2+.12,f.w/2-.12])b.box(x+dx,.06,z,.05,.025,f.d-.1,'#f4f0d6');for(const dz of [-f.d/2+.1,f.d/2-.1])b.box(x,.06,z+dz,f.w-.15,.025,.04,'#f4f0d6')
    if(f.kind==='stadium'){for(let i=-3;i<=3;i++)b.box(x+i*.85,.06,z,.035,.02,f.d-.25,'#e6f0d5');for(const dx of [-3.1,3.1]){b.cylinder(x+dx,1,z,.035,1.9,'#eecb78',8);b.box(x+dx,1.4,z,.05,.06,1.2,'#eecb78')}}
    else{b.torus(x,.075,z,.65,.025,'#faf2d5',Math.PI/2);for(const dx of [-2.9,2.9]){b.box(x+dx,.7,z,.07,1.4,.07,palette.accent);b.box(x+dx,1.5,z,.08,.7,.9,'#dbe6dc');b.torus(x+dx*.89,1.22,z,.21,.035,'#d37f51',Math.PI/2)}}
   }else if(f.kind==='stands'){
    for(let row=0;row<2;row++){const zz=z-.6+row*.65;b.box(x,.13+row*.1,zz,f.w,.26+row*.2,.6,'#b8c7c4');for(let col=-3;col<=3;col++){b.box(x+col*.7,.35+row*.1,zz,.5,.09,.47,palette.fabric);b.box(x+col*.7,.55+row*.1,zz+.2,.5,.38,.07,palette.fabric)}}
    for(const dx of [-f.w/2,f.w/2]){b.cylinder(x+dx,.58,z,.035,1.16,palette.trim,6);b.box(x+dx,1.12,z,.05,.05,f.d,palette.trim)}
   }else if(f.kind==='gallery'){
    for(let i=-1;i<=1;i++){const xx=x+i*f.w/3;back.box(xx,1.8,z,2,.15,.18,palette.wood);back.box(xx,1.85,z,1.8,1.45,.13,palette.wood);back.box(xx,1.85,z+.08,1.59,1.24,.04,['#d49e7d','#688b9c','#d3b66e'][i+1]);back.sphere(xx-.28,2.04,z+.12,.3,'#f3dfae',1,1,.1);back.box(xx+.25,1.64,z+.12,.65,.6,.03,palette.accent);back.box(xx,1.03,z+.03,.65,.1,.04,palette.trim)}
   }else if(f.kind==='games'){
    b.box(x,.5,z,.9,1,1,'#617a8c');b.box(x,1.4,z-.15,.9,.8,.7,palette.accent);glow.box(x,1.45,z+.22,.67,.5,.02,'#a8d9bd');b.box(x,1.04,z+.33,.9,.12,.5,palette.trim);for(const dx of [-.2,.2])b.cylinder(x+dx,1.13,z+.4,.04,.1,palette.fabric,6)
   }
  }
  if(['cafe','hospital','airport','work','pavilion'].includes(type))plant(hw-.7,hd-1.1,city==='bay'?1.15:.85)
  if(city==='nyc'&&type==='home'){b.box(-hw+.5,1.1,-hd+.5,.65,2.2,.6,palette.wood);for(let i=0;i<7;i++)b.box(-hw+.5,.5+i*.23,-hd+.15,.48,.15,.3,i%2?palette.accent:palette.fabric)}
  if(city==='bay'&&['cafe','work','pavilion'].includes(type))plant(-hw+.7,hd-1.1,1)
  if(city==='atl'&&type==='home'){back.box(1.7,1.9,-hd+.13,.9,1,.06,palette.wood);back.box(1.7,1.9,-hd+.17,.75,.85,.025,palette.fabric)}
  if(type==='theatre'){
   const stage=layout.furniture.find(f=>f.kind==='stage')!,backZ=-hd+.3
   // A proper tall proscenium, folded velvet curtains and a stepped audience rake.
   back.box(0,height-.3,stage.z,hw*1.7,.35,2.6,'#252d45');back.box(0,height/2,backZ,hw*1.55,height,.14,'#26334d')
   for(const side of [-1,1]){back.box(side*hw*.65,2.2,stage.z,.32,4.4,.6,'#d2ac68');for(let i=0;i<6;i++)back.cylinder(side*(hw*.47+i*.18),2.2,stage.z-.25,.16,4.2,i%2?'#862c49':'#a04457',8)}
   back.box(0,4.45,stage.z,hw*1.4,.6,.4,'#9c3e54');back.box(0,4.8,stage.z,hw*1.5,.13,.6,'#d8ba7b')
   for(let row=0;row<2;row++){const seat=layout.furniture.find(f=>f.id===`seat-${row}-0`);if(seat)b.box(0,(.12+row*.28)/2,seat.z,hw*.8,.12+row*.28,1.1,'#604b5a')}
   for(let i=0;i<60;i++){const x=Math.sin(i*7.17)*hw*.55,z=backZ+.1+((i*37)%100)/100*2;wallglow.sphere(x,height-.5,z,.025,'#f8e6b6',1,.6,1)}
  }
  if(type==='foodhall'){
   for(const x of [-hw*.75,-hw*.25,hw*.25,hw*.75]){back.box(x,height/2,-hd+.2,.16,height,.24,'#ae7950');back.box(x,height-.2,-hd/2,.16,.25,hd,'#ae7950');glow.box(x,height-.5,-hd/2,.8,.07,.2,'#ffe1a2')}
   for(const x of [-hw*.6,0,hw*.6])b.box(x,.012,0,.045,.018,hd*1.65,'#b6ad96')
   for(let i=0;i<8;i++)back.box(-hw+.7+i*(hw*2-1.4)/7,2.8,-hd+.12,.85,1.6,.04,i%2?'#b4d2cd':'#d9e6db')
  }
  if(type==='arena'||type==='stadium'){
   // The public floor opens into an octagonal bowl, with terraced seats around the playing area.
   for(const side of [-1,1])for(let row=0;row<4;row++){
    const xx=side*(hw-1.6+row*.3),yy=.25+row*.38
    b.box(xx,yy/2,-1.0,.4,yy,hd*1.2,'#929f9d')
    for(let j=0;j<9;j++)b.box(xx,yy+.12,-hd*.6+j*hd*.13,.4,.22,.55,palette.fabric)
   }
   for(let row=0;row<4;row++){const zz=-hd+.4+row*.42,yy=1.45-row*.3;b.box(0,yy/2,zz,hw*1.45,yy,.4,'#9aa5a2');for(let col=-7;col<=7;col++)b.box(col*.7,yy+.1,zz,.5,.2,.32,palette.fabric)}
   back.box(0,height-1.1,-hd+.25,4.6,1.6,.3,'#243942');glow.box(0,height-1.1,-hd+.43,4.2,1.2,.035,'#b3d7bb');back.text(0,height-1.1,-hd+.46,'HOME',.13,'#315152')
   for(const side of [-1,1])for(let n=0;n<3;n++)glow.box(side*(hw-.5),height-.4,-hd*.7+n*hd*.7,.35,.12,1.4,'#edf3df')
  }
  if(type==='museum'){
   for(const side of [-1,1]){back.box(side*(hw-.35),height/2,-hd*.25,.3,height,hd*1.4,'#faf8ef');for(let j=0;j<3;j++){const zz=-hd*.6+j*hd*.55;back.box(side*(hw-.52),2.4,zz,.07,2.5,1.75,'#c5b7a1');back.box(side*(hw-.57),2.4,zz,.04,2.23,1.48,j%2?'#799ca2':'#c39178')}}
   for(const x of [-hw*.5,0,hw*.5]){back.box(x,height-.3,0,.16,.2,hd*1.6,'#c5c7bf');glow.box(x,height-.43,0,.1,.025,hd*1.5,'#fffff1')}
   // Sculptures stand on real plinths rather than a generic bookshelf or desk.
   for(const side of [-1,1]){const x=side*hw*.4;b.box(x,.4,hd*.52,1,.8,1,'#f5f1e6');b.torus(x,1.55,hd*.52,.55,.14,side<0?'#927b58':'#819c98');b.sphere(x,2.35,hd*.52,.23,'#b4c6bf')}
  }
  if(type==='club'){
   for(const x of [-hw*.6,hw*.6]){back.box(x,height-.5,-hd*.25,.09,.12,hd*1.3,'#30313d');for(let n=0;n<4;n++){const z=-hd*.7+n*hd*.35;b.cylinder(x,height-.7,z,.14,.3,'#262731',8);glow.cylinder(x,height-.89,z,.1,.025,n%2?'#b497ff':'#f27ebc',8)}}
   for(const x of [-hw+.12,hw-.12])wallglow.box(x,1.7,0,.035,.08,hd*1.5,'#9e6de1')
  }
  if(type==='hospital'){back.box(3.9,2.05,-4.82,.23,1,.06,'#4f8c89');back.box(3.9,2.05,-4.8,.8,.23,.07,'#4f8c89')}
  if(type==='airport'){back.box(2.8,1.9,-4.8,4.5,1.45,.08,'#3d7189');back.box(2.8,1.62,-4.73,4.4,.08,.05,'#cadbd6');back.box(2.8,1.45,-4.72,4.4,.23,.05,'#768e91');back.box(2.8,1.85,-4.7,2,.08,.04,'#eff1df')}
  if(type==='pavilion'){for(const x of [-5.6,5.6])for(const z of [-4.6,4.6])b.box(x,1.5,z,.2,3,.2,palette.wood);back.box(0,2.9,-4.6,11.4,.25,.35,palette.wood);back.box(0,1.7,-4.85,4.8,1.2,.05,'#739d8e');for(let i=-2;i<=2;i++)back.sphere(i*1.1,1.9,-4.78,.45,'#53816b',1,.8,.1)}
  if(['work','cafe','hospital','airport','pavilion'].includes(type)){b.cylinder(0,height-.08,0,.15,.06,palette.trim,12);b.cylinder(0,height-.2,0,.025,.18,palette.wood,8);b.cylinder(0,height-.31,0,.38,.16,palette.accent,16,.24);glow.cylinder(0,height-.4,0,.32,.025,'#ffe0a5',16)}
  const floor=new THREE.ShapeGeometry(shape).toNonIndexed();floor.rotateX(-Math.PI/2);floor.translate(0,-.016,0);const pos=floor.getAttribute('position'),uv=floor.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)*.7,pos.getZ(i)*.7);floor.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(pos.count*3).fill(1),3));bakeContact([...b.parts,floor]);const props=b.build();props.userData.bakedContact=true
  return {props,floor,glass:glass.parts.length?glass.build():null,glow:glow.parts.length?glow.build():null,back:back.build(),front:front.build(),wallglow:wallglow.parts.length?wallglow.build():null}
 },[layout,palette,hw,hd,type,city,height,windowed])
 useEffect(()=>()=>Object.values(built).forEach(g=>g?.dispose()),[built])
 const garden=useMemo(()=>{const b=new Builder();b.box(0,-.47,0,140,.08,140,'#3e6950');b.box(0,-.4,0,38,.12,34,'#4b8054');b.box(0,-.31,10,38,.05,3,'#bcc3af');b.box(0,-.32,13.5,38,.05,4,'#53676d');for(const x of [-11,-7,7,11]){b.cylinder(x,.9,-9,.12,2.2,'#876c4d',6);b.sphere(x,2.2,-9,.95,'#5e966b',1,1.2,1)}for(const x of [-18,18])for(let z=-15;z<=8;z+=1.8)b.box(x,.65,z,1.2,1.8,1.9,'#547c57');for(let x=-17;x<=17;x+=1.8)b.box(x,.65,-16,1.9,1.8,1.2,'#547c57');return b.build()},[])
 useEffect(()=>()=>garden.dispose(),[garden])
 const stove=layout.furniture.find(f=>f.kind==='stove'),desk=layout.furniture.find(f=>f.kind==='desk')
 return <><mesh geometry={garden} receiveShadow><meshStandardMaterial vertexColors color={night?'#8299a8':'#ffffff'} roughness={1}/></mesh><RoomWalls hw={hw} hd={hd} palette={palette} paper={surfaces.paper} open={['pavilion','stadium','arena'].includes(type)} height={height} floor={layout.floor} windows={windowed}/><mesh geometry={built.floor} receiveShadow><meshStandardMaterial map={surfaces.floor} vertexColors roughness={.88}/></mesh><mesh name={`${type}-interior`} geometry={built.props} castShadow receiveShadow userData={{template:type,stationCount:layout.stations.length}}><meshStandardMaterial vertexColors roughness={.85}/></mesh><WallMounted side="front"><mesh geometry={built.front} castShadow><meshStandardMaterial vertexColors roughness={.85}/></mesh></WallMounted><WallMounted side="back">{built.wallglow&&<mesh name="starlit-ceiling" geometry={built.wallglow}><meshStandardMaterial vertexColors emissive="#ffe6b6" emissiveIntensity={1.5}/></mesh>}<mesh name="room-wall-decor" geometry={built.back} castShadow><meshStandardMaterial vertexColors roughness={.85}/></mesh>{windowed&&<mesh name="room-window" position={[-.7,1.85,-hd+.08]}><planeGeometry args={[1.7,1.3]}/><meshStandardMaterial color={night?'#203e58':'#cde1db'} emissive={night?'#28455f':'#c8d9db'} emissiveIntensity={night?.25:.55}/></mesh>}{type!=='home'&&signs.map((sign,i)=><mesh key={i} position={[sign.x,sign.y,sign.z]}><planeGeometry args={[i===0?5.4:3.1,i===0?.42:.36]}/><meshBasicMaterial map={sign.texture} toneMapped={false}/></mesh>)}</WallMounted>{built.glass&&<mesh name="frosted-shower" geometry={built.glass}><meshStandardMaterial vertexColors transparent opacity={.88} roughness={1} depthWrite={false} side={THREE.DoubleSide}/></mesh>}{built.glow&&<mesh name="room-glowing-surfaces" geometry={built.glow}><meshStandardMaterial vertexColors emissive="#ffe0cb" emissiveIntensity={type==='club'?1.7:type==='museum'?.8:night?.85:.5}/></mesh>}<pointLight position={[0,Math.min(height-.5,4),0]} intensity={type==='club'?3:type==='museum'?45:night?30:22} color={type==='museum'?'#fff9eb':'#ffe2b5'} distance={Math.max(hw,hd)*2.6} decay={2}/>{stove&&<pointLight position={[stove.x,1.5,stove.z]} intensity={4} color="#ffc57e" distance={4}/>} {desk&&<pointLight position={[desk.x,1.35,desk.z+.25]} intensity={4} color="#bbd9ed" distance={5}/>} {type==='club'&&<><pointLight position={[-2.6,2.7,-2]} intensity={28} color="#ef65ad" distance={12}/><pointLight position={[2.6,2.7,-2]} intensity={23} color="#6ca5f5" distance={12}/></>}<RoomStaff staff={layout.staff??[]}/></>
}
