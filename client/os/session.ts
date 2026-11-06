import { createStore } from '../lib/store';
import { get, post, setUnauthorizedHandler } from '../lib/api';
import type { AdminNotification, AuthStatus, Order, SessionUser } from '../../shared/types';
import { euro } from '../lib/format';
import { settingsStore } from '../lib/store';
import { CLIENT_BUILD } from '../lib/build';
import { tr } from '../lib/i18n';

/* ─────────── Anmeldung mit Minecraft-Name + Passwort ─────────── */

export interface SessionState {
  checked: boolean;
  user: SessionUser | null;
  isAdmin: boolean;
  noAdmin: boolean;
  setupAllowed: boolean;
  isLocal: boolean;
  /** Verbindungs-/Versionsproblem mit dem Server */
  error: string | null;
  unread: number;
  notifications: AdminNotification[];
  live: 'off' | 'connecting' | 'live';
}

export const sessionStore = createStore<SessionState>({
  checked: false, user: null, isAdmin: false, noAdmin: false, setupAllowed: false,
  isLocal: false, error: null, unread: 0, notifications: [], live: 'off',
});

type Listener = (event: string, data: any) => void;
const listeners = new Set<Listener>();
export function onAdminEvent(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }
const emit = (event: string, data: any) => listeners.forEach((l) => l(event, data));

let es: EventSource | null = null;

const OUTDATED = () => tr('Im Hintergrund läuft noch eine alte MineOS-Version. Schließe alle schwarzen MineOS-Fenster (oder starte den PC neu) und öffne danach „MineOS starten“ erneut – die neue Version ersetzt die alte dann automatisch.', 'An old MineOS version is still running in the background. Close all black MineOS windows (or restart the PC) and then open “Start MineOS” again – the new version will replace the old one automatically.');

export async function checkSession(): Promise<SessionState> {
  try {
    const s = await get<AuthStatus>('/api/auth/status');
    // Läuft im Hintergrund noch ein alter MineOS-Server, passt die Oberfläche nicht zum Server
    if (CLIENT_BUILD !== 'dev' && s.build !== CLIENT_BUILD) {
      sessionStore.set((st) => ({ ...st, checked: true, error: OUTDATED() }));
      return sessionStore.get();
    }
    const isAdmin = s.user?.role === 'admin';
    sessionStore.set((st) => ({ ...st, checked: true, ...s, isAdmin, error: null }));
    if (isAdmin) { void loadNotifications(); connectLive(); } else disconnectLive();
  } catch (e: any) {
    const error = e?.status === 404
      ? OUTDATED()
      : e?.status === 0
        ? tr("Keine Verbindung zum MineOS-Server. Läuft das schwarze MineOS-Fenster noch?", "No connection to the MineOS server. Is the black MineOS window still running?")
        : tr(`Der MineOS-Server meldet einen Fehler (${e?.message ?? 'unbekannt'}).`, `The MineOS server reports an error (${e?.message ?? 'unknown'}).`);
    sessionStore.set((st) => ({ ...st, checked: true, error }));
  }
  return sessionStore.get();
}

/** Anmelden mit Minecraft-Name + Passwort */
export async function login(username: string, password: string) {
  try { await post('/api/auth/login', { username, password }); } catch (e: any) { if (e?.status === 404) { await checkSession(); } throw e; }
  return checkSession();
}

/** Neues Konto erstellen (meldet direkt an) */
export async function register(username: string, password: string, edition: 'java' | 'bedrock') {
  try { await post('/api/auth/register', { username, password, edition }); } catch (e: any) { if (e?.status === 404) { await checkSession(); } throw e; }
  return checkSession();
}

export async function logout() {
  try { await post('/api/auth/logout'); } catch { /* egal */ }
  disconnectLive();
  sessionStore.set((st) => ({ ...st, user: null, isAdmin: false, notifications: [], unread: 0 }));
}

/** Wird aufgerufen, wenn eine Anfrage mit 401 scheitert (Sitzung abgelaufen / gesperrt). */
export function sessionExpired() {
  if (!sessionStore.get().user) return;
  disconnectLive();
  sessionStore.set((st) => ({ ...st, user: null, isAdmin: false }));
}
setUnauthorizedHandler(sessionExpired);

export async function loadNotifications() {
  try {
    const r = await get<{ items: AdminNotification[]; unread: number }>('/api/admin/notifications');
    sessionStore.set((st) => ({ ...st, notifications: r.items, unread: r.unread }));
  } catch { /* nicht erreichbar */ }
}

