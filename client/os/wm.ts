import { createStore } from '../lib/store';

export type AppId = 'store' | 'chat' | 'admin' | 'computer' | 'controlpanel' | 'useraccounts' | 'msgbox' | 'about';

export interface Rect { x: number; y: number; w: number; h: number }

export interface WinState extends Rect {
  id: string;
  app: AppId;
  title: string;
  z: number;
  minimized: boolean;
  maximized: boolean;
  snapped: 'left' | 'right' | null;
  restoreRect: Rect | null;
  phase: 'opening' | 'open' | 'closing' | 'minimizing' | 'restoring';
  anim: 'geometry' | null;
  props: Record<string, any>;
  nonce: number;
  parentId?: string;
  resizable: boolean;
  minimizable: boolean;
  maximizable: boolean;
  minW: number;
  minH: number;
  flash: number;
}

interface WMState {
  windows: WinState[];
  activeId: string | null;
  zTop: number;
}

export const wmStore = createStore<WMState>({ windows: [], activeId: null, zTop: 10 });

let seq = 0;
const TASKBAR_H = () => (window.innerWidth <= 760 ? 44 : 40);
export const isMobile = () => window.innerWidth <= 760;

export interface OpenOptions {
  title: string;
  w: number;
  h: number;
  singleInstance?: boolean;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  minW?: number;
  minH?: number;
  parentId?: string;
  center?: boolean;
  maximized?: boolean;
}

function desktopSize() {
  return { W: window.innerWidth, H: window.innerHeight - TASKBAR_H() };
}

function update(id: string, patch: Partial<WinState> | ((w: WinState) => Partial<WinState>)) {
  wmStore.set((s) => ({
    ...s,
    windows: s.windows.map((w) => (w.id === id ? { ...w, ...(typeof patch === 'function' ? patch(w) : patch) } : w)),
  }));
}

function topVisible(exclude?: string): string | null {
  const vis = wmStore.get().windows.filter((w) => !w.minimized && w.phase !== 'closing' && w.phase !== 'minimizing' && w.id !== exclude);
  if (!vis.length) return null;
  return vis.reduce((a, b) => (a.z > b.z ? a : b)).id;
}

