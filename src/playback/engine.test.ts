import { describe, expect, it } from 'vitest';
import { ScrollEngine, type EngineClock } from './engine';

function fakeClock() {
  let t = 0;
  let cb: ((t: number) => void) | null = null;
  let ids = 0;
  let pending = 0;
  const clock: EngineClock = {
    now: () => t,
    requestFrame: (f) => { cb = f; pending++; return ++ids; },
    cancelFrame: () => { cb = null; pending = Math.max(0, pending - 1); },
  };
  return {
    clock,
    get pending() { return pending; },
    /** belirtilen kare aralığıyla süre ilerlet */
    run(ms: number, frameMs: number) {
      const end = t + ms;
      while (t < end && cb) {
        t = Math.min(end, t + frameMs);
        const f = cb; cb = null; pending--;
        f(t);
      }
      t = end;
    },
    jump(ms: number) { t += ms; },
  };
}

describe('ScrollEngine', () => {
  it('60/90/120 Hz ve düzensiz karelerde aynı sürede aynı mesafe', () => {
    const results = [1000 / 60, 1000 / 90, 1000 / 120, 7, 23].map((frame) => {
      const c = fakeClock();
      const e = new ScrollEngine(c.clock);
      e.setMaxOffset(100000);
      e.setSpeed(80);
      e.play(0);
      c.run(frame, frame); // ilk kare dt=0 (başlangıç)
      c.run(10_000, frame);
      return e.offset;
    });
    for (const r of results) expect(r).toBeCloseTo(800, 0);
  });

  it('duraklatma hareketi ve aktif süreyi durdurur; devamda sıçrama yok', () => {
    const c = fakeClock();
    const e = new ScrollEngine(c.clock);
    e.setMaxOffset(10000);
    e.setSpeed(100);
    e.play(0);
    c.run(16, 16);
    c.run(1000, 16);
    e.pause();
    const o = e.offset;
    const a = e.activeMs;
    c.jump(60_000); // bir dakika duraklatıldı
    expect(e.offset).toBe(o);
    e.play(0);
    c.run(16, 16);
    expect(e.offset - o).toBeLessThan(1);
    expect(e.activeMs - a).toBeLessThan(1);
  });

  it('arka planda uzun kare boşluğu sınırlandırılır', () => {
    const c = fakeClock();
    const e = new ScrollEngine(c.clock);
    e.setMaxOffset(100000);
    e.setSpeed(100);
    e.play(0);
    c.run(16, 16);
    c.run(5000, 5000); // tek dev kare
    expect(e.offset).toBeLessThanOrEqual(25 + 1);
  });

  it('tek animasyon döngüsü', () => {
    const c = fakeClock();
    const e = new ScrollEngine(c.clock);
    e.setMaxOffset(1000);
    e.play(0); e.play(0); e.toggle(); e.toggle();
    expect(c.pending).toBe(1);
  });

  it('boş metinde başlamaz', () => {
    const c = fakeClock();
    const e = new ScrollEngine(c.clock);
    expect(e.play(0)).toBe(false);
    expect(e.state).toBe('idle');
  });

  it('sayaç, iptal ve bitiş', () => {
    const c = fakeClock();
    const states: string[] = [];
    const counts: number[] = [];
    const e = new ScrollEngine(c.clock, { onState: (s) => states.push(s), onCountdown: (n) => counts.push(n) });
    e.setMaxOffset(50);
    e.setSpeed(100);
    e.play(3);
    c.run(1500, 16);
    e.pause(); // sayaç iptal
    expect(e.offset).toBe(0);
    e.play(3);
    c.run(3016, 16);
    expect(counts).toContain(3);
    expect(counts).toContain(0);
    c.run(1000, 16);
    expect(e.offset).toBe(50);
    expect(e.state).toBe('finished');
    expect(states).toEqual(['countdown', 'paused', 'countdown', 'playing', 'finished']);
  });

  it('döngü modunda başa döner', () => {
    const c = fakeClock();
    const e = new ScrollEngine(c.clock);
    e.loop = true;
    e.setMaxOffset(50);
    e.setSpeed(100);
    e.play(0);
    c.run(16, 16);
    c.run(700, 10);
    expect(e.state).toBe('playing');
    expect(e.offset).toBeLessThan(50);
  });

  it('gerçek geçmişle 5 sn geri sarar; geçmiş yoksa false', () => {
    const c = fakeClock();
    const e = new ScrollEngine(c.clock);
    e.setMaxOffset(100000);
    e.setSpeed(100);
    expect(e.rewindActiveMs(5000)).toBe(false);
    e.play(0);
    c.run(16, 16);
    c.run(8000, 16);
    expect(e.rewindActiveMs(5000)).toBe(true);
    expect(e.offset).toBeGreaterThan(280);
    expect(e.offset).toBeLessThan(320);
  });
});

describe('elle sürükleme (hold)', () => {
  it('sürüklerken akış ilerlemez, durum playing kalır, bırakınca sıçramadan devam eder', () => {
    const c = fakeClock();
    const e = new ScrollEngine(c.clock);
    e.setMaxOffset(100000);
    e.setSpeed(100);
    e.play(0);
    c.run(16, 16);
    c.run(1000, 16);
    e.setHeld(true);
    e.nudge(500);
    const o = e.offset;
    c.run(2000, 16);
    expect(e.offset).toBe(o);
    expect(e.state).toBe('playing');
    e.setHeld(false);
    c.run(16, 16);
    expect(e.offset - o).toBeLessThan(2);
    c.run(1000, 16);
    expect(e.offset - o).toBeGreaterThan(95);
  });
});
