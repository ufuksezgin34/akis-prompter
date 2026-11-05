import { memo, type ReactNode } from 'react';
import type { Block } from '../model/types';
import { parseInline, type InlineRun } from '../model/inline';
import { splitSentences } from '../model/text';

/** Satır içi biçimli parçaları cümle sınırlarına göre keser. HTML üretmez; yalnızca React metin düğümleri. */
export function sentenceRuns(text: string): InlineRun[][] {
  const runs = parseInline(text);
  const plain = runs.map((r) => r.text).join('');
  const sentences = splitSentences(plain);
  const out: InlineRun[][] = [];
  let ri = 0;
  let rOff = 0;
  for (const s of sentences) {
    let need = s.length;
    const parts: InlineRun[] = [];
    while (need > 0 && ri < runs.length) {
      const r = runs[ri]!;
      const take = Math.min(need, r.text.length - rOff);
      parts.push({ ...r, text: r.text.slice(rOff, rOff + take) });
      need -= take;
      rOff += take;
      if (rOff >= r.text.length) {
        ri++;
        rOff = 0;
      }
    }
    out.push(parts);
  }
  return out;
}

function renderRuns(runs: InlineRun[]): ReactNode[] {
  return runs.map((r, i) => {
    let node: ReactNode = r.text;
    if (r.accent) node = <mark className="r-accent">{node}</mark>;
    if (r.bold) node = <strong>{node}</strong>;
    return <span key={i}>{node}</span>;
  });
}

export const ReaderText = memo(function ReaderText({ blocks, showNotes }: { blocks: Block[]; showNotes: boolean }) {
  return (
    <>
      {blocks.map((b) => {
        if (b.type === 'note') {
          if (!showNotes) return null;
          return (
            <div key={b.id} data-block-id={b.id} data-kind="note" className="r-note" aria-label="Yönetmen notu">
              <span aria-hidden="true">✎ </span>
              {renderRuns(parseInline(b.text))}
            </div>
          );
        }
        if (b.type === 'heading') {
          return (
            <h2 key={b.id} data-block-id={b.id} data-kind="heading" className="r-heading">
              {renderRuns(parseInline(b.text))}
            </h2>
          );
        }
        if (!b.text.trim()) return null;
        return (
          <p key={b.id} data-block-id={b.id} data-kind="speech" className="r-speech">
            {sentenceRuns(b.text).map((runs, i) => (
              <span key={i} data-s="">
                {renderRuns(runs)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
});
