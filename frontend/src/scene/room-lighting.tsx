/* oxlint-disable react/immutability -- Room-only light/environment resources are owned by this component. */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { motion } from '../walking'
import { useStore } from '../store'
import { useNightLighting } from '../lighting'
import { roomLayout,roomType } from '../navigation'

export function RoomLighting({club}:{club:boolean}){
 const night=useNightLighting(),roomId=useStore(s=>s.sim?.position?.room),city=useStore(s=>s.city),type=roomType(roomId??'')??'home',layout=roomLayout(city,type),extent=Math.max(layout.bounds?.w??12,layout.bounds?.d??10)/2+2,height=layout.height??3,museum=type==='museum',theatre=type==='theatre',sports=type==='stadium'||type==='arena',environmentLevel=club?.12:museum?.65:theatre?.2:sports?.5:night?.3:.45
 const {gl,scene,invalidate}=useThree(),key=useRef<THREE.DirectionalLight>(null),previous=useRef(''),lastUpdate=useRef(0)
 useEffect(()=>{const room=new RoomEnvironment(),generator=new THREE.PMREMGenerator(gl),environment=generator.fromScene(room,.04),old=scene.environment,oldIntensity=scene.environmentIntensity;scene.environment=environment.texture;scene.environmentIntensity=environmentLevel;room.dispose();generator.dispose();gl.shadowMap.needsUpdate=true;invalidate();return()=>{scene.environment=old;scene.environmentIntensity=oldIntensity;environment.dispose()}},[gl,scene,invalidate,environmentLevel])
 useFrame(({clock})=>{
  const p=motion.position,sim=useStore.getState().sim,people=useStore.getState().players
  const signature=`${p?.x.toFixed(2)}:${p?.z.toFixed(2)}:${sim?.busyUntil}:${people.filter(x=>x.position?.room===p?.room).map(x=>`${x.id}:${x.position?.x.toFixed(2)}:${x.position?.z.toFixed(2)}`).join(',')}`
  const animated=!!sim?.busyUntil||people.some(x=>x.position?.room===p?.room&&x.activity&&x.activity!=='idle')
  if((signature!==previous.current||animated)&&clock.elapsedTime-lastUpdate.current>.067){if(key.current)key.current.shadow.needsUpdate=true;gl.shadowMap.needsUpdate=true;previous.current=signature;lastUpdate.current=clock.elapsedTime}
 })
 return <><hemisphereLight args={[museum?'#ffffff':night?'#aec8dd':'#fff3df',club?'#34304b':museum?'#b6bbb5':'#8a7c78',club?.16:museum?.72:theatre?.3:.48]}/><directionalLight ref={key} name="room-shadow-key" position={[-extent*.45,Math.max(7,height+2),extent*.6]} intensity={club?.8:museum?3.5:theatre?1.4:sports?3.2:night?1.8:2.5} color={museum||sports?'#fffaf0':night?'#b8cee1':'#ffe1b3'} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-extent} shadow-camera-right={extent} shadow-camera-top={extent} shadow-camera-bottom={-extent} shadow-camera-near={.5} shadow-camera-far={Math.max(24,height+extent*2)} shadow-normalBias={.035} shadow-bias={-.00015}/></>
}
