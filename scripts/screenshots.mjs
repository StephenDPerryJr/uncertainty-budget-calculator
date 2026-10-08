// Smoke test + screenshots of the built app using the system Chrome via playwright-core.
// Usage: npm run build && npm run preview (in another shell) && node scripts/screenshots.mjs [url]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = process.argv[2] || 'http://127.0.0.1:4173/';
const OUT = new globalThis.URL('../screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const problems = [];
const watch = (page, tag) => {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${tag}] console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`[${tag}] requestfailed: ${r.url()}`));
};

// ---------- desktop
const desk = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
watch(desk, 'desktop');
await desk.goto(URL, { waitUntil: 'networkidle' });
await desk.evaluate(() => localStorage.clear());
await desk.reload({ waitUntil: 'networkidle' });
const title = await desk.title();

// wizard step 3 (quantify sources) on the default caliper example, Type A component selected
await desk.getByTestId('next').click();
await desk.getByTestId('next').click();
await desk.locator('.comp-nav button').nth(1).click();
await desk.waitForSelector('[data-testid="component-result"]');
await desk.screenshot({ path: OUT + '01-wizard-step3-desktop.png', fullPage: true });

// every wizard step renders
await desk.getByTestId('next').click();
await desk.getByTestId('next').click();
const caliperStatement = await desk.getByTestId('statement').innerText();

// GUM H.1 example in the budget table
await desk.getByTestId('tab-library').click();
await desk.getByTestId('example-gum-h1').click();
await desk.waitForSelector('[data-testid="budget-table"]');
const h1 = {
  uc: await desk.getByTestId('uc').innerText(),
  veff: await desk.getByTestId('veff').innerText(),
  k: await desk.getByTestId('k').innerText(),
  U: await desk.getByTestId('U').innerText(),
  statement: (await desk.getByTestId('statement').innerText()).split('\n')[0],
};
await desk.screenshot({ path: OUT + '02-budget-table-gum-h1-desktop.png', fullPage: true });

// calculators, report, guide render without errors
await desk.getByTestId('tab-calculators').click();
await desk.waitForSelector('[data-testid="calc-t"]');
await desk.screenshot({ path: OUT + '04-calculators-desktop.png', fullPage: false });
await desk.getByTestId('tab-report').click();
await desk.waitForSelector('[data-testid="report-frame"]');
await desk.waitForTimeout(300);
await desk.screenshot({ path: OUT + '05-report-desktop.png', fullPage: false });
await desk.getByTestId('tab-guide').click();

// ---------- phone
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
watch(phone, 'phone');
await phone.goto(URL, { waitUntil: 'networkidle' });
await phone.getByTestId('tab-library').click();
await phone.getByTestId('example-ea-s2').click();
await phone.waitForSelector('[data-testid="results"]');
const s2 = { U: await phone.getByTestId('U').innerText(), statement: (await phone.getByTestId('statement').innerText()).split('\n')[0] };
await phone.screenshot({ path: OUT + '03-results-ea-s2-phone.png', fullPage: false });

await browser.close();
console.log(JSON.stringify({ title, caliperStatement: caliperStatement.split('\n')[0], gumH1: h1, eaS2: s2, problems }, null, 2));
process.exit(problems.length ? 1 : 0);
