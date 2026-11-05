import { useState } from 'react';
import { useStore } from './store';

const STEPS = [
  { title: '1. Metni ekle', body: '“+ Yeni metin” ile yazın, uzun metni yapıştırın veya TXT/Markdown dosyası içe aktarın. Bölüm başlıkları ve okunmayacak yönetmen notları ayrı blok türleridir.' },
  { title: '2. Ayarla', body: 'Okuma ekranında ⚙ ile yazı boyutu, hız (px/s), okuma çizgisi ve ayna ayarlanır. Ayarlar seçili profile kaydedilir: Reels, YouTube, Aynalı Prompter…' },
  { title: '3. Oku', body: 'Boşluk oynatır/duraklatır, ↑↓ hızı, ←→ cümleyi değiştirir, R “tekrar al” yapar. Kamera veya mikrofon izni gerekmez. Metinler yalnızca bu cihazda saklanır; düzenli yedek alın.' },
];

export function Onboarding() {
  const { updateApp } = useStore();
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const done = () => void updateApp({ onboardingDone: true });
  return (
    <div className="onboarding" role="dialog" aria-modal="false" aria-labelledby="ob-title">
      <h2 id="ob-title">{step.title}</h2>
      <p>{step.body}</p>
      <div className="row">
        <button className="btn ghost" onClick={done}>Atla</button>
        <span className="muted small" aria-label={`Adım ${i + 1} / ${STEPS.length}`}>{i + 1}/{STEPS.length}</span>
        {i < STEPS.length - 1 ? (
          <button className="btn primary" onClick={() => setI(i + 1)}>İleri</button>
        ) : (
          <button className="btn primary" onClick={done}>Başla</button>
        )}
      </div>
    </div>
  );
}
