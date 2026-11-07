import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, tx, nowIso, setSetting, getSetting } from '../db';
import { config } from '../config';
import { HttpError, readJson, type Router, type Ctx } from '../http';
import { requireAdmin, adminCount, hashPassword } from '../auth';
import { enforceRateLimit, sha256, randomString } from '../security';
import {
  statusUpdateSchema, productSchema, productPatchSchema,
  categorySchema, uploadSchema, slugify, discordSettingsSchema, userPatchSchema,
} from '../validation';
import { attachItems, getOrderById, mapCategory, mapNotification, mapProduct, getProduct, getCategory } from '../repo';
import { addClient, broadcast, clientCount } from '../events';
import { notifyStatusChange, sendWebhook, buildNewOrderPayload, discordConfig } from '../discord';
import { newAccessCode } from './public';
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from '../../shared/constants';
import type { DashboardStats, Order } from '../../shared/types';

type Row = Record<string, unknown>;

/* ───────────── Discord-Einstellungen (serverseitig gespeichert) ───────────── */

function maskUrl(u: string) {
  const m = /^(https:\/\/[^/]+\/api\/webhooks\/\d+\/)(.+)$/.exec(u);
  return m ? `${m[1]}${'•'.repeat(8)}${m[2].slice(-4)}` : '••••••••';
}

function getDiscordSettings(ctx: Ctx) {
  requireAdmin(ctx);
  const d = discordConfig();
  return {
    configured: !!d.webhookUrl,
    maskedUrl: d.webhookUrl ? maskUrl(d.webhookUrl) : null,
    mention: d.mention,
    notifyStatus: d.notifyStatus,
    notifySupport: getSetting('discord_notify_support') !== '0',
    fromEnv: d.fromEnv,
  };
}

async function putDiscordSettings(ctx: Ctx) {
  requireAdmin(ctx);
  const input = discordSettingsSchema.parse(await readJson(ctx, 4096));
  if (input.webhookUrl !== undefined) setSetting('discord_webhook_url', input.webhookUrl ?? '');
  setSetting('discord_mention', input.mention);
  setSetting('discord_notify_status', input.notifyStatus ? '1' : '0');
  if (input.notifySupport !== undefined) setSetting('discord_notify_support', input.notifySupport ? '1' : '0');
  return getDiscordSettings(ctx);
}

/* ───────────── Benutzer (Shop-Konten) ───────────── */

function listUsers(ctx: Ctx) {
  requireAdmin(ctx);
  return (db.prepare(`
    SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
    FROM users u WHERE u.password_hash IS NOT NULL ORDER BY (u.role = 'admin') DESC, u.last_login_at DESC LIMIT 1000`).all() as Row[]).map((r) => ({
    id: Number(r.id), name: String(r.username), edition: (r.edition as 'java' | 'bedrock' | null) ?? null,
    role: String(r.role), blocked: Boolean(r.blocked), orderCount: Number(r.order_count),
    createdAt: String(r.created_at), lastLoginAt: (r.last_login_at as string | null) ?? null,
  }));
}

