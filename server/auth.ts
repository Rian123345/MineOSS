import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config';
import { db, nowIso } from './db';
import { HttpError, parseCookies, setCookie, type Ctx } from './http';
import { hashIp, sha256, safeEqual } from './security';

/* ─────────── Passwörter (scrypt) ─────────── */

const scrypt = promisify(crypto.scrypt) as (
  pw: crypto.BinaryLike, salt: crypto.BinaryLike, keylen: number, opts: crypto.ScryptOptions,
) => Promise<Buffer>;
const N = 32768, R = 8, P = 1, KEYLEN = 64;

/** Format: scrypt$N$r$p$salt$hash */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = (stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | null = null;
/** Gleiche Rechenzeit auch bei unbekannten Namen (verrät nicht, ob ein Konto existiert) */
export function getDummyHash() {
  if (!dummyHash) dummyHash = hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHash;
}

const COMMON = new Set(['12345678', '123456789', '1234567890', 'password', 'passwort', 'qwertz123', 'qwerty123', 'minecraft', 'minecraft1', '11111111', '00000000', 'abcdefgh', 'iloveyou', 'passwort1', 'password1']);

export function passwordProblem(pw: string, username?: string): string | null {
  if (pw.length < 8) return 'Das Passwort muss mindestens 8 Zeichen lang sein.';
  if (pw.length > 200) return 'Das Passwort ist zu lang.';
  if (COMMON.has(pw.toLowerCase())) return 'Dieses Passwort ist zu leicht zu erraten. Bitte wähle ein anderes.';
  if (username && pw.toLowerCase() === username.toLowerCase()) return 'Das Passwort darf nicht dein Minecraft-Name sein.';
  return null;
}

/**
 * Sitzungen für angemeldete Konten.
 * Das Sitzungs-Token liegt nur im HttpOnly-Cookie; die Datenbank kennt nur seinen SHA-256-Hash.
 */

export const SESSION_COOKIE = 'mineos_session';

export interface SessionUser {
  id: number;
  name: string;
  edition: 'java' | 'bedrock' | null;
  role: 'customer' | 'admin';
}

export function isSecure(ctx: Ctx) {
  if (config.cookieSecure) return true;
  return config.trustProxy && ctx.req.headers['x-forwarded-proto'] === 'https';
}

export function createSession(ctx: Ctx, userId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionHours * 3600_000).toISOString();
  db.prepare('INSERT INTO user_sessions (token_hash, user_id, expires_at, ip_hash) VALUES (?, ?, ?, ?)')
    .run(sha256(token), userId, expires, hashIp(ctx.ip));
  setCookie(ctx.res, SESSION_COOKIE, token, { maxAge: config.sessionHours * 3600, secure: isSecure(ctx) });
}

export function destroySession(ctx: Ctx) {
  const token = parseCookies(ctx.req)[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(sha256(token));
  setCookie(ctx.res, SESSION_COOKIE, '', { maxAge: 0, secure: isSecure(ctx) });
}

export function getUser(ctx: Ctx): SessionUser | null {
  const token = parseCookies(ctx.req)[SESSION_COOKIE];
  if (!token || token.length > 100) return null;
  const hash = sha256(token);
  const row = db.prepare(`
    SELECT s.token_hash, s.expires_at, u.id, u.username AS name, u.edition, u.role, u.blocked
    FROM user_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?`).get(hash) as
    | { token_hash: string; expires_at: string; id: number; name: string; edition: string | null; role: string; blocked: number } | undefined;
  if (!row || !safeEqual(row.token_hash, hash)) return null;
  if (row.expires_at < nowIso() || row.blocked) {
    db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(hash);
    return null;
  }
  return { id: Number(row.id), name: row.name, edition: row.edition === 'bedrock' ? 'bedrock' : row.edition === 'java' ? 'java' : null, role: row.role === 'admin' ? 'admin' : 'customer' };
}

/** Jeder Shop-Zugriff erfordert eine Anmeldung. */
export function requireUser(ctx: Ctx): SessionUser {
  const user = getUser(ctx);
  if (!user) throw new HttpError(401, 'Bitte melde dich mit deinem Minecraft-Namen an.');
  ctx.user = user;
  return user;
}

export function requireAdmin(ctx: Ctx): SessionUser {
  const user = requireUser(ctx);
  if (user.role !== 'admin') throw new HttpError(403, 'Nur Administratoren haben hierauf Zugriff.');
  return user;
}

export function adminCount(): number {
  return Number((db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND blocked = 0 AND password_hash IS NOT NULL").get() as { n: number }).n);
}

/**
 * Ersteinrichtung ist nur direkt am Server-PC erlaubt (localhost, ohne Proxy),
 * damit niemand aus dem Internet den Shop vor dir in Besitz nehmen kann.
 */
export function isLocalRequest(ctx: Ctx) {
  const remote = ctx.req.socket.remoteAddress || '';
  const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  const forwarded = !!(ctx.req.headers['x-forwarded-for'] || ctx.req.headers['x-real-ip'] || ctx.req.headers.forwarded);
  const host = (ctx.req.headers.host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return loopback && !forwarded && ['localhost', '127.0.0.1', '::1'].includes(host);
}

// Abgelaufene Sitzungen stündlich entfernen
setInterval(() => {
  db.prepare('DELETE FROM user_sessions WHERE expires_at < ?').run(nowIso());
}, 3600_000).unref();
