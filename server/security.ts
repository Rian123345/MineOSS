import crypto from 'node:crypto';
import { config } from './config';
import { ipSecret } from './db';
import { HttpError, type Ctx } from './http';

/** Pseudonymisiert IP-Adressen (HMAC) – es wird nie die Klar-IP gespeichert. */
export function hashIp(ip: string): string {
  return crypto.createHmac('sha256', ipSecret).update(ip).digest('hex').slice(0, 32);
}

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function randomString(len: number, alphabet: string): string {
  // Ablehnungsverfahren gegen Modulo-Bias
  const out: string[] = [];
  const max = 256 - (256 % alphabet.length);
  while (out.length < len) {
    const bytes = crypto.randomBytes(len * 2);
    for (const b of bytes) {
      if (b < max) out.push(alphabet[b % alphabet.length]);
      if (out.length === len) break;
    }
  }
  return out.join('');
}

/* ─────────────── Rate-Limiter (Sliding Window im Speicher) ─────────────── */

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { ok: true, retryAfter: 0 };
}

export function enforceRateLimit(ctx: Ctx, name: string, limit: number, windowMs: number, message?: string) {
  const r = rateLimit(`${name}:${ctx.ip}`, limit, windowMs);
  if (!r.ok) {
    ctx.res.setHeader('Retry-After', String(r.retryAfter));
    throw new HttpError(429, message || `Zu viele Anfragen. Bitte warte ${r.retryAfter} Sekunden.`);
  }
}

export function resetRateLimit(name: string, ip: string) {
  buckets.delete(`${name}:${ip}`);
}

// Alte Einträge regelmäßig aufräumen
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of buckets) {
    if (!arr.length || now - arr[arr.length - 1] > 60 * 60 * 1000) buckets.delete(k);
  }
}, 10 * 60 * 1000).unref();

/* ─────────────── CSRF-Schutz ───────────────
 * Zustandsändernde Anfragen müssen
 *   1) den Header "X-Requested-With: MineOS" tragen (kann von fremden Seiten
 *      ohne CORS-Freigabe nicht gesetzt werden) und
 *   2) – falls der Browser einen Origin-Header sendet – von der eigenen Seite kommen.
 * Zusätzlich sind Admin-Cookies SameSite=Strict.
 */
export function checkCsrf(ctx: Ctx) {
  const m = ctx.req.method || 'GET';
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return;
  if (ctx.req.headers['x-requested-with'] !== 'MineOS') {
    throw new HttpError(403, 'Ungültige Anfrage (CSRF-Schutz).');
  }
  const origin = ctx.req.headers.origin;
  if (origin) {
    const host = ctx.req.headers['x-forwarded-host'] && config.trustProxy
      ? String(ctx.req.headers['x-forwarded-host'])
      : ctx.req.headers.host;
    let originHost = '';
    try { originHost = new URL(origin).host; } catch { /* ungültig */ }
    const allowed = new Set<string>([host || '']);
    if (config.publicUrl) {
      try { allowed.add(new URL(config.publicUrl).host); } catch { /* ignorieren */ }
    }
    if (!allowed.has(originHost)) throw new HttpError(403, 'Ungültige Herkunft der Anfrage.');
  }
}
