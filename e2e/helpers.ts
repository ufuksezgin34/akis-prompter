import type { Page } from '@playwright/test';

export async function freshStart(page: Page) {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    await Promise.all((dbs ?? []).map((d) => d.name && new Promise((r) => { const q = indexedDB.deleteDatabase(d.name!); q.onsuccess = q.onerror = q.onblocked = () => r(null); })));
  });
  await page.reload();
  // Rehberi atla (ilk açılışta görünür)
  await page.getByRole('button', { name: 'Atla' }).click();
}

export async function newScriptWithText(page: Page, title: string, text: string) {
  await page.getByRole('button', { name: 'Yeni metin', exact: true }).first().click();
  await page.getByLabel('Metin adı').fill(title);
  await page.getByRole('button', { name: 'Metin yapıştır' }).click();
  await page.getByLabel('Yapıştırılacak metin').fill(text);
  await page.getByRole('button', { name: 'Mevcut metnin yerine koy' }).click();
  await page.getByText('Kaydedildi').waitFor();
}

export async function contentOffset(page: Page): Promise<number> {
  return page.getByTestId('content').evaluate((el) => {
    const m = /translate3d\(0px,\s*(-?[\d.]+)px/.exec((el as HTMLElement).style.transform);
    return m ? 0 - Number(m[1]) : 0;
  });
}
