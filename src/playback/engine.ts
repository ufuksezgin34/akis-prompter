/**
 * Kaydırma motoru. React'tan bağımsızdır; her karede React state güncellemez.
 * Konum (offset) piksel cinsinden ondalıklı tutulur ve yuvarlanmadan transform ile çizilir,
 * böylece 60/90/120 Hz ekranlarda aynı gerçek hız ve basamaksız hareket elde edilir.
 */

export type EngineState = 'idle' | 'countdown' | 'playing' | 'paused' | 'finished';

export interface EngineClock {
  now(): number;
  requestFrame(cb: (t: number) => void): number;
  cancelFrame(id: number): void;
}

export const browserClock: EngineClock = {
  now: () => performance.now(),
  requestFrame: (cb) => requestAnimationFrame(cb),
  cancelFrame: (id) => cancelAnimationFrame(id),
};

export interface EngineEvents {
  onFrame?(offset: number): void;
  onState?(state: EngineState): void;
  onCountdown?(secondsLeft: number): void;
}

/** Tek karede kabul edilen en büyük zaman farkı. Arka plandan dönüşte sıçramayı önler. */
export const MAX_FRAME_DT_MS = 250;
const HISTORY_INTERVAL_MS = 100;
const HISTORY_LIMIT = 600; // ~60 sn

export class ScrollEngine {
  private _state: EngineState = 'idle';
  private _offset = 0;
  private _max = 0;
  private _speed = 60;
  private _activeMs = 0;
  private _countdownEndsAt = 0;
  private _lastCountdownShown = -1;
  private rafId: number | null = null;
  private lastT: number | null = null;
  private history: { ms: number; offset: number }[] = [];
  private lastHistoryMs = -Infinity;
  loop = false;
  /** Elle sürükleme sırasında akış durmadan beklemeye alınır (durum 'playing' kalır). */
  private held = false;

  constructor(
    private clock: EngineClock = browserClock,
    private events: EngineEvents = {},
  ) {}

  get state(): EngineState {
    return this._state;
  }
  get offset(): number {
    return this._offset;
  }
  get maxOffset(): number {
    return this._max;
  }
  get speed(): number {
    return this._speed;
  }
  /** Yalnızca 'playing' durumunda geçen aktif süre (ms). */
  get activeMs(): number {
    return this._activeMs;
  }

  setEvents(e: EngineEvents): void {
    this.events = e;
  }

  /** Sürükleme başlarken true, bırakılınca false. Bekleme süresi aktif süreye eklenmez, bırakınca sıçrama olmaz. */
  setHeld(on: boolean): void {
    this.held = on;
    if (!on) this.lastT = null;
  }

  get isHeld(): boolean {
    return this.held;
  }

  setSpeed(pxPerSec: number): void {
    this._speed = Math.max(0, pxPerSec);
  }

  setMaxOffset(max: number): void {
    this._max = Math.max(0, max);
    if (this._offset > this._max) this.seek(this._max);
    else if (this._state === 'finished' && this._offset < this._max) this.setState('paused');
  }

  /** Mutlak konuma git. Durumu değiştirmez (finished hariç). */
  seek(offset: number): void {
    this._offset = Math.min(this._max, Math.max(0, offset));
    if (this._state === 'finished' && this._offset < this._max) this.setState('paused');
    this.history = [];
    this.lastHistoryMs = -Infinity;
    this.events.onFrame?.(this._offset);
  }

  /** Göreli kaydırma (tekerlek/sürükleme). Çağıran önce pause() yapmalıdır. */
  nudge(delta: number): void {
    this.seek(this._offset + delta);
  }

  /** Oynat. countdownSec > 0 ise önce sayaç. Boş/uzunluksuz metinde başlamaz. */
  play(countdownSec = 0): boolean {
    if (this._max <= 0) return false;
    if (this._state === 'playing' || this._state === 'countdown') return true;
    if (this._state === 'finished' || this._offset >= this._max) {
      this._offset = 0;
      this.events.onFrame?.(0);
    }
    if (countdownSec > 0) {
      this._countdownEndsAt = this.clock.now() + countdownSec * 1000;
      this._lastCountdownShown = -1;
      this.setState('countdown');
    } else {
      this.setState('playing');
    }
    this.lastT = null;
    this.ensureLoop();
    return true;
  }