export async function markAllRead() {
  sessionStore.set((st) => ({ ...st, unread: 0, notifications: st.notifications.map((n) => ({ ...n, read: true })) }));
  try { await post('/api/admin/notifications/read', {}); } catch { /* egal */ }
}

function connectLive() {
  if (es) return;
  sessionStore.set((st) => ({ ...st, live: 'connecting' }));
  es = new EventSource('/api/admin/events');
  es.addEventListener('hello', () => sessionStore.set((st) => ({ ...st, live: 'live' })));
  es.addEventListener('order.created', (ev) => {
    const order: Order = JSON.parse((ev as MessageEvent).data);
    void loadNotifications();
    emit('order.created', order);
    notifyNewOrder(order);
  });
  es.addEventListener('order.updated', (ev) => emit('order.updated', JSON.parse((ev as MessageEvent).data)));
  es.addEventListener('order.deleted', (ev) => emit('order.deleted', JSON.parse((ev as MessageEvent).data)));
  es.addEventListener('catalog.changed', () => emit('catalog.changed', {}));
  es.addEventListener('notifications.read', () => void loadNotifications());
  es.onerror = () => {
    sessionStore.set((st) => ({ ...st, live: 'connecting' }));
    void get<AuthStatus>('/api/auth/status').then((s) => { if (s.user?.role !== 'admin') sessionExpired(); }).catch(() => {});
  };
}

function disconnectLive() {
  es?.close();
  es = null;
  sessionStore.set((st) => ({ ...st, live: 'off' }));
}

/* ─────────── Sprechblase im Infobereich ─────────── */

export interface Balloon { id: number; title: string; text: string; icon: 'info' | 'warning' | 'error' | 'success'; action?: () => void }
export const balloonStore = createStore<{ current: Balloon | null }>({ current: null });
let balloonSeq = 0;
let balloonTimer: ReturnType<typeof setTimeout> | undefined;

export function showBalloon(b: Omit<Balloon, 'id'>, ms = 9000) {
  const id = ++balloonSeq;
  balloonStore.set({ current: { ...b, id } });
  clearTimeout(balloonTimer);
  balloonTimer = setTimeout(() => {
    if (balloonStore.get().current?.id === id) balloonStore.set({ current: null });
  }, ms);
}

/* ─────────── Neue Bestellung: Ton, Sprechblase, Browser-Benachrichtigung ─────────── */

let openAdminOrder: ((id: number) => void) | null = null;
export function registerOrderOpener(fn: (id: number) => void) { openAdminOrder = fn; }

function notifyNewOrder(order: Order) {
  playChime();
  showBalloon({
    title: tr(`Neue Bestellung ${order.orderNumber}`, `New order ${order.orderNumber}`),
    text: tr(`${order.playerName} hat ${order.items.length} Position(en) für ${euro(order.totalCents)} bestellt. Klicke hier, um sie zu öffnen.`, `${order.playerName} ordered ${order.items.length} item(s) for ${euro(order.totalCents)}. Click here to open it.`),
    icon: 'info',
    action: () => openAdminOrder?.(order.id),
  });
  document.querySelector('[data-taskbtn="admin"]')?.classList.add('flash');
  setTimeout(() => document.querySelector('[data-taskbtn="admin"]')?.classList.remove('flash'), 3200);
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try {
      const n = new Notification(tr(`MineOS: Neue Bestellung ${order.orderNumber}`, `MineOS: New order ${order.orderNumber}`), {
        body: `${order.playerName} · ${euro(order.totalCents)}`,
        tag: order.orderNumber,
      });
      n.onclick = () => { window.focus(); openAdminOrder?.(order.id); };
    } catch { /* nicht unterstützt */ }
  }
}

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission().catch(() => {});
  }
}

let audioCtx: AudioContext | null = null;
export function playChime(kind: 'order' | 'error' | 'click' | 'logon' = 'order') {
  const s = settingsStore.get();
  if (!s.sounds || s.volume <= 0) return;
  try {
    audioCtx ||= new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    const vol = (s.volume / 100) * 0.18;
    const notes = kind === 'order' ? [880, 1318.5] : kind === 'error' ? [330, 262] : kind === 'logon' ? [523.25, 659.25, 783.99, 1046.5] : [1200];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = ctx.currentTime + i * (kind === 'logon' ? 0.18 : 0.14);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'logon' ? 1.2 : 0.5));
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1.3);
    });
  } catch { /* Audio nicht verfügbar */ }
}
