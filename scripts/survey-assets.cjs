// Offline asset measurements through the production glTF loader; no raster output.
const fs=require('fs'),path=require('path');
(async()=>{
 global.self=globalThis;global.ProgressEvent=class{constructor(type,init){this.type=type;Object.assign(this,init)}};global.createImageBitmap=async()=>({width:1,height:1,close(){}});
 const THREE=await import('../frontend/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
 const {MeshoptDecoder}=await import('../frontend/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js');
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),base='http://127.0.0.1:5173/models/',root=path.resolve('frontend/public/models'),rows={};
 for(const dir of['chars','kaykit','world/suburban','world/commercial','world/car','world/nature','vehicles','streets'])for(const file of fs.readdirSync(path.join(root,dir)).filter(f=>/\.(glb|gltf)$/.test(f))){
  const url=dir+'/'+file,gltf=await loader.loadAsync(base+url);gltf.scene.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(gltf.scene),size=b.getSize(new THREE.Vector3());let triangles=0;const materials=new Set();gltf.scene.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m.name))}});
  rows[url]={sha256:require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,url))).digest('hex'),min:b.min.toArray(),size:size.toArray(),triangles,materials:[...materials],clips:gltf.animations.map(a=>a.name)};
 }
 fs.writeFileSync('shared/model-metrics.json.tmp',JSON.stringify(rows,null,2)+'\n');fs.renameSync('shared/model-metrics.json.tmp','shared/model-metrics.json');
 for(const[k,v]of Object.entries(rows))if(/chars\/f_casual|building_[A-C]_|streetlight|car\/|tree-large|road_straight|building-type-a/.test(k))console.log(k,JSON.stringify(v));
})().catch(e=>{console.error(e);process.exitCode=1});
