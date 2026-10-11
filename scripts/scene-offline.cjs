const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Users/rapha/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',args:['--use-angle=d3d11']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],failedRequests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failedRequests.push({url:r.url(),status:r.status()})});
    await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.__metroScene);await page.evaluate(()=>window.__metroScene.theme('day'));await page.waitForTimeout(1500);
    const result={errors,failedRequests,landmarks:await page.locator('#destination option').count()-1,metrics:await page.evaluate(()=>window.__metroScene.metrics())};
    if(result.errors.length||result.landmarks!==20||result.metrics.calls<20)throw Error('Offline scene failed');
    const output=path.resolve(__dirname,'../evidence/m2');await page.screenshot({path:path.join(output,'backend-down.png')});fs.writeFileSync(path.join(output,'backend-down.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
