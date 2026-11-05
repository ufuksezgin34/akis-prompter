import { chromium } from '@playwright/test';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
for (const h of ['#/', '#/texts', '#/settings', '#/import', '#/reading-view']) {
  await p.goto('http://localhost:4173/' + h); await p.waitForTimeout(800);
  console.log(h, (await p.locator('h1').first().textContent().catch(() => 'NO H1')));
}
await b.close();
