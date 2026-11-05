import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ActionId, ReaderSettings, Script } from '../model/types';
import { getScript, patchScript, saveScript, withVersion } from '../storage/repo';
import { formatDuration, speechWordCount } from '../model/text';
import { ScrollEngine, speedForTargetDuration, type EngineState } from './engine';
import {
  anchorAt,
  currentSentenceIndex,
  measure,
  nextSectionOffset,
  nextSentenceOffset,
  offsetForAnchor,
  prevSectionOffset,
  prevSentenceOffset,
  type Layout,
} from './layout';
import { ReaderText } from './ReaderText';
import { ReaderSettingsPanel } from './ReaderSettingsPanel';
import { navigate, useStore, announce } from '../ui/store';
import { actionForKey, actionForRemoteKey, keyLabel } from '../platform/keyboard';
import { captureHardwareKeys, onRemoteKey } from '../platform/remoteInput';
import { createWakeLock, fullscreen, isStandalone, type WakeLockStatus } from '../platform/wakeLock';
import { clampSettings } from '../profiles/defaults';
import { setReaderActive } from '../ui/readerActivity';
import { Icon } from '../ui/Icon';
import { isNative } from '../platform/native';
import { Switch } from '../ui/kit';

const STATE_LABEL: Record<EngineState, string> = {
  idle: 'Prova',
  countdown: 'Geri sayım',
  playing: 'Canlı',
  paused: 'Duraklatıldı',
  finished: 'Bitti',
};

const HIDE_CONTROLS_MS = 2500;

