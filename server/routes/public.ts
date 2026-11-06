import { db, tx, nowIso } from '../db';
import { config } from '../config';
import { HttpError, readJson, type Router, type Ctx } from '../http';
import { enforceRateLimit, hashIp, randomString, safeEqual, sha256 } from '../security';
import { orderSchema, trackSchema } from '../validation';
import { mapCategory, mapProduct, getOrderById, getOrderItems, getOrderHistory, attachItems } from '../repo';
import { broadcast } from '../events';
import { notifyNewOrder } from '../discord';
import { ACCESS_CODE_ALPHABET } from '../../shared/constants';
import { formatMoney } from '../../shared/money';
import { MINEOS_VERSION, BUILD_ID } from '../version';
import { requireUser } from '../auth';
import type { OrderCreated, PublicOrderView } from '../../shared/types';

type Row = Record<string, unknown>;

const MAX_ORDER_TOTAL_CENTS = 100_000_000_000; // $1.000.000.000 Obergrenze je Bestellung (Ingame-Geld)
const MAX_OPEN_ORDERS_PER_PLAYER = 3;

function getCatalog() {
  const categories = (db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
    FROM categories c WHERE c.active = 1 ORDER BY c.sort_order, c.name`).all() as Row[]).map(mapCategory);
  const products = (db.prepare(`
    SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1 AND c.active = 1 ORDER BY c.sort_order, p.name`).all() as Row[]).map(mapProduct);
  return { categories, products, topProductIds: topProductIds() };
}

/**
 * „Meist gekaufte Sachen“: automatisch aus den Bestellungen berechnet
 * (nicht stornierte Bestellungen; zuerst nach Anzahl Bestellungen, dann nach Menge).
 * Solange es noch wenige Bestellungen gibt, wird mit als „Beliebt“ markierten Produkten aufgefüllt.
 */
const TOP_LIMIT = 12;
function topProductIds(): number[] {
  const sold = (db.prepare(`
    SELECT oi.product_id AS id FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE o.status != 'cancelled' AND p.active = 1 AND c.active = 1
    GROUP BY oi.product_id
    ORDER BY COUNT(DISTINCT oi.order_id) DESC, SUM(oi.quantity) DESC, p.name
    LIMIT ?`).all(TOP_LIMIT) as { id: number }[]).map((r) => Number(r.id));
  if (sold.length < TOP_LIMIT) {
    const pinned = db.prepare(`
      SELECT p.id FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.featured = 1 AND p.active = 1 AND c.active = 1 ORDER BY p.name`).all() as { id: number }[];
    for (const r of pinned) if (sold.length < TOP_LIMIT && !sold.includes(Number(r.id))) sold.push(Number(r.id));
  }
  return sold;
}

function newOrderNumber(): string {
  for (let i = 0; i < 20; i++) {
    const n = 'MC-' + randomString(6, ACCESS_CODE_ALPHABET);
    if (!db.prepare('SELECT 1 FROM orders WHERE order_number = ?').get(n)) return n;
  }
  throw new HttpError(500, 'Bestellnummer konnte nicht erzeugt werden.');
}

export function newAccessCode(): string {
  return randomString(10, ACCESS_CODE_ALPHABET);
}

async function createOrder(ctx: Ctx) {
  const user = requireUser(ctx);
  enforceRateLimit(ctx, 'order', config.orderRateLimit, 10 * 60_000,
    'Du hast in kurzer Zeit zu viele Bestellungen aufgegeben. Bitte warte ein paar Minuten.');
  const input = orderSchema.parse(await readJson(ctx));

  if (input.website) throw new HttpError(400, 'Die Bestellung wurde als Spam erkannt.');
  if (input.formStartedAt && Date.now() - input.formStartedAt < 2500) {
    throw new HttpError(400, 'Das ging etwas zu schnell. Bitte prüfe deine Angaben und sende erneut.');
  }

  const openForPlayer = Number((db.prepare(
    "SELECT COUNT(*) AS n FROM orders WHERE player_name = ? COLLATE NOCASE AND status = 'new'",
  ).get(input.playerName) as { n: number }).n);
  if (openForPlayer >= MAX_OPEN_ORDERS_PER_PLAYER) {
    throw new HttpError(429, `Für ${input.playerName} gibt es bereits ${openForPlayer} unbearbeitete Bestellungen. Bitte warte, bis diese angenommen wurden.`);
  }

  const accessCode = newAccessCode();
  const orderNumber = newOrderNumber();
  const createdAt = nowIso();

  const orderId = tx(() => {
    // Preise, Verfügbarkeit und Mengen werden ausschließlich serverseitig aus der DB bestimmt
    const lines = input.items.map((line) => {
      const p = db.prepare(`
        SELECT p.*, c.active AS category_active FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.id = ?`).get(line.productId) as Row | undefined;
      if (!p || !p.active || !p.category_active) {
        throw new HttpError(409, 'Ein Produkt in deinem Warenkorb ist nicht mehr verfügbar. Bitte aktualisiere den Warenkorb.', { productId: line.productId });
      }
      const product = mapProduct(p);
      if (line.quantity < product.minQty || line.quantity > product.maxQty) {
        throw new HttpError(409, `Für „${product.name}“ sind ${product.minQty}–${product.maxQty} Einheiten bestellbar.`, { productId: product.id });
      }
      if (product.stock !== null && line.quantity > product.stock) {
        throw new HttpError(409, `Von „${product.name}“ sind nur noch ${product.stock} Einheiten verfügbar.`, { productId: product.id, stock: product.stock });
      }
      return { product, quantity: line.quantity, lineTotal: product.priceCents * line.quantity };
    });

    const total = lines.reduce((s, l) => s + l.lineTotal, 0);
    if (total > MAX_ORDER_TOTAL_CENTS) {
      throw new HttpError(400, 'Der Bestellwert ist zu hoch. Bitte teile die Bestellung auf oder kontaktiere uns.');
    }
    const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

    const r = db.prepare(`
      INSERT INTO orders (order_number, access_hash, player_name, edition, discord_name, delivery_time, notes,
                          status, total_cents, item_count, ip_hash, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)`).run(
      orderNumber, sha256(accessCode), input.playerName, input.edition, input.discordName, input.deliveryTime,
      input.notes, total, itemCount, hashIp(ctx.ip), user.id, createdAt, createdAt,
    );
    const id = Number(r.lastInsertRowid);
    const insItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_label, unit_price_cents, quantity, line_total_cents, icon, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL');
    for (const l of lines) {
      insItem.run(id, l.product.id, l.product.name, l.product.unitLabel, l.product.priceCents, l.quantity, l.lineTotal, l.product.icon, l.product.imageUrl);
      decStock.run(l.quantity, l.product.id);
    }
    db.prepare("INSERT INTO order_status_history (order_id, status, note, created_at) VALUES (?, 'new', NULL, ?)").run(id, createdAt);
    db.prepare("INSERT INTO notifications (type, order_id, title, body, created_at) VALUES ('order.created', ?, ?, ?, ?)")
      .run(id, `Neue Bestellung ${orderNumber}`, `${input.playerName} hat ${lines.length} Position(en) für ${formatMoney(total)} bestellt.`, createdAt);
    return id;
  });

  const order = getOrderById(orderId)!;
  broadcast('order.created', order);
  void notifyNewOrder(order).catch((e) => console.error('[discord]', e));

  const result: OrderCreated = {
    orderNumber,
    accessCode,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    items: order.items,
  };
  ctx.res.statusCode = 201;
  return result;
}

function publicView(row: Row): PublicOrderView {
  const id = Number(row.id);
  return {
    orderNumber: String(row.order_number),
    playerName: String(row.player_name),
    edition: row.edition as PublicOrderView['edition'],
    status: row.status as PublicOrderView['status'],
    totalCents: Number(row.total_cents),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deliveryTime: (row.delivery_time as string | null) ?? null,
    items: getOrderItems(id),
    history: getOrderHistory(id),
  };
}

/** Bestellungen des angemeldeten Kontos – ganz ohne Zugriffscode */
function myOrders(ctx: Ctx) {
  const user = requireUser(ctx);
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(user.id) as Row[];
  const last = rows[0];
  return {
    orders: attachItems(rows).map((o) => ({
      orderNumber: o.orderNumber, status: o.status, totalCents: o.totalCents, createdAt: o.createdAt, playerName: o.playerName, items: o.items,
    })),
    lastDetails: last
      ? { playerName: String(last.player_name), edition: String(last.edition), discordName: (last.discord_name as string | null) ?? '' }
      : { playerName: user.name.replace(/^[.*]/, ''), edition: user.edition ?? '', discordName: '' },
  };
}

function myOrder(ctx: Ctx): PublicOrderView {
  const user = requireUser(ctx);
  const row = db.prepare('SELECT * FROM orders WHERE order_number = ? AND user_id = ?').get(String(ctx.params.number).toUpperCase(), user.id) as Row | undefined;
  if (!row) throw new HttpError(404, 'Bestellung nicht gefunden.');
  return publicView(row);
}

async function trackOrder(ctx: Ctx): Promise<PublicOrderView> {
  requireUser(ctx);
  enforceRateLimit(ctx, 'track', 30, 10 * 60_000);
  const input = trackSchema.parse(await readJson(ctx, 4096));
  const row = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(input.orderNumber) as Row | undefined;
  // Immer hashen, damit die Antwortzeit nichts verrät
  const given = sha256(input.accessCode);
  if (!row || !safeEqual(String(row.access_hash), given)) {
    throw new HttpError(404, 'Keine Bestellung mit dieser Nummer und diesem Zugriffscode gefunden.');
  }
  return publicView(row);
}

export function registerPublicRoutes(r: Router) {
  r.get('/api/health', () => ({ ok: true, app: 'MineOS', version: MINEOS_VERSION, build: BUILD_ID, time: nowIso() }));
  r.get('/api/catalog', (ctx) => { requireUser(ctx); return getCatalog(); });
  r.get('/api/me/orders', myOrders);
  r.get('/api/me/orders/:number', myOrder);
  r.post('/api/orders', createOrder);
  r.post('/api/orders/track', trackOrder);
}
