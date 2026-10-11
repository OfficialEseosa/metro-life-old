// Photographic study only. These downloads never enter frontend/public.
const fs=require('fs'),sharp=require('C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const pages={empire:'Empire_State_Building',oneWtc:'One_World_Trade_Center',brooklynBridge:'Brooklyn_Bridge',liberty:'Statue_of_Liberty',grandCentral:'Grand_Central_Terminal',met:'Metropolitan_Museum_of_Art',goldenGate:'Golden_Gate_Bridge',ferryBuilding:'San_Francisco_Ferry_Building',salesforce:'Salesforce_Tower',alcatraz:'Alcatraz_Island',paintedLadies:'Painted_ladies',sfCityHall:'San_Francisco_City_Hall'};
const out='evidence/art-rebuild/references-cities';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const results=await Promise.allSettled(Object.entries(pages).map(async([id,title])=>{
  const page='https://en.wikipedia.org/wiki/'+title,r=await fetch(page,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`${id} page ${r.status}`);const html=await r.text();fs.writeFileSync(`${out}/${id}.html`,html);
  const urls=[...new Set([...html.matchAll(/src="(\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/thumb\/[^"?]+\.(?:jpg|JPG|jpeg|png))/g)].map(m=>'https:'+m[1].replace('thumb.wikimedia','upload.wikimedia')))].filter(u=>!/(?:logo|map|Flag_|icon|signature|diagram|plan|seal|coat|wordmark|\.svg)/i.test(u));
  const picked=urls.filter(u=>Number(u.match(/\/(\d+)px-/)?.[1]||0)>=220).slice(0,5),images=[];
  for(let i=0;i<picked.length;i++){const url=picked[i].replace(/\/\d+px-/,'/960px-'),res=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!res.ok){images.push({url,status:res.status});continue}const file=`${out}/${id}-${i}.jpg`;fs.writeFileSync(file,Buffer.from(await res.arrayBuffer()));images.push({url,status:res.status,file})}
  return{id,page,images};
 }));
 fs.writeFileSync(`${out}/sources.json`,JSON.stringify(results,(_,v)=>v instanceof Error?String(v):v,2));
 for(const r of results){if(r.status!=='fulfilled')continue;const {id,images}=r.value,good=images.filter(i=>i.file);if(!good.length)continue;const layers=[];for(let i=0;i<good.length;i++){layers.push({input:await sharp(good[i].file).resize(400,280,{fit:'contain',background:'#eee'}).toBuffer(),left:i%2*400,top:Math.floor(i/2)*305});layers.push({input:Buffer.from(`<svg width="400" height="25"><text x="8" y="18" font-size="16">${id}-${i}</text></svg>`),left:i%2*400,top:Math.floor(i/2)*305+280})}await sharp({create:{width:800,height:Math.ceil(good.length/2)*305,channels:4,background:'#fff'}}).composite(layers).png().toFile(`${out}/${id}-contact.png`)}
 console.log(JSON.stringify(results,(_,v)=>v instanceof Error?String(v):v,2));
})();