export function Reader({ id }: { id: string }) {
  const { activeProfile, profiles, app, saveProfile, updateApp } = useStore();
  const [script, setScript] = useState<Script | null>(null);
  const [missing, setMissing] = useState(false);
  const [s, setS] = useState<ReaderSettings>(activeProfile.settings);
  const [state, setState] = useState<EngineState>('idle');
  const [countdown, setCountdown] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [glassSheet, setGlassSheet] = useState(false);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [wake, setWake] = useState<WakeLockStatus>('inactive');
  const [targetSec, setTargetSec] = useState<number | null>(null);
  const [rehearsal, setRehearsal] = useState<{ startMs: number; startOffset: number } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<{ elapsed: HTMLElement | null; remaining: HTMLElement | null; scrub: HTMLInputElement | null; pos: HTMLElement | null; total: HTMLElement | null }>({
    elapsed: null,
    remaining: null,
    scrub: null,
    pos: null,
    total: null,
  });
  /** Zaman çizelgesi sürüklenirken motor konumu çizelgeyi ezmesin. */
  const scrubbing = useRef<{ wasPlaying: boolean } | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const activeSentence = useRef<HTMLElement | null>(null);
  const lastHud = useRef(0);
  const versionSaved = useRef(false);
  const sRef = useRef(s);
  sRef.current = s;

  const engine = useMemo(() => new ScrollEngine(), []);
  const words = useMemo(() => (script ? speechWordCount(script.blocks) : 0), [script]);
  const wordsRef = useRef(words);
  wordsRef.current = words;
  /** Ölçülmüş düzende kelime başına düşen kaydırma mesafesi (px). Kelime/dk → px/s çevirisi için. */
  const pxPerWord = useRef(0);
  const wakeLock = useMemo(() => createWakeLock(), []);

  /* --- dar ekran uyarısı: satır başına çok az karakter sığıyorsa bir kez bildir --- */
  const narrowWarned = useRef(false);
  useEffect(() => {
    const st = stageRef.current;
    if (!st || narrowWarned.current) return;
    const colPx = (st.clientWidth * s.columnWidth) / 100 - 2 * s.paddingX;
    if (colPx / (s.fontSize * 0.55) < 8) {
      narrowWarned.current = true;
      setNotice('Bu ekran için yazı boyutu büyük; satıra çok az kelime sığıyor. ⚙ ile yazı boyutunu küçültebilirsiniz.');
    }
  }, [s.fontSize, s.columnWidth, s.paddingX, script]);

  /* --- yükleme --- */
  useEffect(() => {
    void getScript(id).then((x) => {
      if (!x || x.deletedAt) setMissing(true);
      else setScript(x);
    });
  }, [id]);

  // Profil değişince yerel ayarları al.
  useEffect(() => {
    setS(activeProfile.settings);
  }, [activeProfile.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ayar değişikliklerini profile ertelemeli yaz.
  const persistTimer = useRef<number | null>(null);
  const setSettings = useCallback(
    (patch: Partial<ReaderSettings>) => {
      setS((cur) => {
        const next = clampSettings({ ...cur, ...patch });
        if (persistTimer.current) clearTimeout(persistTimer.current);
        persistTimer.current = window.setTimeout(() => void saveProfile({ ...activeProfile, settings: next }), 400);
        return next;
      });
      if ('wpm' in patch && targetSec !== null) {
        setTargetSec(null);
        setNotice('Hızı elle değiştirdiniz; hedef süre artık garanti edilmiyor.');
      }
    },
    [activeProfile, saveProfile, targetSec],
  );

  /* --- motor olayları: React state yalnızca durum değişiminde güncellenir --- */
  const updateHud = useCallback(
    (offset: number, forceNow = false) => {
      const lay = layoutRef.current;
      if (!lay) return;
      // Okuma çizgisindeki cümleyi işaretle (doğrudan DOM, her karede ucuz).
      const idx = currentSentenceIndex(lay, offset);
      const el = idx >= 0 ? lay.sentences[idx]!.el : null;
      if (el !== activeSentence.current) {
        activeSentence.current?.classList.remove('is-active');
        el?.classList.add('is-active');
        activeSentence.current = el;
      }
      const now = performance.now();
      if (!forceNow && now - lastHud.current < 250) return;
      lastHud.current = now;
      const h = hudRef.current;
      const sp = engine.speed;
      if (h.elapsed) h.elapsed.textContent = formatDuration(engine.activeMs / 1000);
      if (h.remaining) h.remaining.textContent = sp > 0 ? `≈ ${formatDuration((lay.maxOffset - offset) / sp)}` : '—';
      const frac = lay.maxOffset > 0 ? offset / lay.maxOffset : 0;
      if (h.scrub && !scrubbing.current) {
        h.scrub.value = String(Math.round(frac * 1000));
        h.scrub.style.setProperty('--pct', `${frac * 100}%`);
      }
      // Çizelge zamanı: geçerli hızla metindeki konumun karşılığı (tahmini).
      if (h.pos) h.pos.textContent = sp > 0 ? formatDuration(offset / sp) : '0:00';
      if (h.total) h.total.textContent = sp > 0 ? formatDuration(lay.maxOffset / sp) : '—';
    },
    [engine],
  );

  const applyOffset = useCallback(
    (offset: number) => {
      const c = contentRef.current;
      // Yuvarlama yok: alt piksel transform basamaklı hareketi önler.
      if (c) c.style.transform = `translate3d(0, ${-offset}px, 0)`;
      updateHud(offset);
    },
    [updateHud],
  );

  const savePosition = useCallback(() => {
    const lay = layoutRef.current;
    if (!lay || !script) return;
    const a = anchorAt(lay, engine.offset);
    if (a) void patchScript(script.id, { lastPosition: a }).catch(() => {});
  }, [engine, script]);

  useEffect(() => {
    engine.setEvents({
      onFrame: applyOffset,
      onState: (st) => {
        setState(st);
        announce(STATE_LABEL[st]);
        if (st === 'paused' || st === 'finished') savePosition();
      },
      onCountdown: setCountdown,
    });
  }, [engine, applyOffset, savePosition]);

  /** Kelime/dk → px/s: metnin gerçek yerleşimindeki ortalama kelime yoğunluğuna göre. */
  const syncSpeed = useCallback(() => {
    const ppw = pxPerWord.current;
    const px = ppw > 0 ? (sRef.current.wpm / 60) * ppw : sRef.current.speed;
    engine.setSpeed(px);
    updateHud(engine.offset, true);
  }, [engine, updateHud]);

  useEffect(() => {
    engine.loop = s.loop;
    syncSpeed();
  }, [engine, s.wpm, s.loop, syncSpeed]);

  /* --- ölçüm: yalnızca yerleşim değişince --- */
  const remeasure = useCallback(() => {
    const stage = stageRef.current;
    const content = contentRef.current;
    if (!stage || !content) return;
    const old = layoutRef.current;
    const anchor = old ? anchorAt(old, engine.offset) : null;
    const lineY = (stage.clientHeight * sRef.current.readingLine) / 100;
    content.style.paddingTop = `${lineY}px`;
    content.style.paddingBottom = `${Math.max(0, stage.clientHeight - lineY)}px`;
    const lay = measure(content, lineY);
    layoutRef.current = lay;
    pxPerWord.current = wordsRef.current > 0 ? lay.maxOffset / wordsRef.current : 0;
    engine.setMaxOffset(lay.maxOffset);
    const restored = offsetForAnchor(lay, anchor);
    if (restored !== null) engine.seek(restored);
    else applyOffset(engine.offset);
    syncSpeed();
  }, [engine, applyOffset, syncSpeed]);

  useLayoutEffect(() => {
    remeasure();
  }, [remeasure, script, s.fontSize, s.fontWeight, s.lineHeight, s.paragraphGap, s.columnWidth, s.paddingX, s.paddingY, s.narrowColumn, s.cameraPosition, s.readingLine, s.showNotes, s.align]);

  useEffect(() => {
    const stage = stageRef.current;
    const content = contentRef.current;
    if (!stage || !content) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(remeasure);
    });
    ro.observe(stage);
    ro.observe(content);
    void document.fonts?.ready.then(() => remeasure());
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [remeasure, script]);

  // Hedef süre modu: kalan mesafe / kalan süre. Yerleşim değişince yeniden hesaplanır.
  useEffect(() => {
    if (targetSec === null) return;
    const lay = layoutRef.current;
    if (!lay) return;
    const sp = speedForTargetDuration(lay.maxOffset - engine.offset, targetSec);
    const ppw = pxPerWord.current;
    if (ppw > 0) setS((cur) => ({ ...cur, wpm: Math.min(300, Math.max(40, Math.round((sp * 60) / ppw))) }));
  }, [targetSec, engine, s.fontSize, s.columnWidth, s.lineHeight, s.paragraphGap, s.paddingX]);

  /* --- kontrol eylemleri --- */
  const empty = words === 0;

  const play = useCallback(
    (countdownSec = sRef.current.countdown) => {
      if (empty) {
        setNotice('Okunacak konuşma metni yok. Editörde konuşma bloğu ekleyin.');
        return;
      }
      if (!versionSaved.current && script) {
        versionSaved.current = true;
        void saveScript(withVersion(script, 'Çekim başlangıcı')).catch(() => {});
      }
      setNotice(null);
      engine.play(countdownSec);
      if (app.keepAwake) void wakeLock.request();
    },
    [empty, engine, script, wakeLock, app.keepAwake],
  );

  const seekTo = useCallback(
    (offset: number | null) => {
      if (offset === null) return;
      engine.pause();
      engine.seek(offset);
    },
    [engine],
  );

  const retake = useCallback(() => {
    const lay = layoutRef.current;
    if (!lay) return;
    engine.pause();
    engine.seek(prevSentenceOffset(lay, engine.offset, 'current'));
    play(3);
  }, [engine, play]);

  /** ±sn: geri sarma gerçek hareket geçmişini kullanır; yoksa cümle başına döner ve bunu söyler. */
  const skip = useCallback(
    (sec: number) => {
      if (sec < 0) {
        if (!engine.rewindActiveMs(-sec * 1000)) {
          const lay = layoutRef.current;
          if (lay) engine.seek(prevSentenceOffset(lay, engine.offset));
          setNotice('Hareket geçmişi yok; bir önceki cümleye dönüldü.');
        }
      } else {
        engine.seek(engine.offset + engine.speed * sec);
      }
    },
    [engine],
  );

  const changeSpeed = useCallback(
    (dir: 1 | -1) => {
      setSettings({ wpm: sRef.current.wpm + dir * 5 });
    },
    [setSettings],
  );

  const exit = useCallback(async () => {
    engine.pause();
    savePosition();
    if (fullscreen.active) await fullscreen.toggle();
    navigate({ name: 'edit', id });
  }, [engine, id, savePosition]);

  const run = useCallback(
    (a: ActionId) => {
      const lay = layoutRef.current;
      switch (a) {
        case 'togglePlay':
          if (engine.state === 'playing' || engine.state === 'countdown') engine.pause();
          else play();
          break;
        case 'speedUp':
          changeSpeed(1);
          break;
        case 'speedDown':
          changeSpeed(-1);
          break;
        case 'prevSentence':
          if (lay) seekTo(prevSentenceOffset(lay, engine.offset));
          break;
        case 'nextSentence':
          if (lay) seekTo(nextSentenceOffset(lay, engine.offset));
          break;
        case 'prevSection':
          if (lay) seekTo(prevSectionOffset(lay, engine.offset));
          break;
        case 'nextSection':
          if (lay) seekTo(nextSectionOffset(lay, engine.offset));
          break;
        case 'toStart':
          engine.reset();
          break;
        case 'fullscreen':
          void fullscreen.toggle().then((ok) => {
            if (!ok) setNotice(isStandalone() || isNative() ? 'Tam ekran bu cihazda desteklenmiyor.' : 'Tam ekran desteklenmiyor. Ana ekrana ekleyip uygulama olarak açarsanız tarayıcı çubukları görünmez.');
          });
          break;
        case 'mirror':
          setSettings({ mirrorX: !sRef.current.mirrorX });
          break;
        case 'retake':
          retake();
          break;
        case 'exit':
          if (drawer) setDrawer(false);
          else void exit();
          break;
      }
      showControls();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, play, changeSpeed, seekTo, setSettings, retake, exit, drawer],
  );

  /* --- kumanda: oyun kolu ve Android ses/medya tuşları --- */
  useEffect(() => {
    const release = captureHardwareKeys();
    const off = onRemoteKey((key) => {
      const a = actionForRemoteKey(app.keymap, key);
      if (a) run(a);
    });
    return () => {
      off();
      release();
    };
  }, [app.keymap, run]);

  /* --- klavye / pedal --- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const a = actionForKey(app.keymap, e);
      if (!a) return;
      e.preventDefault();
      run(a);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app.keymap, run]);

  /* --- görünürlük: arka planda duraklat, dönüşte otomatik başlatma --- */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        savePosition();
        if (sRef.current.pauseOnHidden && (engine.state === 'playing' || engine.state === 'countdown')) {
          engine.pause();
          setNotice('Uygulama arka plana geçtiği için duraklatıldı. Devam etmek için Oynat’a basın.');
        }
      } else if (wakeLock.status === 'released' || wakeLock.status === 'active') {
        void wakeLock.request();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [engine, savePosition, wakeLock]);

  useEffect(() => {
    wakeLock.onChange(setWake);
    setWake(wakeLock.status);
    setReaderActive(true);
    return () => {
      setReaderActive(false);
      engine.dispose();
      void wakeLock.release();
    };
  }, [engine, wakeLock]);

  useEffect(() => {
    setReaderActive(state === 'playing' || state === 'countdown' ? 'busy' : true);
  }, [state]);

  /* --- kontrollerin otomatik gizlenmesi --- */
  const hideTimer = useRef<number | null>(null);
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (engine.state === 'playing') setControlsVisible(false);
    }, HIDE_CONTROLS_MS);
  }, [engine]);
  useEffect(() => {
    if (state === 'playing') showControls();
    else setControlsVisible(true);
  }, [state, showControls]);

  /* --- elle kaydırma: önce otomatik akışı duraklatır --- */
  const drag = useRef<{ y: number; moved: boolean; id: number } | null>(null);
  const dirY = s.flipY ? -1 : 1;
  const onWheel = (e: React.WheelEvent) => {
    if (locked) return;
    if (engine.state === 'playing' || engine.state === 'countdown') engine.pause();
    engine.nudge(e.deltaY * dirY);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (locked) {
      showControls();
      return;
    }
    drag.current = { y: e.clientY, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) {
      if (e.pointerType === 'mouse') showControls();
      return;
    }
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < 8) return;
    if (!d.moved) {
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      if (engine.state === 'playing' || engine.state === 'countdown') engine.pause();
    }
    engine.nudge(-dy * dirY);
    d.y = e.clientY;
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    // Dokunma yalnızca kontrolleri gösterir; asla başa sarmaz veya oynatmaz.
    if (d && !d.moved) showControls();
  };

  /* --- prova ölçümü --- */
  const toggleRehearsal = () => {
    const lay = layoutRef.current;
    if (!rehearsal) {
      setRehearsal({ startMs: engine.activeMs, startOffset: engine.offset });
      setNotice('Prova ölçümü başladı. Normal okuyun, bitince “Ölçümü bitir”e basın.');
      return;
    }
    const sec = (engine.activeMs - rehearsal.startMs) / 1000;
    const dist = engine.offset - rehearsal.startOffset;
    setRehearsal(null);
    if (!lay || sec < 10 || dist <= 0 || lay.maxOffset <= 0) {
      setNotice('Ölçüm için en az 10 saniye akış gerekli.');
      return;
    }
    const wpm = Math.round(((dist / lay.maxOffset) * words) / (sec / 60));
    setSettings({ measuredWpm: wpm });
    setNotice(`Prova: ${formatDuration(sec)} sürede ≈ ${wpm} kelime/dk. Bu profilde kişisel hız olarak kaydedildi (yaklaşık değer).`);
  };

  if (missing)
    return (
      <main className="page">
        <p>Metin bulunamadı.</p>
        <button className="btn" onClick={() => navigate({ name: 'library' })}>Metinlere dön</button>
      </main>
    );

  const lineHeightPx = s.fontSize * s.lineHeight;
  const lineY = `${s.readingLine}%`;
  const bandH = lineHeightPx * s.focusBandHeight;
  const columnStyle: CSSProperties = {
    width: s.narrowColumn ? `min(${s.columnWidth}%, 34em)` : `${s.columnWidth}%`,
    marginLeft: s.cameraPosition === 'left' ? s.paddingX : 'auto',
    marginRight: s.cameraPosition === 'right' ? s.paddingX : 'auto',
    paddingLeft: s.paddingX,
    paddingRight: s.paddingX,
  };
  const rootStyle = {
    '--r-fg': s.glassMode ? '#ffffff' : s.textColor,
    '--r-bg': s.glassMode ? '#000000' : s.bgColor,
    '--r-accent': s.accentColor,
    '--r-size': `${s.fontSize}px`,
    '--r-weight': s.fontWeight,
    '--r-lh': s.lineHeight,
    '--r-pgap': `${s.paragraphGap}em`,
    '--r-align': s.align,
    '--r-bottom': `${s.paddingY}px`,
  } as CSSProperties;

  const hidden = !controlsVisible && !drawer && state === 'playing';
  const playing = state === 'playing' || state === 'countdown';

  const quick = (label: string, icon: Parameters<typeof Icon>[0]['name'], fn: () => void) => (
    <button className="quick" onClick={fn}>
      <Icon name={icon} size={20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className={`reader${hidden ? ' controls-hidden' : ''}${locked ? ' is-locked' : ''}`} style={rootStyle} data-state={state} data-theme-r={s.readerTheme} data-glass={s.glassMode || undefined}>
      <div
        ref={stageRef}
        className="stage"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Okuma alanı"
      >
        {/* Yalnızca metin katmanı aynalanır; kontroller okunaklı kalır. */}
        <div className="text-layer" style={{ transform: `scale(${s.mirrorX ? -1 : 1}, ${s.flipY ? -1 : 1})` }} data-testid="text-layer">
          {s.focusBand && <div className="band" style={{ top: lineY, height: bandH }} aria-hidden="true" />}
          <div ref={contentRef} className="content" data-testid="content">
            <div className="column" style={columnStyle}>
              {script && <ReaderText blocks={script.blocks} showNotes={s.showNotes} />}
            </div>
          </div>
          {s.focusBand && (
            <>
              <div className="dim dim-top" style={{ height: `calc(${lineY} - ${lineHeightPx * 0.1}px)`, opacity: s.dimOutside }} />
              <div className="dim dim-bottom" style={{ top: `calc(${lineY} + ${bandH + lineHeightPx * 0.1}px)`, opacity: s.dimOutside * 0.45 }} />
            </>
          )}
          {s.showReadingMarker && (
            <div className="marker" style={{ top: `calc(${lineY} + ${lineHeightPx / 2}px)` }} aria-hidden="true">
              <span className="marker-arrow" />
            </div>
          )}
          {s.cameraPosition !== 'none' && <div className={`cam-dot cam-${s.cameraPosition}`} aria-hidden="true" title="Kamera" />}
        </div>
      </div>

      <header className="r-top" aria-hidden={hidden}>
        <button className="r-btn" onClick={() => void exit()} aria-label="Okumadan çık"><Icon name="close" /></button>
        <div className="r-status">
          {s.showStatus && (
            <span className={`r-pill st-${state}`}>
              <span className="tally" aria-hidden="true" />
              {STATE_LABEL[state]}
            </span>
          )}
          {s.showElapsed && (
            <span className="r-time" title="Geçen aktif süre" ref={(el) => void (hudRef.current.elapsed = el)}>0:00</span>
          )}
        </div>
        <button className="r-btn" onClick={() => setDrawer((d) => !d)} aria-label="Diğer seçenekler" aria-expanded={drawer}><Icon name="more" /></button>
      </header>
      <div className="hud-badges">
        {targetSec !== null && <span className="badge">Hedef {formatDuration(targetSec)}</span>}
        {rehearsal && <span className="badge rec">Prova ölçülüyor</span>}
        {wake === 'released' && <span className="badge warn">Ekran kilidi engeli kalktı</span>}
      </div>

      {state === 'countdown' && countdown > 0 && (
        <div className="countdown" role="timer" aria-live="assertive">
          <span className="count-ring">{countdown}</span>
          <button className="btn pill" onClick={() => engine.pause()}>İptal</button>
        </div>
      )}

      {state === 'finished' && (
        <div className="finished" role="dialog" aria-label="Metin bitti">
          <p>Metin bitti</p>
          <div className="row center">
            <button className="btn primary" onClick={() => { engine.reset(); play(); }}><Icon name="retake" size={18} /> Baştan başlat</button>
            <button className="btn" onClick={() => engine.reset()}>Başa dön</button>
            <button className="btn" onClick={() => void exit()}>Editöre dön</button>
          </div>
        </div>
      )}

      {notice && (
        <div className="reader-notice" role="status">
          {notice}
          <button className="icon-btn" aria-label="Bildirimi kapat" onClick={() => setNotice(null)}><Icon name="close" size={18} /></button>
        </div>
      )}

      {locked ? (
        <UnlockButton onUnlock={() => setLocked(false)} />
      ) : (
        <nav className="controls" aria-label="Okuma kontrolleri" onPointerMove={showControls} onFocus={showControls}>
          {s.showProgress && (
            <div className="timeline">
              <span className="tl-time" ref={(el) => void (hudRef.current.pos = el)}>0:00</span>
              <input
                ref={(el) => void (hudRef.current.scrub = el)}
                className="range scrub"
                type="range"
                min={0}
                max={1000}
                step={1}
                defaultValue={0}
                aria-label="Zaman çizelgesi: ileri veya geri sar"
                onPointerDown={() => {
                  const wasPlaying = engine.state === 'playing';
                  if (wasPlaying) engine.pause();
                  scrubbing.current = { wasPlaying };
                }}
                onInput={(e) => {
                  const lay = layoutRef.current;
                  if (!lay) return;
                  const v = Number(e.currentTarget.value) / 1000;
                  e.currentTarget.style.setProperty('--pct', `${v * 100}%`);
                  engine.seek(v * lay.maxOffset);
                }}
                onPointerUp={() => {
                  const sc = scrubbing.current;
                  scrubbing.current = null;
                  if (sc?.wasPlaying) engine.play(0);
                }}
                onPointerCancel={() => (scrubbing.current = null)}
              />
              <span className="tl-time total" ref={(el) => void (hudRef.current.total = el)}>—</span>
            </div>
          )}
          <div className="speed-row">
            <label htmlFor="speed-wpm">Hız</label>
            <span className="speed-val">
              {s.showRemaining && (
                <span className="remain" title="Yaklaşık kalan süre (geçerli hızla)">
                  Kalan <span ref={(el) => void (hudRef.current.remaining = el)}>—</span>
                </span>
              )}
              <strong>{s.wpm}</strong> kelime/dk
            </span>
          </div>
          <input
            id="speed-wpm"
            className="range"
            type="range"
            min={40}
            max={300}
            step={5}
            value={s.wpm}
            onChange={(e) => setSettings({ wpm: Number(e.target.value) })}
            aria-valuetext={`${s.wpm} kelime/dk`}
            style={{ '--pct': `${((s.wpm - 40) / 260) * 100}%` } as CSSProperties}
          />
          <div className="transport">
            <button className="ctl round" onClick={() => skip(-10)} aria-label="10 saniye geri"><span className="skip">10</span><Icon name="retake" size={34} /></button>
            <button className="ctl play" onClick={() => run('togglePlay')} disabled={empty} aria-label={playing ? 'Duraklat' : 'Oynat'}>
              <Icon name={playing ? 'pause' : 'play'} size={34} />
            </button>
            <button className="ctl round fwd" onClick={() => skip(10)} aria-label="10 saniye ileri"><span className="skip">10</span><Icon name="retake" size={34} /></button>
          </div>
          <div className="speed-compact" role="group" aria-label="Hız">
            <button className="ctl mini" onClick={() => run('speedDown')} aria-label="Hızı azalt"><Icon name="minus" size={18} /></button>
            <span><strong>{s.wpm}</strong> k/dk</span>
            <button className="ctl mini" onClick={() => run('speedUp')} aria-label="Hızı artır"><Icon name="plus" size={18} /></button>
          </div>
          <div className="tools">
            <button className="tool" onClick={() => setDrawer((d) => !d)} aria-label="Okuma ayarları" aria-expanded={drawer}><span className="aa">Aa</span></button>
            <button className="tool" onClick={() => setGlassSheet(true)} aria-pressed={s.mirrorX || s.flipY} aria-label="Ayna"><Icon name="mirror" /></button>
            <button className="tool" onClick={() => run('retake')} aria-label="Tekrar al" title={`Tekrar al (${keyLabel(app.keymap.retake[0] ?? '')})`}><Icon name="retake" /></button>
            <button className="tool" onClick={() => setLocked(true)} aria-label="Kilitle"><Icon name="lock" /></button>
          </div>
        </nav>
      )}

      {glassSheet && !locked && (
        <GlassSheet
          s={s}
          onPick={(mirrorX, flipY) => setSettings({ mirrorX, flipY })}
          onGlass={(glassMode) => setSettings({ glassMode })}
          onClose={() => setGlassSheet(false)}
        />
      )}

      {drawer && !locked && (
        <aside className="drawer" aria-label="Okuma ayarları">
          <header className="drawer-head">
            <strong>Okuma</strong>
            <button className="icon-btn" aria-label="Ayarları kapat" onClick={() => setDrawer(false)}><Icon name="close" /></button>
          </header>
          <div className="quick-grid">
            {quick('Önceki cümle', 'prevSentence', () => run('prevSentence'))}
            {quick('Sonraki cümle', 'nextSentence', () => run('nextSentence'))}
            {quick('Önceki bölüm', 'prevSection', () => run('prevSection'))}
            {quick('Sonraki bölüm', 'nextSection', () => run('nextSection'))}
            {quick('Başa dön', 'toStart', () => run('toStart'))}
            {script?.lastPosition &&
              quick('Son konum', 'resume', () => {
                const l = layoutRef.current;
                if (l) seekTo(offsetForAnchor(l, script.lastPosition));
              })}
            {quick('Tam ekran', 'fullscreen', () => run('fullscreen'))}
          </div>
          <label className="field-inline">
            Profil
            <select value={activeProfile.id} onChange={(e) => void updateApp({ activeProfileId: e.target.value })}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <TargetDuration
            current={targetSec}
            onSet={(v) => {
              setTargetSec(v);
              if (v !== null) setNotice(`Hız ${formatDuration(v)} içinde bitecek şekilde ayarlandı (kalan metne göre).`);
            }}
          />
          <section className="rehearsal">
            <button className="btn" onClick={toggleRehearsal}>{rehearsal ? 'Ölçümü bitir' : 'Prova süresini ölç'}</button>
            <p className="muted small">
              Ölçülen okuma: {s.measuredWpm ? `${s.measuredWpm} kelime/dk (yaklaşık)` : 'henüz ölçülmedi'} · Kaydırma: {Math.round(engine.speed)} px/s
            </p>
          </section>
          <p className="muted small">
            Ekranı açık tutma:{' '}
            {wake === 'unsupported'
              ? 'bu tarayıcı desteklemiyor — cihaz ayarlarından otomatik kilidi uzatın.'
              : wake === 'active'
                ? 'etkin.'
                : wake === 'released'
                  ? 'sistem tarafından kaldırıldı; tekrar istenecek.'
                  : wake === 'error'
                    ? 'istenemedi (pil tasarrufu modu olabilir).'
                    : 'oynatınca istenir.'}
          </p>
          <ReaderSettingsPanel s={s} set={setSettings} compact />
        </aside>
      )}
    </div>
  );
}

