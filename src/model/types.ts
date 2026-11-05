/**
 * Teleprompter veri modeli.
 * Metin, güvenli ve taşınabilir bir blok listesi olarak saklanır; ham HTML asla tutulmaz.
 * Satır içi biçim: **kalın** ve ==vurgu== işaretleri (bkz. inline.ts).
 */

export type BlockType = 'heading' | 'speech' | 'note';

export interface Block {
  id: string;
  type: BlockType;
  text: string;
}

export interface ScriptVersion {
  at: number;
  reason: string;
  title: string;
  blocks: Block[];
}

export interface Script {
  id: string;
  title: string;
  blocks: Block[];
  tags: string[];
  folder: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  /** Her başarılı kayıtta 1 artar; çoklu sekme çakışması için. */
  revision: number;
  deletedAt: number | null;
  /** Son okunan konum: blok kimliği + blok içi oran. */
  lastPosition: ReadingAnchor | null;
  versions: ScriptVersion[];
}

export interface ReadingAnchor {
  blockId: string;
  fraction: number;
  /** Blok içindeki cümle sırası ve cümle içi oran: yeniden sarılan paragraflarda daha kesin konum. */
  sentence?: number;
  sentenceFraction?: number;
}

export type Align = 'left' | 'center' | 'right' | 'justify';
export type CountdownSeconds = 0 | 3 | 5 | 10;
export type CameraPosition = 'top' | 'left' | 'right' | 'bottom' | 'none';

export interface ReaderSettings {
  fontSize: number; // px 18–160
  fontWeight: number; // 300–900
  lineHeight: number; // 1.1–2.5
  paragraphGap: number; // em 0–3
  align: Align;
  textColor: string;
  bgColor: string;
  accentColor: string;
  columnWidth: number; // yüzde 20–100
  paddingX: number; // px
  paddingY: number; // px (kontrol çubuğu dışında ek boşluk)
  narrowColumn: boolean;
  cameraPosition: CameraPosition;
  mirrorX: boolean;
  flipY: boolean;
  readingLine: number; // ekran yüksekliğinin yüzdesi 10–90
  showReadingMarker: boolean;
  focusBand: boolean;
  focusBandHeight: number; // satır sayısı 1–6
  dimOutside: number; // 0–0.9
  speed: number; // px/s (iç değer; kelime/dk'dan ekrandaki gerçek düzene göre hesaplanır)
  /** Kullanıcının seçtiği hız (kelime/dk). Okuma ekranı bunu metnin ölçülmüş kelime yoğunluğuyla px/s'ye çevirir. */
  wpm: number;
  readerTheme: 'navy' | 'black' | 'paper';
  /** Prompter camı: tam siyah zemin, beyaz yazı, renkli bant yok (camda parlamasın). */
  glassMode: boolean;
  countdown: CountdownSeconds;
  loop: boolean;
  showElapsed: boolean;
  showRemaining: boolean;
  showProgress: boolean;
  showStatus: boolean;
  showNotes: boolean;
  pauseOnHidden: boolean;
  /** Kişisel ölçülmüş okuma hızı (kelime/dk); null ise varsayılan tahmin kullanılır. */
  measuredWpm: number | null;
}

export interface Profile {
  id: string;
  name: string;
  settings: ReaderSettings;
  builtin: boolean;
  updatedAt: number;
}

export type ActionId =
  | 'togglePlay'
  | 'speedUp'
  | 'speedDown'
  | 'prevSentence'
  | 'nextSentence'
  | 'toStart'
  | 'fullscreen'
  | 'mirror'
  | 'exit'
  | 'retake'
  | 'prevSection'
  | 'nextSection';

export type KeyMap = Record<ActionId, string[]>;

export interface AppSettings {
  activeProfileId: string;
  /** Ayarlar ekranında görünen isteğe bağlı çalışma alanı adı (yalnızca bu cihazda). */
  workspaceName: string;
  keepAwake: boolean;
  keymap: KeyMap;
  editorTheme: 'system' | 'light' | 'dark';
  onboardingDone: boolean;
  persistRequested: boolean;
}
