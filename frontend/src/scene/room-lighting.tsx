/* oxlint-disable react/immutability -- Room-only light/environment resources are owned by this component. */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { motion } from '../walking'
import { useStore } from '../store'

export function RoomLighting({club}:{club:boolean}){
 const {gl,scene,invalidate}=useThree(),key=useRef<THREE.DirectionalLight>(null),previous=useRef(''),lastUpdate=useRef(0)
 useEffect(()=>{const room=new RoomEnvironment(),generator=new THREE.PMREMGenerator(gl),environment=generator.fromScene(room,.04),old=scene.environment,oldIntensity=scene.environmentIntensity;scene.environment=environment.texture;scene.environmentIntensity=.4;room.dispose();generator.dispose();gl.shadowMap.needsUpdate=true;invalidate();return()=>{scene.environment=old;scene.environmentIntensity=oldIntensity;environment.dispose()}},[gl,scene,invalidate])
 useFrame(({clock})=>{
  const p=motion.position,sim=useStore.getState().sim,people=useStore.getState().players
  const signature=`${p?.x.toFixed(2)}:${p?.z.toFixed(2)}:${sim?.busyUntil}:${people.filter(x=>x.position?.room===p?.room).map(x=>`${x.id}:${x.position?.x.toFixed(2)}:${x.position?.z.toFixed(2)}`).join(',')}`
  const animated=!!sim?.busyUntil||people.some(x=>x.position?.room===p?.room&&x.activity&&x.activity!=='idle')
  if((signature!==previous.current||animated)&&clock.elapsedTime-lastUpdate.current>.067){if(key.current)key.current.shadow.needsUpdate=true;gl.shadowMap.needsUpdate=true;previous.current=signature;lastUpdate.current=clock.elapsedTime}
 })
 return <><hemisphereLight args={['#fff3df','#a79086',club?.85:.5]}/><directionalLight ref={key} name="room-shadow-key" position={[-4,7,5]} intensity={club?3.5:2.2} color="#ffe1b3" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-camera-near={.5} shadow-camera-far={22} shadow-normalBias={.035} shadow-bias={-.00015}/></>
}
