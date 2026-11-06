import { useCallback, useEffect, useState } from 'react';
import { FrameBar } from '../../os/frame';
import type { AppProps } from '../../os/apps';
import { openApp } from '../../os/apps';
import { wm } from '../../os/wm';
import { useStore, settingsStore } from '../../lib/store';
import { sessionStore, onAdminEvent, markAllRead, logout, requestNotificationPermission, playChime } from '../../os/session';
import type { DashboardStats } from '../../../shared/types';
import { STATUS_COLORS, STATUS_LABELS, ORDER_STATUSES } from '../../../shared/constants';
import { ShieldIcon, BellIcon, Chevron, ArrowGlyph, StatusGlyph, PackageIcon, ItemIcon, GearIcon, HomeIcon, UserPic } from '../../os/icons';
import { UsersPage } from './Users';
import { OrdersPage } from './Orders';
import { ProductsPage, CategoriesPage } from './Products';
import { adminApi, Stat, StatusPill } from './common';
import type { ApiError } from '../../lib/api';
import { euro, fmtDateTime, timeAgo, cls } from '../../lib/format';
import { Spinner } from '../../os/Boot';
import { itemName, nameByGerman } from '../../lib/catalog';
import { tr, locale, useLang } from '../../lib/i18n';
import { serverText } from '../../lib/serverText';

type Page = 'dashboard' | 'orders' | 'products' | 'categories' | 'users' | 'notifications' | 'settings';
const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Dashboard', get orders() { return tr("Bestellungen", "Orders"); }, get products() { return tr("Produkte", "Products"); }, get categories() { return tr("Kategorien", "Categories"); }, get users() { return tr("Benutzer", "Users"); }, get notifications() { return tr("Benachrichtigungen", "Notifications"); }, get settings() { return tr("Einstellungen", "Settings"); },
};

