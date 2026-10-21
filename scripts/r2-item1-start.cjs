// Real startup journey. Run one width at a time with the shared GPU QA slot.
// METRO_WIDTH=1280 selects New York; METRO_WIDTH=390 selects the Bay Area.
const {chromium}=require('C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{attach}=require('./playable-browser.cjs');
const width=Number(process.env.METRO_WIDTH||1280),height=width===1280?800:812;
const base='http://127.0.0.1:5174',out=path.resolve('evidence/round2/item1-start');
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
assert([1280,390].includes(width),'Use METRO_WIDTH=1280 or 390');
fs.mkdirSync(out,{recursive:true});

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/rapha/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--use-angle=d3d11']});
 const context=await browser.newContext({viewport:{width,height}});
 const report={width,height,base,controlledPlayerSetup:'Actual Creator and city card buttons only',views:[],checks:[],errors:[],setupRequests:[]};
 let page;
 try{
  page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/sim/setup')report.setupRequests.push(r.postDataJSON())});
  const shot=async(label,extra={})=>{
   await page.waitForTimeout(350);
   await page.screenshot({path:path.join(out,`${width}-${label}.png`)});
   const scene=await page.evaluate(()=>({status:window.__metroScene?.status(),metrics:window.__metroScene?.metrics(),sim:window.__store?.getState().sim}));
   report.views.push({label,...extra,...scene});
   console.log(width,label,scene.metrics?JSON.stringify(scene.metrics):'startup UI');
  };
  const session=async()=>{const response=await context.request.get(base+'/api/auth/me');assert(response.ok(),'/api/auth/me status '+response.status());return response.json()};
  await page.goto(base);
  const creator=page.getByRole('dialog',{name:'Create your character',exact:true});
  await creator.waitFor({timeout:30000});
  const worldResponse=await context.request.get(base+'/api/world');assert(worldResponse.ok(),'/api/world status '+worldResponse.status());
  const world=await worldResponse.json();
  assert.equal(world.cities.length,3);
  const fresh=await session();assert(fresh.user,'Automatic guest session exists');assert(!fresh.sim,'Fresh context has no Sim before the actual setup form');
  report.initialSession={guest:fresh.user.guest??null,hasUser:!!fresh.user,hasSim:!!fresh.sim};
  assert.equal(await page.locator('input[type="password"],input[type="email"]').count(),0,'Startup has no account fields');
  const name='Start '+Array.from({length:8},()=>String.fromCharCode(97+Math.floor(Math.random()*26))).join('');
  await creator.getByRole('textbox',{name:'Your name',exact:true}).fill(name);
  await page.waitForTimeout(2500);
  await shot('creator',{name,copy:await creator.innerText()});
  await creator.getByRole('button',{name:'Choose my city',exact:true}).click();
  const chooser=page.getByRole('dialog',{name:'Choose your home city',exact:true});
  await chooser.waitFor();
  assert.equal(await chooser.locator('.start-city-option').count(),3);
  const card=city=>chooser.getByRole('button',{name:new RegExp(escaped(city.name))});
  report.costCards=[];
  for(const city of world.cities){
   assert(city.startingLife,'Starting life must be supplied by the API for '+city.id);
   const start=city.startingLife,neighborhood=city.neighborhoods.find(n=>n.id===start.neighborhood);
   assert(neighborhood,'Starting neighborhood exists for '+city.id);
   const item=card(city),values=await item.locator('dl > div').evaluateAll(rows=>rows.map(row=>({label:row.querySelector('dt').textContent,value:row.querySelector('dd').textContent})));
   assert.deepEqual(values,[{label:'Daily rent',value:money(start.rent)},{label:'Entry shift pay',value:money(start.payPerShift)},{label:'After rent, per shift',value:money(start.payPerShift-start.rent)}]);
   assert((await item.innerText()).includes(neighborhood.name+' studio'));
   assert.equal(await item.getAttribute('aria-pressed'),String(city.id==='atl'));
   report.costCards.push({city:city.id,neighborhood:neighborhood.id,...start,values});
  }
  report.checks.push('All three rendered city cost cards exactly match API startingLife rent, wages, disposable shift income and neighborhood; Atlanta initially selected');
  const atl=world.cities.find(c=>c.id==='atl'),nyc=world.cities.find(c=>c.id==='nyc'),bay=world.cities.find(c=>c.id==='bay');
  await card(atl).scrollIntoViewIfNeeded();
  await shot('cost-cards-atlanta-default',{selected:'atl',cards:report.costCards});
  for(const [city,label]of[[nyc,'new-york-selected'],[bay,'bay-selected']]){
   await card(city).click();assert.equal(await card(city).getAttribute('aria-pressed'),'true');
   assert.equal(await chooser.locator('.start-city-option[aria-pressed="true"]').count(),1);
   await card(city).scrollIntoViewIfNeeded();await shot(label,{selected:city.id,copy:await card(city).innerText()});
  }
  const selected=width===1280?nyc:bay;
  if(selected.id!=='bay'){await card(selected).click();await card(selected).scrollIntoViewIfNeeded();await shot('final-new-york-choice',{selected:selected.id})}
  await chooser.getByRole('button',{name:`Begin in ${selected.short}`,exact:true}).click();
  const arrival=page.getByRole('dialog',{name:'Your arrival',exact:true});await arrival.waitFor({timeout:30000});
  await attach(page);
  const begun=await session(),start=selected.startingLife;
  assert.equal(begun.sim.username,name);assert.equal(begun.sim.city,selected.id);
  assert.equal(begun.sim.home.neighborhood,start.neighborhood);assert.equal(begun.sim.home.rent,start.rent);
  assert.equal(begun.sim.cash,start.startingCash);assert.equal(begun.sim.introDone,false);
  assert.equal(report.setupRequests.length,1,'Exactly one setup request, emitted by the actual UI');
  assert.equal(report.setupRequests[0].city,selected.id);assert.equal(report.setupRequests[0].neighborhood,start.neighborhood);
  report.arrival={city:begun.sim.city,home:begun.sim.home,cash:begun.sim.cash,username:begun.sim.username};
  await shot('arrival-card-one',{copy:await arrival.innerText()});
  report.introCards=[];
  for(let i=0;i<4;i++){
   const text=await arrival.innerText();assert(text.includes(`${i+1} / 4`));report.introCards.push(text);
   if(i===0)assert(text.includes(selected.name));
   if(i===2){assert(text.includes(`studio costs ${money(start.rent)} a day`));assert(text.includes(`Entry shifts here pay ${money(start.payPerShift)}`));await shot('arrival-costs',{copy:text})}
   if(i===3)await shot('turn-the-key',{copy:text});
   await arrival.getByRole('button',{name:i===3?'Turn the key':'Next',exact:true}).click();
  }
  await arrival.waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.__store.getState().sim?.introDone&&window.__metroScene.status().roomLighting&&window.__metroScene.status().playerParts.length>50,{},{timeout:30000});
  const home=await page.evaluate(()=>window.__store.getState().sim);
  assert.equal(home.city,selected.id);assert.equal(home.home.neighborhood,start.neighborhood);assert.equal(home.home.rent,start.rent);assert(home.position.room?.startsWith('home:'));
  assert.equal(await page.locator('input[type="password"],input[type="email"]').count(),0);
  report.checks.push(`Actual UI begins ${selected.id}, sets its authoritative starting studio and rent, shows its true entry wage, completes all four arrival cards and opens the furnished home`);
  await page.waitForTimeout(2000);await shot('studio-home');
  await page.evaluate(()=>window.__metroScene.resetMetrics());
  report.movement={input:width===390?'visible walking joystick':'WASD keyboard',samples:[]};
  const joystick=width===390?await page.getByRole('region',{name:'Walking joystick',exact:true}).boundingBox():null;
  if(width===390)assert(joystick,'Phone joystick visible');
  for(let i=0;i<8;i++){
   if(joystick){const x=joystick.x+joystick.width/2,y=joystick.y+joystick.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+(i%2?-34:34),y)}
   else await page.keyboard.down(i%2?'a':'d');
   await page.waitForTimeout(500);
   report.movement.samples.push(await page.evaluate(()=>({...window.__walk.motion.position})));
   if(joystick)await page.mouse.up();else await page.keyboard.up(i%2?'a':'d');
  }
  const xs=report.movement.samples.map(p=>p.x),zs=report.movement.samples.map(p=>p.z);
  assert(Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs))>.2,'Real movement changes the rendered player position');
  await shot(width===390?'phone-frame-active-movement':'studio-active-movement');
  report.movement.metrics=report.views.at(-1).metrics;
  report.checks.push('Held actual walking controls for four seconds; recorded active draw calls, triangles, FPS, frame timing and movement samples');
  assert.deepEqual(report.errors,[]);
  report.result='PASS';
 }catch(e){
  report.result='FAIL';report.failure=e.stack;
  if(page){report.state=await page.evaluate(()=>({sim:window.__store?.getState().sim,status:window.__metroScene?.status(),dialogs:[...document.querySelectorAll('[role="dialog"]')].map(n=>n.innerText)})).catch(()=>null);await page.screenshot({path:path.join(out,`${width}-failure.png`)}).catch(()=>{})}
  throw e;
 }finally{
  fs.writeFileSync(path.join(out,`report-${width}.json`),JSON.stringify(report,null,2)+'\n');
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
