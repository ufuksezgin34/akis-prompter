import { Capacitor } from '@capacitor/core';

/** Android/iOS paketinde mi çalışıyoruz? (Tarayıcı ve PWA'da false.) */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Native pakette dosyayı önbelleğe yazar ve sistem paylaşım sayfasını açar
 * (Drive'a kaydet, Dosyalar, e-posta…). Uygulama içi WebView'de <a download> çalışmadığı için gerekir.
 */
export async function shareTextFileNative(filename: string, text: string): Promise<void> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const res = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ title: filename, files: [res.uri], dialogTitle: 'Dosyayı kaydet veya paylaş' });
  } catch (e) {
    // Kullanıcı paylaşım sayfasını kapattıysa hata sayılmaz.
    if (!/cancel/i.test(String(e))) throw e;
  }
}

/** Ekranı açık tutma: native pakette KeepAwake eklentisi. */
export async function keepAwakeNative(on: boolean): Promise<boolean> {
  try {
    const { KeepAwake } = await import('@capacitor-community/keep-awake');
    if (on) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
    return true;
  } catch {
    return false;
  }
}
