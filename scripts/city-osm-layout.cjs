const fs=require('fs');
const output={attribution:'Map data (c) OpenStreetMap contributors',cities:{nyc:{footprints:[],streets:[]},bay:{footprints:[],streets:[]}}};
for(const[id,city,lon,lat,x,z,scale]of[['nycDowntown','nyc',-74.0134,40.713,-29,45,.025],['bayFerry','bay',-122.3937,37.7955,-7,-10,.04],['bayAlcatraz','bay',-122.423,37.826,17,-46,.04]]){
 const file=`evidence/art-rebuild/${id}-osm.xml`;if(!fs.existsSync(file))continue;const xml=fs.readFileSync(file,'utf8'),nodes=new Map();
 for(const m of xml.matchAll(/<node\b([^>]*)>/g)){const a=Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]+)"/g)].map(v=>[v[1],v[2]]));nodes.set(a.id,[x+(+a.lon-lon)*111320*Math.cos(lat*Math.PI/180)*scale,z-(+a.lat-lat)*111320*scale])}
 for(const m of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)){
  const tags=Object.fromEntries([...m[2].matchAll(/<tag k="([^"]+)" v="([^"]*)"/g)].map(v=>[v[1],v[2]])),points=[...m[2].matchAll(/<nd ref="(\d+)"/g)].map(v=>nodes.get(v[1])).filter(Boolean);if(points.length<2)continue;
  const row={name:tags.name||'',points,tags};
  if(/^(primary|secondary|tertiary|trunk)$/.test(tags.highway||''))output.cities[city].streets.push(row);
  if(tags.building&&/Ferry Building|One World Trade Center|Alcatraz/.test(tags.name||'')||/^(North|South) Pool$/.test(tags.name||'')||id==='bayAlcatraz'&&tags.natural==='coastline')output.cities[city].footprints.push(row);
 }
}
fs.writeFileSync('frontend/src/scene/city-osm.json',JSON.stringify(output));console.log(Object.fromEntries(Object.entries(output.cities).map(([k,v])=>[k,{streets:v.streets.length,footprints:v.footprints.map(f=>[f.name,f.points.length,f.tags.natural])}])));
