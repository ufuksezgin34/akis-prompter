import type { AppSettings, KeyMap, Profile, ReaderSettings } from '../model/types';

export const BASE_SETTINGS: ReaderSettings = {
  fontSize: 56,
  fontWeight: 500,
  lineHeight: 1.45,
  paragraphGap: 0.9,
  align: 'left',
  textColor: '#f4f4f2',
  bgColor: '#000000',
  accentColor: '#f5c542',
  columnWidth: 86,
  paddingX: 24,
  paddingY: 0,
  narrowColumn: false,
  cameraPosition: 'none',
  mirrorX: false,
  flipY: false,
  readingLine: 35,
  showReadingMarker: true,
  focusBand: true,
  focusBandHeight: 2,
  dimOutside: 0.35,
  speed: 60,
  countdown: 3,
  loop: false,
  showElapsed: true,
  showRemaining: true,
  showProgress: true,
  showStatus: true,
  showNotes: true,
  pauseOnHidden: true,
  measuredWpm: null,
};

export const SETTING_LIMITS = {
  fontSize: [18, 160],
  fontWeight: [300, 900],
  lineHeight: [1.1, 2.5],
  paragraphGap: [0, 3],
  columnWidth: [20, 100],
  paddingX: [0, 200],
  paddingY: [0, 400],
  readingLine: [10, 90],
  focusBandHeight: [1, 6],
  dimOutside: [0, 0.9],
  speed: [5, 600],
} as const satisfies Partial<Record<keyof ReaderSettings, readonly [number, number]>>;

export function clampSettings(s: ReaderSettings): ReaderSettings {
  const out = { ...s };
  for (const [k, [min, max]] of Object.entries(SETTING_LIMITS) as [keyof typeof SETTING_LIMITS, readonly [number, number]][]) {
    const v = Number(out[k]);
    (out[k] as number) = Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : BASE_SETTINGS[k];
  }
  return out;
}

/** Başlangıç profilleri yalnızca düzenlenebilir önerilerdir. */
export function builtinProfiles(now = Date.now()): Profile[] {
  const mk = (id: string, name: string, patch: Partial<ReaderSettings>): Profile => ({
    id,
    name,
    builtin: true,
    updatedAt: now,
    settings: { ...BASE_SETTINGS, ...patch },
  });
  return [
    mk('p-dikey', 'Dikey video (Reels/Shorts)', { fontSize: 64, speed: 70, readingLine: 30, columnWidth: 92 }),
    mk('p-yatay', 'Yatay video (YouTube)', { fontSize: 54, speed: 55, readingLine: 35 }),
    mk('p-hizli', 'Hızlı anlatım', { fontSize: 60, speed: 75 }),
    mk('p-aynali', 'Aynalı Prompter', { mirrorX: true, fontSize: 72, readingLine: 40, showNotes: false }),
    mk('p-masaustu', 'Masaüstü', {
      fontSize: 34,
      narrowColumn: true,
      cameraPosition: 'top',
      columnWidth: 38,
      readingLine: 18,
      align: 'center',
      speed: 40,
    }),
  ];
}

/**
 * İlk sürümlerdeki kişisel başlangıç profilleri → genel adlar.
 * Kullanıcının elle değiştirdiği adlar korunur; yalnızca hiç değiştirilmemiş varsayılan adlar yenilenir.
 */
export const LEGACY_PROFILE_MAP: Record<string, { id: string; oldName: string }> = {
  'p-tuba-reels': { id: 'p-dikey', oldName: 'Tuba — Reels' },
  'p-tuba-youtube': { id: 'p-yatay', oldName: 'Tuba — YouTube' },
  'p-ufuk-kisa': { id: 'p-hizli', oldName: 'Ufuk — Kısa Video' },
};

export const DEFAULT_KEYMAP: KeyMap = {
  togglePlay: [' '],
  speedUp: ['ArrowUp'],
  speedDown: ['ArrowDown'],
  prevSentence: ['ArrowLeft'],
  nextSentence: ['ArrowRight'],
  toStart: ['Home'],
  fullscreen: ['f'],
  mirror: ['m'],
  exit: ['Escape'],
  retake: ['r'],
  prevSection: ['PageUp'],
  nextSection: ['PageDown'],
};

export const ACTION_LABELS: Record<keyof KeyMap, string> = {
  togglePlay: 'Oynat / duraklat',
  speedUp: 'Hızı artır',
  speedDown: 'Hızı azalt',
  prevSentence: 'Önceki cümle',
  nextSentence: 'Sonraki cümle',
  toStart: 'Başa dön',
  fullscreen: 'Tam ekran',
  mirror: 'Yatay ayna',
  exit: 'Okumadan çık',
  retake: 'Tekrar al',
  prevSection: 'Önceki bölüm',
  nextSection: 'Sonraki bölüm',
};

export function defaultAppSettings(): AppSettings {
  return {
    activeProfileId: 'p-yatay',
    keymap: structuredClone(DEFAULT_KEYMAP),
    editorTheme: 'dark',
    onboardingDone: false,
    persistRequested: false,
  };
}
