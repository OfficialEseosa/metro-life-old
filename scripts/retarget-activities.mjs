// CC0 Quaternius clips retargeted onto the shipped character skeleton; original GLBs stay untouched.
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from '../frontend/node_modules/three/build/three.module.js'
import { GLTFLoader } from '../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from '../frontend/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js'

function withoutTextures(file){
 const b=fs.readFileSync(file),length=b.readUInt32LE(12),json=JSON.parse(b.subarray(20,20+length).toString()),bin=b.subarray(20+length)
 delete json.images;delete json.textures;delete json.samplers;delete json.materials
 for(const m of json.meshes??[])for(const p of m.primitives)delete p.material
 const raw=Buffer.from(JSON.stringify(json)),padding=(4-raw.length%4)%4,j=Buffer.concat([raw,Buffer.alloc(padding,32)]),header=Buffer.alloc(20)
 header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+j.length+bin.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16)
 const result=Buffer.concat([header,j,bin]);return result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength)
}
async function load(file){return new Promise((resolve,reject)=>new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(withoutTextures(file),'',resolve,reject))}
const target=await load('frontend/public/models/chars/f_casual.glb')
if(process.argv.includes('--inspect')){
 target.scene.updateMatrixWorld(true)
 const rig=[];target.scene.traverse(o=>{if(o instanceof THREE.Bone&&['Root','Body','Hips','Abdomen','Chest','Head','UpperArmL','UpperLegL','FootL'].includes(o.name))rig.push({name:o.name,local:o.position.toArray(),world:o.getWorldPosition(new THREE.Vector3()).toArray()})})
 const bounds=new THREE.Box3().setFromObject(target.scene);console.log('target',bounds.min.toArray(),bounds.max.toArray(),rig)
 let skin;target.scene.traverse(o=>{if(o.isSkinnedMesh)skin=o})
 console.log('bind',skin.skeleton.bones.slice(0,9).map((b,i)=>({name:b.name,bind:new THREE.Vector3().setFromMatrixPosition(skin.skeleton.boneInverses[i].clone().invert()).toArray()})))
 const basis=new THREE.Matrix4().multiplyMatrices(skin.skeleton.bones[0].matrixWorld,skin.skeleton.boneInverses[0]);console.log('recovered rest',skin.skeleton.bones.slice(0,14).map((b,i)=>({name:b.name,world:new THREE.Vector3().setFromMatrixPosition(basis.clone().multiply(skin.skeleton.boneInverses[i].clone().invert())).toArray()})))
 const mixer=new THREE.AnimationMixer(target.scene);mixer.clipAction(target.animations.find(a=>a.name.endsWith('|Idle'))).play();mixer.update(.01);target.scene.updateMatrixWorld(true)
 console.log('idle',rig.map(r=>({name:r.name,world:target.scene.getObjectByName(r.name).getWorldPosition(new THREE.Vector3()).toArray()})))
 process.exit(0)
}

const sources=await Promise.all([
 load('.runtime/quaternius-ual/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb'),
 load('.runtime/quaternius-ual/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb')
])
const canon=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'')
function skeleton(gltf){let found;gltf.scene.traverse(o=>{if(o.isSkinnedMesh&&(!found||o.skeleton.bones.length>found.bones.length))found=o.skeleton});return found}
function rest(gltf){
 gltf.scene.updateMatrixWorld(true);const s=skeleton(gltf),basis=s.bones[0].matrixWorld.clone().multiply(s.boneInverses[0]),map=new Map()
 s.bones.forEach((b,i)=>map.set(b.name,basis.clone().multiply(s.boneInverses[i].clone().invert())))
 return map
}
const sourceRests=sources.map(rest),sourceMixers=sources.map(g=>new THREE.AnimationMixer(g.scene)),sourceBones=sources.map(g=>new Map(skeleton(g).bones.map(b=>[canon(b.name),b])))
const maps=[{Body:'DEF-hips',Hips:'DEF-hips',Abdomen:'DEF-spine.001',Torso:'DEF-spine.002',Chest:'DEF-spine.003',Neck:'DEF-neck',Head:'DEF-head'},
 {Body:'pelvis',Hips:'pelvis',Abdomen:'spine_01',Torso:'spine_02',Chest:'spine_03',Neck:'neck_01',Head:'Head'}]
