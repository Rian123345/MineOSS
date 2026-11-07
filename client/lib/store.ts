import { useSyncExternalStore } from 'react';

/** Minimaler globaler Zustand mit optionaler Speicherung in localStorage. */
export function createStore<T>(initial: T, persistKey?: string) {
  let state = initial;
  if (persistKey) {
    try {
      const raw = localStorage.getItem(persistKey);
      if (raw) state = { ...initial, ...JSON.parse(raw) };
    } catch { /* Speicher nicht verfügbar */ }
  }
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: T | ((s: T) => T)) {
      state = typeof next === 'function' ? (next as (s: T) => T)(state) : next;
      if (persistKey) {
        try { localStorage.setItem(persistKey, JSON.stringify(state)); } catch { /* voll / privat */ }
      }
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}

export function useStore<T>(store: { get: () => T; subscribe: (l: () => void) => () => void }): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/* ── Systemeinstellungen (Personalisierung) ── */
export interface Settings {
  wallpaper: string;
  glassColor: string; // "r, g, b"
  glassAlpha: number;
  transparency: boolean;
  iconSize: 'small' | 'medium' | 'large';
  clock24: boolean;
  showSeconds: boolean;
  volume: number;
  sounds: boolean;
  /** Dunkelmodus */
  dark: boolean;
  /** Optik: Windows-7-Stil (Aero) oder Windows-XP-Stil (Luna) */
  skin: 'win7' | 'xp';
  /** Hintergrund im XP-Theme */
  xpWallpaper: 'bliss' | 'senorpollo';
}
export const settingsStore = createStore<Settings>({
  wallpaper: 'aero',
  glassColor: '116, 184, 252',
  glassAlpha: 0.42,
  transparency: true,
  iconSize: 'medium',
  clock24: true,
  showSeconds: false,
  volume: 60,
  sounds: true,
  dark: false,
  skin: 'win7',
  xpWallpaper: 'bliss',
}, 'mineos.settings');

export function setDark(dark: boolean) { settingsStore.set((s) => ({ ...s, dark })); }

/** Theme wechseln (XP startet mit dem Bliss-Hintergrund) */
export function setSkin(skin: 'win7' | 'xp') { settingsStore.set((s) => ({ ...s, skin, xpWallpaper: skin === 'xp' && s.skin !== 'xp' ? 'bliss' : s.xpWallpaper })); }

/* ── Warenkorb ── */
export interface CartState { lines: { productId: number; quantity: number }[] }
export const cartStore = createStore<CartState>({ lines: [] }, 'mineos.cart');

export const cart = {
  add(productId: number, quantity: number) {
    cartStore.set((s) => {
      const existing = s.lines.find((l) => l.productId === productId);
      if (existing) return { lines: s.lines.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + quantity } : l)) };
      return { lines: [...s.lines, { productId, quantity }] };
    });
  },
  setQty(productId: number, quantity: number) {
    cartStore.set((s) => ({ lines: s.lines.map((l) => (l.productId === productId ? { ...l, quantity } : l)) }));
  },
  remove(productId: number) {
    cartStore.set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) }));
  },
  clear() { cartStore.set({ lines: [] }); },
};

/* ── Eigene Bestellungen (für bequeme Verfolgung auf diesem Gerät) ── */
export interface MyOrder { orderNumber: string; accessCode: string; createdAt: string; totalCents: number }
export const myOrdersStore = createStore<{ orders: MyOrder[] }>({ orders: [] }, 'mineos.myorders');
