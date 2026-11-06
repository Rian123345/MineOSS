import { createStore, useStore } from './store';
import { setLang as setCoreLang, tr, getLang, type Lang } from '../../shared/i18n';

export { tr, getLang };
export type { Lang };

function detect(): Lang {
  try { return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en'; } catch { return 'de'; }
}

/** Gewählte Sprache (wird im Browser gespeichert) */
export const langStore = createStore<{ lang: Lang }>({ lang: detect() }, 'mineos.lang');
setCoreLang(langStore.get().lang);
document.documentElement.lang = langStore.get().lang;

export function setLang(lang: Lang) {
  if (lang === langStore.get().lang) return;
  setCoreLang(lang);
  document.documentElement.lang = lang;
  langStore.set({ lang });
}

export function toggleLang() { setLang(langStore.get().lang === 'de' ? 'en' : 'de'); }

/** Aktuelle Sprache; Komponenten, die das aufrufen, werden beim Umschalten neu gezeichnet */
export function useLang(): Lang { return useStore(langStore).lang; }

/** Gebietsschema für Datums- und Zahlenformate */
export function locale(): string { return getLang() === 'en' ? 'en-US' : 'de-DE'; }
