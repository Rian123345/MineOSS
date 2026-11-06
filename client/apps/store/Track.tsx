import { useCallback, useEffect, useState } from 'react';
import type { MyOrderSummary, OrderItem, PublicOrderView } from '../../../shared/types';
import { CUSTOMER_STEPS, EDITION_LABELS, STATUS_LABELS } from '../../../shared/constants';
import { get, post, ApiError } from '../../lib/api';
import { ItemIcon, StatusGlyph, PackageIcon } from '../../os/icons';
import { euro, fmtDateTime, formatCode, cls, timeAgo } from '../../lib/format';
import { Spinner } from '../../os/Boot';
import type { View } from './common';
import { itemName, unitText } from '../../lib/catalog';
import { tr } from '../../lib/i18n';

/* ─────────── Bestellbestätigung ─────────── */

function CopyField({ label, value, big }: { label: string; value: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-field">
      <div className="muted">{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <code className={cls('code-value selectable', big && 'big')}>{value}</code>
        <button className="btn" onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });
        }}>{copied ? tr("Kopiert ✔", "Copied ✔") : tr("Kopieren", "Copy")}</button>
      </div>
    </div>
  );
}

export function ConfirmationView({ v, go }: { v: Extract<View, { kind: 'confirmation' }>; go: (v: View) => void }) {
  return (
    <div className="confirm-view printable">
      <div className="confirm-head">
        <StatusGlyph kind="success" size={48} />
        <div>
          <h1 className="h-title" style={{ fontSize: 20 }}>{tr("Vielen Dank für deine Bestellung!", "Thank you for your order!")}</h1>
          <div>{tr("Deine Bestellung ist eingegangen und wird so schnell wie möglich bearbeitet.", "Your order has been received and will be processed as soon as possible.")}</div>
        </div>
      </div>
      <div className="confirm-codes">
        <CopyField label={tr("Bestellnummer", "Order number")} value={v.orderNumber} big />
        <CopyField label={tr("Zugriffscode (geheim halten!)", "Access code (keep it secret!)")} value={formatCode(v.accessCode)} big />
      </div>
      <div className="info-bar" style={{ margin: '12px 0' }}>
        <StatusGlyph kind="warning" size={16} />
        <span>{tr("Deine Bestellung findest du jederzeit unter ", "You can find your order at any time under ")}<b>{tr("Meine Bestellungen", "My orders")}</b>{tr(". Mit Bestellnummer und Zugriffscode kann auch jemand anderes (z. B. ein Freund) den Status abrufen – gib den Code nur weiter, wenn du das möchtest.", ". With the order number and access code, someone else (e.g. a friend) can check the status too – only share the code if you want to.")}</span>
      </div>
      <div className="group-box">
        <span className="gb-title">{tr("Bestellübersicht · ", "Order summary · ")}{fmtDateTime(v.createdAt)}</span>
        <ItemsTable items={v.items} total={v.totalCents} />
      </div>
      <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn green big" onClick={() => go({ kind: 'track', orderNumber: v.orderNumber })}>{tr("Bestellung verfolgen", "Track order")}</button>
        <button className="btn big" onClick={() => window.print()}>{tr("Bestätigung drucken", "Print confirmation")}</button>
        <button className="btn big" onClick={() => go({ kind: 'home' })}>{tr("Weiter einkaufen", "Continue shopping")}</button>
      </div>
    </div>
  );
}

