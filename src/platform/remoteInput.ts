import { isNative } from './native';

/**
 * Klavye dışı kumanda girdileri tek kaynaktan gelir:
 *  - Oyun kolu (Gamepad API): kumanda GAME modundaysa. Tuş adı "Gamepad:<düğme>" veya "Eksen:<n>+/-".
 *  - Android paketi: ses ve medya tuşları (VolumeUp, MediaPlayPause…), yalnızca yakalama açıkken.
 * Normal klavye tuşları (KEY modu) zaten tarayıcının keydown olayıyla gelir.
 */
type Listener = (key: string) => void;
const listeners = new Set<Listener>();
let captureUsers = 0;

function emit(key: string) {
  listeners.forEach((l) => l(key));
}

export function onRemoteKey(fn: Listener): () => void {
  listeners.add(fn);
  ensureSources();
  if (!gamepadLoop && (navigator.getGamepads?.() ?? []).some(Boolean)) gamepadLoop = requestAnimationFrame(pollGamepads);
  return () => {
    listeners.delete(fn);
  };
}

/** Ses tuşlarının sistem ses düzeyi yerine uygulamaya gelmesi; yalnızca okuma/öğrenme ekranındayken. */
export function captureHardwareKeys(): () => void {
  captureUsers++;
  void setNativeCapture(true);
  return () => {
    captureUsers = Math.max(0, captureUsers - 1);
    if (captureUsers === 0) void setNativeCapture(false);
  };
}

/* ---------- Android köprüsü ---------- */
interface RemoteKeysPlugin {
  setCapture(o: { enabled: boolean }): Promise<void>;
  addListener(ev: 'key', cb: (d: { key: string }) => void): Promise<{ remove(): Promise<void> }>;
}
let nativePlugin: RemoteKeysPlugin | null = null;
let nativeReady: Promise<void> | null = null;

function initNative(): Promise<void> {
  nativeReady ??= (async () => {
    if (!isNative()) return;
    const { registerPlugin } = await import('@capacitor/core');
    nativePlugin = registerPlugin<RemoteKeysPlugin>('RemoteKeys');
    try {
      await nativePlugin.addListener('key', (d) => emit(d.key));
    } catch {
      nativePlugin = null; // eski APK sürümünde eklenti yoksa sessizce devre dışı
    }
  })();
  return nativeReady;
}

async function setNativeCapture(enabled: boolean) {
  await initNative();
  try {
    await nativePlugin?.setCapture({ enabled });
  } catch {
    /* eklenti yok */
  }
}

/* ---------- Oyun kolu ---------- */
let gamepadLoop = 0;
const prevButtons = new Map<number, boolean[]>();
const prevAxes = new Map<number, number[]>();
const AXIS_THRESHOLD = 0.6;

function pollGamepads() {
  gamepadLoop = 0;
  const pads = navigator.getGamepads?.() ?? [];
  let any = false;
  for (const gp of pads) {
    if (!gp) continue;
    any = true;
    const pb = prevButtons.get(gp.index) ?? [];
    gp.buttons.forEach((b, i) => {
      if (b.pressed && !pb[i]) emit(`Gamepad:${i}`);
      pb[i] = b.pressed;
    });
    prevButtons.set(gp.index, pb);
    const pa = prevAxes.get(gp.index) ?? [];
    gp.axes.forEach((v, i) => {
      const dir = v > AXIS_THRESHOLD ? 1 : v < -AXIS_THRESHOLD ? -1 : 0;
      if (dir !== 0 && dir !== pa[i]) emit(`Eksen:${i}${dir > 0 ? '+' : '-'}`);
      pa[i] = dir;
    });
    prevAxes.set(gp.index, pa);
  }
  if (any && listeners.size > 0) gamepadLoop = requestAnimationFrame(pollGamepads);
}

let sourcesReady = false;
function ensureSources() {
  if (sourcesReady) return;
  sourcesReady = true;
  void initNative();
  if (typeof window !== 'undefined' && 'getGamepads' in navigator) {
    window.addEventListener('gamepadconnected', () => {
      if (!gamepadLoop) gamepadLoop = requestAnimationFrame(pollGamepads);
    });
    if ((navigator.getGamepads?.() ?? []).some(Boolean)) gamepadLoop = requestAnimationFrame(pollGamepads);
  }
}

/** Tuş adlarını kullanıcıya gösterim için. */
export function remoteKeyLabel(key: string): string | null {
  const names: Record<string, string> = {
    VolumeUp: 'Ses +',
    VolumeDown: 'Ses −',
    MediaPlayPause: 'Oynat/Duraklat (medya)',
    MediaPlay: 'Oynat (medya)',
    MediaPause: 'Duraklat (medya)',
    MediaTrackNext: 'Sonraki parça',
    MediaTrackPrevious: 'Önceki parça',
    MediaFastForward: 'İleri sar (medya)',
    MediaRewind: 'Geri sar (medya)',
  };
  if (names[key]) return names[key]!;
  const g = key.match(/^Gamepad:(\d+)$/);
  if (g) return `Kol düğmesi ${Number(g[1]) + 1}`;
  const a = key.match(/^Eksen:(\d+)([+-])$/);
  if (a) return `Kol yönü ${Number(a[1]) + 1}${a[2] === '+' ? ' ileri' : ' geri'}`;
  return null;
}
