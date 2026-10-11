// Focused integration review; the full per-city recognition round follows this.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const deps='C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const{chromium}=require(deps+'/playwright'),sharp=require(deps+'/sharp');
const out=path.resolve('evidence/art-rebuild/cities-integrated');fs.mkdirSync(out,{recursive:true});
const heroes={atl:['arena'],nyc:['empire','oneWtc','brooklynBridge','liberty','grandCentral','met'],bay:['goldenGate','ferryBuilding','salesforce','alcatraz','paintedLadies','sfCityHall']};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/rapha/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--use-angle=d3d11']});
 const report={errors:[],requests:[],cities:[]};
 try{
  const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});p.on('response',r=>{if(/\/models\/.*\.(glb|gltf)$/.test(r.url()))report.requests.push({url:r.url(),status:r.status()})});
  await p.goto('http://127.0.0.1:5173');await p.waitForFunction(()=>!!window.__metroScene);await p.waitForTimeout(6000);
  // Exercise visibility lifecycle while allowing ordinary React clock updates.
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(300);const frozen=await p.evaluate(()=>window.__metroScene.status());await p.waitForTimeout(1400);const frozenLater=await p.evaluate(()=>window.__metroScene.status());assert.equal(frozen.frameloop,'never');assert.equal(frozen.frame,frozenLater.frame,'No hidden scene frames');
  await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(500);const resumed=await p.evaluate(()=>window.__metroScene.status());assert.equal(resumed.frameloop,'demand');assert(resumed.frame>frozen.frame,'Visibility resumes rendering without map input');report.visibility={frozenFrame:frozen.frame,frozenLaterFrame:frozenLater.frame,resumedFrame:resumed.frame,method:'visibilitychange with test-controlled document.hidden'};
  for(const[city,ids]of Object.entries(heroes).filter(([city])=>!process.argv[2]||city===process.argv[2])){
   await p.locator('.metro-hud').evaluate(e=>e.style.visibility='');await p.getByLabel('View city').selectOption(city);await p.waitForFunction(ids=>ids.every(id=>window.__metroScene?.geometry()[id]>0),ids);await p.waitForTimeout(1500);await p.addStyleTag({content:'.map-tooltip{visibility:hidden!important}'});await p.locator('.metro-hud').evaluate(e=>e.style.visibility='hidden');await p.evaluate(()=>window.__metroScene.hidePins(true));
   const entry={city,geometry:await p.evaluate(()=>window.__metroScene.geometry()),views:[]};
   for(const id of ids)assert(entry.geometry[id]<12000,`${id} triangle budget`);
   for(const viewport of[{width:1280,height:800},{width:375,height:812},{width:667,height:375}]){
    await p.setViewportSize(viewport);
    for(const theme of['day','night']){
     await p.evaluate(t=>window.__metroScene.theme(t),theme);const layers=[];
     for(let i=0;i<ids.length;i++){
      const id=ids[i];await p.evaluate(id=>window.__metroScene.focus(id),id);await p.waitForTimeout(500);const file=path.join(out,`${id}-${theme}-${viewport.width}.png`);await p.screenshot({path:file});
      layers.push({input:await sharp(file).resize(400,250,{fit:'contain',background:'#e6e9ee'}).toBuffer(),left:i%2*400,top:Math.floor(i/2)*275},{input:Buffer.from(`<svg width="400" height="25"><text x="8" y="18" font-size="16">${id}</text></svg>`),left:i%2*400,top:Math.floor(i/2)*275+250});
     }
     await sharp({create:{width:800,height:Math.ceil(ids.length/2)*275,channels:4,background:'#fff'}}).composite(layers).png().toFile(path.join(out,`${city}-${theme}-${viewport.width}-contact.png`));
     await p.evaluate(()=>window.__metroScene.focus(null));await p.waitForTimeout(6500);const metrics=await p.evaluate(()=>window.__metroScene.metrics());await p.screenshot({path:path.join(out,`${city}-skyline-${theme}-${viewport.width}.png`)});
     const peak=await p.evaluate(async()=>{window.__metroScene.refreshShadows();let peak={triangles:0};for(let i=0;i<40;i++){await new Promise(requestAnimationFrame);const m=window.__metroScene.metrics();if(m.triangles>peak.triangles)peak=m}return peak});entry.views.push({viewport,theme,metrics,shadowPeak:peak});assert(peak.calls<150&&peak.triangles<300000,`${city} shadow budget: ${peak.triangles}`);
    }
   }
   report.cities.push(entry);console.log(city,JSON.stringify(entry.views));
  }
  assert(report.requests.every(r=>r.status===200));assert.deepEqual(report.errors,[]);
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close()}
 console.log('Focused GLB integration and visibility lifecycle PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
