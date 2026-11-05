import { expect, test } from '@playwright/test';
import { freshStart, newScriptWithText } from './helpers';

const TEXT = '# Giriş\n\nBirinci cümle. İkinci cümle burada.\n\n%% [GÜLÜMSE]\n\nÜçüncü cümle biraz daha uzun bir cümledir.';

async function noHorizontalOverflow(page: import('@playwright/test').Page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(r.sw).toBeLessThanOrEqual(r.cw + 1);
}

async function allControlsInViewport(page: import('@playwright/test').Page) {
  const out = await page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    return [...document.querySelectorAll<HTMLElement>('.controls button')]
      .map((b) => ({ name: b.getAttribute('aria-label') ?? b.textContent, r: b.getBoundingClientRect() }))
      .filter(({ r }) => r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1 || r.height < 40)
      .map((x) => `${x.name} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`);
  });
  expect(out).toEqual([]);
}

for (const vp of [
  { name: '320x640 dikey', width: 320, height: 640 },
  { name: '390x844 dikey', width: 390, height: 844 },
  { name: '844x390 yatay', width: 844, height: 390 },
]) {
  test(`16. ${vp.name}: taşma yok, kontroller erişilebilir`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await freshStart(page);
    await noHorizontalOverflow(page);
    await newScriptWithText(page, 'Mobil', TEXT);
    await noHorizontalOverflow(page);
    await page.getByRole('button', { name: '▶ Oku' }).click();
    await page.locator('.reader').waitFor();
    await allControlsInViewport(page);
    await page.getByRole('button', { name: 'Okuma ayarları' }).click();
    const drawer = await page.locator('.drawer').boundingBox();
    expect(drawer!.x).toBeGreaterThanOrEqual(-1);
    expect(drawer!.x + drawer!.width).toBeLessThanOrEqual(vp.width + 1);
  });
}

test('dokunma kontrolleri gösterir, başa sarmaz veya oynatmaz', async ({ page }) => {
  await freshStart(page);
  await newScriptWithText(page, 'Dokunma', Array(8).fill(TEXT).join('\n\n'));
  await page.getByRole('button', { name: '▶ Oku' }).click();
  await page.locator('.reader').waitFor();
  await page.getByRole('button', { name: 'Sonraki cümle' }).tap();
  await page.getByRole('button', { name: 'Sonraki cümle' }).tap();
  const before = await page.getByTestId('content').getAttribute('style');
  await page.locator('.stage').tap({ position: { x: 150, y: 200 } });
  expect(await page.getByTestId('content').getAttribute('style')).toBe(before);
  await expect(page.locator('.reader')).toHaveAttribute('data-state', /idle|paused/);
});

test('ekran kilidi: kısa dokunma açmaz, uzun basma açar', async ({ page }) => {
  await freshStart(page);
  await newScriptWithText(page, 'Kilit', TEXT);
  await page.getByRole('button', { name: '▶ Oku' }).click();
  await page.getByRole('button', { name: '🔒 Kilitle' }).tap();
  await expect(page.locator('.controls')).toHaveCount(0);
  await page.locator('.unlock').tap();
  await expect(page.locator('.controls')).toHaveCount(0);
  const box = (await page.locator('.unlock').boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await page.mouse.up();
  await expect(page.locator('.controls')).toHaveCount(1);
});
