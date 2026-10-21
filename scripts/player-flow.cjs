// Optional future player journey against an isolated running server. No screenshots or performance probes.
// METRO_URL defaults to the isolated development server; this creates one new browser life.
const assert=require('node:assert/strict');
let playwright;try{playwright=require('playwright')}catch{playwright=require('C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
const base=process.env.METRO_URL||'http://127.0.0.1:5174';
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const suffix=Date.now().toString(36).replace(/[0-9]/g,digit=>String.fromCharCode(97+Number(digit))),name='Avery '+suffix;
  await page.goto(base);await page.getByLabel('Your name',{exact:true}).fill(name);
  await page.getByRole('button',{name:'Look',exact:true}).click();await page.getByRole('button',{name:'Bob',exact:true}).click();await page.getByRole('button',{name:'Bright',exact:true}).click();
  await page.getByRole('button',{name:'Personality',exact:true}).click();await page.getByRole('button',{name:/^Homebody/}).click();await page.getByRole('button',{name:/^Foodie/}).click();
  await page.getByRole('button',{name:'Dream',exact:true}).click();await page.getByRole('button',{name:/^Restaurateur/}).click();
  await page.getByRole('button',{name:/Choose my city/}).click();await page.getByRole('button',{name:/^New York/}).click();await page.getByRole('button',{name:/^Begin in/}).click();
  for(let card=0;card<3;card++)await page.getByRole('button',{name:/^Next/}).click();await page.getByRole('button',{name:/Turn the key/}).click();
  await page.getByRole('button',{name:'Open your needs and skills',exact:true}).waitFor({timeout:30000});
  const before=await (await context.request.get(base+'/api/auth/me')).json();assert.equal(before.sim.username,name);assert.equal(before.sim.city,'nyc');assert.equal(before.sim.look.hair,'bob');assert.equal(before.sim.look.face,'bright');assert(before.sim.traits.includes('foodie'));assert.equal(before.sim.aspiration.id,'restaurateur');
  await page.reload();await page.getByRole('button',{name:'Open your needs and skills',exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();
  const after=await (await context.request.get(base+'/api/auth/me')).json();assert.equal(after.sim.userId,before.sim.userId);assert.deepEqual(after.sim.home,before.sim.home);assert.deepEqual(after.sim.look,before.sim.look);assert.deepEqual(errors,[]);
  console.log('Player flow passed: create, appearance, personality, dream, city choice, intro and saved-life reload.');
 }finally{await context.close();await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
