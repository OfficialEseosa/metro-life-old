const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('evidence/final-review/a'),url='http://127.0.0.1:5173';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/rapha/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--use-angle=d3d11']});const report={views:[],errors:[]};try{
for(const viewport of [{width:1280,height:800},{width:375,height:812}])for(const skew of [10000,-120000]){
 const context=await browser.newContext({viewport}),p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.addInitScript(skew=>{const now=Date.now.bind(Date);Date.now=()=>now()+skew;Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}})},skew);
 const post=async(route,data)=>{const r=await context.request.post(url+'/api/'+route,{data});assert(r.ok(),await r.text());return r.json()};
 await post('auth/guest',{});await post('worlds',{mode:'solo',name:'Authority review'});await post('sim/setup',{city:'atl',neighborhood:'midtown',aspiration:'founder'});await post('jobs/apply',{jobId:'tech-1'});
 await p.goto(url);await p.getByRole('button',{name:'Mute sound'}).click();await p.getByRole('button',{name:'Turn sound on'}).click();await p.waitForFunction(()=>!!window.__metroScene);
 await p.evaluate(async()=>{const u=performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/store.ts'));window.store=(await import(u)).useStore;const resources=performance.getEntriesByType('resource').map(e=>e.name);window.client=await import(resources.find(u=>u.includes('/src/api/client.ts')));window.time=await import(resources.find(u=>u.includes('/src/server-time.ts')))});
 const server=(await(await context.request.get(url+'/api/auth/me')).json()).now,client=await p.evaluate(()=>window.time.serverNow());assert(Math.abs(client-server)<1500,JSON.stringify({client,server}));
 await p.evaluate(()=>{window.store.getState().selectLocation('home');window.store.getState().setFocus('home')});if(viewport.width===375)await p.getByRole('button',{name:/Resize panel/}).press('ArrowUp');await p.locator('.actions-list button').first().waitFor();
 // Freeze a pre-action snapshot at the network boundary, then deliver it after the mutation.
 let release;const held=new Promise(r=>release=r);let fetched;const ready=new Promise(r=>fetched=r);
 await p.route('**/api/sim',async route=>{const response=await route.fetch();fetched();await held;await route.fulfill({response})},{times:1});
 await p.evaluate(()=>{window.oldRead=window.client.api.sim().then(r=>{window.store.getState().setSim(r.sim);return 'accepted'}).catch(e=>e.message)});await ready;
 let acts=0;await p.route('**/api/act',async route=>{acts++;await new Promise(r=>setTimeout(r,600));await route.continue()});
 await p.evaluate(()=>{document.querySelector('.sheet-primary button').click();document.querySelector('.actions-list button').click()});
 await p.locator('.busy-card').first().waitFor();assert.equal(acts,1);release();const old=await p.evaluate(()=>window.oldRead);assert.equal(old,'A newer action is already in progress.');assert(await p.evaluate(()=>!!window.store.getState().sim.busyUntil));
 await p.screenshot({path:path.join(out,`${viewport.width}-${skew}-busy.png`)});
 await p.locator('.busy-card').waitFor({state:'detached'});await p.evaluate(()=>window.store.getState().selectLocation('techVillage'));await p.getByRole('button',{name:/Work a shift/}).waitFor();
 const cash=await p.evaluate(()=>window.store.getState().sim.cash);await p.getByRole('button',{name:/Work a shift/}).click();await p.locator('.busy-card').first().waitFor();await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>window.store.getState().sim.cash),cash);assert.equal(await p.evaluate(()=>window.store.getState().lastResult),null);
 await p.waitForFunction(cash=>window.store.getState().sim.cash>cash,cash);await p.waitForFunction(()=>!!window.store.getState().lastResult);await p.waitForTimeout(800);
 await p.screenshot({path:path.join(out,`${viewport.width}-${skew}-paid.png`)});report.views.push({viewport,skew,storageBlocked:true,soundDefaultsOn:true,serverClock:true,stalePollRejected:true,doubleTapRequests:acts-1,payOnlyAtCompletion:true});await context.close();
}assert.deepEqual(report.errors,[]);console.log('Final A PASS')}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