for(const side of ['L','R']){
 for(const [dst,src] of Object.entries({Shoulder:'shoulder',UpperArm:'upper_arm',LowerArm:'forearm',Wrist:'hand',UpperLeg:'thigh',LowerLeg:'shin',Foot:'foot'}))maps[0][dst+side]='DEF-'+src+'.'+side
 for(const [dst,src] of Object.entries({Shoulder:'clavicle',UpperArm:'upperarm',LowerArm:'lowerarm',Wrist:'hand',UpperLeg:'thigh',LowerLeg:'calf',Foot:'foot'}))maps[1][dst+side]=src+'_'+side.toLowerCase()
 for(const [dst,src,src2] of [['Index','f_index','index'],['Middle','f_middle','middle'],['Ring','f_ring','ring'],['Pinky','f_pinky','pinky'],['Thumb','thumb','thumb']])for(let i=1;i<=3;i++){maps[0][dst+i+side]='DEF-'+src+'.0'+i+'.'+side;maps[1][dst+i+side]=src2+'_0'+i+'_'+side.toLowerCase()}
}
function sourcePose(library,clip,time){const mixer=sourceMixers[library];mixer.stopAllAction();mixer.clipAction(sources[library].animations.find(a=>a.name===clip)).play();mixer.setTime(time);sources[library].scene.updateMatrixWorld(true);return sourceBones[library]}
const specs=[
 {name:'Sit',lib:0,clip:'Sitting_Idle_Loop',seconds:2},
 {name:'Talk',lib:0,clip:'Idle_Talking_Loop',seconds:2.9},
 {name:'Jog',lib:0,clip:'Jog_Fwd_Loop',seconds:.933333},
 {name:'Dance',lib:0,clip:'Dance_Loop',seconds:1},
 {name:'Type',lib:0,clip:'Driving_Loop',seconds:2,seated:true},
 {name:'Eat',lib:1,clip:'Consume',seconds:1.333333,seated:true},
 {name:'Lie',lib:1,clip:'LayToIdle',seconds:2,freeze:true},
 {name:'Sleep',lib:1,clip:'LayToIdle',seconds:3,freeze:true},
 {name:'Cheer',lib:0,clip:'Dance_Loop',seconds:2,cheer:true}
]
const output=path.resolve('frontend/public/models/chars');fs.mkdirSync(output,{recursive:true})
for(const body of ['f','m']){
 const g=body==='f'?target:await load('frontend/public/models/chars/m_casual.glb'),skel=skeleton(g),base=rest(g),boneMap=new Map(skel.bones.map(b=>[b.name,b])),clips=[],metadata={}
 const position=m=>new THREE.Vector3().setFromMatrixPosition(m),rotation=m=>new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(m))
 const restore=()=>{for(const b of skel.bones){const local=b.parent.matrixWorld.clone().invert().multiply(base.get(b.name));local.decompose(b.position,b.quaternion,b.scale);b.updateMatrixWorld(true)}}
 for(const spec of specs){
  const frameCount=Math.round(spec.seconds*24),times=Array.from({length:frameCount+1},(_,i)=>i/24),values=new Map(skel.bones.map(b=>[b.name,{q:[],p:[]}]))
  const ratio=(position(base.get('Body')).y-position(base.get('FootL')).y)/(position(sourceRests[spec.lib].get(sourceBones[spec.lib].get(canon(maps[spec.lib].Body)).name)).y-position(sourceRests[spec.lib].get(sourceBones[spec.lib].get(canon(maps[spec.lib].FootL)).name)).y)
  for(const time of times){
   restore();const src=sourcePose(spec.lib,spec.clip,spec.freeze?0:time%spec.seconds)
   let sit=null;if(spec.seated)sit=sourcePose(0,'Sitting_Idle_Loop',time%1.666667)
   // Consume uses library2, so the seated lower body can be sampled independently.
   // Driving already has seated legs; no second source0 sample is needed for typing.
   if(spec.name==='Type')sourcePose(0,'Driving_Loop',time%1.666667)
   for(const bone of skel.bones){
    if(bone.name==='Root'||bone.name.startsWith('PT'))continue
    const lower=/^(Body|Hips|UpperLeg|LowerLeg|Foot)/.test(bone.name),lib=spec.seated&&lower?0:spec.lib,source=spec.seated&&lower?sit:src,mapped=maps[lib][bone.name],sb=mapped?source.get(canon(mapped)):null
    const restWorld=base.get(bone.name),qRest=rotation(restWorld);let q=qRest.clone(),at
    if(sb){const sr=sourceRests[lib].get(sb.name),delta=sb.getWorldQuaternion(new THREE.Quaternion()).multiply(rotation(sr).invert());q=delta.multiply(qRest)}
    if(spec.cheer&&/^(UpperArm|LowerArm|Wrist|Index|Middle|Ring|Pinky|Thumb)/.test(bone.name)){const sign=bone.name.endsWith('L')?1:-1,angle=bone.name.startsWith('UpperArm')?1.2:1.5;q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),sign*(angle+Math.sin(time*Math.PI*4)*.1)).multiply(qRest)}
    if(spec.name==='Type'&&/^(UpperArm|LowerArm|Wrist|Index|Middle|Ring|Pinky|Thumb)/.test(bone.name))q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.45))
    if(spec.name==='Type'&&/^Wrist[LR]$/.test(bone.name))q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.sin(time*15+(bone.name.endsWith('L')?0:Math.PI))*.12))
    if(spec.name==='Sleep'&&bone.name==='Abdomen')q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.sin(time*Math.PI*2/3)*.012))
    if(bone.name==='Body'){
     const sr=sourceRests[lib].get(sb.name),delta=sb.getWorldPosition(new THREE.Vector3()).sub(position(sr)).multiplyScalar(ratio);if(!spec.freeze){delta.x=THREE.MathUtils.clamp(delta.x,-.12,.12);delta.z=THREE.MathUtils.clamp(delta.z,-.12,.12)}
     at=position(restWorld).add(delta)
    }else{
     const parent=bone.name.startsWith('Foot')?boneMap.get('LowerLeg'+bone.name.at(-1)):bone.parent
     if(parent.isBone){const localOffset=position(restWorld).sub(position(base.get(parent.name))).applyQuaternion(rotation(base.get(parent.name)).invert()).applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()));at=parent.getWorldPosition(new THREE.Vector3()).add(localOffset)}else at=position(restWorld)
    }
    const scale=new THREE.Vector3();restWorld.decompose(new THREE.Vector3(),new THREE.Quaternion(),scale)
    const world=new THREE.Matrix4().compose(at,q,scale),local=bone.parent.matrixWorld.clone().invert().multiply(world);local.decompose(bone.position,bone.quaternion,bone.scale);bone.updateMatrixWorld(true)
   }
   for(const bone of skel.bones){values.get(bone.name).q.push(...bone.quaternion.toArray());values.get(bone.name).p.push(...bone.position.toArray())}
   if(time===0){const hip=boneMap.get('Body').getWorldPosition(new THREE.Vector3()),head=boneMap.get('Head').getWorldPosition(new THREE.Vector3());metadata[spec.name]={hip:hip.toArray(),head:head.toArray(),duration:times.at(-1),source:spec.clip,library:spec.lib+1}}
  }
  const tracks=[];for(const [name,v]of values){tracks.push(new THREE.QuaternionKeyframeTrack(name+'.quaternion',times,v.q));tracks.push(new THREE.VectorKeyframeTrack(name+'.position',times,v.p))}
  clips.push(THREE.AnimationClip.toJSON(new THREE.AnimationClip(spec.name,times.at(-1),tracks)))
 }
 const data={licence:'CC0-1.0',source:'Quaternius Universal Animation Libraries 1 and 2',sampleRate:24,metadata,clips},file=path.join(output,`activities-${body}.json`),temporary=file+'.tmp'
 fs.writeFileSync(temporary,JSON.stringify(data,(_,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v));fs.renameSync(temporary,file);console.log('RETARGET',body,fs.statSync(file).size,metadata)
}
