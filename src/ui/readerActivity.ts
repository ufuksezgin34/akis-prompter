/**
 * Okuma ekranının açık/oynuyor olup olmadığı. Service worker güncellemesi bu durumda
 * gösterilmez ve asla kendiliğinden sayfa yenilenmez.
 */
type Activity = false | true | 'busy';
let activity: Activity = false;
const listeners = new Set<(a: Activity) => void>();

export function setReaderActive(a: Activity): void {
  activity = a;
  listeners.forEach((l) => l(a));
}
export function getReaderActivity(): Activity {
  return activity;
}
export function onReaderActivity(fn: (a: Activity) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