export function AdminApp({ winId, props, nonce }: AppProps) {
  const lang = useLang();
  const session = useStore(sessionStore);
  const [page, setPage] = useState<Page>(props.page || 'dashboard');
  const [orderId, setOrderId] = useState<number | undefined>(props.orderId);
  const [orderFilter, setOrderFilter] = useState<any>(undefined);
  const [bellOpen, setBellOpen] = useState(false);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    if (props.page) setPage(props.page);
    if (props.orderId) setOrderId(props.orderId);
  }, [nonce, props.page, props.orderId]);

  useEffect(() => { wm.setTitle(winId, tr(`Shop-Verwaltung – ${PAGE_TITLES[page]}`, `Shop Management – ${PAGE_TITLES[page]}`)); }, [winId, page, lang]);

  const refreshNew = useCallback(() => {
    if (!sessionStore.get().isAdmin) return;
    adminApi<{ total: number }>('GET', '/api/admin/orders?status=new&limit=1').then((r) => setNewCount(r.total)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!session.isAdmin) return;
    refreshNew();
    return onAdminEvent((ev) => { if (ev.startsWith('order.')) refreshNew(); });
  }, [session.isAdmin, refreshNew]);

  useEffect(() => {
    if (!bellOpen) return;
    const close = () => setBellOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [bellOpen]);

  if (!session.checked) return <div className="empty-state"><Spinner dark /></div>;

  if (!session.isAdmin) {
    return (
      <div className="admin-login">
        <div className="admin-login-inner" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <ShieldIcon size={40} />
          <div>
            <div className="h-title" style={{ margin: 0 }}>{tr("Kein Zugriff", "No access")}</div>
            <p>{tr("Die Shop-Verwaltung ist nur für Administratoren zugänglich. Du bist als ", "Shop Management is only available to administrators. You are signed in as ")}<b>{session.user?.name ?? tr("Gast", "Guest")}</b> {tr("angemeldet.", ".")}</p>
            <p className="muted">{tr("Ein Administrator kann dein Konto unter „Shop-Verwaltung → Benutzer“ freischalten.", "An administrator can grant you access under “Shop Management → Users”.")}</p>
          </div>
        </div>
      </div>
    );
  }

  const nav = (p: Page, extra?: { orderId?: number; filter?: any }) => {
    setPage(p);
    setOrderId(extra?.orderId);
    setOrderFilter(extra?.filter);
  };

  const navItems: { p: Page; label: string; icon: React.ReactNode; count?: number }[] = [
    { p: 'dashboard', label: 'Dashboard', icon: <HomeIcon /> },
    { p: 'orders', label: tr("Bestellungen", "Orders"), icon: <PackageIcon />, count: newCount },
    { p: 'products', label: tr("Produkte", "Products"), icon: <ItemIcon icon="diamond" size={16} /> },
    { p: 'categories', label: tr("Kategorien", "Categories"), icon: <ItemIcon icon="chest" size={16} /> },
    { p: 'users', label: tr("Benutzer", "Users"), icon: <UserPic size={16} /> },
    { p: 'notifications', label: tr("Benachrichtigungen", "Notifications"), icon: <BellIcon color="#f0b31a" />, count: session.unread },
    { p: 'settings', label: tr("Einstellungen", "Settings"), icon: <GearIcon /> },
  ];

  return (
    <>
      <FrameBar>
        <div className="nav-bar">
          <div className="nav-arrows">
            <button className="nav-round" disabled={page === 'dashboard'} onClick={() => nav('dashboard')} aria-label={tr("Zurück", "Back")}><ArrowGlyph dir="left" /></button>
            <button className="nav-round" disabled aria-label={tr("Vor", "Forward")}><ArrowGlyph dir="right" /></button>
          </div>
          <div className="address-bar">
            <span className="ab-ic"><ShieldIcon /></span>
            <span className="crumb-sep"><Chevron /></span>
            <span className="crumb" onClick={() => nav('dashboard')}>{tr("Shop-Verwaltung", "Shop Management")}</span>
            <span className="crumb-sep"><Chevron /></span>
            <span className="crumb">{PAGE_TITLES[page]}</span>
          </div>
        </div>
      </FrameBar>

      <div className="cmd-bar">
        <select className="select mobile-only" value={page} onChange={(e) => nav(e.target.value as Page)} aria-label={tr("Bereich", "Section")}>
          {navItems.map((n) => <option key={n.p} value={n.p}>{n.label}</option>)}
        </select>
        <button className="cmd-btn" onClick={() => nav('orders', { filter: 'new' })}><PackageIcon /> {tr("Neue Bestellungen", "New orders")}{newCount > 0 && <span className="cart-badge">{newCount}</span>}</button>
        <button className="cmd-btn" onClick={() => nav('products')}>{tr("Preise & Produkte", "Prices & products")}</button>
        <button className="cmd-btn" onClick={() => openApp('store')}>{tr("Store öffnen", "Open store")}</button>
        <div className="cmd-right">
          <span className={cls('live-dot', session.live === 'live' && 'on')} title={session.live === 'live' ? tr("Echtzeit verbunden", "Real-time connected") : tr("Verbinde …", "Connecting …")} />
          <span className="muted" style={{ marginRight: 6 }}>{session.live === 'live' ? 'Live' : tr("Verbinde …", "Connecting …")}</span>
          <div style={{ position: 'relative' }}>
            <button className={cls('cmd-btn', bellOpen && 'pressed')} onPointerDown={(e) => e.stopPropagation()} onClick={() => setBellOpen(!bellOpen)} title={tr("Benachrichtigungen", "Notifications")}>
              <BellIcon color="#f0b31a" /> {session.unread > 0 && <span className="cart-badge">{session.unread}</span>}
            </button>
            {bellOpen && (
              <div className="bell-drop" onPointerDown={(e) => e.stopPropagation()}>
                <div className="bell-head">
                  <b>{tr("Benachrichtigungen", "Notifications")}</b>
                  <button className="link" onClick={() => void markAllRead()}>{tr("Alle als gelesen markieren", "Mark all as read")}</button>
                </div>
                <div className="bell-list">
                  {session.notifications.length === 0 && <div className="empty-state" style={{ padding: 20 }}>{tr("Keine Benachrichtigungen", "No notifications")}</div>}
                  {session.notifications.slice(0, 12).map((n) => (
                    <div key={n.id} className={cls('bell-item', !n.read && 'unread')} onClick={() => { setBellOpen(false); if (n.orderId) nav('orders', { orderId: n.orderId }); }}>
                      <PackageIcon size={20} />
                      <div><b>{serverText(n.title)}</b><div>{serverText(n.body)}</div><div className="muted">{timeAgo(n.createdAt)}</div></div>
                    </div>
                  ))}
                </div>
                <div className="bell-foot"><button className="link" onClick={() => { setBellOpen(false); nav('notifications'); }}>{tr("Alle anzeigen", "Show all")}</button></div>
              </div>
            )}
          </div>
          <div className="cmd-sep" />
          <span className="admin-user"><UserPic size={18} admin /> {session.user?.name}</span>
          <button className="cmd-btn" onClick={() => void logout()}>{tr("Abmelden", "Log off")}</button>
        </div>
      </div>

      <div className="admin-body">
        <nav className="nav-pane admin-nav">
          <div className="nav-group">
            <div className="nav-group-title"><ShieldIcon /> {tr("Shop-Verwaltung", "Shop Management")}</div>
            {navItems.map((n) => (
              <div key={n.p} className={cls('nav-item', page === n.p && 'selected')} onClick={() => nav(n.p)}>
                <span className="ni-ic">{n.icon}</span>{n.label}
                {!!n.count && <span className="ni-count"><span className="cart-badge">{n.count}</span></span>}
              </div>
            ))}
          </div>
        </nav>
        <div className="admin-main">
          {page === 'dashboard' && <Dashboard onOpenOrder={(id) => nav('orders', { orderId: id })} onFilter={(f) => nav('orders', { filter: f })} />}
          {page === 'orders' && <OrdersPage key={`${orderId}-${orderFilter}`} winId={winId} initialOrderId={orderId} initialFilter={orderFilter} />}
          {page === 'products' && <ProductsPage winId={winId} />}
          {page === 'categories' && <CategoriesPage winId={winId} />}
          {page === 'notifications' && <NotificationsPage onOpen={(id) => nav('orders', { orderId: id })} />}
          {page === 'users' && <UsersPage winId={winId} />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </div>
    </>
  );
}

/* ─────────── Dashboard ─────────── */

function Dashboard({ onOpenOrder, onFilter }: { onOpenOrder: (id: number) => void; onFilter: (f: string) => void }) {
  const [s, setS] = useState<DashboardStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => adminApi<DashboardStats>('GET', '/api/admin/stats').then(setS).catch((e) => setErr(e.message)), []);
  useEffect(() => { void load(); return onAdminEvent((ev) => { if (ev.startsWith('order.')) void load(); }); }, [load]);

  if (!s) return <div className="empty-state">{err ? <span className="err-text">{err}</span> : <Spinner dark />}</div>;
  const inWork = s.byStatus.accepted + s.byStatus.farming + s.byStatus.ready;
  const maxDay = Math.max(1, ...s.perDay.map((d) => d.count));

  return (
    <div className="app-scroll dashboard">
      <h1 className="h-title">{tr("Übersicht", "Overview")}</h1>
      <div className="stat-grid">
        <Stat label={tr("Bestellungen gesamt", "Total orders")} value={s.total} onClick={() => onFilter('')} />
        <Stat label={tr("Neue Bestellungen", "New orders")} value={s.byStatus.new} sub={tr("warten auf Annahme", "waiting for acceptance")} color={STATUS_COLORS.new} onClick={() => onFilter('new')} />
        <Stat label={tr("Offene Bestellungen", "Open orders")} value={s.open} sub={tr("noch nicht abgeschlossen", "not completed yet")} color="#5a6f8a" onClick={() => onFilter('open')} />
        <Stat label={tr("In Bearbeitung", "In progress")} value={inWork} sub={tr(`${s.byStatus.accepted} angenommen · ${s.byStatus.farming} farmen · ${s.byStatus.ready} bereit`, `${s.byStatus.accepted} accepted · ${s.byStatus.farming} farming · ${s.byStatus.ready} ready`)} color={STATUS_COLORS.farming} onClick={() => onFilter('farming')} />
        <Stat label={tr("Abgeschlossen", "Completed")} value={s.byStatus.completed} sub={tr(`${s.byStatus.cancelled} storniert`, `${s.byStatus.cancelled} cancelled`)} color={STATUS_COLORS.completed} onClick={() => onFilter('completed')} />
        <Stat label={tr("Gesamtumsatz", "Total revenue")} value={euro(s.revenueCents)} sub={tr(`+ ${euro(s.revenueOpenCents)} in offenen Bestellungen`, `+ ${euro(s.revenueOpenCents)} in open orders`)} color="#24700f" />
      </div>

      <div className="dash-row">
        <div className="group-box" style={{ flex: 2 }}>
          <span className="gb-title">{tr("Bestellungen der letzten 14 Tage", "Orders in the last 14 days")}</span>
          <div className="bar-chart" role="img" aria-label={tr("Bestellungen pro Tag", "Orders per day")}>
            {s.perDay.map((d) => (
              <div key={d.day} className="bar-col" title={tr(`${new Date(d.day).toLocaleDateString(locale())}: ${d.count} Bestellung(en), ${euro(d.revenueCents)}`, `${new Date(d.day).toLocaleDateString('en-US')}: ${d.count} order(s), ${euro(d.revenueCents)}`)}>
                <span className="bar-val">{d.count || ''}</span>
                <div className="bar" style={{ height: `${(d.count / maxDay) * 100}%` }} />
                <span className="bar-label">{new Date(d.day).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="group-box" style={{ flex: 1, minWidth: 220 }}>
          <span className="gb-title">{tr("Status-Verteilung", "Status breakdown")}</span>
          {ORDER_STATUSES.map((k) => (
            <div key={k} className="dist-row">
              <span style={{ width: 120 }}>{STATUS_LABELS[k]}</span>
              <div className="progress" style={{ flex: 1, height: 12 }}><div style={{ width: `${s.total ? (s.byStatus[k] / s.total) * 100 : 0}%`, background: `linear-gradient(rgba(255,255,255,.5), rgba(255,255,255,.1) 50%, transparent 51%), ${STATUS_COLORS[k]}` }} /></div>
              <span style={{ width: 28, textAlign: 'right' }}>{s.byStatus[k]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-row">
        <div className="group-box" style={{ flex: 2 }}>
          <span className="gb-title">{tr("Letzte Bestellungen", "Latest orders")}</span>
          {s.recent.length === 0 ? <div className="muted">{tr("Noch keine Bestellungen.", "No orders yet.")}</div> : (
            <div className="table-scroll"><table className="list-table">
              <thead><tr><th>{tr("Nr.", "No.")}</th><th>{tr("Spieler", "Player")}</th><th>Items</th><th className="num">{tr("Gesamt", "Total")}</th><th>{tr("Datum", "Date")}</th><th>Status</th></tr></thead>
              <tbody>
                {s.recent.map((o) => (
                  <tr key={o.id} onClick={() => onOpenOrder(o.id)} style={{ cursor: 'default' }}>
                    <td className="kbd">{o.orderNumber}</td>
                    <td>{o.playerName}</td>
                    <td className="muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.items.map((i) => `${i.quantity}× ${itemName(i)}`).join(', ')}</td>
                    <td className="num">{euro(o.totalCents)}</td>
                    <td title={fmtDateTime(o.createdAt)}>{timeAgo(o.createdAt)}</td>
                    <td><StatusPill status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
        <div className="group-box" style={{ flex: 1, minWidth: 220 }}>
          <span className="gb-title">{tr("Top-Produkte (Umsatz)", "Top products (revenue)")}</span>
          {s.topProducts.length === 0 ? <div className="muted">{tr("Noch keine Daten.", "No data yet.")}</div> : s.topProducts.map((p, i) => (
            <div key={p.name} className="dist-row">
              <span className="muted" style={{ width: 16 }}>{i + 1}.</span>
              <span style={{ flex: 1 }}>{nameByGerman(p.name)}</span>
              <span className="muted">{p.quantity}×</span>
              <b style={{ fontWeight: 600, width: 80, textAlign: 'right' }}>{euro(p.revenueCents)}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Benachrichtigungen ─────────── */

function NotificationsPage({ onOpen }: { onOpen: (id: number) => void }) {
  const session = useStore(sessionStore);
  return (
    <div className="admin-page">
      <div className="page-toolbar">
        <button className="btn" onClick={() => void markAllRead()} disabled={!session.unread}>{tr("Alle als gelesen markieren", "Mark all as read")}</button>
        <span className="muted">{session.unread} {tr("ungelesen", "unread")}</span>
      </div>
      <div className="app-scroll" style={{ padding: 10 }}>
        {session.notifications.length === 0 && <div className="empty-state">{tr("Noch keine Benachrichtigungen. Neue Bestellungen erscheinen hier sofort.", "No notifications yet. New orders appear here instantly.")}</div>}
        {session.notifications.map((n) => (
          <div key={n.id} className={cls('bell-item big', !n.read && 'unread')} onClick={() => n.orderId && onOpen(n.orderId)}>
            <PackageIcon size={28} />
            <div style={{ flex: 1 }}><b>{serverText(n.title)}</b><div>{serverText(n.body)}</div></div>
            <span className="muted" title={fmtDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Einstellungen ─────────── */

function SettingsPage() {
  const session = useStore(sessionStore);
  const settings = useStore(settingsStore);
  const [sys, setSys] = useState<any>(null);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  useEffect(() => { adminApi('GET', '/api/admin/system').then(setSys).catch(() => {}); }, []);


  return (
    <div className="app-scroll" style={{ padding: '14px 20px' }}>
      <h1 className="h-title">{tr("Einstellungen", "Settings")}</h1>
      <DiscordSettings />

      <div className="group-box" style={{ maxWidth: 640 }}>
        <span className="gb-title">{tr("Benachrichtigungen in MineOS", "Notifications in MineOS")}</span>
        <p style={{ marginTop: 0 }}>{tr("Echtzeit-Verbindung: ", "Real-time connection: ")}<b>{session.live === 'live' ? 'verbunden' : tr("wird hergestellt …", "connecting …")}</b>{sys && tr(` · ${sys.realtimeClients} offene Verbindung(en)`, ` · ${sys.realtimeClients} open connection(s)`)}</p>
        <label className="check" style={{ display: 'flex', marginBottom: 8 }}><input type="checkbox" checked={settings.sounds} onChange={() => settingsStore.set((s) => ({ ...s, sounds: !s.sounds }))} /> {tr("Signalton bei neuen Bestellungen", "Play a sound for new orders")}</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" onClick={() => playChime('order')}>{tr("Ton testen", "Test sound")}</button>
          <button className="btn" disabled={perm !== 'default'} onClick={() => { requestNotificationPermission(); setTimeout(() => setPerm(Notification.permission), 1500); }}>{tr("Browser-Benachrichtigungen erlauben", "Allow browser notifications")}</button>
          <span className="muted">{perm === 'granted' ? 'erlaubt' : perm === 'denied' ? tr("im Browser blockiert", "blocked in the browser") : perm === 'unsupported' ? tr("nicht unterstützt", "not supported") : tr("noch nicht erlaubt", "not allowed yet")}</span>
        </div>
      </div>

      <div className="group-box" style={{ maxWidth: 640 }}>
        <span className="gb-title">{tr("Konto", "Account")}</span>
        <p style={{ marginTop: 0 }}>{tr("Angemeldet als ", "Signed in as ")}<b>{session.user?.name}</b>.</p>
        <button className="btn" onClick={() => openApp('useraccounts')}>{tr("Passwort ändern…", "Change password…")}</button>
      </div>

      {sys && (
        <div className="group-box" style={{ maxWidth: 640 }}>
          <span className="gb-title">System</span>
          <table className="form-table"><tbody>
            <tr><td>Node.js</td><td>{sys.node}</td></tr>
            <tr><td>{tr("Laufzeit", "Uptime")}</td><td>{Math.floor(sys.uptimeSeconds / 3600)} h {Math.floor((sys.uptimeSeconds % 3600) / 60)} min</td></tr>
          </tbody></table>
        </div>
      )}
    </div>
  );
}

/* ─────────── Discord verbinden ─────────── */

interface DiscordState { configured: boolean; maskedUrl: string | null; mention: string; notifyStatus: boolean; fromEnv: boolean }

function DiscordSettings() {
  const [st, setSt] = useState<DiscordState | null>(null);
  const [url, setUrl] = useState('');
  const [mention, setMention] = useState('@here');
  const [notifyStatus, setNotifyStatus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = (d: DiscordState) => { setSt(d); setMention(d.mention); setNotifyStatus(d.notifyStatus); };
  useEffect(() => { adminApi<DiscordState>('GET', '/api/admin/settings/discord').then(apply).catch((e) => setMsg({ ok: false, text: e.message })); }, []);

  const save = async (removeUrl = false) => {
    setBusy(true); setMsg(null);
    try {
      const body: Record<string, unknown> = { mention: mention.trim(), notifyStatus };
      if (removeUrl) body.webhookUrl = null; else if (url.trim()) body.webhookUrl = url.trim();
      const d = await adminApi<DiscordState>('PUT', '/api/admin/settings/discord', body);
      apply(d); setUrl('');
      if (!removeUrl && d.configured) {
        try {
          await adminApi('POST', '/api/admin/discord-test', {});
          setMsg({ ok: true, text: tr("Gespeichert! Eine Testnachricht wurde an deinen Discord-Kanal gesendet.", "Saved! A test message was sent to your Discord channel.") });
        } catch (te) {
          setMsg({ ok: false, text: tr(`Gespeichert, aber die Testnachricht kam nicht an: ${(te as Error).message}`, `Saved, but the test message didn't arrive: ${(te as Error).message}`) });
        }
      } else {
        setMsg({ ok: true, text: removeUrl ? tr("Discord wurde getrennt.", "Discord was disconnected.") : tr("Gespeichert.", "Saved.") });
      }
    } catch (e) {
      const a = e as ApiError;
      setMsg({ ok: false, text: a.fields ? Object.values(a.fields).join(' ') : a.message });
    } finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setMsg(null);
    try { await adminApi('POST', '/api/admin/discord-test', {}); setMsg({ ok: true, text: tr("Testnachricht wurde gesendet.", "Test message sent.") }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  };

  return (
    <div className="group-box" style={{ maxWidth: 680 }}>
      <span className="gb-title">{tr("Discord verbinden", "Connect Discord")}</span>
      {!st ? <Spinner small dark /> : (
        <>
          <p style={{ marginTop: 0 }}>
            Status: {st.configured ? <b className="ok-text">{tr("✔ Verbunden", "✔ Connected")}</b> : <b className="err-text">{tr("Nicht verbunden", "Not connected")}</b>}
            {st.maskedUrl && <span className="muted kbd" style={{ marginLeft: 8 }}>{st.maskedUrl}</span>}
          </p>
          {st.fromEnv ? (
            <div className="info-bar blue"><StatusGlyph kind="info" size={16} /> {tr("Der Webhook ist in der Datei ", "The webhook is set in the file ")}<code className="kbd">.env</code> {tr("festgelegt und kann hier nicht geändert werden.", "and can't be changed here.")}</div>
          ) : (
            <>
              <ol className="discord-steps">
                <li>{tr("In Discord: ", "In Discord: ")}<b>{tr("Servereinstellungen → Integrationen → Webhooks → Neuer Webhook", "Server Settings → Integrations → Webhooks → New Webhook")}</b></li>
                <li>{tr("Kanal wählen (z. B. #bestellungen) und auf ", "Choose a channel (e.g. #orders) and click ")}<b>{tr("Webhook-URL kopieren", "Copy Webhook URL")}</b> {tr("klicken", "")}</li>
                <li>{tr("Die URL hier einfügen und ", "Paste the URL here and press ")}<b>{tr("Speichern", "Save")}</b> {tr("drücken – fertig!", "– done!")}</li>
              </ol>
              <div className="field">
                <label>{tr("Webhook-URL", "Webhook URL")}</label>
                <input className="input" style={{ width: '100%' }} value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder={st.configured ? tr("Neue URL einfügen, um sie zu ersetzen", "Paste a new URL to replace it") : 'https://discord.com/api/webhooks/…'} autoComplete="off" spellCheck={false} />
                <span className="hint">{tr("Die URL wird nur auf dem Server gespeichert und nie wieder vollständig angezeigt.", "The URL is only stored on the server and never shown in full again.")}</span>
              </div>
            </>
          )}
          <div className="pform-row">
            <div className="field">
              <label>{tr("Wer soll erwähnt werden?", "Who should be mentioned?")}</label>
              <select className="select" value={['', '@here', '@everyone'].includes(mention) ? mention : 'custom'} disabled={st.fromEnv}
                onChange={(e) => setMention(e.target.value === 'custom' ? '<@>' : e.target.value)}>
                <option value="@here">{tr("@here (alle Online-Mitglieder)", "@here (all online members)")}</option>
                <option value="@everyone">@everyone</option>
                <option value="">{tr("Niemand", "Nobody")}</option>
                <option value="custom">{tr("Bestimmte Person/Rolle …", "Specific person/role …")}</option>
              </select>
            </div>
            {!['', '@here', '@everyone'].includes(mention) && (
              <div className="field">
                <label>{tr("Benutzer- oder Rollen-ID", "User or role ID")}</label>
                <input className="input" value={mention} onChange={(e) => setMention(e.target.value)} placeholder={tr("<@123456789> oder <@&123456789>", "<@123456789> or <@&123456789>")} disabled={st.fromEnv} />
              </div>
            )}
          </div>
          <label className="check" style={{ display: 'flex', marginBottom: 10 }}>
            <input type="checkbox" checked={notifyStatus} disabled={st.fromEnv} onChange={() => setNotifyStatus(!notifyStatus)} /> {tr("Auch Statusänderungen (angenommen, wird gefarmt, …) an Discord senden", "Also send status changes (accepted, farming, …) to Discord")}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {!st.fromEnv && <button className="btn default" onClick={() => save()} disabled={busy}>{busy ? <Spinner small dark /> : tr("Speichern", "Save")}</button>}
            <button className="btn" onClick={test} disabled={busy || !st.configured}>{tr("Testnachricht senden", "Send test message")}</button>
            {st.configured && !st.fromEnv && <button className="btn danger" onClick={() => save(true)} disabled={busy}>{tr("Trennen", "Disconnect")}</button>}
          </div>
          {msg && <div className={msg.ok ? 'ok-text' : 'err-text'} style={{ marginTop: 8 }}>{msg.text}</div>}
        </>
      )}
    </div>
  );
}
