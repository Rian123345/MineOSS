import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Order } from '../../../shared/types';
import { ORDER_STATUSES, STATUS_LABELS, EDITION_LABELS, type OrderStatus } from '../../../shared/constants';
import { adminApi, StatusPill } from './common';
import { onAdminEvent } from '../../os/session';
import { ItemIcon, StatusGlyph, SearchIcon } from '../../os/icons';
import { euro, fmtDateTime, formatCode, cls, timeAgo } from '../../lib/format';
import { msgbox } from '../../os/wm';
import { Spinner } from '../../os/Boot';
import { ApiError } from '../../lib/api';
import { itemName, unitText } from '../../lib/catalog';
import { serverText } from '../../lib/serverText';
import { tr } from '../../lib/i18n';

type Filter = '' | 'open' | OrderStatus;

const NEXT_ACTION: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  new: { to: 'accepted', get label() { return tr("Bestellung annehmen", "Accept order"); } },
  accepted: { to: 'farming', get label() { return tr("Farmen starten", "Start farming"); } },
  farming: { to: 'ready', get label() { return tr("Bereit zur Übergabe", "Ready for handover"); } },
  ready: { to: 'completed', get label() { return tr("Als übergeben abschließen", "Complete as handed over"); } },
};

export function OrdersPage({ winId, initialOrderId, initialFilter }: { winId: string; initialOrderId?: number; initialFilter?: Filter }) {
  const [filter, setFilter] = useState<Filter>(initialFilter ?? '');
  const [q, setQ] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selId, setSelId] = useState<number | null>(initialOrderId ?? null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      if (q.trim()) params.set('q', q.trim());
      const r = await adminApi<{ total: number; orders: Order[] }>('GET', `/api/admin/orders?${params}`);
      setOrders(r.orders); setTotal(r.total); setErr(null);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [filter, q]);

  useEffect(() => { setLoading(true); const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => { if (initialOrderId) setSelId(initialOrderId); }, [initialOrderId]);

  useEffect(() => onAdminEvent((ev, data) => {
    if (ev === 'order.created') {
      setFresh((s) => new Set(s).add(data.id));
      setTimeout(() => setFresh((s) => { const n = new Set(s); n.delete(data.id); return n; }), 6000);
      void load();
    }
    if (ev === 'order.updated') setOrders((list) => list.map((o) => (o.id === data.id ? data : o)));
    if (ev === 'order.deleted') { setOrders((list) => list.filter((o) => o.id !== data.id)); setSelId((s) => (s === data.id ? null : s)); }
  }), [load]);

  const tabs: { key: Filter; label: string }[] = [
    { key: '', label: tr("Alle", "All") }, { key: 'open', label: tr("Offen", "Open") },
    ...ORDER_STATUSES.map((s) => ({ key: s as Filter, label: STATUS_LABELS[s] })),
  ];

  return (
    <div className="orders-page">
      <div className="orders-toolbar">
        <div className="tabs" style={{ flex: 1, borderBottom: 'none', flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <button key={t.key} className={cls('tab', filter === t.key && 'active')} onClick={() => { setFilter(t.key); setSelId(null); }}>{t.label}</button>
          ))}
        </div>
        <div className="search-box" style={{ width: 220 }}>
          <input placeholder={tr("Nr., Spieler, Discord, Konto", "No., player, Discord, account")} value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="sb-ic"><SearchIcon /></span>
        </div>
      </div>
      <div className={cls('orders-split', selId && 'has-detail')}>
        <div className="orders-list app-scroll">
          {err && <div className="info-bar red"><StatusGlyph kind="error" size={16} /> {err}</div>}
          {loading && !orders.length ? (
            <div className="empty-state"><Spinner dark /></div>
          ) : !orders.length ? (
            <div className="empty-state">{tr("Keine Bestellungen in dieser Ansicht.", "No orders in this view.")}</div>
          ) : (
            <table className="list-table">
              <thead>
                <tr><th>{tr("Nr.", "No.")}</th><th>{tr("Spieler", "Player")}</th><th>Items</th><th className="num">{tr("Gesamt", "Total")}</th><th>{tr("Datum", "Date")}</th><th>Discord</th><th>Status</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className={cls(selId === o.id && 'selected', fresh.has(o.id) && 'fresh-row')} onClick={() => setSelId(o.id)}>
                    <td className="kbd">{o.orderNumber}</td>
                    <td>{o.playerName} <span className="muted">({o.edition === 'java' ? 'J' : 'B'})</span></td>
                    <td className="items-cell" title={o.items.map((i) => `${i.quantity}× ${itemName(i)}`).join('\n')}>
                      <span className="mini-icons">{o.items.slice(0, 4).map((i, k) => <ItemIcon key={k} icon={i.icon || 'chest'} imageUrl={i.imageUrl} size={18} />)}</span>
                      {o.items.length} {tr("Pos. · ", "items · ")}{o.items.reduce((s, i) => s + i.quantity, 0)} {tr("Einh.", "units")}</td>
                    <td className="num"><b style={{ fontWeight: 600 }}>{euro(o.totalCents)}</b></td>
                    <td title={fmtDateTime(o.createdAt)}>{timeAgo(o.createdAt)}</td>
                    <td>{o.discordName || <span className="muted">—</span>}</td>
                    <td><StatusPill status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="muted" style={{ padding: '6px 8px' }}>{total} {tr("Bestellung(en)", "order(s)")}</div>
        </div>
        {selId && <OrderDetail key={selId} id={selId} winId={winId} onClose={() => setSelId(null)} onChanged={(o) => setOrders((l) => l.map((x) => (x.id === o.id ? o : x)))} onDeleted={() => { setSelId(null); void load(); }} />}
      </div>
    </div>
  );
}

function OrderDetail({ id, winId, onClose, onChanged, onDeleted }: { id: number; winId: string; onClose: () => void; onChanged: (o: Order) => void; onDeleted: () => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<OrderStatus>('new');
  const [note, setNote] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const apply = (o: Order) => { setOrder(o); setStatus(o.status); setAdminNote(o.adminNote ?? ''); };

  useEffect(() => {
    adminApi<Order>('GET', `/api/admin/orders/${id}`).then(apply).catch((e) => setErr(e.message));
    return onAdminEvent((ev, data) => { if (ev === 'order.updated' && data.id === id) apply(data); });
  }, [id]);

  const save = async (to: OrderStatus = status, msg: string = note) => {
    if (!order) return;
    if (to === 'cancelled' && order.status !== 'cancelled') {
      const a = await msgbox({ title: tr("Bestellung stornieren", "Cancel order"), heading: tr(`${order.orderNumber} stornieren?`, `Cancel ${order.orderNumber}?`), text: tr("Der Kunde sieht den Status „Storniert“. Reservierte Lagerbestände werden zurückgebucht.", "The customer will see the status “Cancelled”. Reserved stock is returned."), icon: 'warning', buttons: [tr("Stornieren", "Cancel order"), tr("Abbrechen", "Cancel")], defaultButton: 1, parentId: winId });
      if (a !== tr('Stornieren', 'Cancel order')) return;
    }
    setBusy(true); setErr(null);
    try {
      const o = await adminApi<Order>('PATCH', `/api/admin/orders/${id}`, { status: to, note: msg.trim() || null, adminNote: adminNote.trim() || null });
      apply(o); onChanged(o); setNote(''); setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); }
  };

  const regen = async () => {
    const a = await msgbox({ title: tr("Zugriffscode", "Access code"), heading: tr("Neuen Zugriffscode erzeugen?", "Generate a new access code?"), text: tr("Der alte Code funktioniert danach nicht mehr. Teile den neuen Code dem Kunden mit (z. B. per Discord).", "The old code will stop working. Give the new code to the customer (e.g. via Discord)."), icon: 'question', buttons: [tr("Erzeugen", "Generate"), tr("Abbrechen", "Cancel")], parentId: winId });
    if (a !== tr('Erzeugen', 'Generate')) return;
    try {
      const r = await adminApi<{ accessCode: string }>('POST', `/api/admin/orders/${id}/access-code`, {});
      await msgbox({ title: tr("Neuer Zugriffscode", "New access code"), heading: formatCode(r.accessCode), text: tr(`Bestellnummer: ${order?.orderNumber}\nDieser Code wird nur jetzt angezeigt.`, `Order number: ${order?.orderNumber}\nThis code is only shown now.`), icon: 'info', parentId: winId });
    } catch (e) { setErr((e as Error).message); }
  };

  const remove = async () => {
    const a = await msgbox({ title: tr("Bestellung löschen", "Delete order"), heading: tr(`${order?.orderNumber} endgültig löschen?`, `Permanently delete ${order?.orderNumber}?`), text: tr("Diese Aktion kann nicht rückgängig gemacht werden.", "This action cannot be undone."), icon: 'warning', buttons: [tr("Löschen", "Delete"), tr("Abbrechen", "Cancel")], defaultButton: 1, parentId: winId });
    if (a !== tr('Löschen', 'Delete')) return;
    try { await adminApi('DELETE', `/api/admin/orders/${id}`); onDeleted(); } catch (e) { setErr((e as Error).message); }
  };

  const units = useMemo(() => order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0, [order]);

  if (!order) return <div className="order-detail"><div className="empty-state">{err ? <span className="err-text">{err}</span> : <Spinner dark />}</div></div>;
  const nextAction = NEXT_ACTION[order.status];

  return (
    <div className="order-detail app-scroll">
      <div className="od-head">
        <div>
          <div className="od-num kbd">{order.orderNumber}</div>
          <div className="muted">{fmtDateTime(order.createdAt)} {tr("· aktualisiert ", "· updated ")}{timeAgo(order.updatedAt)}</div>
        </div>
        <StatusPill status={order.status} />
        <button className="cmd-btn" onClick={onClose} title={tr("Schließen", "Close")} style={{ marginLeft: 'auto' }}>✕</button>
      </div>

      {nextAction && (
        <div className="od-quick">
          <button className="btn green" disabled={busy} onClick={() => save(nextAction.to, note)}>{nextAction.label}</button>
          {order.status !== 'cancelled' && order.status !== 'completed' && (
            <button className="btn danger" disabled={busy} onClick={() => save('cancelled', note)}>{tr("Stornieren", "Cancel order")}</button>
          )}
        </div>
      )}

      <div className="group-box">
        <span className="gb-title">{tr("Kunde", "Customer")}</span>
        <dl className="review-dl">
          <dt>{tr("Shop-Konto", "Shop account")}</dt><dd className="selectable">{order.accountName ?? '—'}</dd>
          <dt>{tr("Spielername", "Player name")}</dt><dd className="selectable"><b style={{ fontWeight: 600 }}>{order.playerName}</b> <button className="link" onClick={() => void navigator.clipboard?.writeText(order.playerName)}>{tr("kopieren", "copy")}</button></dd>
          <dt>Edition</dt><dd>{EDITION_LABELS[order.edition]}</dd>
          <dt>Discord</dt><dd className="selectable">{order.discordName || '—'}</dd>
          <dt>{tr("Übergabezeit", "Handover time")}</dt><dd className="selectable">{order.deliveryTime || '—'}</dd>
          <dt>{tr("Informationen", "Information")}</dt><dd className="selectable" style={{ whiteSpace: 'pre-wrap' }}>{order.notes || '—'}</dd>
          <dt>{tr("Discord-Meldung", "Discord notification")}</dt><dd className="muted">{serverText(order.discordStatus) || '—'}</dd>
        </dl>
      </div>

      <div className="group-box">
        <span className="gb-title">{tr("Bestellte Items (", "Ordered items (")}{order.items.length} {tr("Positionen · ", "items · ")}{units} {tr("Einheiten)", "units)")}</span>
        <table className="review-table">
          <tbody>
            {order.items.map((i, k) => (
              <tr key={k}>
                <td style={{ width: 30 }}><ItemIcon icon={i.icon || 'chest'} imageUrl={i.imageUrl} size={24} /></td>
                <td><b style={{ fontWeight: 600 }}>{i.quantity}×</b> {itemName(i)}<div className="muted">{unitText(i.unitLabel)} {tr('à', '@')} {euro(i.unitPriceCents)}</div></td>
                <td className="num">{euro(i.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td /><td>{tr("Gesamtpreis", "Total price")}</td><td className="num"><b>{euro(order.totalCents)}</b></td></tr></tfoot>
        </table>
      </div>

      <div className="group-box">
        <span className="gb-title">{tr("Status ändern", "Change status")}</span>
        <div className="field">
          <label>{tr("Neuer Status", "New status")}</label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{tr("Nachricht an den Kunden ", "Message to the customer ")}<span className="muted">{tr("(sichtbar in der Bestellverfolgung)", "(visible in order tracking)")}</span></label>
          <textarea className="textarea" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("z. B. „Wir treffen uns um 18 Uhr am Spawn.“", "e.g. “Let's meet at spawn at 6 pm.”")} />
        </div>
        <div className="field">
          <label>{tr("Interne Notiz ", "Internal note ")}<span className="muted">{tr("(nur für dich)", "(only for you)")}</span></label>
          <textarea className="textarea" rows={2} maxLength={2000} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
        </div>
        {err && <div className="err-text" style={{ marginBottom: 6 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn default" disabled={busy} onClick={() => save()}>{busy ? <Spinner small dark /> : tr("Speichern", "Save")}</button>
          {saved && <span className="ok-text">{tr("✔ Gespeichert", "✔ Saved")}</span>}
        </div>
      </div>

      <div className="group-box">
        <span className="gb-title">{tr("Verlauf", "History")}</span>
        <ul className="history-list">
          {order.history?.slice().reverse().map((h, k) => (
            <li key={k}>
              <StatusPill status={h.status} />
              <span className="muted">{fmtDateTime(h.createdAt)}</span>
              {h.note && <div className="selectable" style={{ marginTop: 3 }}>{tr("„", "“")}{h.note}{tr("“", "”")}</div>}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0 4px' }}>
        <button className="btn" onClick={regen}>{tr("Neuen Zugriffscode erzeugen", "Generate new access code")}</button>
        {(order.status === 'completed' || order.status === 'cancelled') && <button className="btn danger" onClick={remove}>{tr("Bestellung löschen", "Delete order")}</button>}
      </div>
    </div>
  );
}
