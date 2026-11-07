import { useEffect, useRef, type ReactNode } from 'react';
import { api, ApiError } from '../../lib/api';
import { sessionExpired } from '../../os/session';
import { CapGlyph, XpGlyph } from '../../os/icons';
import type { OrderStatus } from '../../../shared/constants';
import { STATUS_LABELS } from '../../../shared/constants';
import { tr } from '../../lib/i18n';

/** API-Aufruf für den Adminbereich: abgelaufene Sitzungen werden erkannt. */
export async function adminApi<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  try {
    return await api<T>(method, url, body);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) sessionExpired();
    throw e;
  }
}

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`status-pill small s-${status}`}>{STATUS_LABELS[status]}</span>;
}

/** Aero-Dialog innerhalb eines Fensters (modal für dieses Fenster) */
export function Dialog({ title, children, footer, onClose, width = 560 }: { title: string; children: ReactNode; footer: ReactNode; onClose: () => void; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    ref.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="inwin-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) ref.current?.classList.add('shake'); setTimeout(() => ref.current?.classList.remove('shake'), 400); }}>
      <div className="win active inwin-dialog" ref={ref} style={{ width }}>
        <div className="win-glass" />
        <div className="win-inner">
          <div className="win-titlebar"><span className="win-title">{title}</span></div>
          <div className="win-caption">
            <button className="cap-close" style={{ width: 43, borderRadius: '0 0 5px 5px' }} onClick={onClose} aria-label={tr("Schließen", "Close")}><CapGlyph kind="close" /><XpGlyph kind="close" /></button>
          </div>
          <div className="win-client">
            <div className="inwin-body">{children}</div>
            <div className="dialog-footer">{footer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, color, onClick }: { label: string; value: ReactNode; sub?: string; color?: string; onClick?: () => void }) {
  return (
    <button className="stat-box" onClick={onClick} disabled={!onClick} style={{ ['--accent' as any]: color || '#2a7fd8' }}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </button>
  );
}
