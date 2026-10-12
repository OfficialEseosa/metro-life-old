// Generate the client/server collision contract from the actual instanced city layouts.
const fs=require('fs'),path=require('path'),Module=require('module');
process.env.NODE_PATH=path.resolve('frontend/node_modules');Module._initPaths();
const ts=require('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {citySites,homeSitesFor}=require('../frontend/src/scene/cities');
const {kitFabric}=require('../frontend/src/scene/fabric');
const {dataFor,metropolitanGroups}=require('../frontend/src/scene/metropolitan-fabric');
const {nycLand,nycEast}=require('../frontend/src/scene/cities/nyc'),{bayWest,bayEast,bayMarin}=require('../frontend/src/scene/cities/bay');
const world=require('../shared/world.json'),out={version:1,cities:{}};
const dimensions={empire:[14,11],oneWtc:[19,19],grandCentral:[21,15],met:[29,20],cityHall:[18,12],ferryBuilding:[27,12],salesforce:[15,22],sfCityHall:[30,18],paintedLadies:[20,14]};
const neighborhoods={atl:['midtown','buckhead','o4w','eastAtlanta','westEnd','decatur'],nyc:['harlem','uws','soho','williamsburg','bedstuy','astoria'],bay:['mission','soma','sunset','oakland','berkeley','paloAlto']};
for(const city of ['atl','nyc','bay']){
 const data=city==='atl'?null:dataFor(city),groups=data?metropolitanGroups(data,city):kitFabric(),boxes=[],doors={};
 for(const [url,placements] of Object.entries(groups))if(/building|painted-row/.test(url))for(const p of placements)boxes.push({x:p.x,z:p.z,w:p.sx,d:p.sz,h:p.sy,a:p.angle});
 for(const [id,s] of Object.entries(citySites[city])){
  const place=world.cities.find(c=>c.id===city).landmarks.find(l=>l.id===id);
  const solid=!['park','waterfront'].includes(place.category)&&!['beltline','brooklynBridge','goldenGate','coney','liberty','alcatraz','pier39','highLine'].includes(id);
  const [w,d]=dimensions[id]??[s.size*.75,s.size*.65];
  if(solid)boxes.push({x:s.x,z:s.z,w,d,h:s.height,a:s.angle??0});
  // A doorway on the front edge; parks use a path entrance rather than an obstacle.
  const distance=solid?d/2+1.1:s.size*.32,angle=s.angle??0;
  doors[id]={x:s.x+Math.sin(angle)*distance,z:s.z+Math.cos(angle)*distance,name:place.name};
 }
 const homes={};homeSitesFor(city).forEach((s,i)=>{homes[neighborhoods[city][i]]={x:s.x,z:s.z+4.1,name:'Home'};boxes.push({x:s.x,z:s.z,w:3.4,d:3,h:3,a:0})});
 out.cities[city]={land:city==='atl'?[[[-115,-110],[120,-110],[120,125],[-115,125]]]:city==='nyc'?[nycLand,nycEast,[[-60,70],[-42,70],[-42,88],[-60,88]]]:[bayWest,bayEast,bayMarin,[[5,-56],[28,-56],[28,-35],[5,-35]]],water:city==='atl'?[[[9,-36],[12,-40],[18,-39],[23,-33],[21,-27],[15,-28],[10,-31]]]:city==='bay'?[[[64,-5],[74,-8],[80,-2],[76,7],[68,6]]]:[],bridges:city==='nyc'?[{x:21,z:47,w:43,d:7,a:0}]:city==='bay'?[{x:-44,z:-58,w:8,d:64,a:-.16},{x:33,z:-8,w:49,d:6,a:0}]:[],boxes,doors,homes};
 if(data){data.land.dispose();data.streets.dispose()}
}
fs.writeFileSync('shared/navigation.json',JSON.stringify(out,null,2)+'\n');
console.log(Object.fromEntries(Object.entries(out.cities).map(([c,d])=>[c,{boxes:d.boxes.length,doors:Object.keys(d.doors).length}])));
