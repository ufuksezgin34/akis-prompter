import type { Align, CameraPosition, CountdownSeconds, ReaderSettings } from '../model/types';
import { BASE_SETTINGS, SETTING_LIMITS } from '../profiles/defaults';

type Num = keyof typeof SETTING_LIMITS;

function Slider({ k, label, s, set, step = 1, unit = '' }: { k: Num; label: string; s: ReaderSettings; set: (p: Partial<ReaderSettings>) => void; step?: number; unit?: string }) {
  const [min, max] = SETTING_LIMITS[k];
  const v = s[k] as number;
  const id = `set-${k}`;
  return (
    <div className="slider">
      <label htmlFor={id}>
        {label} <output>{Number.isInteger(step) ? Math.round(v) : v.toFixed(2)}{unit}</output>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={v} onChange={(e) => set({ [k]: Number(e.target.value) } as Partial<ReaderSettings>)} />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

export function ReaderSettingsPanel({ s, set, compact }: { s: ReaderSettings; set: (p: Partial<ReaderSettings>) => void; compact?: boolean }) {
  return (
    <div className={`settings-panel${compact ? ' compact' : ''}`}>
      <fieldset>
        <legend>Yazı</legend>
        <Slider k="fontSize" label="Yazı boyutu" s={s} set={set} unit=" px" />
        <Slider k="fontWeight" label="Kalınlık" s={s} set={set} step={100} />
        <Slider k="lineHeight" label="Satır aralığı" s={s} set={set} step={0.05} />
        <Slider k="paragraphGap" label="Paragraf aralığı" s={s} set={set} step={0.1} unit=" em" />
        <label className="field-inline">
          Hizalama
          <select value={s.align} onChange={(e) => set({ align: e.target.value as Align })}>
            <option value="left">Sola</option>
            <option value="center">Ortaya</option>
            <option value="right">Sağa</option>
            <option value="justify">İki yana</option>
          </select>
        </label>
        <div className="colors">
          <label>
            Yazı <input type="color" value={s.textColor} onChange={(e) => set({ textColor: e.target.value })} />
          </label>
          <label>
            Arka plan <input type="color" value={s.bgColor} onChange={(e) => set({ bgColor: e.target.value })} />
          </label>
          <label>
            Vurgu <input type="color" value={s.accentColor} onChange={(e) => set({ accentColor: e.target.value })} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Yerleşim</legend>
        <Slider k="columnWidth" label="Sütun genişliği" s={s} set={set} unit=" %" />
        <Slider k="paddingX" label="Yan boşluk" s={s} set={set} unit=" px" />
        <Slider k="paddingY" label="Alt boşluk (kontroller için)" s={s} set={set} unit=" px" />
        <Toggle label="Kameraya yakın dar sütun" checked={s.narrowColumn} onChange={(v) => set({ narrowColumn: v })} />
        <label className="field-inline">
          Kamera nerede?
          <select value={s.cameraPosition} onChange={(e) => set({ cameraPosition: e.target.value as CameraPosition })}>
            <option value="none">Belirtme</option>
            <option value="top">Üstte</option>
            <option value="left">Solda</option>
            <option value="right">Sağda</option>
            <option value="bottom">Altta</option>
          </select>
        </label>
        <p className="muted small">Kameranın yerini uygulama bilemez; seçiminize göre sütun o tarafa yaslanır ve kenarda küçük bir işaret gösterilir.</p>
      </fieldset>

      <fieldset>
        <legend>Ayna</legend>
        <Toggle label="Yatay ayna (prompter camı)" checked={s.mirrorX} onChange={(v) => set({ mirrorX: v })} />
        <Toggle label="Dikey ters çevir" checked={s.flipY} onChange={(v) => set({ flipY: v })} />
      </fieldset>

      <fieldset>
        <legend>Okuma çizgisi</legend>
        <Slider k="readingLine" label="Çizgi konumu (üstten)" s={s} set={set} unit=" %" />
        <Toggle label="Okuma oku/çizgisi" checked={s.showReadingMarker} onChange={(v) => set({ showReadingMarker: v })} />
        <Toggle label="Odak bandı" checked={s.focusBand} onChange={(v) => set({ focusBand: v })} />
        <Slider k="focusBandHeight" label="Bant yüksekliği (satır)" s={s} set={set} />
        <Slider k="dimOutside" label="Bant dışını karart" s={s} set={set} step={0.05} />
      </fieldset>

      <fieldset>
        <legend>Akış</legend>
        <Slider k="speed" label="Hız" s={s} set={set} unit=" px/s" />
        <label className="field-inline">
          Başlangıç sayacı
          <select value={s.countdown} onChange={(e) => set({ countdown: Number(e.target.value) as CountdownSeconds })}>
            <option value={0}>Kapalı</option>
            <option value={3}>3 sn</option>
            <option value={5}>5 sn</option>
            <option value={10}>10 sn</option>
          </select>
        </label>
        <Toggle label="Sonda başa dön (döngü)" checked={s.loop} onChange={(v) => set({ loop: v })} />
        <Toggle label="Sekme/uygulama arka plana geçince duraklat" checked={s.pauseOnHidden} onChange={(v) => set({ pauseOnHidden: v })} />
        <Toggle label="Yönetmen notlarını göster" checked={s.showNotes} onChange={(v) => set({ showNotes: v })} />
      </fieldset>

      <fieldset>
        <legend>Göstergeler</legend>
        <Toggle label="Geçen süre" checked={s.showElapsed} onChange={(v) => set({ showElapsed: v })} />
        <Toggle label="Yaklaşık kalan süre" checked={s.showRemaining} onChange={(v) => set({ showRemaining: v })} />
        <Toggle label="İlerleme çubuğu" checked={s.showProgress} onChange={(v) => set({ showProgress: v })} />
        <Toggle label="Durum" checked={s.showStatus} onChange={(v) => set({ showStatus: v })} />
      </fieldset>

      <button type="button" className="btn" onClick={() => set({ ...BASE_SETTINGS, measuredWpm: s.measuredWpm })}>
        Görünümü varsayılana döndür
      </button>
    </div>
  );
}