async function patchUser(ctx: Ctx) {
  const me = requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const input = userPatchSchema.parse(await readJson(ctx, 1024));
  const target = db.prepare('SELECT id, role, blocked FROM users WHERE id = ?').get(id) as Row | undefined;
  if (!target) throw new HttpError(404, 'Benutzer nicht gefunden.');
  const losesAdmin = target.role === 'admin' && (input.role === 'customer' || input.blocked === true);
  if (losesAdmin && adminCount() <= 1) throw new HttpError(409, 'Es muss mindestens ein Administrator bleiben.');
  if (id === me.id && (input.blocked || input.role === 'customer')) throw new HttpError(409, 'Du kannst dich nicht selbst sperren oder herabstufen.');
  let tempPassword: string | undefined;
  if (input.resetPassword) {
    tempPassword = randomString(10, 'abcdefghijkmnpqrstuvwxyz23456789');
    const hash = await hashPassword(tempPassword);
    tx(() => {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
      db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(id);
    });
  }
  tx(() => {
    if (input.role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(input.role, id);
    if (input.blocked !== undefined) {
      db.prepare('UPDATE users SET blocked = ? WHERE id = ?').run(input.blocked ? 1 : 0, id);
      if (input.blocked) db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(id);
    }
  });
  return { ok: true, tempPassword };
}

/* ───────────── Dashboard ───────────── */

function stats(ctx: Ctx): DashboardStats {
  requireAdmin(ctx);
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all() as Row[]) {
    byStatus[r.status as OrderStatus] = Number(r.n);
  }
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const rev = db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_cents END), 0) AS done,
      COALESCE(SUM(CASE WHEN status IN ('new','accepted','farming','ready') THEN total_cents END), 0) AS open
    FROM orders`).get() as Row;

  const since = new Date(Date.now() - 13 * 86400_000);
  since.setHours(0, 0, 0, 0);
  const days = db.prepare(`
    SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n, SUM(CASE WHEN status != 'cancelled' THEN total_cents ELSE 0 END) AS rev
    FROM orders WHERE created_at >= ? GROUP BY day`).all(since.toISOString()) as Row[];
  const dayMap = new Map(days.map((d) => [String(d.day), d]));
  const perDay = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400_000 + 12 * 3600_000).toISOString().slice(0, 10);
    const r = dayMap.get(d);
    return { day: d, count: r ? Number(r.n) : 0, revenueCents: r ? Number(r.rev) : 0 };
  });

  const recent = attachItems(db.prepare('SELECT *, (SELECT username FROM users WHERE users.id = orders.user_id) AS account_name FROM orders ORDER BY id DESC LIMIT 8').all() as Row[]);
  const topProducts = (db.prepare(`
    SELECT oi.product_name AS name, SUM(oi.quantity) AS q, SUM(oi.line_total_cents) AS rev
    FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status != 'cancelled'
    GROUP BY oi.product_name ORDER BY rev DESC LIMIT 5`).all() as Row[])
    .map((r) => ({ name: String(r.name), quantity: Number(r.q), revenueCents: Number(r.rev) }));

  return {
    total,
    byStatus,
    open: byStatus.new + byStatus.accepted + byStatus.farming + byStatus.ready,
    revenueCents: Number(rev.done),
    revenueOpenCents: Number(rev.open),
    perDay,
    recent,
    topProducts,
  };
}

/* ───────────── Bestellungen ───────────── */

function listOrders(ctx: Ctx) {
  requireAdmin(ctx);
  const status = ctx.url.searchParams.get('status') || '';
  const q = (ctx.url.searchParams.get('q') || '').trim().slice(0, 60);
  const limit = Math.min(200, Math.max(1, Number(ctx.url.searchParams.get('limit')) || 100));
  const offset = Math.max(0, Number(ctx.url.searchParams.get('offset')) || 0);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (status === 'open') where.push("status IN ('new','accepted','farming','ready')");
  else if (status) {
    if (!(ORDER_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, 'Unbekannter Status.');
    where.push('status = ?'); params.push(status);
  }
  if (q) {
    where.push('(order_number LIKE ? OR player_name LIKE ? OR discord_name LIKE ? OR user_id IN (SELECT id FROM users WHERE username LIKE ? OR name LIKE ?))');
    const like = `%${q.replace(/[%_\\]/g, (m) => '\\' + m)}%`;
    params.push(like, like, like, like, like);
  }
  const w = where.length ? 'WHERE ' + where.map((c) => c.replace(/LIKE \?/g, "LIKE ? ESCAPE '\\'")).join(' AND ') : '';
  const totalRow = db.prepare(`SELECT COUNT(*) AS n FROM orders ${w}`).get(...params) as Row;
  const rows = db.prepare(`SELECT *, (SELECT username FROM users WHERE users.id = orders.user_id) AS account_name FROM orders ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as Row[];
  return { total: Number(totalRow.n), orders: attachItems(rows) };
}

function getOrder(ctx: Ctx) {
  requireAdmin(ctx);
  const order = getOrderById(Number(ctx.params.id));
  if (!order) throw new HttpError(404, 'Bestellung nicht gefunden.');
  return order;
}

