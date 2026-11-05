/**
 * Güvenli satır içi biçim: **kalın** ve ==vurgu==.
 * Çıktı düz metin parçalarıdır; React bunları metin düğümü olarak basar, HTML yorumlanmaz.
 */
export interface InlineRun {
  text: string;
  bold: boolean;
  accent: boolean;
}

export function parseInline(src: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let bold = false;
  let accent = false;
  let buf = '';
  const push = () => {
    if (buf) runs.push({ text: buf, bold, accent });
    buf = '';
  };
  // Eşleşmeyen işaretleri düz metin olarak bırakmak için önce hangi işaretlerin kapandığını say.
  const boldCount = (src.match(/\*\*/g) ?? []).length;
  const accentCount = (src.match(/==/g) ?? []).length;
  let boldLeft = boldCount - (boldCount % 2);
  let accentLeft = accentCount - (accentCount % 2);
  for (let i = 0; i < src.length; i++) {
    const two = src.slice(i, i + 2);
    if (two === '**' && boldLeft > 0) {
      push();
      bold = !bold;
      boldLeft--;
      i++;
      continue;
    }
    if (two === '==' && accentLeft > 0) {
      push();
      accent = !accent;
      accentLeft--;
      i++;
      continue;
    }
    buf += src[i];
  }
  push();
  return runs;
}

export function stripInline(src: string): string {
  return parseInline(src)
    .map((r) => r.text)
    .join('');
}
