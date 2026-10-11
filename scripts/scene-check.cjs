const fs = require('fs'); const path = require('path');
const bundle = 'C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = require(path.join(bundle, 'playwright'));
const root = path.resolve(__dirname, '..'); const output = path.join(root, 'evidence/m2'); fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/rapha/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe', args: ['--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors=[]; page.on('pageerror', e => errors.push(e.message)); page.on('console', msg => {if(msg.type()==='error')errors.push(msg.text())});
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__metroScene); await page.waitForTimeout(2500);
  await page.screenshot({path:path.join(output,'first-desktop.png')});
  const metrics = await page.evaluate(() => window.__metroScene.metrics());
  fs.writeFileSync(path.join(output,'first-check.json'), JSON.stringify({metrics,errors},null,2));
  console.log(JSON.stringify({metrics,errors}));
  await browser.close();
})().catch(e => {console.error(e);process.exit(1)});
