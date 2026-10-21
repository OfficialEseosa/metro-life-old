// Offline regression: geography, actual GLB footprints and shared collision.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('node:assert/strict');
process.env.NODE_PATH=path.resolve('frontend/node_modules');Module._initPaths();
const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {ATLANTA_TOWERS}=require('../frontend/src/scene/atlanta-models');
// Vite serves public assets by URL; build-time JSON mirrors must stay exact.
assert.deepEqual(require('../frontend/src/scene/atlanta-skyline-manifest.json'),require('../frontend/public/models/skyline/manifest.json'));
assert.deepEqual(require('../frontend/src/scene/atlanta-landmarks-manifest.json'),require('../frontend/public/models/landmarks-blender/manifest.json'));
const nav=require('../shared/navigation.json').cities.atl,assets=require('../evidence/round1/item3-model-metrics.json');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function inside(x,z,p){let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
function blocked(x,z,b,pad=.3){const dx=x-b.x,dz=z-b.z,c=Math.cos(b.a),s=Math.sin(b.a);return Math.abs(dx*c-dz*s)<b.w/2+pad&&Math.abs(dx*s+dz*c)<b.d/2+pad}
const corners=b=>[-1,1].flatMap(x=>[-1,1].map(z=>[b.x+Math.cos(b.a)*x*b.w/2+Math.sin(b.a)*z*b.d/2,b.z-Math.sin(b.a)*x*b.w/2+Math.cos(b.a)*z*b.d/2]));
function intersects(a,b){const aa=corners(a),bb=corners(b);for(const theta of [a.a,a.a+Math.PI/2,b.a,b.a+Math.PI/2]){const c=Math.cos(theta),s=-Math.sin(theta),pa=aa.map(p=>p[0]*c+p[1]*s),pb=bb.map(p=>p[0]*c+p[1]*s);if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false}return true}
const towerIds=new Set(ATLANTA_TOWERS.map(t=>t.id)),report={pairChecks:0,doorChecks:0,footprintChecks:0,landChecks:0,overlapChecks:0,towers:[]};
for(let i=0;i<ATLANTA_TOWERS.length;i++){
 const tower=ATLANTA_TOWERS[i],box=nav.boxes.find(b=>b.id===tower.id),asset=assets.models.find(a=>a.source.endsWith(tower.file));
 assert.ok(box,`${tower.name}: collision missing`);
 near(box.w,asset.size[0]*.04);near(box.d,asset.size[2]*.04);
 near(box.x,tower.x+(asset.min[0]+asset.size[0]/2)*.04);near(box.z,tower.z+(asset.min[2]+asset.size[2]/2)*.04);
 near(tower.height,tower.realHeightToTip*.045);near(asset.size[1]*tower.heightScale,tower.height);near(box.h,tower.height);
 assert.ok(blocked(tower.x,tower.z,box),`${tower.name}: centre is walkable through tower`);report.footprintChecks++;
 for(const [x,z]of corners(box)){assert.ok(nav.land.some(p=>inside(x,z,p)),`${tower.name}: outside land`);assert.ok(!nav.water.some(p=>inside(x,z,p)),`${tower.name}: in water`);report.landChecks++}
 for(const [id,door]of Object.entries({...nav.doors,...nav.homes})){assert.ok(!blocked(door.x,door.z,box,.8),`${tower.name}: blocks ${id} door approach`);report.doorChecks++}
 for(const other of nav.boxes.filter(b=>b!==box)){assert.ok(!intersects(box,other),`${tower.name}: overlaps ${other.id??'filler/home'} footprint`);report.overlapChecks++}
 for(let j=i+1;j<ATLANTA_TOWERS.length;j++){
  const other=ATLANTA_TOWERS[j];near(tower.x-other.x,(tower.realOffset.x-other.realOffset.x)*.03);near(tower.z-other.z,-(tower.realOffset.n-other.realOffset.n)*.03);near(tower.height/other.height,tower.realHeightToTip/other.realHeightToTip);report.pairChecks++;
 }
 report.towers.push({id:tower.id,position:[tower.x,tower.z],height:tower.height,collision:box});
}
assert.equal(nav.boxes.filter(b=>towerIds.has(b.id)).length,5);
report.result='PASS';fs.writeFileSync('evidence/round1/item3-placement-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