export const wm = {
  get: (id: string) => wmStore.get().windows.find((w) => w.id === id),

  open(app: AppId, opts: OpenOptions, props: Record<string, any> = {}): string {
    const s = wmStore.get();
    if (opts.singleInstance !== false && app !== 'msgbox') {
      const existing = s.windows.find((w) => w.app === app && w.phase !== 'closing');
      if (existing) {
        update(existing.id, (w) => ({ props: { ...w.props, ...props }, nonce: w.nonce + 1 }));
        if (existing.minimized) wm.restore(existing.id); else wm.focus(existing.id);
        return existing.id;
      }
    }
    const { W, H } = desktopSize();
    const w = Math.min(opts.w, W - 10);
    const h = Math.min(opts.h, H - 10);
    const count = s.windows.filter((x) => x.app !== 'msgbox').length;
    let x: number, y: number;
    const parent = opts.parentId ? wm.get(opts.parentId) : undefined;
    if (parent && !parent.maximized) {
      x = parent.x + (parent.w - w) / 2; y = parent.y + Math.max(30, (parent.h - h) / 3);
    } else if (opts.center || parent) {
      x = (W - w) / 2; y = Math.max(10, (H - h) / 3);
    } else {
      x = Math.min(60 + count * 28, W - w - 10); y = Math.min(30 + count * 26, H - h - 10);
    }
    x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
    const id = `w${++seq}`;
    const z = s.zTop + 1;
    const maximize = (opts.maximized || (isMobile() && opts.maximizable !== false && app !== 'msgbox'));
    const win: WinState = {
      id, app, title: opts.title, x, y, w, h, z,
      minimized: false, maximized: !!maximize, snapped: null, restoreRect: maximize ? { x, y, w, h } : null,
      phase: 'opening', anim: null, props, nonce: 0, parentId: opts.parentId,
      resizable: opts.resizable !== false, minimizable: opts.minimizable !== false, maximizable: opts.maximizable !== false,
      minW: opts.minW ?? 300, minH: opts.minH ?? 180, flash: 0,
    };
    wmStore.set({ windows: [...s.windows, win], activeId: id, zTop: z });
    setTimeout(() => update(id, (w) => (w.phase === 'opening' ? { phase: 'open' } : {})), 260);
    return id;
  },

  close(id: string) {
    const w = wm.get(id);
    if (!w || w.phase === 'closing') return;
    // Kindfenster (Dialoge) mit schließen
    wmStore.get().windows.filter((c) => c.parentId === id).forEach((c) => wm.close(c.id));
    update(id, { phase: 'closing' });
    const next = topVisible(id);
    wmStore.set((s) => ({ ...s, activeId: s.activeId === id ? next : s.activeId }));
    setTimeout(() => {
      wmStore.set((s) => ({ ...s, windows: s.windows.filter((x) => x.id !== id) }));
    }, 200);
  },

  focus(id: string) {
    const w = wm.get(id);
    if (!w) return;
    // Modale Dialoge haben Vorrang
    const child = wmStore.get().windows.find((c) => c.parentId === id && c.phase !== 'closing');
    if (child) { wm.focus(child.id); update(child.id, (c) => ({ flash: c.flash + 1 })); return; }
    const s = wmStore.get();
    if (s.activeId === id && w.z === s.zTop) return;
    const z = s.zTop + 1;
    wmStore.set({ ...s, zTop: z, activeId: id, windows: s.windows.map((x) => (x.id === id ? { ...x, z } : x)) });
  },

  deactivateAll() {
    wmStore.set((s) => ({ ...s, activeId: null }));
  },

  minimize(id: string) {
    const w = wm.get(id);
    if (!w || w.minimized || !w.minimizable || w.phase === 'minimizing') return;
    const btn = document.querySelector(`[data-taskbtn="${w.app}"]`) as HTMLElement | null;
    const el = document.querySelector(`[data-win="${id}"]`) as HTMLElement | null;
    update(id, { phase: 'minimizing' });
    wmStore.set((s) => ({ ...s, activeId: topVisible(id) }));
    const finish = () => update(id, (x) => (x.phase === 'minimizing' ? { minimized: true, phase: 'open' } : {}));
    if (!btn || !el || !el.animate) { finish(); return; }
    const b = btn.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (r.left + r.width / 2);
    const dy = b.top + b.height / 2 - (r.top + r.height / 2);
    // Windows-7-typisch: Fenster schrumpft und gleitet in seine Taskleisten-Schaltfläche
    const anim = el.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(0.45)`, opacity: 0.75, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.08)`, opacity: 0 },
    ], { duration: 320, easing: 'cubic-bezier(.4, 0, .65, 1)', fill: 'forwards' });
    anim.onfinish = () => { finish(); requestAnimationFrame(() => anim.cancel()); };
  },

  restore(id: string) {
    const w = wm.get(id);
    if (!w) return;
    update(id, { minimized: false, phase: 'restoring' });
    wm.focus(id);
    setTimeout(() => update(id, (x) => (x.phase === 'restoring' ? { phase: 'open' } : {})), 280);
  },

  toggleMinimize(id: string) {
    const w = wm.get(id);
    if (!w) return;
    const active = wmStore.get().activeId === id;
    if (w.minimized) wm.restore(id);
    else if (active) wm.minimize(id);
    else wm.focus(id);
  },

  toggleMax(id: string) {
    const w = wm.get(id);
    if (!w || !w.maximizable) return;
    const { W, H } = desktopSize();
    if (w.maximized || w.snapped) {
      const r = w.restoreRect || { x: 60, y: 40, w: Math.min(900, W - 40), h: Math.min(600, H - 40) };
      update(id, { maximized: false, snapped: null, ...r, anim: 'geometry' });
    } else {
      update(id, { maximized: true, restoreRect: { x: w.x, y: w.y, w: w.w, h: w.h }, anim: 'geometry' });
    }
    setTimeout(() => update(id, { anim: null }), 220);
  },

  snap(id: string, side: 'left' | 'right' | 'max') {
    const w = wm.get(id);
    if (!w) return;
    const { W, H } = desktopSize();
    const restoreRect = w.maximized || w.snapped ? w.restoreRect : { x: w.x, y: w.y, w: w.w, h: w.h };
    if (side === 'max') { update(id, { maximized: true, snapped: null, restoreRect, anim: 'geometry' }); }
    else {
      update(id, {
        maximized: false, snapped: side, restoreRect, anim: 'geometry',
        x: side === 'left' ? 0 : Math.floor(W / 2), y: 0, w: Math.ceil(W / 2), h: H,
      });
    }
    setTimeout(() => update(id, { anim: null }), 220);
  },

  setRect(id: string, r: Partial<Rect> & { snapped?: null; maximized?: boolean }) { update(id, r); },
  setTitle(id: string, title: string) { const w = wm.get(id); if (w && w.title !== title) update(id, { title }); },
  setProps(id: string, props: Record<string, any>) { update(id, (w) => ({ props: { ...w.props, ...props } })); },

  minimizeAll() {
    const wins = wmStore.get().windows.filter((w) => !w.minimized && w.minimizable);
    if (!wins.length) {
      // Zweiter Klick: alles wiederherstellen
      const restore = (wm as any)._lastShown as string[] | undefined;
      restore?.forEach((id) => wm.restore(id));
      (wm as any)._lastShown = undefined;
      return;
    }
    (wm as any)._lastShown = wins.map((w) => w.id);
    wins.forEach((w) => wm.minimize(w.id));
  },

  closeAll() {
    wmStore.get().windows.forEach((w) => wm.close(w.id));
  },

  /** Hält Fenster nach Größenänderung des Browserfensters im sichtbaren Bereich */
  clampAll() {
    const { W, H } = desktopSize();
    wmStore.set((s) => ({
      ...s,
      windows: s.windows.map((w) => {
        if (isMobile() && !w.maximized && w.maximizable && w.app !== 'msgbox') {
          return { ...w, maximized: true, restoreRect: { x: w.x, y: w.y, w: w.w, h: w.h } };
        }
        const nw = Math.min(w.w, W);
        const nh = Math.min(w.h, H);
        return { ...w, w: nw, h: nh, x: Math.max(Math.min(w.x, W - 80), -nw + 80), y: Math.max(0, Math.min(w.y, H - 30)) };
      }),
    }));
  },
};

/* ─────────── Meldungsfenster (MessageBox) ─────────── */

export interface MsgBoxOptions {
  title: string;
  text: string;
  heading?: string;
  icon?: 'info' | 'warning' | 'error' | 'question' | 'success';
  buttons?: string[];
  defaultButton?: number;
  parentId?: string;
}

export function msgbox(o: MsgBoxOptions): Promise<string> {
  return new Promise((resolve) => {
    wm.open('msgbox', {
      title: o.title, w: 440, h: 200, singleInstance: false, resizable: false, minimizable: false, maximizable: false,
      parentId: o.parentId, center: true, minW: 300, minH: 120,
    }, { ...o, resolve });
  });
}
