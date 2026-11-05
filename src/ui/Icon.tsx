/** Tutarlı çizgi ikon seti (24×24, 1.75 çizgi). Harici ikon kütüphanesi veya CDN yok. */
const PATHS: Record<string, string> = {
  play: 'M7 4.5v15l12.5-7.5z',
  pause: 'M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z',
  prevSentence: 'M15 5l-7 7 7 7',
  nextSentence: 'M9 5l7 7-7 7',
  prevSection: 'M18 5l-7 7 7 7M6 5v14',
  nextSection: 'M6 5l7 7-7 7M18 5v14',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  close: 'M6 6l12 12M18 6L6 18',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  retake: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4',
  back5: 'M11 7L6 12l5 5M18 7l-5 5 5 5',
  toStart: 'M6 5v14M18 5l-9 7 9 7z',
  mirror: 'M12 3v18M9 7l-5 5 5 5zM15 7l5 5-5 5',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9h-13z',
  resume: 'M5 12h11M12 7l5 5-5 5M20 5v14',
  library: 'M5 4h4v16H5zM11 4h4v16h-4zM17 5l3 .8-3.4 14.4-3-.8',
  backup: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14',
  upload: 'M12 20V9M7.5 13.5L12 9l4.5 4.5M5 5h14',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L20 20',
  star: 'M12 3.8l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.4l-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  split: 'M4 12h16M12 4v5M9.5 6.5L12 9l2.5-2.5M12 20v-5M9.5 17.5L12 15l2.5 2.5',
  merge: 'M12 4v6M9.5 7.5L12 10l2.5-2.5M12 20v-6M9.5 16.5L12 14l2.5 2.5M4 12h16',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  note: 'M5 4h14v12l-4 4H5zM15 20v-4h4',
  heading: 'M6 4v16M18 4v16M6 12h12',
 home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  file: 'M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7',
  clipboard: 'M8 5H6v16h12V5h-2M9 3h6v4H9zM9 12h6M9 16h6',
  lines: 'M4 7h16M4 12h16M4 17h10',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4',
  book: 'M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z',
  gauge: 'M4 16a8 8 0 1 1 16 0M12 16l4-5',
  timer: 'M12 6a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM12 10v4M10 3h4M18.5 6.5l1.5-1.5',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  keyboard: 'M3 7h18v11H3zM7 11h.01M11 11h.01M15 11h.01M7 14.5h10',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4M7 8h10M7 11h6',
  check: 'M5 12l5 5L20 7',
  profile: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0',
  quickPlay: 'M3 8h5M3 12h7M3 16h5M12 5v14l9-7z',
  text: 'M4 18l4.5-12h1L14 18M5.6 14h6.8M15 18l2.8-7.5h.4L21 18M15.9 15.8h4.2',
  mic: 'M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v3',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, filled = false, label }: { name: IconName; size?: number; filled?: boolean; label?: string }) {
  const solid = filled || name === 'play' || name === 'pause';
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? 'currentColor' : 'none'}
      stroke={solid && (name === 'play' || name === 'pause') ? 'none' : 'currentColor'}
      strokeWidth={name === 'more' ? 3.2 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
