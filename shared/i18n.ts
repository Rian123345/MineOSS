/**
 * Mini-Übersetzung für MineOS: Texte stehen direkt im Code als tr('Deutsch', 'English').
 * Der Server ruft setLang nie auf und bleibt daher immer auf Deutsch (z. B. für Discord).
 */
export type Lang = 'de' | 'en';
export const LANGS: Lang[] = ['de', 'en'];

let current: Lang = 'de';

export function setLang(l: Lang) { current = l; }
export function getLang(): Lang { return current; }

/** Gibt den Text in der aktuellen Sprache zurück */
export function tr(de: string, en: string): string {
  return current === 'en' ? en : de;
}
