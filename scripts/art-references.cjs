const fs=require('fs'),path=require('path');
const out=path.resolve('evidence/art-rebuild');fs.mkdirSync(out,{recursive:true});
const refs={
 'benz-aerial':'https://walterpmoore.imgix.net/images/projects/mercedes-benz-stadium-erection-engineering/dji_0091.jpg?auto=format&fit=crop&w=1400',
 'benz-roof':'https://www.leisureopportunities.co.uk/images/HIGH28224_616044.jpg',
 'centennial-aerial':'https://dtjdesign.com/www/wp-content/uploads/2019/03/header-1920x1200.jpg',
 'centennial-plaza':'https://gibsonlandscape.com/wp-content/uploads/2015/01/COP.jpeg',
 'piedmont-aerial':'https://images.ctfassets.net/ech69gzmnnzr/264moRm7bI0da6cUEFiZ6B/2b3819049570aa9c33c4818087b10985/what-its-like-living-in-atlanta-1017732812.jpg',
 'piedmont-lake':'https://images.trvl-media.com/place/800005/928cfa41-51fd-4ab5-b681-476542b98e21.jpg?h=800&impolicy=fcrop&p=1&q=medium&w=1400'
};
const query='[out:json][timeout:35];(nwr["name"~"Piedmont Park|Lake Clara Meer|Active Oval|Centennial Olympic Park|Mercedes-Benz Stadium|Georgia Aquarium|World of Coca-Cola|State Farm Arena|Georgia World Congress Center"](33.745,-84.412,33.80,-84.36);way["highway"~"^(primary|secondary|trunk)$"](33.745,-84.412,33.80,-84.36););out geom;';
(async()=>{
const result=await Promise.allSettled(Object.entries(refs).map(async([id,url])=>{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`${id} ${r.status}`);fs.writeFileSync(path.join(out,`${id}.jpg`),Buffer.from(await r.arrayBuffer()));return{id,url,status:r.status}}));
for(const host of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){try{const r=await fetch(host+'?data='+encodeURIComponent(query),{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const json=await r.json();fs.writeFileSync(path.join(out,'atlanta-osm.json'),JSON.stringify(json,null,2));result.push({status:'fulfilled',value:{overpass:host,elements:json.elements.length}});break}catch(e){result.push({status:'rejected',reason:String(e)})}}
fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(result,(_,v)=>v instanceof Error?String(v):v,2));console.log(result);
})();
