import type { AppSettings, KeyMap, Profile, ReaderSettings } from '../model/types';

export const BASE_SETTINGS: ReaderSettings = {
  fontSize: 48,
  fontWeight: 700,
  lineHeight: 1.45,
  paragraphGap: 0.9,
  align: 'left',
  textColor: '#f4efe6',
  bgColor: '#0e1a33',
  accentColor: '#ff7a35',
  columnWidth: 100,
  paddingX: 22,
  paddingY: 0,
  narrowColumn: false,
  cameraPosition: 'none',
  mirrorX: false,
  flipY: false,
  glassMode: false,
  readingLine: 35,
  showReadingMarker: true,
  focusBand: true,
  focusBandHeight: 2,
  dimOutside: 0.35,
  speed: 60,
  wpm: 120,
  readerTheme: 'navy',
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
  wpm: [40, 300],
} as const satisfies Partial<Record<keyof ReaderSettings, readonly [number, number]>>;

export const READER_THEMES = {
  navy: { bgColor: '#0e1a33', textColor: '#f4efe6' },
  black: { bgColor: '#000000', textColor: '#f4f4f2' },
  paper: { bgColor: '#f6f1e7', textColor: '#1a1d26' },
} as const;

export function clampSettings(s: ReaderSettings): ReaderSettings {
  const out = { ...BASE_SETTINGS, ...s };
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
    mk('p-dikey', 'Dikey video (Reels/Shorts)', { fontSize: 52, wpm: 140, readingLine: 30 }),
    mk('p-yatay', 'Yatay video (YouTube)', { fontSize: 48, wpm: 120, readingLine: 35 }),
    mk('p-hizli', 'Hızlı anlatım', { fontSize: 48, wpm: 160 }),
    mk('p-aynali', 'Aynalı prompter', { mirrorX: true, glassMode: true, fontSize: 72, readingLine: 40, showNotes: false, readerTheme: 'black', ...READER_THEMES.black }),
    mk('p-masaustu', 'Masaüstü', {
      fontSize: 34,
      narrowColumn: true,
      cameraPosition: 'top',
      columnWidth: 38,
      readingLine: 18,
      align: 'center',
      wpm: 110,
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
  // Medya ve ses tuşları: Android paketinde Bluetooth kumandalardan gelir (tarayıcıda ses tuşları yakalanamaz).
  togglePlay: [' ', 'MediaPlayPause', 'MediaPlay', 'MediaPause'],
  speedUp: ['ArrowUp', 'VolumeUp'],
  speedDown: ['ArrowDown', 'VolumeDown'],
  prevSentence: ['ArrowLeft', 'MediaTrackPrevious', 'MediaRewind'],
  nextSentence: ['ArrowRight', 'MediaTrackNext', 'MediaFastForward'],
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
    workspaceName: '',
    keepAwake: true,
    keymap: structuredClone(DEFAULT_KEYMAP),
    editorTheme: 'dark',
    onboardingDone: false,
    persistRequested: false,
  };
}
