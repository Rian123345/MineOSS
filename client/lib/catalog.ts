import { createStore } from './store';
import { useStore } from './store';
import { getLang, useLang } from './i18n';
import type { OrderItem } from '../../shared/types';
import { get } from './api';
import type { Catalog } from '../../shared/types';

export const catalogStore = createStore<{ data: Catalog | null; loading: boolean; error: string | null; loadedAt: number }>({
  data: null, loading: false, error: null, loadedAt: 0,
});

let inflight: Promise<void> | null = null;

export function loadCatalog(force = false): Promise<void> {
  const s = catalogStore.get();
  if (!force && s.data && Date.now() - s.loadedAt < 30_000) return Promise.resolve();
  if (inflight) return inflight;
  catalogStore.set((st) => ({ ...st, loading: true }));
  inflight = get<Catalog>('/api/catalog')
    .then((data) => catalogStore.set({ data, loading: false, error: null, loadedAt: Date.now() }))
    .catch((e) => catalogStore.set((st) => ({ ...st, loading: false, error: e.message })))
    .finally(() => { inflight = null; });
  return inflight;
}

/* ── Sprache: Produkt- und Kategorienamen auf Englisch anzeigen ── */

/** Mengen-Einheiten wie „1 Stack (64×)“ oder „1 Stück“ übersetzen */
export function unitText(u: string): string {
  if (getLang() === 'de') return u;
  return u.replace(/Shulker-Kisten?/g, 'shulker box').replace(/Stück/g, 'piece').replace(/Stacks?/g, (m) => (m.endsWith('s') ? 'stacks' : 'stack'))
    .replace(/Truhen?/g, 'chest').replace(/Doppeltruhen?/g, 'double chest');
}

let cache: { src: Catalog | null; out: Catalog | null } = { src: null, out: null };

/** Katalog in der eingestellten Sprache (englische Namen, falls vorhanden) */
export function localizedCatalog(c: Catalog | null): Catalog | null {
  if (!c || getLang() === 'de') return c;
  if (cache.src === c) return cache.out;
  const out: Catalog = {
    ...c,
    categories: c.categories.map((x) => ({ ...x, name: x.nameEn || x.name, description: x.descriptionEn || x.description })),
    products: c.products.map((p) => ({ ...p, name: p.nameEn || p.name, description: p.descriptionEn || p.description, unitLabel: unitText(p.unitLabel) })),
  };
  cache = { src: c, out };
  return out;
}

/** Wie useStore(catalogStore), aber mit übersetzten Namen */
export function useCatalog() {
  const s = useStore(catalogStore);
  const lang = useLang();
  if (lang === 'de') return s;
  return { ...s, data: localizedCatalog(s.data) };
}

/** Name einer bestellten Position (in Bestellungen ist der deutsche Name gespeichert) */
export function itemName(i: Pick<OrderItem, 'productId' | 'productName'>): string {
  if (getLang() === 'de' || i.productId == null) return i.productName;
  const p = catalogStore.get().data?.products.find((x) => x.id === i.productId);
  return p?.nameEn && p.name === i.productName ? p.nameEn : i.productName;
}

/** Name eines Produkts/einer Kategorie in der eingestellten Sprache */
export function pName(x: { name: string; nameEn?: string | null }): string {
  return getLang() === 'en' && x.nameEn ? x.nameEn : x.name;
}

/** Englischer Name zu einem (in Bestellungen gespeicherten) deutschen Produktnamen */
export function nameByGerman(name: string): string {
  if (getLang() === 'de') return name;
  return catalogStore.get().data?.products.find((x) => x.name === name)?.nameEn || name;
}