const ORIENTATIONS: { label: string; hint: string; x: boolean; y: boolean }[] = [
  { label: 'Normal', hint: 'Ayna yok', x: false, y: false },
  { label: 'Sağ-sol', hint: 'Yatay ayna', x: true, y: false },
  { label: 'Alt-üst', hint: 'Dikey ters', x: false, y: true },
  { label: 'İkisi birden', hint: '180° döndür', x: true, y: true },
];

/** Cam ayarı: dört yön seçeneği, her biri örnek yazıyla; camda düz okunan seçilir. */
function GlassSheet({ s, onPick, onGlass, onClose }: { s: ReaderSettings; onPick: (x: boolean, y: boolean) => void; onGlass: (v: boolean) => void; onClose: () => void }) {
  return (
    <div className="glass-sheet" role="dialog" aria-label="Prompter camı ayarı">
      <header className="drawer-head">
        <strong>Prompter camı</strong>
        <button className="icon-btn" aria-label="Kapat" onClick={onClose}><Icon name="close" /></button>
      </header>
      <p className="glass-help">Telefonu düzeneğe yerleştir ve cama bak. Camda <strong>düz okunan</strong> kartı seç.</p>
      <div className="orient-grid" role="radiogroup" aria-label="Yön">
        {ORIENTATIONS.map((o) => {
          const on = s.mirrorX === o.x && s.flipY === o.y;
          return (
            <button key={o.label} role="radio" aria-checked={on} className="orient" onClick={() => onPick(o.x, o.y)}>
              <span className="orient-sample" style={{ transform: `scale(${o.x ? -1 : 1}, ${o.y ? -1 : 1})` }} aria-hidden="true">
                <span className="orient-word">Metin</span>
                <span className="orient-arrow">↑</span>
              </span>
              <span className="orient-label">{o.label}</span>
              <span className="orient-hint">{o.hint}</span>
            </button>
          );
        })}
      </div>
      <label className="glass-toggle">
        <span>
          <strong>Cam modu</strong>
          <small>Tam siyah zemin ve beyaz yazı; renkli bant kalkar. Camda en net görüntü budur.</small>
        </span>
        <Switch checked={s.glassMode} onChange={onGlass} label="Cam modu" />
      </label>
      <p className="glass-help small">İpucu: Telefonun parlaklığını en yükseğe al, ortamı biraz karart. Yansımada çift görüntü varsa camın kaplamalı yüzü telefona bakmalı.</p>
      <button className="btn primary block" onClick={onClose}>Tamam</button>
    </div>
  );
}

