import type { ActionId, KeyMap } from '../model/types';
import { remoteKeyLabel } from './remoteInput';

/** Yazı alanlarında kısayollar devre dışı. */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (t as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color'].includes(type);
  }
  return false;
}

export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLocaleLowerCase('tr') : key;
}

/** Kumanda/oyun kolu/medya tuşu adı için (yazı alanı denetimi gerekmez). */
export function actionForRemoteKey(map: KeyMap, key: string): ActionId | null {
  for (const [action, keys] of Object.entries(map) as [ActionId, string[]][]) {
    if (keys.includes(key)) return action;
  }
  return null;
}

export function actionForKey(map: KeyMap, e: Pick<KeyboardEvent, 'key' | 'target' | 'ctrlKey' | 'metaKey' | 'altKey'>): ActionId | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (isTypingTarget(e.target)) return null;
  const k = normalizeKey(e.key);
  for (const [action, keys] of Object.entries(map) as [ActionId, string[]][]) {
    if (keys.some((x) => normalizeKey(x) === k)) return action;
  }
  return null;
}

export function keyLabel(key: string): string {
  const names: Record<string, string> = {
    ' ': 'Boşluk',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Escape: 'Esc',
    PageUp: 'Page Up',
    PageDown: 'Page Down',
    Enter: 'Enter',
  };
  return names[key] ?? remoteKeyLabel(key) ?? (key.length === 1 ? key.toLocaleUpperCase('tr') : key);
}
