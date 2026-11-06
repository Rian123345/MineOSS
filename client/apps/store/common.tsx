import { useEffect, useState } from 'react';
import type { Product } from '../../../shared/types';
import { euro } from '../../lib/format';
import { tr } from '../../lib/i18n';

export type View =
  | { kind: 'home' }
  | { kind: 'featured' }
  | { kind: 'category'; id: number }
  | { kind: 'search'; q: string }
  | { kind: 'product'; id: number }
  | { kind: 'cart' }
  | { kind: 'checkout' }
  | { kind: 'confirmation'; orderNumber: string; accessCode: string; totalCents: number; createdAt: string; items: any[] }
  | { kind: 'track'; orderNumber?: string; accessCode?: string };

export interface StoreNav {
  go: (v: View) => void;
}

/** Windows-7-Drehfeld für Mengen */
export function QtySpinner({ value, min, max, onChange, width = 58 }: { value: number; min: number; max: number; onChange: (v: number) => void; width?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (raw: string) => {
    const n = Math.round(Number(raw.replace(/\D/g, '')));
    const v = Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : min;
    setText(String(v));
    if (v !== value) onChange(v);
  };
  return (
    <span className="spin" style={{ width }}>
      <input
        className="input"
        inputMode="numeric"
        value={text}
        aria-label={tr("Menge", "Quantity")}
        onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 5))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          if (e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(max, value + 1)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(min, value - 1)); }
        }}
      />
      <span className="spin-btns">
        <button type="button" tabIndex={-1} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label={tr("Mehr", "More")}>
          <svg width="7" height="4" viewBox="0 0 7 4"><path d="M0 4L3.5 0 7 4z" fill="#333" /></svg>
        </button>
        <button type="button" tabIndex={-1} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label={tr("Weniger", "Less")}>
          <svg width="7" height="4" viewBox="0 0 7 4"><path d="M0 0L3.5 4 7 0z" fill="#333" /></svg>
        </button>
      </span>
    </span>
  );
}

export function maxOrderable(p: Product) {
  return p.stock === null ? p.maxQty : Math.min(p.maxQty, p.stock);
}

export function Availability({ p }: { p: Product }) {
  if (p.stock === null) return <span className="avail farm" title={tr("Wird nach deiner Bestellung frisch gefarmt", "Freshly farmed after you order")}>{tr("● Auf Bestellung gefarmt", "● Farmed to order")}</span>;
  if (p.stock === 0) return <span className="avail out">{tr("● Ausverkauft", "● Sold out")}</span>;
  if (p.stock < 10) return <span className="avail low">{tr("● Nur noch ", "● Only ")}{p.stock} {tr("verfügbar", "available")}</span>;
  return <span className="avail ok">● {p.stock} {tr("verfügbar", "available")}</span>;
}

export function Price({ cents, unit }: { cents: number; unit?: string }) {
  return (
    <span className="price">
      <b>{euro(cents)}</b>
      {unit && <small> / {unit}</small>}
    </span>
  );
}
