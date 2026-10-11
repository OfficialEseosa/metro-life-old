const fs=require('fs'),path=require('path');
const bundle='C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(bundle,'playwright')),sharp=require(path.join(bundle,'sharp'));
const root=path.resolve(__dirname,'..'),output=path.join(root,'evidence/m2',process.argv[2]||'round1');fs.mkdirSync(output,{recursive:true});
const world=JSON.parse(fs.readFileSync(path.join(root,'shared/world.json'),'utf8'));
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Users/rapha/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--use-angle=d3d11']});
  const report={measurements:[],errors:[],checks:{}};
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__metroScene);
  await page.evaluate(()=>window.__metroScene.theme('day'));
  await page.waitForTimeout(6000);
  report.geometry=await page.evaluate(()=>window.__metroScene.geometry());
  // Actual user selection and pin hit-testing, through the store and camera.
  await page.locator('#destination').selectOption('capitol');await page.waitForTimeout(1300);
  report.checks.dropdown=await page.locator('.place-card h2').innerText()==='Georgia State Capitol';
  await page.evaluate(()=>window.__metroScene.focus(null));await page.waitForTimeout(250);
  const pin=await page.evaluate(()=>window.__metroScene.project('krog'));await page.mouse.move(pin.x,pin.y);await page.waitForTimeout(100);await page.mouse.click(pin.x,pin.y);await page.waitForTimeout(1000);
  report.checks.pinClick=await page.locator('.place-card h2').innerText()==='Krog Street Market';
  await page.locator('.overview-button').click();await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(output,'atl-ui-1280.png')});
  for(const viewport of [{width:1280,height:800},{width:375,height:812}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(250);
    await page.addStyleTag({content:'.metro-hud,.map-tooltip{visibility:hidden !important}'});
    for(const theme of ['day','night']){
      await page.evaluate(t=>{window.__metroScene.theme(t);window.__metroScene.hidePins(true);window.__metroScene.focus(null)},theme);await page.waitForTimeout(5500);
      report.measurements.push({width:viewport.width,theme,...await page.evaluate(()=>window.__metroScene.metrics())});
      await page.screenshot({path:path.join(output,`atl-skyline-${theme}-${viewport.width}.png`)});
      const tiles=[];
      for(const loc of world.cities[0].landmarks){
        await page.evaluate(id=>window.__metroScene.focus(id),loc.id);await page.waitForTimeout(180);
        const name=`atl-${loc.id}-${theme}-${viewport.width}.png`,file=path.join(output,name);await page.screenshot({path:file});
        const tileHeight=viewport.width===375?416:160;
        const thumb=await sharp(file).resize(256,tileHeight,{fit:'contain',background:'#e1e3cf'}).png().toBuffer();
        const label=Buffer.from(`<svg width="256" height="24"><rect width="256" height="24" fill="#faf7ee"/><text x="8" y="16" font-size="12" fill="#254537">${loc.id}: ${loc.name.replace(/&/g,'&amp;')}</text></svg>`);
        tiles.push({input:thumb,left:0,top:0});
        const index=world.cities[0].landmarks.indexOf(loc);tiles.push({input:label,left:(index%5)*256,top:Math.floor(index/5)*184+160});
      }
      // Reposition tiles by landmark ordinal (two layers per card).
      const tileHeight=viewport.width===375?416:160;
      tiles.forEach((tile,i)=>{const n=Math.floor(i/2);tile.left=(n%5)*256;tile.top=Math.floor(n/5)*(tileHeight+24)+(i%2?tileHeight:0)});
      await sharp({create:{width:1280,height:(tileHeight+24)*4,channels:4,background:'#f8f5ed'}}).composite(tiles).png().toFile(path.join(output,`review-${theme}-${viewport.width}.png`));
    }
  }
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
