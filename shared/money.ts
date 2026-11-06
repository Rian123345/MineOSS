/**
 * Ingame-Währung: Dollar ($). Beträge werden intern in Hundertsteln gespeichert.
 * Ganze Beträge ohne Nachkommastellen: $2,500 · sonst: $2.50
 */
export function formatMoney(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}$${w}${frac ? '.' + String(frac).padStart(2, '0') : ''}`;
}

/** Liest Eingaben wie "2500", "$2,500", "2.50", "2,5" → Hundertstel (oder null). */
export function parseMoney(input: string): number | null {
  let s = input.replace(/[$\s]/g, '');
  if (!s) return null;
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  let decimalSep = '';
  if (lastDot > -1 && lastComma > -1) decimalSep = lastDot > lastComma ? '.' : ',';
  else if (lastDot > -1 || lastComma > -1) {
    const sep = lastDot > -1 ? '.' : ',';
    const parts = s.split(sep);
    // "2,500" / "1.000.000" → Tausendertrennzeichen; "2.5" / "2,50" → Dezimaltrennzeichen
    decimalSep = parts.length === 2 && parts[1].length !== 3 ? sep : '';
    if (parts.length > 2) decimalSep = '';
  }
  if (decimalSep) {
    const thousands = decimalSep === '.' ? ',' : '.';
    s = s.split(thousands).join('').replace(decimalSep, '.');
  } else {
    s = s.replace(/[.,]/g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export const centsToMoneyInput = (c: number) => (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
