import { expect, it } from 'vitest';
import { actionForKey, actionForRemoteKey, keyLabel } from './keyboard';
import { DEFAULT_KEYMAP } from '../profiles/defaults';

it('medya ve ses tuşları varsayılan eylemlere bağlı', () => {
  expect(actionForRemoteKey(DEFAULT_KEYMAP, 'MediaPlayPause')).toBe('togglePlay');
  expect(actionForRemoteKey(DEFAULT_KEYMAP, 'VolumeUp')).toBe('speedUp');
  expect(actionForRemoteKey(DEFAULT_KEYMAP, 'MediaTrackNext')).toBe('nextSentence');
  expect(actionForRemoteKey(DEFAULT_KEYMAP, 'Gamepad:3')).toBeNull();
});

it('oyun kolu düğmesi atanınca çalışır ve okunur adla gösterilir', () => {
  const map = { ...DEFAULT_KEYMAP, retake: ['r', 'Gamepad:2'] };
  expect(actionForRemoteKey(map, 'Gamepad:2')).toBe('retake');
  expect(keyLabel('Gamepad:2')).toBe('Kol düğmesi 3');
  expect(keyLabel('VolumeDown')).toBe('Ses −');
});

it('yazı alanında klavye kısayolu tetiklenmez', () => {
  const ta = document.createElement('textarea');
  expect(actionForKey(DEFAULT_KEYMAP, { key: ' ', target: ta, ctrlKey: false, metaKey: false, altKey: false })).toBeNull();
  expect(actionForKey(DEFAULT_KEYMAP, { key: ' ', target: document.body, ctrlKey: false, metaKey: false, altKey: false })).toBe('togglePlay');
});
