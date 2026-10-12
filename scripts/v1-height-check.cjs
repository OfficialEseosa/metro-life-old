// Generate the client/server collision contract from the actual instanced city layouts.
const fs=require('fs'),path=require('path'),Module=require('module');
process.env.NODE_PATH=path.resolve('frontend/node_modules');Module._initPaths();
const ts=require('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const assert=require('assert/strict'),THREE=require('three'),{terrainHeight}=require('../frontend/src/scene/terrain-height'),{dataFor}=require('../frontend/src/scene/metropolitan-fabric');
const rows=[];
for(const city of ['atl','nyc','bay']){
 const data=city==='atl'?null:dataFor(city),geometry=data?data.land:new THREE.PlaneGeometry(1200,1200,64,64),mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 if(city==='atl'){const p=geometry.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i),rise=THREE.MathUtils.smoothstep(Math.hypot(x,z),100,210)*(Math.sin(x*.022)*Math.cos(z*.019)*7+8);p.setZ(i,rise)}mesh.rotation.x=-Math.PI/2;}mesh.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(),points=Array.from({length:400},(_,i)=>({x:(i*97%230)-115+.13,z:(i*71%230)-110+.27}));let max=0;
 for(const {x,z} of points){ray.set(new THREE.Vector3(x,60,z),new THREE.Vector3(0,-1,0));const hits=ray.intersectObject(mesh),expected=hits.length?Math.max(...hits.map(h=>h.point.y)):0,actual=terrainHeight(mesh,x,z);max=Math.max(max,Math.abs(expected-actual));assert(Math.abs(expected-actual)<.00001,JSON.stringify({city,x,z,expected,actual}));}
 const start=performance.now();for(let i=0;i<100;i++)for(const p of points)terrainHeight(mesh,p.x,p.z);rows.push({city,comparisons:points.length,maxErrorMetres:max,lookupMillisecondsPer400Samples:(performance.now()-start)/100});geometry.dispose();mesh.material.dispose();data?.streets.dispose();
}fs.writeFileSync('evidence/visual/v1/height-sampling.json',JSON.stringify(rows,null,2));console.log(rows);
