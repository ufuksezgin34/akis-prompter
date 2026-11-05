import { expect, test } from '@playwright/test';
import { contentOffset, freshStart, newScriptWithText } from './helpers';

const SHORT = '# Giriş\n\nBirinci cümle burada. İkinci cümle de burada. Üçüncü cümle biraz daha uzun olabilir.\n\n%% [ÜRÜNÜ GÖSTER]\n\n# Bölüm iki\n\nDördüncü cümle. Beşinci cümle. Altıncı cümle sondur.';

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('1. metin oluştur, düzenle, kapat/aç: içerik aynı', async ({ page, context }) => {
  await newScriptWithText(page, 'Kalıcılık testi', 'İç mimarlıkta “ışık” 🙂 önemlidir.\n\nİkinci paragraf.');
  await page.getByLabel('Konuşma 2').fill('İkinci paragraf düzenlendi.');
  await expect(page.getByText('Kaydedildi')).toBeVisible();
  const url = page.url();
  await page.close();
  const p2 = await context.newPage();
  await p2.goto(url);
  await expect(p2.getByLabel('Metin adı')).toHaveValue('Kalıcılık testi');
  await expect(p2.getByLabel('Konuşma 1')).toHaveValue('İç mimarlıkta “ışık” 🙂 önemlidir.');
  await expect(p2.getByLabel('Konuşma 2')).toHaveValue('İkinci paragraf düzenlendi.');
});

test('7. editörde Space yazmak oynatma başlatmaz', async ({ page }) => {
  await newScriptWithText(page, 'Boşluk', 'Merhaba');
  const ta = page.getByLabel('Konuşma 1');
  await ta.click();
  await ta.press('End');
  await page.keyboard.type(' dünya ve boşluk');
  await expect(ta).toHaveValue('Merhaba dünya ve boşluk');
  await expect(page.locator('.reader')).toHaveCount(0);
});

test('oynat, duraklat, devam; boşluk ve hız tuşları; aktif cümle', async ({ page }) => {
  await newScriptWithText(page, 'Akış', Array(6).fill(SHORT).join("\n\n"));
  await page.getByRole('button', { name: '▶ Oku' }).click();
  await expect(page.locator('.reader')).toBeVisible();
  // Sayaçsız başlat
  await page.getByRole('button', { name: 'Okuma ayarları' }).click();
  await page.getByLabel('Başlangıç sayacı').selectOption('0');
  await page.getByRole('button', { name: 'Ayarları kapat' }).click();
  expect(await contentOffset(page)).toBe(0);
  await page.keyboard.press(' ');
  await page.waitForTimeout(1200);
  const o1 = await contentOffset(page);
  expect(o1).toBeGreaterThan(20);
  await page.keyboard.press(' ');
  await expect(page.locator('.reader')).toHaveAttribute('data-state', 'paused');
  const o2 = await contentOffset(page);
  await page.waitForTimeout(800);
  expect(await contentOffset(page)).toBe(o2);
  // Devam: ilk karede sıçrama yok
  await page.keyboard.press(' ');
  await page.waitForTimeout(100);
  expect((await contentOffset(page)) - o2).toBeLessThan(30);
  await expect(page.locator('[data-s].is-active')).toHaveCount(1);
});

test('6. cümle ileri/geri, bölüm geçişi, metin sonu ve tekrar başlat', async ({ page }) => {
  await newScriptWithText(page, 'Gezinme', SHORT);
  await page.getByRole('button', { name: '▶ Oku' }).click();
  await page.locator('.reader').waitFor();
  const s0 = await contentOffset(page);
  await page.keyboard.press('ArrowRight');
  const s1 = await contentOffset(page);
  expect(s1).toBeGreaterThan(s0);
  await page.keyboard.press('ArrowRight');
  const s2 = await contentOffset(page);
  expect(s2).toBeGreaterThan(s1);
  await page.keyboard.press('ArrowLeft');
  expect(await contentOffset(page)).toBeCloseTo(s1, 0);
  await page.keyboard.press('PageDown');
  const sec = await contentOffset(page);
  expect(sec).toBeGreaterThan(s2);
  // Sona kadar hızlı akış
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[aria-label="Okuma ayarları"]')!.click();
  });
  await page.locator('#set-speed').fill('600');
  await page.getByLabel('Başlangıç sayacı').selectOption('0');
  await page.getByRole('button', { name: 'Ayarları kapat' }).click();
  await page.keyboard.press(' ');
  await expect(page.getByText('Metin bitti')).toBeVisible({ timeout: 15_000 });
  // Son satır okuma çizgisini geçmiş olmalı: son cümlenin altı çizginin üstünde/çizgide.
  const geo = await page.evaluate(() => {
    const spans = document.querySelectorAll('[data-s]');
    const last = spans[spans.length - 1]!.getBoundingClientRect();
    const marker = document.querySelector('.marker')!.getBoundingClientRect();
    return { lastBottom: last.bottom, markerMid: marker.top + marker.height / 2 };
  });
  expect(geo.lastBottom).toBeLessThanOrEqual(geo.markerMid + 40);
  await page.getByRole('button', { name: 'Başa dön' }).click();
  expect(await contentOffset(page)).toBe(0);
});