async function updateOrder(ctx: Ctx) {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const input = statusUpdateSchema.parse(await readJson(ctx, 8192));
  const before = getOrderById(id, false);
  if (!before) throw new HttpError(404, 'Bestellung nicht gefunden.');
  const now = nowIso();
  const statusChanged = before.status !== input.status;

  tx(() => {
    if (statusChanged) {
      // Lagerbestand bei Stornierung zurückbuchen bzw. bei Reaktivierung erneut abziehen
      if (input.status === 'cancelled') {
        for (const it of before.items) {
          if (it.productId) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL').run(it.quantity, it.productId);
        }
      } else if (before.status === 'cancelled') {
        for (const it of before.items) {
          if (it.productId) db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ? AND stock IS NOT NULL').run(it.quantity, it.productId);
        }
      }
      db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(input.status, now, id);
      db.prepare('INSERT INTO order_status_history (order_id, status, note, created_at) VALUES (?, ?, ?, ?)').run(id, input.status, input.note, now);
    } else if (input.note) {
      db.prepare('INSERT INTO order_status_history (order_id, status, note, created_at) VALUES (?, ?, ?, ?)').run(id, input.status, input.note, now);
      db.prepare('UPDATE orders SET updated_at = ? WHERE id = ?').run(now, id);
    }
    if (input.adminNote !== undefined) {
      db.prepare('UPDATE orders SET admin_note = ?, updated_at = ? WHERE id = ?').run(input.adminNote, now, id);
    }
  });

  const order = getOrderById(id)!;
  broadcast('order.updated', order);
  if (statusChanged) void notifyStatusChange(order, input.note).catch(() => {});
  return order;
}

function regenerateCode(ctx: Ctx) {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const code = newAccessCode();
  const r = db.prepare('UPDATE orders SET access_hash = ?, updated_at = ? WHERE id = ?').run(sha256(code), nowIso(), id);
  if (!r.changes) throw new HttpError(404, 'Bestellung nicht gefunden.');
  return { accessCode: code };
}

function deleteOrder(ctx: Ctx) {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const order = getOrderById(id, false);
  if (!order) throw new HttpError(404, 'Bestellung nicht gefunden.');
  if (!['cancelled', 'completed'].includes(order.status)) {
    throw new HttpError(409, 'Nur abgeschlossene oder stornierte Bestellungen können gelöscht werden.');
  }
  db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  broadcast('order.deleted', { id });
  return { ok: true };
}

/* ───────────── Produkte ───────────── */

function listProducts(ctx: Ctx) {
  requireAdmin(ctx);
  return (db.prepare('SELECT * FROM products ORDER BY category_id, name').all() as Row[]).map(mapProduct);
}

function productParams(p: ReturnType<typeof productSchema.parse>) {
  if (!getCategory(p.categoryId)) throw new HttpError(400, 'Kategorie existiert nicht.', { field: 'categoryId' });
  return [p.categoryId, p.name, p.description, p.priceCents, p.unitLabel, p.stock, p.minQty, p.maxQty, p.icon, p.imageUrl, p.active ? 1 : 0, p.featured ? 1 : 0, p.nameEn ?? null, p.descriptionEn ?? null] as const;
}

async function createProduct(ctx: Ctx) {
  requireAdmin(ctx);
  const p = productSchema.parse(await readJson(ctx));
  const r = db.prepare(`INSERT INTO products (category_id, name, description, price_cents, unit_label, stock, min_qty, max_qty, icon, image_url, active, featured, name_en, description_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...productParams(p));
  broadcast('catalog.changed', {});
  ctx.res.statusCode = 201;
  return getProduct(Number(r.lastInsertRowid));
}

async function updateProduct(ctx: Ctx) {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const p = productSchema.parse(await readJson(ctx));
  const r = db.prepare(`UPDATE products SET category_id = ?, name = ?, description = ?, price_cents = ?, unit_label = ?, stock = ?,
    min_qty = ?, max_qty = ?, icon = ?, image_url = ?, active = ?, featured = ?, name_en = ?, description_en = ?, updated_at = ? WHERE id = ?`)
    .run(...productParams(p), nowIso(), id);
  if (!r.changes) throw new HttpError(404, 'Produkt nicht gefunden.');
  broadcast('catalog.changed', {});
  return getProduct(id);
}

async function patchProduct(ctx: Ctx) {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const p = productPatchSchema.parse(await readJson(ctx, 4096));
  const current = getProduct(id);
  if (!current) throw new HttpError(404, 'Produkt nicht gefunden.');
  db.prepare('UPDATE products SET price_cents = ?, active = ?, stock = ?, updated_at = ? WHERE id = ?').run(
    p.priceCents ?? current.priceCents,
    (p.active ?? current.active) ? 1 : 0,
    p.stock === undefined ? current.stock : p.stock,
    nowIso(), id,
  );
  broadcast('catalog.changed', {});
  return getProduct(id);
}

function deleteProduct(ctx: Ctx) {
  requireAdmin(ctx);
  const r = db.prepare('DELETE FROM products WHERE id = ?').run(Number(ctx.params.id));
  if (!r.changes) throw new HttpError(404, 'Produkt nicht gefunden.');
  broadcast('catalog.changed', {});
  return { ok: true };
}

/* ───────────── Kategorien ───────────── */

function listCategories(ctx: Ctx) {
  requireAdmin(ctx);
  return (db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
    FROM categories c ORDER BY sort_order, name`).all() as Row[]).map(mapCategory);
}