function TargetDuration({ current, onSet }: { current: number | null; onSet: (v: number | null) => void }) {
  const [val, setVal] = useState(current ? formatDuration(current) : '');
  return (
    <section className="target">
      <label className="field-inline">
        Hedef süre (dk:sn)
        <input inputMode="numeric" placeholder="ör. 0:30" value={val} onChange={(e) => setVal(e.target.value)} size={6} />
      </label>
      <button
        className="btn"
        onClick={() => {
          const m = val.trim().match(/^(\d{1,3})(?::(\d{1,2}))?$/);
          if (!m) return onSet(null);
          const sec = m[2] !== undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[1]);
          onSet(sec > 0 ? sec : null);
        }}
      >
        Uygula
      </button>
      {current !== null && <button className="btn ghost" onClick={() => { setVal(''); onSet(null); }}>Kapat</button>}
    </section>
  );
}

/** Kilit: dokunmatikte belirgin uzun basma (1 sn); klavye/ekran okuyucuda iki aşamalı onay. */
function UnlockButton({ onUnlock }: { onUnlock: () => void }) {
  const [armed, setArmed] = useState(false);
  const [holding, setHolding] = useState(false);
  const t = useRef<number | null>(null);
  useEffect(() => () => void (t.current && clearTimeout(t.current)), []);
  return (
    <button
      className={`unlock${holding ? ' holding' : ''}`}
      aria-label={armed ? 'Kilidi açmak için tekrar etkinleştirin' : 'Kilitli. Açmak için basılı tutun'}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        setHolding(true);
        t.current = window.setTimeout(() => {
          setHolding(false);
          onUnlock();
        }, 1000);
      }}
      onPointerUp={() => {
        setHolding(false);
        if (t.current) clearTimeout(t.current);
      }}
      onPointerLeave={() => {
        setHolding(false);
        if (t.current) clearTimeout(t.current);
      }}
      onClick={(e) => {
        // detail === 0: klavye veya yardımcı teknoloji etkinleştirmesi
        if (e.detail !== 0) return;
        if (armed) onUnlock();
        else {
          setArmed(true);
          window.setTimeout(() => setArmed(false), 3000);
        }
      }}
    >
      <Icon name="lock" size={18} /> {armed ? 'Onaylamak için tekrar' : 'Kilidi açmak için basılı tut'}
    </button>
  );
}