  pause(): void {
    if (this._state === 'playing' || this._state === 'countdown') {
      this.setState('paused');
      this.stopLoop();
    }
  }

  toggle(countdownSec = 0): void {
    if (this._state === 'playing' || this._state === 'countdown') this.pause();
    else this.play(countdownSec);
  }

  reset(): void {
    this.stopLoop();
    this._activeMs = 0;
    this.seek(0);
    this.setState('idle');
  }

  /** Gerçek hareket geçmişinden geri sar. Geçmiş yoksa false döner (çağıran cümle geri kullanır). */
  rewindActiveMs(ms: number): boolean {
    const target = this._activeMs - ms;
    if (this.history.length === 0) return false;
    const first = this.history[0]!;
    if (first.ms > target) return false;
    let best = first;
    for (const h of this.history) if (h.ms <= target) best = h;
    const hist = this.history.filter((h) => h.ms <= best.ms);
    this.seek(best.offset);
    this.history = hist;
    return true;
  }

  dispose(): void {
    this.stopLoop();
  }

  /** Testler ve rAF tarafından çağrılır. */
  tick(t: number): void {
    this.rafId = null;
    if (this._state === 'countdown') {
      const left = this._countdownEndsAt - t;
      const shown = Math.ceil(left / 1000);
      if (shown !== this._lastCountdownShown && shown > 0) {
        this._lastCountdownShown = shown;
        this.events.onCountdown?.(shown);
      }
      if (left <= 0) {
        this.events.onCountdown?.(0);
        this.setState('playing');
        this.lastT = t;
      }
      this.ensureLoop();
      return;
    }
    if (this._state !== 'playing') return;
    if (this.held) {
      this.lastT = t;
      this.ensureLoop();
      return;
    }
    if (this.lastT === null) {
      this.lastT = t;
      this.ensureLoop();
      return;
    }
    const dt = Math.min(MAX_FRAME_DT_MS, Math.max(0, t - this.lastT));
    this.lastT = t;
    this._activeMs += dt;
    this._offset += (this._speed * dt) / 1000;
    if (this._activeMs - this.lastHistoryMs >= HISTORY_INTERVAL_MS) {
      this.history.push({ ms: this._activeMs, offset: this._offset });
      if (this.history.length > HISTORY_LIMIT) this.history.shift();
      this.lastHistoryMs = this._activeMs;
    }
    if (this._offset >= this._max) {
      if (this.loop) {
        this._offset = 0;
        this.history = [];
      } else {
        this._offset = this._max;
        this.events.onFrame?.(this._offset);
        this.setState('finished');
        return;
      }
    }
    this.events.onFrame?.(this._offset);
    this.ensureLoop();
  }

  private ensureLoop(): void {
    if (this.rafId !== null) return; // tek döngü garantisi
    this.rafId = this.clock.requestFrame((t) => this.tick(t));
  }

  private stopLoop(): void {
    if (this.rafId !== null) this.clock.cancelFrame(this.rafId);
    this.rafId = null;
    this.lastT = null;
  }

  private setState(s: EngineState): void {
    if (this._state === s) return;
    this._state = s;
    if (s !== 'playing' && s !== 'countdown') this.stopLoop();
    this.events.onState?.(s);
  }
}

/** Hedef süre modu: kalan mesafe / kalan süre. */
export function speedForTargetDuration(remainingPx: number, seconds: number): number {
  if (seconds <= 0) return 0;
  return remainingPx / seconds;
}

/** Yaklaşık kelime/dk tahmini: px/s hızını metindeki ortalama kelime yoğunluğuyla çevirir. */
export function estimateWpm(speedPxPerSec: number, totalWords: number, totalPx: number): number | null {
  if (totalPx <= 0 || totalWords <= 0) return null;
  return Math.round((speedPxPerSec * 60 * totalWords) / totalPx);
}