test('4. yazı boyutu ve pencere boyutu değişince okuma yeri korunur', async ({ page }) => {
  await newScriptWithText(page, 'Konum', Array(5).fill(SHORT).join("\n\n"));
  await page.getByRole('button', { name: '▶ Oku' }).click();
  await page.locator('.reader').waitFor();
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
  const textAtLine = () =>
    page.evaluate(() => document.querySelector('[data-s].is-active')?.textContent?.trim() ?? '');
  const before = await textAtLine();
  expect(before.length).toBeGreaterThan(3);
  await page.getByRole('button', { name: 'Okuma ayarları' }).click();
  await page.locator('#set-fontSize').fill('90');
  await page.getByRole('button', { name: 'Ayarları kapat' }).click();
  await page.waitForTimeout(300);
  expect(await textAtLine()).toBe(before);
  await page.setViewportSize({ width: 700, height: 900 });
  await page.waitForTimeout(400);
  expect(await textAtLine()).toBe(before);
});

test('5. ayna açıkken kontroller aynalanmaz ve tıklanabilir', async ({ page }) => {
  await newScriptWithText(page, 'Ayna', SHORT);
  await page.getByRole('button', { name: '▶ Oku' }).click();
  await page.locator('.reader').waitFor();
  await page.keyboard.press('m');
  await expect(page.getByTestId('text-layer')).toHaveAttribute('style', /scale\(-1, 1\)/);
  const ctlTransform = await page.locator('.controls').evaluate((el) => getComputedStyle(el).transform);
  expect(ctlTransform === 'none' || !ctlTransform.startsWith('matrix(-1')).toBe(true);
  await page.getByRole('button', { name: 'Sonraki cümle' }).click();
  expect(await contentOffset(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Ayna', exact: true }).click();
  await expect(page.getByTestId('text-layer')).toHaveAttribute('style', /scale\(1, 1\)/);
});

test('boş metinde oynatma başlamaz', async ({ page }) => {
  await page.getByRole('button', { name: '+ Yeni metin' }).click();
  await expect(page.getByRole('button', { name: '▶ Oku' })).toBeDisabled();
});

test('2. 10.000+ kelimelik metin: akış, duraklama, devam ve kare ölçümü', async ({ page }) => {
  await page.getByRole('button', { name: 'Örnek metinleri ekle' }).click();
  await page.getByRole('button', { name: 'Stres testi — 10.000+ kelime' }).click();
  await page.getByRole('button', { name: '▶ Oku' }).click();
  await page.locator('.reader').waitFor();
  await page.getByRole('button', { name: 'Okuma ayarları' }).click();
  await page.getByLabel('Başlangıç sayacı').selectOption('0');
  await page.getByRole('button', { name: 'Ayarları kapat' }).click();
  await page.keyboard.press(' ');
  const stats = await page.evaluate(
    () =>
      new Promise<{ frames: number; p95: number; max: number }>((resolve) => {
        const d: number[] = [];
        let last = performance.now();
        const end = last + 3000;
        const f = (t: number) => {
          d.push(t - last);
          last = t;
          if (t < end) requestAnimationFrame(f);
          else {
            d.sort((a, b) => a - b);
            resolve({ frames: d.length, p95: d[Math.floor(d.length * 0.95)]!, max: d[d.length - 1]! });
          }
        };
        requestAnimationFrame(f);
      }),
  );
  console.log(`PERF 10k kelime (headless Chrome, 1280x720): ${stats.frames} kare/3 sn, p95 ${stats.p95.toFixed(1)} ms, max ${stats.max.toFixed(1)} ms`);
  expect(await contentOffset(page)).toBeGreaterThan(50);
  await page.keyboard.press(' ');
  const o = await contentOffset(page);
  await page.waitForTimeout(500);
  expect(await contentOffset(page)).toBe(o);
});

test('3. sekme gizlenince duraklar, dönünce kendiliğinden başlamaz', async ({ page }) => {
  await newScriptWithText(page, 'Görünürlük', Array(4).fill(SHORT).join("\n\n"));
  await page.getByRole('button', { name: '▶ Oku' }).click();
  await page.locator('.reader').waitFor();
  await page.getByRole('button', { name: 'Okuma ayarları' }).click();
  await page.getByLabel('Başlangıç sayacı').selectOption('0');
  await page.getByRole('button', { name: 'Ayarları kapat' }).click();
  await page.keyboard.press(' ');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.reader')).toHaveAttribute('data-state', 'paused');
  const o = await contentOffset(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(500);
  expect(await contentOffset(page)).toBe(o);
  await expect(page.locator('.reader')).toHaveAttribute('data-state', 'paused');
});

test('11. Wake Lock ve tam ekran reddi uygulamayı çökertmez', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'wakeLock', { value: { request: () => Promise.reject(new Error('NotAllowedError')) }, configurable: true });
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('denied'));
  });
  await page.reload();
  await newScriptWithText(page, 'Ret', SHORT);
  await page.getByRole('button', { name: '▶ Oku' }).click();
  await page.locator('.reader').waitFor();
  await page.keyboard.press(' ');
  await page.keyboard.press('f');
  await expect(page.locator('.reader-notice')).toContainText(/Tam ekran/);
  await expect(page.locator('.reader')).toBeVisible();
});

