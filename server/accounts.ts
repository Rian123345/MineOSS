import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { db, tx, nowIso } from './db';
import { HttpError, parseCookies, readJson, type Ctx, type Router } from './http';
import {
  createSession, destroySession, getUser, requireUser, adminCount, isLocalRequest, isSecure,
  hashPassword, verifyPassword, getDummyHash, passwordProblem,
} from './auth';
import { enforceRateLimit, rateLimit, resetRateLimit, safeEqual, sha256, randomString } from './security';
import { registerSchema, loginSchema, passwordChangeSchema } from './validation';
import { MINEOS_VERSION, BUILD_ID } from './version';

/**
 * Konten: Anmeldung mit Minecraft-Name + Passwort.
 * Das erste Konto, das am Server-PC (oder mit Einrichtungscode) erstellt wird, ist der Administrator.
 */

/* ─────────── Einrichtungscode (Besitzer-Konto von jedem Gerät aus anlegen) ─────────── */

const SETUP_COOKIE = 'mineos_setup';
const setupFile = path.join(config.dataDir, 'EINRICHTUNGSCODE.txt');
let setupCode: string | null = null;
const setupTokens = new Set<string>();

export function ensureSetupCode() {
  if (adminCount() > 0) { clearSetupCode(); return null; }
  if (!setupCode) {
    // Eigener Code per Umgebungsvariable (z. B. bei Render), sonst zufällig
    const fromEnv = (process.env.MINEOS_SETUP_CODE || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    setupCode = fromEnv.length >= 6 && fromEnv.length <= 40 ? fromEnv : randomString(8, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    try {
      fs.writeFileSync(setupFile, `MineOS – Einrichtungscode\n\n    ${setupCode}\n\nNur nötig, wenn du MineOS nicht über http://localhost öffnest.\nWer diesen Code eingibt und danach ein Konto erstellt, wird Administrator.\n`);
    } catch { /* Datei optional */ }
  }
  return setupCode;
}

function clearSetupCode() {
  setupCode = null;
  setupTokens.clear();
  try { fs.rmSync(setupFile, { force: true }); } catch { /* egal */ }
}

/** Wird das nächste Konto Administrator? (noch kein Admin + am Server-PC oder mit Code) */
export function canSetup(ctx: Ctx) {
  if (adminCount() > 0) return false;
  if (isLocalRequest(ctx)) return true;
  const t = parseCookies(ctx.req)[SETUP_COOKIE];
  return !!t && setupTokens.has(sha256(t));
}

async function submitSetupCode(ctx: Ctx) {
  enforceRateLimit(ctx, 'setupcode', 8, 15 * 60_000, 'Zu viele Versuche. Bitte warte 15 Minuten.');
  if (adminCount() > 0) throw new HttpError(409, 'MineOS ist bereits eingerichtet.');
  const body = (await readJson(ctx, 1024)) as { code?: unknown };
  const given = String(body.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const code = ensureSetupCode();
  if (!code || given.length !== code.length || !safeEqual(given, code)) throw new HttpError(400, 'Der Einrichtungscode ist falsch.');
  const token = crypto.randomBytes(32).toString('base64url');
  setupTokens.add(sha256(token));
  ctx.res.setHeader('Set-Cookie', [`${SETUP_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200${isSecure(ctx) ? '; Secure' : ''}`]);
  return { ok: true };
}

/* ─────────── Routen ─────────── */

function status(ctx: Ctx) {
  return {
    version: MINEOS_VERSION,
    build: BUILD_ID,
    user: getUser(ctx),
    noAdmin: adminCount() === 0,
    setupAllowed: canSetup(ctx),
    isLocal: isLocalRequest(ctx),
  };
}

async function register(ctx: Ctx) {
  enforceRateLimit(ctx, 'register', 10, 60 * 60_000, 'Zu viele neue Konten von dieser Verbindung. Bitte später erneut versuchen.');
  const input = registerSchema.parse(await readJson(ctx, 4096));
  const problem = passwordProblem(input.password, input.username);
  if (problem) throw new HttpError(400, problem, { field: 'password' });
  const hash = await hashPassword(input.password);
  const becomeAdmin = canSetup(ctx);

  const id = tx(() => {
    if (db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(input.username)) {
      throw new HttpError(409, 'Dieser Minecraft-Name ist bereits registriert. Melde dich stattdessen an.', { field: 'username' });
    }
    const role = becomeAdmin && adminCount() === 0 ? 'admin' : 'customer';
    return Number(db.prepare(`INSERT INTO users (ms_id, name, username, password_hash, edition, role, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(`local:${input.username.toLowerCase()}`, input.username, input.username, hash, input.edition, role, nowIso()).lastInsertRowid);
  });
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string };
  if (user.role === 'admin') {
    console.log(`[konten] ${input.username} ist jetzt Administrator (Besitzer).`);
    clearSetupCode();
  }
  createSession(ctx, id);
  ctx.res.statusCode = 201;
  return { ok: true, role: user.role };
}

async function login(ctx: Ctx) {
  enforceRateLimit(ctx, 'login', 10, 15 * 60_000, 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.');
  const input = loginSchema.parse(await readJson(ctx, 4096));
  const perUser = rateLimit(`login-user:${input.username.toLowerCase()}`, 15, 15 * 60_000);
  if (!perUser.ok) throw new HttpError(429, 'Dieses Konto ist vorübergehend gesperrt. Bitte in 15 Minuten erneut versuchen.');
  const row = db.prepare('SELECT id, password_hash, blocked FROM users WHERE username = ? COLLATE NOCASE').get(input.username) as
    | { id: number; password_hash: string | null; blocked: number } | undefined;
  const ok = row?.password_hash ? await verifyPassword(input.password, row.password_hash) : (await verifyPassword(input.password, await getDummyHash()), false);
  if (!row || !ok) throw new HttpError(401, 'Minecraft-Name oder Passwort ist falsch.');
  if (row.blocked) throw new HttpError(403, 'Dieses Konto wurde für den Shop gesperrt.');
  resetRateLimit('login', ctx.ip);
  // Gibt es noch keinen Admin (z. B. nach Umstieg von einer alten Version), wird der Betreiber am Server-PC Admin
  if (canSetup(ctx)) {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(row.id);
    clearSetupCode();
  }
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), row.id);
  createSession(ctx, Number(row.id));
  return { ok: true };
}

async function changePassword(ctx: Ctx) {
  const user = requireUser(ctx);
  enforceRateLimit(ctx, 'pwchange', 8, 15 * 60_000);
  const input = passwordChangeSchema.parse(await readJson(ctx, 4096));
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string | null };
  if (!(await verifyPassword(input.currentPassword, row.password_hash))) {
    throw new HttpError(400, 'Das aktuelle Passwort ist falsch.', { field: 'currentPassword' });
  }
  const problem = passwordProblem(input.newPassword, user.name);
  if (problem) throw new HttpError(400, problem, { field: 'newPassword' });
  const hash = await hashPassword(input.newPassword);
  tx(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(user.id);
  });
  createSession(ctx, user.id);
  return { ok: true };
}

function logout(ctx: Ctx) {
  destroySession(ctx);
  return { ok: true };
}

export function registerAccountRoutes(r: Router) {
  r.get('/api/auth/status', status);
  r.post('/api/auth/register', register);
  r.post('/api/auth/login', login);
  r.post('/api/auth/logout', logout);
  r.post('/api/auth/password', changePassword);
  r.post('/api/auth/setup-code', submitSetupCode);
}
