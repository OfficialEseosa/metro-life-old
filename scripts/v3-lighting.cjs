const {chromium}=require('C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {attach,walk}=require('./playable-browser.cjs'),url='http://127.0.0.1:5173',out=path.resolve('evidence/visual/v3/lighting');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/rapha/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--use-angle=d3d11']}),report={views:[],errors:[]};try{
 for(const viewport of (process.argv[2]?[{width:Number(process.argv[2]),height:Number(process.argv[2])===1280?800:812}]:[{width:1280,height:800},{width:375,height:812}])){
  const context=await browser.newContext({viewport}),page=await context.newPage(),letters=Date.now().toString(36).replace(/[0-9]/g,d=>String.fromCharCode(97+Number(d)));
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  const post=async(route,data)=>{const r=await context.request.post(url+'/api/'+route,{data});assert(r.ok(),await r.text());return r.json()};
  await post('auth/guest',{});await post('sim/setup',{username:'Light '+letters,pronouns:'they',city:'atl',neighborhood:'midtown',aspiration:'founder'});await post('intro/complete');await page.goto(url);await attach(page);await page.waitForFunction(()=>window.__metroScene?.status().playerParts.length>50,{},{timeout:60000});await page.waitForTimeout(3000);
  for(const quality of(process.argv[3]?[process.argv[3]]:['normal','low'])){
   await page.getByRole('button',{name:'City',exact:true}).click();await page.getByRole('button',{name:'Settings and wardrobe',exact:true}).click();await page.getByRole('button',{name:quality==='normal'?'Cozy':'Low',exact:true}).click();await page.getByRole('button',{name:'Close panel',exact:true}).click();
   for(const venue of['home','krog','techVillage','l5p']){
    const current=(await(await context.request.get(url+'/api/sim')).json()).sim;
    if(current.position.room){await walk(page,0,current.position.room.startsWith('home:')?2.65:3.7,viewport.width<700);await post('door',{enter:false});}
    if(venue!=='home')await post('travel',{city:'atl',loc:venue});else await post('travel',{city:'atl',loc:'home'});
    for(let wait=0;wait<80;wait++){const settled=(await(await context.request.get(url+'/api/sim')).json()).sim;if(!settled.busyUntil)break;await page.waitForTimeout(250)}
    await post('door',{loc:venue,enter:true});await page.evaluate(async()=>window.__store.getState().setSim((await(await fetch('/api/sim')).json()).sim));
    await page.waitForFunction(()=>window.__metroScene?.status().roomLighting&&window.__metroScene.status().playerParts.length>50,{},{timeout:60000});await page.waitForTimeout(8000);
    for(const theme of['day','night']){
     await page.evaluate(theme=>window.__store.getState().setSceneTheme(theme),theme);await page.waitForTimeout(2000);await page.evaluate(()=>window.__metroScene.resetMetrics());
     for(let i=0;i<12;i++)for(const key of['a','d']){await page.keyboard.down(key);await page.waitForTimeout(600);await page.keyboard.up(key)}
     await page.keyboard.down('s');await page.waitForTimeout(100);await page.keyboard.up('s');await page.waitForTimeout(300);
     const status=await page.evaluate(()=>window.__metroScene.status()),metrics=await page.evaluate(()=>window.__metroScene.metrics());assert.equal(status.imageQuality.dpr,1);assert.equal(status.imageQuality.halfResolutionAO,quality==='normal');assert.equal(status.imageQuality.transparencyAware,false);assert.equal(status.imageQuality.automaticBeauty,false);assert.equal(status.roomLighting.shadowSize,1024);assert(metrics.calls<150&&metrics.triangles<300000,JSON.stringify(metrics));const attempts=[{...metrics}];for(let retry=0;metrics.fps<=58&&retry<2;retry++){console.log('RETRY',viewport.width,venue,theme,quality,JSON.stringify(metrics));await page.waitForTimeout(5000);await page.evaluate(()=>window.__metroScene.resetMetrics());for(let i=0;i<12;i++)for(const key of ['a','d']){await page.keyboard.down(key);await page.waitForTimeout(600);await page.keyboard.up(key)}Object.assign(metrics,await page.evaluate(()=>window.__metroScene.metrics()));attempts.push({...metrics});}assert(metrics.fps>58,JSON.stringify({metrics,attempts}));
     await page.screenshot({path:path.join(out,`${viewport.width}-${venue}-${theme}-${quality}.png`)});report.views.push({viewport,venue,theme,quality,metrics,attempts,post:status.imageQuality,room:status.roomLighting});console.log(viewport.width,venue,theme,quality,metrics.fps.toFixed(2),status.imageQuality.postGpuMs?.toFixed(2));
    }
   }
  }
  await context.close();console.log('V3 lighting captures',viewport.width);
 }
 assert.deepEqual(report.errors,[]);console.log('V3 lighting PASS');
 }finally{fs.writeFileSync(path.join(out,process.argv[2]?`report-${process.argv[2]}-${process.argv[3]||'both'}.json`:'report.json'),JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
