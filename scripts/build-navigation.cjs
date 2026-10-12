// Generate the client/server collision contract from the actual instanced city layouts.
const fs=require('fs'),path=require('path'),Module=require('module');
process.env.NODE_PATH=path.resolve('frontend/node_modules');Module._initPaths();
const ts=require('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {citySites,homeSitesFor}=require('../frontend/src/scene/cities');
const {kitFabric}=require('../frontend/src/scene/fabric');
const {metricPlacement}=require('../frontend/src/scene/world-scale');
const {dataFor,metropolitanGroups}=require('../frontend/src/scene/metropolitan-fabric');
const {nycLand,nycEast}=require('../frontend/src/scene/cities/nyc'),{bayWest,bayEast,bayMarin}=require('../frontend/src/scene/cities/bay');
const world=require('../shared/world.json'),out={version:1,cities:{}};
const dimensions={techCampus:[24,24],empire:[14,11],oneWtc:[19,19],grandCentral:[21,15],met:[29,20],cityHall:[18,12],ferryBuilding:[27,12],salesforce:[15,22],sfCityHall:[30,18],paintedLadies:[20,14]};
const neighborhoods={atl:['midtown','buckhead','o4w','eastAtlanta','westEnd','decatur'],nyc:['harlem','uws','soho','williamsburg','bedstuy','astoria'],bay:['mission','soma','sunset','oakland','berkeley','paloAlto']};
for(const city of ['atl','nyc','bay']){
 const data=city==='atl'?null:dataFor(city),groups=data?metropolitanGroups(data,city):kitFabric(),boxes=[],doors={};
 for(const [url,placements] of Object.entries(groups))if(/building|painted-row/.test(url))for(const p of placements)boxes.push({x:p.x,z:p.z,w:p.sx,d:p.sz,h:p.sy,y:p.y,windows:/kaykit\/building/.test(url),a:p.angle});
 for(const [id,s] of Object.entries(citySites[city])){
  const place=world.cities.find(c=>c.id===city).landmarks.find(l=>l.id===id);
  const solid=!['park','waterfront'].includes(place.category)&&!['beltline','brooklynBridge','goldenGate','coney','liberty','alcatraz','pier39','highLine'].includes(id);
  const [w,d]=dimensions[id]??[s.size*.75,s.size*.65];
  if(solid)boxes.push({id,x:s.x,z:s.z,w,d,h:s.height,a:s.angle??0});
  // A doorway on the front edge; parks use a path entrance rather than an obstacle.
  const distance=solid?d/2+1.1:s.size*.32,angle=s.angle??0;
  doors[id]={x:s.x+Math.sin(angle)*distance,z:s.z+Math.cos(angle)*distance,name:place.name};
 }
 const homes={};homeSitesFor(city).forEach((s,i)=>{homes[neighborhoods[city][i]]={x:s.x-2.5714,z:s.z+4.1,name:'Home'};const p=metricPlacement('kaykit/building_B_withoutBase.gltf',{x:s.x,y:0,z:s.z});boxes.push({x:s.x,z:s.z,w:p.sx,d:p.sz,h:p.sy,a:0})});
 out.cities[city]={land:city==='atl'?[[[-115,-110],[120,-110],[120,125],[-115,125]]]:city==='nyc'?[nycLand,nycEast,[[-60,70],[-42,70],[-42,88],[-60,88]]]:[bayWest,bayEast,bayMarin,[[5,-56],[28,-56],[28,-35],[5,-35]]],water:city==='atl'?[[[9,-36],[12,-40],[18,-39],[23,-33],[21,-27],[15,-28],[10,-31]]]:city==='bay'?[[[64,-5],[74,-8],[80,-2],[76,7],[68,6]]]:[],bridges:city==='nyc'?[{x:21,z:47,w:43,d:7,a:0}]:city==='bay'?[{x:-44,z:-58,w:8,d:64,a:-.16},{x:33,z:-8,w:49,d:6,a:0}]:[],boxes,doors,homes};
// Keep walkable water boundaries aligned with the authored park meshes.
const ellipse=(x,z,rx,rz)=>Array.from({length:40},(_,i)=>[x+Math.cos(i*Math.PI/20)*rx,z+Math.sin(i*Math.PI/20)*rz]);
const lake=[[1,-12],[-2,-11],[-4,-8],[-3,-5],[-1,-3],[-1,0],[0,3],[2,6],[4,5],[4,2],[5,0],[6,-1],[8,-2],[8,-5],[6,-7],[7,-9],[5,-11]],smooth=[];
for(let i=0;i<lake.length;i++)for(let j=0;j<5;j++){const t=j/5,p0=lake[(i+lake.length-1)%lake.length],p1=lake[i],p2=lake[(i+1)%lake.length],p3=lake[(i+2)%lake.length];smooth.push([0,1].map(k=>.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t)))}
if(city==='atl')out.cities[city].water=[smooth.map(([x,y])=>[22+x,-38-y])];
if(city==='nyc')out.cities[city].water=[ellipse(-18,-54,5,6),ellipse(-22,-41,4,3)];if(city==='bay')out.cities[city].water.push(ellipse(-71,1,3,3));
if(city==='atl')out.cities[city].doors.piedmont={x:11,z:-26.5,name:doors.piedmont.name};
if(city==='nyc')out.cities[city].doors.centralPark={x:-27,z:-40,name:doors.centralPark.name};
 const n=out.cities[city],inside=(x,z,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes},box=(x,z,b,pad=.35)=>{const dx=x-b.x,dz=z-b.z,c=Math.cos(b.a),s=Math.sin(b.a);return Math.abs(dx*c-dz*s)<b.w/2+pad&&Math.abs(dx*s+dz*c)<b.d/2+pad},clear=(x,z)=>(n.land.some(p=>inside(x,z,p))||n.bridges.some(b=>box(x,z,b,-.4)))&&!n.water.some(p=>inside(x,z,p))&&!boxes.some(b=>box(x,z,b));
 const roads=Object.entries(groups).filter(([url])=>/road_/.test(url)).flatMap(([,p])=>p).filter(p=>clear(Math.round(p.x),Math.round(p.z))),paths=[];
 for(const d of [...Object.values(doors),...Object.values(homes)]){
  const start=[Math.round(d.x),Math.round(d.z)];if(!clear(...start))continue;const targets=roads.slice().sort((a,b)=>Math.hypot(a.x-d.x,a.z-d.z)-Math.hypot(b.x-d.x,b.z-d.z)).slice(0,25),goal=new Set(targets.map(p=>Math.round(p.x)+','+Math.round(p.z))),queue=[start],parent=new Map([[start.join(','),null]]);let found=null;
  for(let i=0;i<queue.length&&i<4000;i++){const at=queue[i],key=at.join(',');if(goal.has(key)){found=at;break}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const next=[at[0]+dx,at[1]+dz],id=next.join(',');if(parent.has(id)||Math.hypot(next[0]-d.x,next[1]-d.z)>24||!clear(...next))continue;parent.set(id,at);queue.push(next)}}
  if(found){const points=[found];let prev=parent.get(found.join(','));while(prev){points.push(prev);prev=parent.get(prev.join(','))}points.reverse();paths.push({points,y:0})}
 }
 n.paths=paths;
 if(data){data.land.dispose();data.streets.dispose()}
}
fs.writeFileSync('shared/navigation.json.tmp',JSON.stringify(out,null,2)+'\n');fs.renameSync('shared/navigation.json.tmp','shared/navigation.json');
console.log(Object.fromEntries(Object.entries(out.cities).map(([c,d])=>[c,{boxes:d.boxes.length,doors:Object.keys(d.doors).length}])));
