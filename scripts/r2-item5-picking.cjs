// Execute the real input component with a CPU Three scene and a native-event
// canvas stub. Hooks are mounted synchronously; no WebGL/browser/build needed.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),Module=require('module');
process.env.NODE_PATH=path.resolve('frontend/node_modules');Module._initPaths();
const ts=require('typescript'),THREE=require('three');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const file=path.resolve('frontend/src/scene/object-picking.tsx'),relativeRequire=Module.createRequire(file),listeners=new Map(),cleanup=[],picks=[],checks=[];
const rect={left:17,top:23,width:1280,height:800,right:1297,bottom:823},canvas={getBoundingClientRect:()=>rect,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,rect.width/rect.height,.1,1000);
let state={city:'atl',sim:{city:'atl',userId:'self',position:{x:0,z:1,room:'home:self'},home:{city:'atl',neighborhood:'midtown'}},players:[]};
const context={gl:{domElement:canvas},scene,camera},moduleOut={exports:{}};
const injectedRequire=name=>name==='react'?{useEffect:fn=>{const end=fn();if(end)cleanup.push(end)},useRef:value=>({current:value})}:name==='@react-three/fiber'?{useThree:()=>context}:name==='../store'?{useStore:{getState:()=>state}}:relativeRequire(name);
const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
vm.runInThisContext(Module.wrap(code),{filename:file})(moduleOut.exports,injectedRequire,moduleOut,file,path.dirname(file));moduleOut.exports.ObjectPicking({onPick:target=>picks.push(target)});
function aim(x,y,z,tx=0,ty=0,tz=0){camera.position.set(x,y,z);camera.lookAt(tx,ty,tz);camera.updateProjectionMatrix();camera.updateMatrixWorld(true)}
function event(point,overrides={}){const p=new THREE.Vector3(...point).project(camera);return{pointerId:1,button:0,isPrimary:true,target:canvas,clientX:rect.left+(p.x+1)*rect.width/2,clientY:rect.top+(1-p.y)*rect.height/2,...overrides}}
function tap(point,expected,overrides){const e=event(point,overrides),before=picks.length;listeners.get('pointerdown')(e);listeners.get('pointerup')(e);assert.equal(picks.length,before+1,'Tap did not produce exactly one pick');const result=picks.at(-1);for(const [key,value]of Object.entries(expected))assert.equal(result[key],value,JSON.stringify(result));assert.equal(result.screen.x,e.clientX);assert.equal(result.screen.y,e.clientY);checks.push({name:expected.kind+':'+expected.id,result});return result}
aim(0,8,10);
tap([-2.7,.9,.1],{kind:'furniture',id:'stove',stationId:'stove'});
tap([2.25,.7,-1.65],{kind:'furniture',id:'bed',stationId:'bed'});
tap([-2.7,1.5,-1.9],{kind:'furniture',id:'shower',stationId:'shower'});
tap([2.5,.7,1],{kind:'furniture',id:'chair',stationId:'couch'});
const frontTrim=new THREE.Group();frontTrim.name='wall-mounted-front';scene.add(frontTrim);tap([.77,1,2.95],{kind:'door',id:'exit',stationId:'exit'});frontTrim.visible=false;
tap([-.4,0,.5],{kind:'ground',id:'ground'});
tap([-.4,0,.5],{kind:'ground',id:'ground'},{pointerType:'touch'});
function noPick(name,fn){const before=picks.length;fn();assert.equal(picks.length,before,name);checks.push({name,result:'ignored'})}
noPick('six-pixel drag',()=>{const e=event([0,0,0]);listeners.get('pointerdown')(e);listeners.get('pointermove')({...e,clientX:e.clientX+6});listeners.get('pointerup')({...e,clientX:e.clientX+6})});
noPick('right orbit',()=>{const e=event([0,0,0],{button:2});listeners.get('pointerdown')(e);listeners.get('pointerup')(e)});
noPick('HUD target',()=>{const e=event([0,0,0],{target:{tagName:'BUTTON'}});listeners.get('pointerdown')(e);listeners.get('pointerup')(e)});
noPick('multitouch gesture',()=>{const e=event([0,0,0]);listeners.get('pointerdown')(e);listeners.get('pointerdown')({...e,pointerId:2,isPrimary:false});listeners.get('pointerup')(e)});
noPick('cancelled pointer',()=>{const e=event([0,0,0]);listeners.get('pointerdown')(e);listeners.get('pointercancel')(e);listeners.get('pointerup')(e)});
noPick('room changed during gesture',()=>{const e=event([0,0,0]);listeners.get('pointerdown')(e);state.sim.position.room='foodhall:ponce';listeners.get('pointerup')(e)});
aim(0,12,8);tap([3.6,.8,.25],{kind:'furniture',id:'table-2',stationId:'table'});
state.sim.position.room='cafe:krog';aim(0,10,8);tap([-3.3,.9,-2.8],{kind:'furniture',id:'reception',stationId:'counter'});
state.sim.position.room='home:self';aim(0,8,10);
const residents=new THREE.InstancedMesh(new THREE.BoxGeometry(.5,1.78,.4),new THREE.MeshStandardMaterial(),1);residents.name='residents';residents.userData.ids=['other'];residents.setMatrixAt(0,new THREE.Matrix4().makeTranslation(.5,0,.3));scene.add(residents);
state.players=[{id:'other',npc:false,online:true,city:'atl',position:{x:99,z:99,room:'home:self'}},{id:'self',npc:false,online:true,city:'atl',position:{x:.5,z:.3,room:'home:self'}}];
tap([.5,.9,.3],{kind:'person',id:'other'});
residents.setMatrixAt(0,new THREE.Matrix4().makeScale(0,0,0));tap([.5,.9,.3],{kind:'ground',id:'ground'});
residents.setMatrixAt(0,new THREE.Matrix4().makeTranslation(.5,0,.3));state.players[0].position.room='theatre:fox';tap([.5,.9,.3],{kind:'ground',id:'ground'});
scene.remove(residents);state.players=[];state.sim.position.room=null;
const terrain=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial());terrain.name='terrain';terrain.rotation.x=-Math.PI/2;terrain.raycast=()=>{};scene.add(terrain);
const museum=new THREE.Mesh(new THREE.BoxGeometry(22,6,18),new THREE.MeshStandardMaterial());museum.name='high';museum.position.set(-8,3,-44);museum.raycast=()=>{};scene.add(museum);aim(-8,18,-18,-8,0,-44);
tap([-8,4,-44],{kind:'door',id:'high'});
const pinGeometry=new THREE.BufferGeometry();pinGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-8,4,-44],3));pinGeometry.setAttribute('pinVisible',new THREE.Float32BufferAttribute([1],1));pinGeometry.userData.locationIds=['high'];const pins=new THREE.Points(pinGeometry,new THREE.PointsMaterial());pins.name='map-pins';scene.add(pins);let pinDistance=1;
pins.raycast=(ray,results)=>{if(pinGeometry.getAttribute('pinVisible').getX(0)<.5)return;const cursor=ray.ray.at(1,new THREE.Vector3()).project(camera),point=new THREE.Vector3().fromBufferAttribute(pinGeometry.attributes.position,0),p=point.clone().project(camera);if(Math.hypot((p.x-cursor.x)*rect.width/2,(p.y-cursor.y)*rect.height/2)<24)results.push({distance:pinDistance,point,index:0,object:pins})};
noPick('foreground visible map pin owns tap',()=>{const e=event([-8,4,-44]);listeners.get('pointerdown')(e);listeners.get('pointerup')(e)});
pinGeometry.getAttribute('pinVisible').setX(0,0);tap([-8,4,-44],{kind:'door',id:'high'});pinGeometry.getAttribute('pinVisible').setX(0,1);
pins.visible=false;tap([-8,4,-44],{kind:'door',id:'high'});pins.visible=true;
pinDistance=999;noPick('same landmark pin owns tap despite nearer building facade',()=>{const e=event([-8,4,-44]);listeners.get('pointerdown')(e);listeners.get('pointerup')(e)});
pinGeometry.userData.locationIds=['elsewhere'];tap([-8,4,-44],{kind:'door',id:'high'});
museum.visible=false;tap([-8,4,-44],{kind:'ground',id:'ground'});
aim(-15,8,10,-15,0,0);tap([-15,.6,0],{kind:'bench',id:'centennial:0'});
state.city='nyc';state.sim.city='nyc';aim(21,18,66,21,5.8,47);const bridgePick=tap([21,5.8,47],{kind:'ground',id:'ground',city:'nyc'});assert(Math.hypot(bridgePick.point.x-21,bridgePick.point.z-47)<.001,'Bridge floor projected onto terrain below');state.city=state.sim.city='atl';
// Exterior remains mounted in the real game; indoor picks must ignore it.
state.sim.position.room='home:self';aim(0,8,10);tap([-.4,0,.5],{kind:'ground',id:'ground',room:'home:self'});
pinGeometry.attributes.position.setXYZ(0,-.4,0,.5);pinDistance=1;tap([-.4,0,.5],{kind:'ground',id:'ground',room:'home:self'});
for(const end of cleanup.reverse())end();assert.equal(listeners.size,0,'Native listeners leaked');checks.push({name:'listener cleanup',result:'PASS'});
fs.mkdirSync('evidence/round2',{recursive:true});fs.writeFileSync('evidence/round2/item5-picking-check.json',JSON.stringify({result:'PASS',checks},null,2)+'\n');console.log(`PASS ${checks.length} input/geometry checks; no browser or renderer.`);
