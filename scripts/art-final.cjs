const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const deps='C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(deps+'/playwright'),sharp=require(deps+'/sharp');
const out=path.resolve('evidence/art-rebuild/atl-final');fs.mkdirSync(out,{recursive:true});
const heroes=['benz','centennial','piedmont','capitol','fox','ponce','high','aquarium'];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/rapha/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--use-angle=d3d11']});
 const report={errors:[],requests:[],views:[]};
 try{
  const p=await browser.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});p.on('response',r=>{if(/\/models\/.*\.(glb|gltf)$/.test(r.url()))report.requests.push({url:r.url(),status:r.status()})});
  await p.goto('http://127.0.0.1:5173');await p.waitForFunction(()=>!!window.__metroScene);await p.waitForTimeout(5000);await p.addStyleTag({content:'.metro-hud,.map-tooltip{visibility:hidden!important}'});await p.evaluate(()=>window.__metroScene.hidePins(true));
  for(const viewport of[{width:1280,height:800},{width:667,height:375},{width:375,height:812}]){
   await p.setViewportSize(viewport);
   for(const theme of ['day','night']){
    await p.evaluate(theme=>window.__metroScene.theme(theme),theme);
    for(const id of heroes){await p.evaluate(id=>window.__metroScene.focus(id),id);await p.waitForTimeout(650);await p.screenshot({path:path.join(out,`${id}-${theme}-${viewport.width}.png`)})}
    await p.evaluate(()=>window.__metroScene.focus(null));await p.waitForTimeout(5500);report.views.push({viewport,theme,...await p.evaluate(()=>window.__metroScene.metrics())});await p.screenshot({path:path.join(out,`skyline-${theme}-${viewport.width}.png`)});
   }
  }
  report.geometry=await p.evaluate(()=>window.__metroScene.geometry());report.shadowPeak=await p.evaluate(async()=>{window.__metroScene.refreshShadows();let peak={triangles:0};for(let i=0;i<40;i++){await new Promise(requestAnimationFrame);const m=window.__metroScene.metrics();if(m.triangles>peak.triangles)peak=m}return peak});
  for(const id of heroes)assert(report.geometry[id]>0&&report.geometry[id]<12000,`${id} triangle budget`);
  assert(report.shadowPeak.calls<150&&report.shadowPeak.triangles<300000);assert.deepEqual(report.errors,[]);assert(report.requests.every(r=>r.status===200));
  for(const id of heroes.slice(0,3)){
   const left=await sharp(path.resolve('evidence/art-rebuild/before',`${id}-1280.png`)).resize(640,400).toBuffer(),right=await sharp(path.join(out,`${id}-day-1280.png`)).resize(640,400).toBuffer();
   await sharp({create:{width:1280,height:432,channels:4,background:'#fff'}}).composite([{input:left,left:0,top:32},{input:right,left:640,top:32},{input:Buffer.from('<svg width="1280" height="32"><text x="12" y="23" font-size="18">Before</text><text x="652" y="23" font-size="18">Blender GLBs + instanced model kits</text></svg>'),left:0,top:0}]).png().toFile(path.join(out,`${id}-comparison.png`));
  }
  for(const theme of ['day','night']){
   const layers=[];for(let i=0;i<heroes.length;i++){layers.push({input:await sharp(path.join(out,`${heroes[i]}-${theme}-1280.png`)).resize(400,250).toBuffer(),left:i%2*400,top:Math.floor(i/2)*275});layers.push({input:Buffer.from(`<svg width="400" height="25"><text x="8" y="18" font-size="16">${heroes[i]}</text></svg>`),left:i%2*400,top:Math.floor(i/2)*275+250})}
   await sharp({create:{width:800,height:1100,channels:4,background:'#fff'}}).composite(layers).png().toFile(path.join(out,`${theme}-contact.png`));
  }
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close()}
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
