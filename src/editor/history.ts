import type { Block } from '../model/types';

export interface Snapshot {
  title: string;
  blocks: Block[];
}

/** Basit geri al / ileri al yığını. Yazarken arka arkaya gelen değişiklikler birleştirilir. */
export class EditHistory {
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private lastPushAt = 0;
  constructor(
    private limit = 200,
    private coalesceMs = 800,
  ) {}

  /** Değişiklikten ÖNCEKİ durumu kaydeder. */
  record(before: Snapshot, coalesce: boolean, now = Date.now()): void {
    if (coalesce && now - this.lastPushAt < this.coalesceMs && this.past.length > 0) {
      this.lastPushAt = now;
      this.future = [];
      return;
    }
    this.past.push(structuredClone(before));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.lastPushAt = now;
  }

  undo(current: Snapshot): Snapshot | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(structuredClone(current));
    this.lastPushAt = 0;
    return prev;
  }

  redo(current: Snapshot): Snapshot | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(structuredClone(current));
    this.lastPushAt = 0;
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
}
