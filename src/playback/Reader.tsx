import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ActionId, ReaderSettings, Script } from '../model/types';
import { getScript, patchScript, saveScript, withVersion } from '../storage/repo';
import { formatDuration, speechWordCount } from '../model/text';
import { ScrollEngine, estimateWpm, speedForTargetDuration, type EngineState } from './engine';
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
import { actionForKey, keyLabel } from '../platform/keyboard';
import { createWakeLock, fullscreen, isStandalone, type WakeLockStatus } from '../platform/wakeLock';
import { clampSettings } from '../profiles/defaults';
import { setReaderActive } from '../ui/readerActivity';

const STATE_LABEL: Record<EngineState, string> = {
  idle: 'Hazır',
  countdown: 'Geri sayım',
  playing: 'Akıyor',
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
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [wake, setWake] = useState<WakeLockStatus>('inactive');
  const [targetSec, setTargetSec] = useState<number | null>(null);
  const [rehearsal, setRehearsal] = useState<{ startMs: number; startOffset: number } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<{ elapsed: HTMLElement | null; remaining: HTMLElement | null; progress: HTMLElement | null; wpm: HTMLElement | null }>({
    elapsed: null,
    remaining: null,
    progress: null,
    wpm: null,
  });
  const layoutRef = useRef<Layout | null>(null);
  const activeSentence = useRef<HTMLElement | null>(null);
  const lastHud = useRef(0);
  const versionSaved = useRef(false);
  const sRef = useRef(s);
  sRef.current = s;

  const engine = useMemo(() => new ScrollEngine(), []);
  const wakeLock = useMemo(() => createWakeLock(), []);

  /* --- dar ekran uyarısı: satır başına çok az karakter sığıyorsa bir kez bildir --- */
  const narrowWarned = useRef(false);
  useEffect(() => {
    const st = stageRef.current;
    if (!st || narrowWarned.current) return;
    const colPx = (st.clientWidth * s.columnWidth) / 100 - 2 * s.paddingX;
    if (colPx / (s.fontSize * 0.55) < 12) {
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
      if ('speed' in patch && targetSec !== null) {
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
      if (h.progress) h.progress.style.transform = `scaleX(${lay.maxOffset > 0 ? offset / lay.maxOffset : 0})`;
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

  useEffect(() => {
    engine.setSpeed(s.speed);
    engine.loop = s.loop;
    updateHud(engine.offset, true);
  }, [engine, s.speed, s.loop, updateHud]);

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
    engine.setMaxOffset(lay.maxOffset);
    const restored = offsetForAnchor(lay, anchor);
    if (restored !== null) engine.seek(restored);
    else applyOffset(engine.offset);
    updateHud(engine.offset, true);
  }, [engine, applyOffset, updateHud]);

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
    setS((cur) => ({ ...cur, speed: Math.min(600, Math.max(5, sp)) }));
  }, [targetSec, engine, s.fontSize, s.columnWidth, s.lineHeight, s.paragraphGap, s.paddingX]);

  /* --- kontrol eylemleri --- */
  const words = useMemo(() => (script ? speechWordCount(script.blocks) : 0), [script]);
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
      void wakeLock.request();
    },
    [empty, engine, script, wakeLock],
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

  const back5 = useCallback(() => {
    engine.pause();
    if (!engine.rewindActiveMs(5000)) {
      const lay = layoutRef.current;
      if (lay) engine.seek(prevSentenceOffset(lay, engine.offset));
      setNotice('Hareket geçmişi yok; bir önceki cümleye dönüldü.');
    }
  }, [engine]);

  const changeSpeed = useCallback(
    (dir: 1 | -1) => {
      const cur = sRef.current.speed;
      const step = Math.max(2, Math.round(cur * 0.08));
      setSettings({ speed: cur + dir * step });
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
            if (!ok) setNotice(isStandalone() ? 'Tam ekran bu cihazda desteklenmiyor.' : 'Tam ekran desteklenmiyor. Ana ekrana ekleyip uygulama olarak açarsanız tarayıcı çubukları görünmez.');
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
        <button className="btn" onClick={() => navigate({ name: 'library' })}>Metinlerime dön</button>
      </main>
    );

  const lay = layoutRef.current;
  const wpmEst = lay ? estimateWpm(s.speed, words, lay.maxOffset) : null;
  const lineHeightPx = s.fontSize * s.lineHeight;
  const lineY = `${s.readingLine}%`;
  const bandH = lineHeightPx * s.focusBandHeight;
  const columnStyle: CSSProperties = {
    width: s.narrowColumn ? `min(${s.columnWidth}%, 34em)` : `${s.columnWidth}%`,
    marginLeft: s.cameraPosition === 'left' ? s.paddingX : s.cameraPosition === 'right' ? 'auto' : 'auto',
    marginRight: s.cameraPosition === 'right' ? s.paddingX : s.cameraPosition === 'left' ? 'auto' : 'auto',
    paddingLeft: s.paddingX,
    paddingRight: s.paddingX,
  };
  const rootStyle = {
    '--r-fg': s.textColor,
    '--r-bg': s.bgColor,
    '--r-accent': s.accentColor,
    '--r-size': `${s.fontSize}px`,
    '--r-weight': s.fontWeight,
    '--r-lh': s.lineHeight,
    '--r-pgap': `${s.paragraphGap}em`,
    '--r-align': s.align,
    '--r-bottom': `${s.paddingY}px`,
  } as CSSProperties;

  const hidden = !controlsVisible && !drawer && state === 'playing';

  return (
    <div className={`reader${hidden ? ' controls-hidden' : ''}${locked ? ' is-locked' : ''}`} style={rootStyle} data-state={state}>
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
          <div ref={contentRef} className="content" data-testid="content">
            <div className="column" style={columnStyle}>
              {script && <ReaderText blocks={script.blocks} showNotes={s.showNotes} />}
            </div>
          </div>
          {s.focusBand && (
            <>
              <div className="dim dim-top" style={{ height: `calc(${lineY} - ${lineHeightPx * 0.15}px)`, opacity: s.dimOutside }} />
              <div className="dim dim-bottom" style={{ top: `calc(${lineY} + ${bandH + lineHeightPx * 0.15}px)`, opacity: s.dimOutside }} />
            </>
          )}
          {s.showReadingMarker && (
            <div className="marker" style={{ top: `calc(${lineY} + ${lineHeightPx / 2}px)` }} aria-hidden="true">
              <span className="marker-arrow">▶</span>
              <span className="marker-line" />
            </div>
          )}
          {s.cameraPosition !== 'none' && <div className={`cam-dot cam-${s.cameraPosition}`} aria-hidden="true" title="Kamera" />}
        </div>
      </div>

      {s.showProgress && (
        <div className="progress" aria-hidden="true">
          <div className="progress-fill" ref={(el) => void (hudRef.current.progress = el)} />
        </div>
      )}

      <div className="hud" aria-hidden={hidden}>
        {s.showStatus && (
          <span className={`hud-state st-${state}`}>
            {state === 'playing' ? '●' : state === 'finished' ? '■' : '❚❚'} {STATE_LABEL[state]}
          </span>
        )}
        {s.showElapsed && (
          <span title="Geçen aktif süre">
            ⏱ <span ref={(el) => void (hudRef.current.elapsed = el)}>0:00</span>
          </span>
        )}
        {s.showRemaining && (
          <span title="Yaklaşık kalan süre (geçerli hızla)">
            ⌛ <span ref={(el) => void (hudRef.current.remaining = el)}>—</span>
          </span>
        )}
        {targetSec !== null && <span className="badge">Hedef {formatDuration(targetSec)}</span>}
        {rehearsal && <span className="badge rec">Prova ölçülüyor</span>}
        {wake === 'released' && <span className="badge warn">Ekran kilidi engeli kalktı</span>}
      </div>

      {state === 'countdown' && countdown > 0 && (
        <div className="countdown" role="timer" aria-live="assertive">
          <span>{countdown}</span>
          <button className="btn" onClick={() => engine.pause()}>İptal</button>
        </div>
      )}

      {state === 'finished' && (
        <div className="finished" role="dialog" aria-label="Metin bitti">
          <p>Metin bitti</p>
          <div className="row">
            <button className="btn primary" onClick={() => { engine.reset(); play(); }}>↺ Baştan başlat</button>
            <button className="btn" onClick={() => engine.reset()}>Başa dön</button>
            <button className="btn" onClick={() => void exit()}>Editöre dön</button>
          </div>
        </div>
      )}

      {notice && (
        <div className="reader-notice" role="status">
          {notice}
          <button className="icon-btn" aria-label="Bildirimi kapat" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {locked ? (
        <UnlockButton onUnlock={() => setLocked(false)} />
      ) : (
        <nav className="controls" aria-label="Okuma kontrolleri" onPointerMove={showControls} onFocus={showControls}>
          <div className="controls-row">
            <button className="btn ghost" onClick={() => void exit()} aria-label="Okumadan çık">✕</button>
            <button className="ctl" onClick={() => run('prevSection')} aria-label="Önceki bölüm">⇤</button>
            <button className="ctl" onClick={() => run('prevSentence')} aria-label="Önceki cümle">‹</button>
            <button className="ctl play" onClick={() => run('togglePlay')} disabled={empty} aria-label={state === 'playing' || state === 'countdown' ? 'Duraklat' : 'Oynat'}>
              {state === 'playing' || state === 'countdown' ? '❚❚' : '▶'}
            </button>
            <button className="ctl" onClick={() => run('nextSentence')} aria-label="Sonraki cümle">›</button>
            <button className="ctl" onClick={() => run('nextSection')} aria-label="Sonraki bölüm">⇥</button>
            <button className="ctl" onClick={() => setDrawer((d) => !d)} aria-label="Okuma ayarları" aria-expanded={drawer}>⚙</button>
          </div>
          <div className="controls-row">
            <button className="ctl sm" onClick={() => run('speedDown')} aria-label="Hızı azalt">−</button>
            <span className="speed" aria-live="off">
              <strong>{Math.round(s.speed)}</strong> px/s
              {wpmEst !== null && <small title="Metindeki ortalama kelime yoğunluğuna göre tahmin"> ≈ {wpmEst} kelime/dk (tahmini)</small>}
            </span>
            <button className="ctl sm" onClick={() => run('speedUp')} aria-label="Hızı artır">+</button>
            <button className="ctl sm text" onClick={() => run('retake')} title={`Tekrar al (${keyLabel(app.keymap.retake[0] ?? '')})`}>↺ Tekrar al</button>
            <button className="ctl sm text" onClick={back5} title="Gerçek hareket geçmişinden 5 saniye geri">−5 sn</button>
            <button className="ctl sm text" onClick={() => run('toStart')}>Başa</button>
            {script?.lastPosition && state === 'idle' && (
              <button
                className="ctl sm text"
                onClick={() => {
                  const l = layoutRef.current;
                  if (l) seekTo(offsetForAnchor(l, script.lastPosition));
                }}
              >
                Son konum
              </button>
            )}
            <button className="ctl sm text" onClick={() => run('mirror')} aria-pressed={s.mirrorX}>Ayna</button>
            <button className="ctl sm text" onClick={() => run('fullscreen')}>Tam ekran</button>
            <button className="ctl sm text" onClick={() => setLocked(true)}>🔒 Kilitle</button>
          </div>
        </nav>
      )}

      {drawer && !locked && (
        <aside className="drawer" aria-label="Okuma ayarları">
          <header className="drawer-head">
            <label className="field-inline">
              Profil
              <select value={activeProfile.id} onChange={(e) => void updateApp({ activeProfileId: e.target.value })}>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <button className="icon-btn" aria-label="Ayarları kapat" onClick={() => setDrawer(false)}>✕</button>
          </header>
          <TargetDuration
            current={targetSec}
            onSet={(v) => {
              setTargetSec(v);
              if (v !== null) setNotice(`Hız ${formatDuration(v)} içinde bitecek şekilde ayarlandı (kalan metne göre).`);
            }}
          />
          <section className="rehearsal">
            <button className="btn" onClick={toggleRehearsal}>{rehearsal ? 'Ölçümü bitir' : 'Prova hızını ölç'}</button>
            <p className="muted small">
              Kişisel hız: {s.measuredWpm ? `${s.measuredWpm} kelime/dk (ölçülmüş, yaklaşık)` : 'henüz ölçülmedi — tahminler varsayılan 140 kelime/dk kullanır'}
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
      🔒 {armed ? 'Onaylamak için tekrar' : 'Kilidi açmak için basılı tut'}
    </button>
  );
}
