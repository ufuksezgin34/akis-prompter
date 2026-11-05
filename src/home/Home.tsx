import { useEffect, useState } from 'react';
import type { Script } from '../model/types';
import { createScript, listScripts, saveScript } from '../storage/repo';
import { DEFAULT_WPM, estimateSeconds, formatDuration, newId, speechWordCount } from '../model/text';
import { navigate, useStore } from '../ui/store';
import { Icon } from '../ui/Icon';
import { Brand } from '../ui/kit';
import { reelsSample } from '../library/samples';

function relDay(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'bugün';
  if (d.toDateString() === y.toDateString()) return 'dün';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

export async function createBlankScript(): Promise<string | null> {
  const r = await saveScript(createScript('Yeni metin', [{ id: newId(), type: 'speech', text: '' }]));
  return r.ok ? r.script.id : null;
}

export function Home() {
  const { app, activeProfile } = useStore();
  const [recent, setRecent] = useState<Script | null | undefined>(undefined);
  const wpm = activeProfile.settings.wpm ?? DEFAULT_WPM;

  useEffect(() => {
    void listScripts()
      .then((all) => {
        const live = all.filter((s) => !s.deletedAt && speechWordCount(s.blocks) > 0);
        live.sort((a, b) => b.updatedAt - a.updatedAt);
        setRecent(live[0] ?? null);
      })
      .catch(() => setRecent(null));
  }, []);

  const quickRehearsal = async () => {
    if (recent) return navigate({ name: 'read', id: recent.id });
    const sample = reelsSample();
    const r = await saveScript({ ...createScript(sample.title, sample.blocks), tags: sample.tags });
    if (r.ok) navigate({ name: 'read', id: r.script.id });
  };

  const initial = app.workspaceName.trim().charAt(0).toLocaleUpperCase('tr');

  return (
    <main className="page home">
      <div className="home-top">
        <Brand />
        <button className="avatar" onClick={() => navigate({ name: 'settings' })} aria-label="Ayarlar">
          {initial || <Icon name="profile" size={22} />}
        </button>
      </div>

      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Hazır olduğunda, başla.</h1>
        <p>Sesin, hikâyen, ritmin.</p>
        <svg className="hero-wave" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="wg" x1="0" x2="1">
              <stop offset="0" stopColor="#ff7a35" stopOpacity="0" />
              <stop offset="0.45" stopColor="#ff7a35" stopOpacity="0.9" />
              <stop offset="1" stopColor="#ff9a5c" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M0 ${150 + i * 4} C 90 ${90 + i * 6}, 150 ${200 - i * 3}, 230 ${120 + i * 5} S 360 ${40 + i * 8}, 400 ${70 + i * 6}`}
              fill="none"
              stroke="url(#wg)"
              strokeWidth={1.2 + (i % 2)}
              opacity={1 - i * 0.12}
            />
          ))}
        </svg>
        <span className="hero-quote" aria-hidden="true">“</span>
      </section>

      <button
        className="btn primary big block"
        onClick={async () => {
          const id = await createBlankScript();
          if (id) navigate({ name: 'edit', id });
        }}
      >
        <Icon name="plus" size={24} /> Yeni metin
      </button>

      {recent && (
        <section className="home-section">
          <h2 className="section-title">Kaldığın yerden</h2>
          <div className="resume-card">
            <button className="resume-main" onClick={() => navigate({ name: 'edit', id: recent.id })}>
              <span className="resume-icon"><Icon name="file" size={30} /></span>
              <span className="resume-text">
                <strong>{recent.title}</strong>
                <span>Son düzenleme {relDay(recent.updatedAt)}</span>
                <span className="resume-time"><Icon name="clock" size={18} /> {formatDuration(estimateSeconds(speechWordCount(recent.blocks), wpm))}</span>
              </span>
            </button>
            <button className="play-fab" onClick={() => navigate({ name: 'read', id: recent.id })} aria-label={`${recent.title} metnini oku`}>
              <Icon name="play" size={26} />
            </button>
          </div>
        </section>
      )}

      <div className="tile-grid">
        <button className="tile" onClick={() => navigate({ name: 'import' })}>
          <Icon name="backup" size={34} />
          <span>Metin içe aktar</span>
        </button>
        <button className="tile" onClick={() => void quickRehearsal()}>
          <Icon name="quickPlay" size={34} />
          <span>Hızlı prova</span>
        </button>
      </div>
    </main>
  );
}