function ItemsTable({ items, total }: { items: OrderItem[]; total: number }) {
  return (
    <table className="review-table">
      <tbody>
        {items.map((i, idx) => (
          <tr key={idx}>
            <td style={{ width: 30 }}><ItemIcon icon={i.icon || 'chest'} imageUrl={i.imageUrl} size={24} /></td>
            <td>{i.quantity}× {itemName(i)}<div className="muted">{unitText(i.unitLabel)} {tr('à', '@')} {euro(i.unitPriceCents)}</div></td>
            <td className="num">{euro(i.lineTotalCents)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot><tr><td /><td>{tr("Gesamt", "Total")}</td><td className="num"><b>{euro(total)}</b></td></tr></tfoot>
    </table>
  );
}

/* ─────────── Bestellverfolgung ─────────── */

export function TrackView({ v, go }: { v: Extract<View, { kind: 'track' }>; go: (v: View) => void }) {
  const [mine, setMine] = useState<MyOrderSummary[] | null>(null);
  const [num, setNum] = useState(v.orderNumber || '');
  const [code, setCode] = useState(v.accessCode ? formatCode(v.accessCode) : '');
  const [order, setOrder] = useState<PublicOrderView | null>(null);
  const [source, setSource] = useState<'mine' | 'code'>('mine');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  const loadMine = useCallback(() => get<{ orders: MyOrderSummary[] }>('/api/me/orders').then((r) => setMine(r.orders)).catch(() => setMine([])), []);

  const openMine = useCallback(async (n: string, silent = false) => {
    if (!silent) { setBusy(true); setErr(null); }
    try {
      setOrder(await get<PublicOrderView>(`/api/me/orders/${encodeURIComponent(n)}`));
      setSource('mine'); setCheckedAt(new Date().toISOString());
    } catch (ex) { if (!silent) { setErr((ex as ApiError).message); setOrder(null); } }
    finally { if (!silent) setBusy(false); }
  }, []);

  const lookup = useCallback(async (n: string, c: string, silent = false) => {
    if (!silent) { setBusy(true); setErr(null); }
    try {
      setOrder(await post<PublicOrderView>('/api/orders/track', { orderNumber: n.trim(), accessCode: c }));
      setSource('code'); setCheckedAt(new Date().toISOString());
    } catch (ex) { if (!silent) { setErr((ex as ApiError).message); setOrder(null); } }
    finally { if (!silent) setBusy(false); }
  }, []);

  useEffect(() => {
    void loadMine();
    if (v.orderNumber) void openMine(v.orderNumber);
  }, [v.orderNumber, loadMine, openMine]);

  const refresh = useCallback((silent = false) => {
    if (!order) return;
    if (source === 'mine') void openMine(order.orderNumber, silent); else void lookup(num, code, silent);
  }, [order, source, num, code, openMine, lookup]);

  // Automatische Aktualisierung alle 30 Sekunden
  useEffect(() => {
    if (!order || order.status === 'completed' || order.status === 'cancelled') return;
    const t = setInterval(() => refresh(true), 30_000);
    return () => clearInterval(t);
  }, [order, refresh]);

  return (
    <div className="track-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="h-title" style={{ flex: 1 }}>{order ? tr("Bestellstatus", "Order status") : tr("Meine Bestellungen", "My orders")}</h1>
        {order && <button className="btn" onClick={() => { setOrder(null); void loadMine(); }}>{tr("Alle Bestellungen", "All orders")}</button>}
      </div>
      {err && <div className="info-bar red" style={{ marginBottom: 12 }}><StatusGlyph kind="error" size={16} /> {err}</div>}

      {order ? <OrderStatusPanel order={order} checkedAt={checkedAt} onRefresh={() => refresh()} busy={busy} /> : (
        <>
          {mine === null ? <div className="empty-state"><Spinner dark /></div> : mine.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 10px' }}>
              <div className="es-ic"><PackageIcon size={40} /></div>
              {tr("Du hast noch keine Bestellungen aufgegeben. ", "You haven't placed any orders yet. ")}<button className="link" onClick={() => go({ kind: 'home' })}>{tr("Jetzt einkaufen", "Start shopping")}</button>
            </div>
          ) : (
            <table className="list-table">
              <thead><tr><th>{tr("Bestellnummer", "Order number")}</th><th>Items</th><th>{tr("Datum", "Date")}</th><th className="num">{tr("Betrag", "Amount")}</th><th>Status</th></tr></thead>
              <tbody>
                {mine.map((o) => (
                  <tr key={o.orderNumber} onClick={() => void openMine(o.orderNumber)} style={{ cursor: 'default' }}>
                    <td className="kbd"><PackageIcon /> {o.orderNumber}</td>
                    <td className="muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.items.map((i) => `${i.quantity}× ${itemName(i)}`).join(', ')}</td>
                    <td>{fmtDateTime(o.createdAt)}</td>
                    <td className="num">{euro(o.totalCents)}</td>
                    <td><span className={`status-pill small s-${o.status}`}>{STATUS_LABELS[o.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: 18 }}>
            <button className="link" onClick={() => setShowCode(!showCode)}>{showCode ? '▾' : '▸'} {tr("Andere Bestellung mit Zugriffscode abrufen", "Look up another order with an access code")}</button>
            {showCode && (
              <form className="track-form" onSubmit={(e) => { e.preventDefault(); void lookup(num, code); }}>
                <div className="field">
                  <label htmlFor="tn">{tr("Bestellnummer", "Order number")}</label>
                  <input id="tn" className="input kbd" placeholder="MC-XXXXXX" value={num} maxLength={9} onChange={(e) => setNum(e.target.value.toUpperCase())} />
                </div>
                <div className="field">
                  <label htmlFor="tc">{tr("Zugriffscode", "Access code")}</label>
                  <input id="tc" className="input kbd" placeholder="XXXXX-XXXXX" value={code} maxLength={11} autoComplete="off" onChange={(e) => setCode(e.target.value.toUpperCase())} />
                </div>
                <button className="btn default" type="submit" disabled={busy || !num || !code} style={{ alignSelf: 'flex-end', marginBottom: 10 }}>
                  {busy ? <Spinner small dark /> : tr("Status abrufen", "Check status")}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function OrderStatusPanel({ order, checkedAt, onRefresh, busy }: { order: PublicOrderView; checkedAt: string | null; onRefresh: () => void; busy: boolean }) {
  const cancelled = order.status === 'cancelled';
  const idx = CUSTOMER_STEPS.findIndex((s) => s.status === order.status);
  const pct = cancelled ? 100 : Math.round(((idx + (order.status === 'completed' ? 1 : 0.5)) / CUSTOMER_STEPS.length) * 100);
  const when = (status: string) => [...order.history].reverse().find((h) => h.status === status)?.createdAt;
  const messages = order.history.filter((h) => h.note);
  return (
    <div className="order-status">
      <div className="os-head">
        <div>
          <div className="muted">{tr("Bestellung", "Order")}</div>
          <div className="os-num kbd">{order.orderNumber}</div>
          <div className="muted">{tr("für ", "for ")}{order.playerName} · {EDITION_LABELS[order.edition]} · {fmtDateTime(order.createdAt)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`status-pill s-${order.status}`}>{STATUS_LABELS[order.status]}</span>
          <div className="muted" style={{ marginTop: 6 }}>
            {checkedAt && tr(`Aktualisiert ${timeAgo(checkedAt)}`, `Updated ${timeAgo(checkedAt)}`)}{' '}
            <button className="link" onClick={onRefresh} disabled={busy}>{tr("Aktualisieren", "Refresh")}</button>
          </div>
        </div>
      </div>

      {cancelled ? (
        <div className="info-bar red" style={{ margin: '12px 0' }}><StatusGlyph kind="error" size={16} /> {tr("Diese Bestellung wurde storniert. Bei Fragen melde dich bitte beim Shop-Betreiber.", "This order was cancelled. If you have questions, please contact the shop owner.")}</div>
      ) : (
        <>
          <div className="progress" style={{ height: 18, margin: '14px 0 4px' }}><div style={{ width: `${pct}%` }} /></div>
          <div className="muted" style={{ textAlign: 'right' }}>{pct} {tr("% abgeschlossen", "% complete")}</div>
          <ol className="timeline">
            {CUSTOMER_STEPS.map((s, i) => {
              const state = i < idx || order.status === 'completed' ? 'done' : i === idx ? 'current' : 'todo';
              const t = when(s.status);
              return (
                <li key={s.status} className={`tl-${state}`}>
                  <span className="tl-dot">{state === 'done' ? '✔' : state === 'current' ? <span className="tl-pulse" /> : i + 1}</span>
                  <div>
                    <b>{s.label}</b>
                    <div className="muted">{state === 'todo' ? tr("Ausstehend", "Pending") : s.hint}</div>
                  </div>
                  <span className="tl-time muted">{t ? fmtDateTime(t) : ''}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {messages.length > 0 && (
        <div className="group-box">
          <span className="gb-title">{tr("Nachrichten vom Shop", "Messages from the shop")}</span>
          {messages.map((m, i) => (
            <div key={i} className="shop-msg">
              <span className="muted">{fmtDateTime(m.createdAt)} · {STATUS_LABELS[m.status]}</span>
              <div className="selectable">{m.note}</div>
            </div>
          ))}
        </div>
      )}

      <div className="group-box">
        <span className="gb-title">{tr("Bestellte Items", "Ordered items")}</span>
        <ItemsTable items={order.items} total={order.totalCents} />
        {order.deliveryTime && <p className="muted" style={{ marginBottom: 0 }}>{tr("Gewünschte Übergabe: ", "Preferred handover: ")}{order.deliveryTime}</p>}
      </div>
    </div>
  );
}
