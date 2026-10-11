const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=path.resolve('evidence/m3');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/rapha/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--use-angle=d3d11']});
 const report={runs:[],errors:[]};
 async function context(size){const context=await browser.newContext({viewport:size});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});return{context,page}}
 try{
 for(const size of [{width:1280,height:800},{width:375,height:812}]){
  const {context:ctx,page}=await context(size),tag=size.width;const started=Date.now();
  await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Start playing',exact:true}).waitFor();await page.waitForTimeout(1200);await page.screenshot({path:path.join(output,`${tag}-landing.png`)});
  await page.getByRole('button',{name:'Start playing',exact:true}).click();await page.screenshot({path:path.join(output,`${tag}-play.png`)});
  await page.getByRole('button',{name:/Play solo/}).click();await page.getByRole('button',{name:'Start my life'}).waitFor();const setupBounds=await page.locator('.modal').boundingBox();assert(setupBounds.x>=0&&setupBounds.x+setupBounds.width<=size.width);await page.screenshot({path:path.join(output,`${tag}-setup.png`)});
  await page.getByLabel('Hair',{exact:true}).selectOption('curly');await page.getByRole('button',{name:'Start my life'}).click();await page.getByRole('button',{name:'Apply',exact:true}).first().waitFor();await page.screenshot({path:path.join(output,`${tag}-jobs.png`)});
  await page.getByRole('button',{name:'Apply',exact:true}).first().click();await page.getByRole('button',{name:/Work a shift/}).waitFor();await page.getByRole('button',{name:'Dismiss result'}).click();
  const before=await(await ctx.request.get('http://127.0.0.1:5173/api/sim')).json();
  await page.getByRole('button',{name:/Work a shift/}).click();await page.getByRole('status').filter({hasText:/Making progress/}).waitFor();await page.screenshot({path:path.join(output,`${tag}-shift.png`)});
  const after=await(await ctx.request.get('http://127.0.0.1:5173/api/sim')).json();assert(after.sim.cash>before.sim.cash);assert.equal(after.sim.job.shifts,1);const secondsToPay=(Date.now()-started)/1000;assert(secondsToPay<120);
  await page.waitForTimeout(3900);await page.getByRole('button',{name:'Dismiss result'}).click();await page.getByRole('button',{name:'My life',exact:true}).click();await page.getByRole('meter').first().waitFor();assert.equal(await page.getByRole('meter').count(),4);assert.equal(await page.locator('.sheet-body').evaluate(e=>e.scrollTop),0);await page.screenshot({path:path.join(output,`${tag}-needs.png`)});
  await page.getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('button',{name:/Take a shower/}).click();await page.getByRole('status').filter({hasText:/Freshened up/}).waitFor();await page.screenshot({path:path.join(output,`${tag}-home.png`)});
  await page.waitForTimeout(2400);await page.getByRole('button',{name:'Dismiss result'}).click();
  const overflow=await page.evaluate(()=>({body:document.documentElement.scrollWidth>innerWidth,panels:[...document.querySelectorAll('.sheet,.bottom-dock,.map-header')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})}));assert(!overflow.body);for(const r of overflow.panels){assert(r.left>=0&&r.right<=size.width&&r.top>=0&&r.bottom<=size.height)}
  report.runs.push({viewport:size,secondsToPay,cashBefore:before.sim.cash,cashAfter:after.sim.cash,job:after.sim.job.title,meters:4,overflow,sim:after.sim});await ctx.close();
 }
 const a=await context({width:1280,height:800}),b=await context({width:375,height:812});await a.page.goto('http://127.0.0.1:5173');await a.page.getByRole('button',{name:'Start playing',exact:true}).click();await a.page.getByRole('button',{name:'Create',exact:true}).click();await a.page.getByRole('button',{name:'Start my life'}).click();await a.page.getByRole('button',{name:'World',exact:true}).click();const code=await a.page.locator('.world-code strong').innerText();await a.page.screenshot({path:path.join(output,'private-owner.png')});
 await b.page.goto('http://127.0.0.1:5173');await b.page.getByRole('button',{name:'Start playing',exact:true}).click();await b.page.getByLabel('Have a world code?').fill('NOTACODE');await b.page.getByRole('button',{name:'Join',exact:true}).click();await b.page.getByRole('alert').filter({hasText:'not found'}).waitFor();await b.page.getByLabel('Have a world code?').fill(code);await b.page.getByRole('button',{name:'Join',exact:true}).click();await b.page.getByRole('button',{name:'Start my life'}).click();await b.page.getByRole('button',{name:'Apply',exact:true}).first().waitFor();await b.page.screenshot({path:path.join(output,'private-joined-phone.png')});
 const meA=await(await a.context.request.get('http://127.0.0.1:5173/api/auth/me')).json(),meB=await(await b.context.request.get('http://127.0.0.1:5173/api/auth/me')).json();assert.equal(meA.world.id,meB.world.id);assert.notEqual(meA.user.id,meB.user.id);report.privateWorld={sameWorld:true,separateUsers:true,invalidCodeRejected:true};await a.context.close();await b.context.close();
 // A rejected join intentionally produces one HTTP 404 console line; retain it separately.
 report.expectedErrors=report.errors.filter(x=>/404/.test(x));report.errors=report.errors.filter(x=>!/404/.test(x));assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({runs:report.runs.map(({sim,...r})=>r),privateWorld:report.privateWorld,errors:report.errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
