import { formatMoney, parseMoney, centsToMoneyInput } from '../../shared/money';
import { tr, locale } from './i18n';

/** Ingame-Geld in Dollar (Name aus Kompatibilitätsgründen „euro“) */
export const euro = formatMoney;
export const money = formatMoney;

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return tr("gerade eben", "just now");
  if (s < 3600) return tr(`vor ${Math.round(s / 60)} Min.`, `${Math.round(s / 60)} min ago`);
  if (s < 86400) return tr(`vor ${Math.round(s / 3600)} Std.`, `${Math.round(s / 3600)} h ago`);
  const d = Math.round(s / 86400);
  return d === 1 ? tr('gestern', 'yesterday') : tr(`vor ${d} Tagen`, `${d} days ago`);
}

export const formatCode = (c: string) => (c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c);

export const parseEuro = parseMoney;
export const centsToInput = centsToMoneyInput;

export function cls(...parts: unknown[]) {
  return parts.filter((p) => typeof p === 'string' && p).join(' ');
}
