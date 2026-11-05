import { expect, test } from '@playwright/test';
import { freshStart, newScriptWithText } from './helpers';

test('8. cache hazırlandıktan sonra internet kesilince çekirdek çalışır', async ({ page, context }) => {
  await freshStart(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // İlk kontrol için sayfayı SW denetiminde yeniden yükle
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const skip = page.getByRole('button', { name: 'Atla' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await newScriptWithText(page, 'Çevrimdışı', 'Bu metin internet yokken de okunur.');
  const url = page.url();
  await context.setOffline(true);
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.getByLabel('Metin adı')).toHaveValue('Çevrimdışı');
  await page.getByLabel('Konuşma 1').fill('Çevrimdışı düzenleme.');
  await expect(page.getByText('Kaydedildi')).toBeVisible();
  await page.getByRole('button', { name: 'Oku', exact: true }).click();
  await expect(page.locator('.r-speech')).toContainText('Çevrimdışı düzenleme.');
  await context.setOffline(false);
});

test('17. okuma ekranındayken güncelleme bildirimi gösterilmez, sayfa yenilenmez', async ({ page }) => {
  await freshStart(page);
  await newScriptWithText(page, 'Güncelleme', 'Okunacak metin. İkinci cümle.');
  await page.getByRole('button', { name: 'Oku', exact: true }).click();
  await page.locator('.reader').waitFor();
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 42));
  // Yeni SW'nin "waiting" durumuna geçmesini taklit: kayıt güncellemesi tetiklenir.
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update().catch(() => {});
  });
  await page.waitForTimeout(1500);
  await expect(page.locator('.update-bar')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(42);
});