test('10. depolama başarısız olursa metin kaybolmaz ve indirme sunulur', async ({ page }) => {
  await newScriptWithText(page, 'Depolama', 'İlk metin');
  await page.evaluate(() => {
    const orig = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof orig>) {
      if (this.name === 'scripts') throw new DOMException('Kota doldu', 'QuotaExceededError');
      return orig.apply(this, args);
    };
  });
  await page.getByLabel('Konuşma 1').fill('Kaybolmaması gereken metin');
  await expect(page.getByText('Kaydedilemedi').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dosya olarak indir' })).toBeVisible();
  await expect(page.getByLabel('Konuşma 1')).toHaveValue('Kaybolmaması gereken metin');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Dosya olarak indir' }).click();
  expect((await dl).suggestedFilename()).toBe('Depolama.md');
});

test('9. JSON yedek: dışa aktar, bozuk dosya veriyi bozmaz, geri yükle', async ({ page }) => {
  await newScriptWithText(page, 'Yedeklenen', 'Yedek içeriği 🙂');
  await page.getByRole('button', { name: '← Metinlerim' }).click();
  await page.getByRole('button', { name: /Yedekleme/ }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Yedeği indir' }).click();
  const path = await (await dl).path();
  await page.getByLabel('Yedek dosyası seç').setInputFiles({ name: 'bozuk.json', mimeType: 'application/json', buffer: Buffer.from('{bozuk') });
  await expect(page.getByRole('alert')).toContainText('geçerli bir JSON değil');
  await page.getByLabel('Yedek dosyası seç').setInputFiles(path!);
  await expect(page.locator('.preview p').first()).toContainText('1 metin');
  await page.getByRole('button', { name: 'Birleştir' }).click();
  await expect(page.getByText(/İçe aktarıldı/)).toContainText('1 aynı/atlandı');
});

test('12. çoklu sekme: eski sekme yeni metni ezmez', async ({ page, context }) => {
  await newScriptWithText(page, 'Çakışma', 'Başlangıç');
  const url = page.url();
  const p2 = await context.newPage();
  await p2.goto(url);
  await p2.getByLabel('Konuşma 1').fill('İkinci sekmeden');
  await expect(p2.getByText('Kaydedildi')).toBeVisible();
  await expect(page.getByText('başka bir sekmede değiştirildi')).toBeVisible();
  await page.getByLabel('Konuşma 1').fill('Birinci sekmeden eski');
  await page.waitForTimeout(900);
  await p2.reload();
  await expect(p2.getByLabel('Konuşma 1')).toHaveValue('İkinci sekmeden');
});

test('6b. tekrar al: mevcut cümle başına döner, 3 sn sayar, yeniden başlar', async ({ page }) => {
  await newScriptWithText(page, 'Tekrar', SHORT);
  await page.getByRole('button', { name: '▶ Oku' }).click();
  await page.locator('.reader').waitFor();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const sentenceStart = await contentOffset(page);
  await page.getByRole('button', { name: 'Okuma ayarları' }).click();
  await page.getByLabel('Başlangıç sayacı').selectOption('0');
  await page.getByRole('button', { name: 'Ayarları kapat' }).click();
  await page.keyboard.press(' ');
  await page.waitForTimeout(500);
  expect(await contentOffset(page)).toBeGreaterThan(sentenceStart);
  await page.keyboard.press('r');
  await expect(page.locator('.reader')).toHaveAttribute('data-state', 'countdown');
  await expect(page.getByRole('timer')).toContainText('3');
  expect(await contentOffset(page)).toBeCloseTo(sentenceStart, 0);
  await expect(page.locator('.reader')).toHaveAttribute('data-state', 'playing', { timeout: 5000 });
});
