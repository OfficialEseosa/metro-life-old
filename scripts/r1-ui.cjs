const { chromium } = require('C:/Users/rapha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');

const url = (process.env.METRO_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = path.resolve(process.env.METRO_EVIDENCE || 'evidence/round1/item1-ui');
fs.mkdirSync(out, { recursive: true });

async function browserLife(context) {
  const response = await context.request.get(url + '/api/auth/me');
  assert.equal(response.status(), 200);
  return response.json();
}

async function noCredentialUi(page) {
  assert.equal(await page.locator('input[type="password"]').count(), 0, 'Password input found');
  assert.equal(await page.getByRole('button', { name: /\b(log\s*in|sign\s*up|register|create account)\b/i }).count(), 0);
  assert.equal(await page.getByRole('link', { name: /\b(log\s*in|sign\s*up|register|create account)\b/i }).count(), 0);
}

async function explainedDisabledButtons(page) {
  const buttons = page.locator('button:disabled');
  const result = [];
  for (const button of await buttons.all()) {
    const reason = button.locator('.gate-reason');
    assert.equal(await reason.count(), 1, 'Disabled button needs one inline reason: ' + await button.innerText());
    assert(await reason.isVisible(), 'Disabled reason is hidden');
    const text = (await reason.innerText()).trim();
    assert(text.length > 0, 'Disabled reason is empty');
    const id = await reason.getAttribute('id');
    const descriptions = (await button.getAttribute('aria-describedby') || '').split(/\s+/);
    assert(id && descriptions.includes(id), 'Disabled reason missing aria-describedby association');
    result.push({ text: await button.innerText(), reason: text, descriptionId: id });
  }
  assert(result.length > 0, 'Expected to inspect disabled controls');
  return result;
}

async function run() {
  const report = { url, views: [], errors: [], passed: false };
  const browser = await chromium.launch({
    executablePath: 'C:/Users/rapha/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
    headless: true,
    args: ['--use-angle=d3d11'],
  });
  try {
    for (const width of [1280, 390]) {
      const viewport = { width, height: width === 1280 ? 800 : 812 };
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      try {
        const page = await context.newPage();
        page.on('pageerror', error => report.errors.push({ width, kind: 'pageerror', text: error.message }));
        page.on('console', message => {
          if (message.type() === 'error') report.errors.push({ width, kind: 'console', text: message.text() });
        });
        await page.goto(url);
        await page.getByRole('dialog', { name: 'Create your character' }).waitFor();
        await page.waitForTimeout(4000); // Existing startup fixture allows the initial character model to load.
        await noCredentialUi(page);
        const guest = await browserLife(context);
        assert(guest.user && guest.user.guest === true);
        assert.equal(guest.sim, null);
        const emptyReasons = await explainedDisabledButtons(page);
        assert(emptyReasons.some(row => row.reason === 'Enter your name to begin.'));
        assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
        await page.screenshot({ path: path.join(out, `${width}-creator-empty.png`) });

        const name = page.getByLabel('Your name', { exact: true });
        await name.fill('Room 42');
        assert(await page.getByRole('button', { name: /^Begin my story/ }).isDisabled());
        const invalidReasons = await explainedDisabledButtons(page);
        assert(invalidReasons.some(row => row.reason.includes('2–20 letters')));
        const suffix = [...crypto.randomBytes(8)].map(value => String.fromCharCode(97 + value % 26)).join('');
        const characterName = 'Rowan ' + suffix;
        await name.fill(characterName);
        await page.getByLabel('Your city', { exact: true }).selectOption('atl');
        assert(await page.getByRole('button', { name: 'Begin my story', exact: true }).isEnabled());
        await page.getByRole('button', { name: 'Begin my story', exact: true }).click();
        await page.getByRole('dialog', { name: 'Your arrival' }).waitFor();
        for (let card = 0; card < 3; card++) await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByRole('button', { name: 'Turn the key', exact: true }).click();
        await page.locator('.walk-status').waitFor();
        await page.locator('.avatar-button img').waitFor();
        await page.waitForTimeout(2400);
        const started = await browserLife(context);
        assert.equal(started.user.id, guest.user.id);
        assert.equal(started.sim.username, characterName);
        assert.equal(started.world.id, 'public');
        assert(started.sim.position.room.startsWith('home:'));
        assert.equal(started.sim.firstDay.complete, false);

        await page.getByRole('button', { name: 'City', exact: true }).click();
        await page.getByRole('button', { name: 'Find a home', exact: true }).click();
        const homes = page.getByRole('region', { name: 'Find your home', exact: true });
        await homes.waitFor();
        await page.waitForTimeout(500);
        await noCredentialUi(page);
        const homeReasons = await explainedDisabledButtons(page);
        assert(homeReasons.length >= 6, 'Expected each neighbourhood move control');
        assert(homeReasons.every(row => row.reason === 'Finish your first-day goals before moving'));
        assert(await homes.getByText(/residents/).first().isVisible());
        assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
        await homes.getByRole('button', { name: /Move here/ }).first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, `${width}-home-first-day-gate.png`) });

        await page.reload();
        await page.getByRole('button', { name: 'Open your needs and skills', exact: true }).waitFor();
        const resumed = await browserLife(context);
        assert.equal(resumed.user.id, started.user.id);
        assert.equal(resumed.sim.userId, started.sim.userId);
        assert.equal(resumed.sim.username, characterName);
        assert.deepEqual(resumed.sim.home, started.sim.home);
        assert.equal(await page.getByRole('dialog', { name: 'Create your character' }).count(), 0);
        await noCredentialUi(page);
        report.views.push({ viewport, automaticGuest: true, sameGuestAfterSetup: true, sharedWorld: 'public',
          emptyReasons, invalidReasons, homeReasons, noCredentialUi: true, refreshPreservesLife: true,
          userId: resumed.user.id, characterName, screenshots: [`${width}-creator-empty.png`, `${width}-home-first-day-gate.png`] });
      } finally {
        await context.close();
      }
    }
    assert.deepEqual(report.errors, []);
    report.passed = true;
    console.log('R1 browser-life and disabled-control UI PASS', url);
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