function uniqueSlug(base: string, exceptId?: number) {
  let slug = base, i = 2;
  while (db.prepare('SELECT 1 FROM categories WHERE slug = ? AND id != ?').get(slug, exceptId ?? -1)) slug = `${base}-${i++}`;
  return slug;
}

async function createCategory(ctx: Ctx) {
  requireAdmin(ctx);
  const c = categorySchema.parse(await readJson(ctx, 8192));
  const slug = uniqueSlug(c.slug || slugify(c.name));
  const r = db.prepare('INSERT INTO categories (slug, name, description, icon, sort_order, active, name_en, description_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(slug, c.name, c.description, c.icon, c.sortOrder, c.active ? 1 : 0, c.nameEn ?? null, c.descriptionEn ?? null);
  broadcast('catalog.changed', {});
  ctx.res.statusCode = 201;
  return getCategory(Number(r.lastInsertRowid));
}

async function updateCategory(ctx: Ctx) {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const c = categorySchema.parse(await readJson(ctx, 8192));
  const slug = uniqueSlug(c.slug || slugify(c.name), id);
  const r = db.prepare('UPDATE categories SET slug = ?, name = ?, description = ?, icon = ?, sort_order = ?, active = ?, name_en = ?, description_en = ? WHERE id = ?')
    .run(slug, c.name, c.description, c.icon, c.sortOrder, c.active ? 1 : 0, c.nameEn ?? null, c.descriptionEn ?? null, id);
  if (!r.changes) throw new HttpError(404, 'Kategorie nicht gefunden.');
  broadcast('catalog.changed', {});
  return getCategory(id);
}

function deleteCategory(ctx: Ctx) {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const n = Number((db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ?').get(id) as Row).n);
  if (n > 0) throw new HttpError(409, `Die Kategorie enthält noch ${n} Produkt(e). Verschiebe oder lösche diese zuerst.`);
  const r = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  if (!r.changes) throw new HttpError(404, 'Kategorie nicht gefunden.');
  broadcast('catalog.changed', {});
  return { ok: true };
}

/* ───────────── Bild-Upload ───────────── */

const SIGNATURES: { ext: string; mime: string; test: (b: Buffer) => boolean }[] = [
  { ext: 'png', mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'gif', mime: 'image/gif', test: (b) => b.subarray(0, 6).toString('ascii').startsWith('GIF8') },
  { ext: 'webp', mime: 'image/webp', test: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
];

async function upload(ctx: Ctx) {
  requireAdmin(ctx);
  enforceRateLimit(ctx, 'upload', 30, 10 * 60_000);
  const { dataUrl } = uploadSchema.parse(await readJson(ctx, 3_100_000));
  const m = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new HttpError(400, 'Nur PNG, JPG, GIF oder WEBP erlaubt.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) throw new HttpError(413, 'Das Bild ist größer als 2 MB.');
  const sig = SIGNATURES.find((s) => s.test(buf));
  if (!sig) throw new HttpError(400, 'Die Datei ist kein gültiges Bild.');
  const name = `${crypto.randomBytes(16).toString('hex')}.${sig.ext}`;
  fs.writeFileSync(path.join(config.uploadDir, name), buf);
  ctx.res.statusCode = 201;
  return { url: `/uploads/${name}` };
}

/* ───────────── Benachrichtigungen ───────────── */

function listNotifications(ctx: Ctx) {
  requireAdmin(ctx);
  const items = (db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 50').all() as Row[]).map(mapNotification);
  const unread = Number((db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE read = 0').get() as Row).n);
  return { items, unread };
}

async function markRead(ctx: Ctx) {
  requireAdmin(ctx);
  const body = (await readJson(ctx, 8192)) as { ids?: unknown };
  if (Array.isArray(body.ids) && body.ids.length) {
    const ids = body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
    if (ids.length) db.prepare(`UPDATE notifications SET read = 1 WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  } else {
    db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
  }
  broadcast('notifications.read', {});
  return { ok: true };
}

function events(ctx: Ctx) {
  requireAdmin(ctx);
  addClient(ctx.res);
  return undefined; // Antwort bleibt offen
}

/* ───────────── System ───────────── */

async function discordTest(ctx: Ctx) {
  requireAdmin(ctx);
  enforceRateLimit(ctx, 'discordtest', 5, 60_000);
  const fake: Order = {
    id: 0, orderNumber: 'MC-TEST00', playerName: 'Steve', edition: 'java', discordName: 'steve',
    deliveryTime: 'Heute Abend ab 19 Uhr', notes: 'Dies ist eine Testnachricht aus der MineOS Shop-Verwaltung.',
    status: 'new', totalCents: 85000, itemCount: 3, adminNote: null, discordStatus: null,
    createdAt: nowIso(), updatedAt: nowIso(),
    items: [
      { productId: null, productName: 'Diamant', unitLabel: '1 Stück', unitPriceCents: 25000, quantity: 1, lineTotalCents: 25000 },
      { productId: null, productName: 'Eisenbarren', unitLabel: '1 Stack (64×)', unitPriceCents: 30000, quantity: 2, lineTotalCents: 60000 },
    ],
  };
  const payload = buildNewOrderPayload(fake);
  payload.content = '🧪 **Test** – So sehen Bestell-Benachrichtigungen von MineOS aus.';
  payload.allowed_mentions = { parse: [] };
  const r = await sendWebhook(payload);
  if (!r.ok) throw new HttpError(502, `Discord-Test fehlgeschlagen: ${r.message}`);
  return { ok: true };
}

function system(ctx: Ctx) {
  requireAdmin(ctx);
  return {
    discordConfigured: !!discordConfig().webhookUrl,
    discordNotifyStatus: discordConfig().notifyStatus,
    realtimeClients: clientCount(),
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    statuses: STATUS_LABELS,
  };
}

export function registerAdminRoutes(r: Router) {
  r.get('/api/admin/settings/discord', getDiscordSettings);
  r.put('/api/admin/settings/discord', putDiscordSettings);
  r.get('/api/admin/users', listUsers);
  r.patch('/api/admin/users/:id', patchUser);
  r.get('/api/admin/stats', stats);
  r.get('/api/admin/orders', listOrders);
  r.get('/api/admin/orders/:id', getOrder);
  r.patch('/api/admin/orders/:id', updateOrder);
  r.delete('/api/admin/orders/:id', deleteOrder);
  r.post('/api/admin/orders/:id/access-code', regenerateCode);
  r.get('/api/admin/products', listProducts);
  r.post('/api/admin/products', createProduct);
  r.put('/api/admin/products/:id', updateProduct);
  r.patch('/api/admin/products/:id', patchProduct);
  r.delete('/api/admin/products/:id', deleteProduct);
  r.get('/api/admin/categories', listCategories);
  r.post('/api/admin/categories', createCategory);
  r.put('/api/admin/categories/:id', updateCategory);
  r.delete('/api/admin/categories/:id', deleteCategory);
  r.post('/api/admin/upload', upload);
  r.get('/api/admin/notifications', listNotifications);
  r.post('/api/admin/notifications/read', markRead);
  r.get('/api/admin/events', events);
  r.post('/api/admin/discord-test', discordTest);
  r.get('/api/admin/system', system);
}
