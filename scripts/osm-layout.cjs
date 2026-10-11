// Offline, deterministic conversion of the account-free OSM map API extracts.
const fs=require('fs'),path=require('path'),out='frontend/src/scene/atl-osm.json';
const nodes=new Map(),ways=new Map(),relations=[];
for(const name of ['centennial','stadium','piedmont']){
 const file=`evidence/art-rebuild/${name}-osm.xml`;if(!fs.existsSync(file))continue;const xml=fs.readFileSync(file,'utf8');
 for(const match of xml.matchAll(/<node\b([^>]*)>/g)){const attr=Object.fromEntries([...match[1].matchAll(/(\w+)="([^"]+)"/g)].map(x=>[x[1],x[2]]));nodes.set(attr.id,{lat:+attr.lat,lon:+attr.lon})}
 for(const m of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)){const id=m[1].match(/id="(\d+)"/)[1],tags=Object.fromEntries([...m[2].matchAll(/<tag k="([^"]+)" v="([^"]*)"/g)].map(x=>[x[1],x[2]]));ways.set(id,{id,tags,refs:[...m[2].matchAll(/<nd ref="(\d+)"/g)].map(x=>x[1])})}
 for(const m of xml.matchAll(/<relation\b[^>]*>([\s\S]*?)<\/relation>/g)){const tags=Object.fromEntries([...m[1].matchAll(/<tag k="([^"]+)" v="([^"]*)"/g)].map(x=>[x[1],x[2]]));relations.push({tags,members:[...m[1].matchAll(/<member type="way" ref="(\d+)" role="(?:outer)?"/g)].map(x=>x[1])})}
}
// Multipolygon outer members are open edge fragments: stitch their node IDs before triangulation.
for(const r of relations)if(/^(Centennial Olympic Park|Mercedes-Benz Stadium|Georgia Aquarium|World of Coca-Cola|State Farm Arena)$/.test(r.tags.name||'')){
 const remaining=r.members.map(id=>ways.get(id)).filter(Boolean),joined=[];
 while(remaining.length){const first=remaining.shift(),refs=[...first.refs];let found=true;
  while(found&&refs[0]!==refs.at(-1)){found=false;for(let i=0;i<remaining.length;i++){let part=remaining[i].refs;if(part[0]===refs.at(-1)||part.at(-1)===refs.at(-1)){if(part.at(-1)===refs.at(-1))part=[...part].reverse();refs.push(...part.slice(1));remaining.splice(i,1);found=true;break}}}
  if(refs[0]===refs.at(-1))joined.push(refs);
 }
 for(const id of r.members)ways.delete(id);
 joined.forEach((refs,i)=>ways.set(`relation-${r.tags.name}-${i}`,{id:`relation-${r.tags.name}-${i}`,tags:r.tags,refs}));
}
const items=[...ways.values()].map(w=>({...w,points:w.refs.map(r=>nodes.get(r)).filter(Boolean)})).filter(w=>w.points.length>1);
const named=items.filter(w=>/^(Centennial Olympic Park|Mercedes-Benz Stadium|Georgia Aquarium|World of Coca-Cola|State Farm Arena)$/.test(w.tags.name||''));
const streets=items.filter(w=>/^(primary|secondary|tertiary|trunk)$/.test(w.tags.highway||''));
// Main street evidence remains in lat/lon. Scene uses a local north-up affine projection.
const project=p=>[(p.lon+84.393)*92500*.045-12,-(p.lat-33.760)*111320*.045+4];
const data={attribution:'Map data (c) OpenStreetMap contributors',source:'https://api.openstreetmap.org/api/0.6/map',footprints:named.map(w=>({id:w.id,name:w.tags.name,tags:w.tags,points:w.points.map(project)})),streets:streets.map(w=>({id:w.id,name:w.tags.name||'',points:w.points.map(project)}))};
fs.writeFileSync(out,JSON.stringify(data));fs.writeFileSync('evidence/art-rebuild/osm-summary.json',JSON.stringify({footprints:data.footprints.map(w=>({id:w.id,name:w.name,n:w.points.length})),streets:streets.length},null,2));console.log({footprints:data.footprints.length,streets:streets.length});
