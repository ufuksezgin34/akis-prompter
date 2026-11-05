import { isNative, keepAwakeNative } from './native';

/**
 * Screen Wake Lock adaptörü. Desteklenmiyorsa açıkça 'unsupported' döner;
 * ekranın açık kalacağı garanti edilmez. Sistem kilidi kaldırırsa durum 'released' olur,
 * görünür hale dönüldüğünde çağıran yeniden ister.
 */
export type WakeLockStatus = 'unsupported' | 'inactive' | 'active' | 'released' | 'error';

interface SentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', cb: () => void): void;
}

export interface WakeLockAdapter {
  readonly supported: boolean;
  status: WakeLockStatus;
  request(): Promise<WakeLockStatus>;
  release(): Promise<void>;
  onChange(cb: (s: WakeLockStatus) => void): void;
}

/** Native pakette eklenti, tarayıcıda Screen Wake Lock API. */
export function createWakeLock(): WakeLockAdapter {
  if (isNative()) return createNativeWakeLock();
  const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<SentinelLike> } };
  const supported = typeof nav.wakeLock?.request === 'function';
  let sentinel: SentinelLike | null = null;
  let listener: (s: WakeLockStatus) => void = () => {};
  const api: WakeLockAdapter = {
    supported,
    status: supported ? 'inactive' : 'unsupported',
    async request() {
      if (!supported) return 'unsupported';
      if (sentinel && !sentinel.released) return api.status;
      try {
        sentinel = await nav.wakeLock!.request('screen');
        set('active');
        sentinel.addEventListener('release', () => {
          if (api.status === 'active') set('released');
        });
      } catch {
        set('error');
      }
      return api.status;
    },
    async release() {
      const s = sentinel;
      sentinel = null;
      if (supported) set('inactive');
      try {
        await s?.release();
      } catch {
        /* zaten bırakılmış */
      }
    },
    onChange(cb) {
      listener = cb;
    },
  };
  function set(s: WakeLockStatus) {
    api.status = s;
    listener(s);
  }
  return api;
}

function createNativeWakeLock(): WakeLockAdapter {
  let listener: (s: WakeLockStatus) => void = () => {};
  const api: WakeLockAdapter = {
    supported: true,
    status: 'inactive',
    async request() {
      api.status = (await keepAwakeNative(true)) ? 'active' : 'error';
      listener(api.status);
      return api.status;
    },
    async release() {
      await keepAwakeNative(false);
      api.status = 'inactive';
      listener(api.status);
    },
    onChange(cb) {
      listener = cb;
    },
  };
  return api;
}

export const fullscreen = {
  get supported(): boolean {
    return typeof document.documentElement.requestFullscreen === 'function' && document.fullscreenEnabled !== false;
  },
  get active(): boolean {
    return !!document.fullscreenElement;
  },
  async toggle(el: HTMLElement = document.documentElement): Promise<boolean> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (typeof el.requestFullscreen === 'function') await el.requestFullscreen({ navigationUI: 'hide' });
      else return false;
      return true;
    } catch {
      return false;
    }
  },
};

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}
