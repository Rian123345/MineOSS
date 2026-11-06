import { db } from './db';
import type { Category, Order, OrderItem, Product, StatusEntry, AdminNotification } from '../shared/types';
import type { Edition, OrderStatus } from '../shared/constants';

type Row = Record<string, unknown>;

export function mapCategory(r: Row): Category {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    description: String(r.description ?? ''),
    nameEn: (r.name_en as string | null) || null,
    descriptionEn: (r.description_en as string | null) || null,
    icon: String(r.icon),
    sortOrder: Number(r.sort_order),
    active: Boolean(r.active),
    productCount: r.product_count === undefined ? undefined : Number(r.product_count),
  };
}

export function mapProduct(r: Row): Product {
  return {
    id: Number(r.id),
    categoryId: Number(r.category_id),
    name: String(r.name),
    description: String(r.description ?? ''),
    nameEn: (r.name_en as string | null) || null,
    descriptionEn: (r.description_en as string | null) || null,
    priceCents: Number(r.price_cents),
    unitLabel: String(r.unit_label),
    stock: r.stock === null || r.stock === undefined ? null : Number(r.stock),
    minQty: Number(r.min_qty),
    maxQty: Number(r.max_qty),
    icon: String(r.icon),
    imageUrl: (r.image_url as string | null) ?? null,
    active: Boolean(r.active),
    featured: Boolean(r.featured),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapItem(r: Row): OrderItem {
  return {
    productId: r.product_id === null ? null : Number(r.product_id),
    productName: String(r.product_name),
    unitLabel: String(r.unit_label),
    unitPriceCents: Number(r.unit_price_cents),
    quantity: Number(r.quantity),
    lineTotalCents: Number(r.line_total_cents),
    icon: (r.icon as string) ?? 'chest',
    imageUrl: (r.image_url as string | null) ?? null,
  };
}

export function mapOrder(r: Row, items: OrderItem[] = [], history?: StatusEntry[]): Order {
  return {
    id: Number(r.id),
    orderNumber: String(r.order_number),
    playerName: String(r.player_name),
    edition: r.edition as Edition,
    discordName: (r.discord_name as string | null) ?? null,
    deliveryTime: (r.delivery_time as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    status: r.status as OrderStatus,
    totalCents: Number(r.total_cents),
    itemCount: Number(r.item_count),
    adminNote: (r.admin_note as string | null) ?? null,
    discordStatus: (r.discord_status as string | null) ?? null,
    userId: r.user_id == null ? null : Number(r.user_id),
    accountName: (r.account_name as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    items,
    history,
  };
}

export function mapNotification(r: Row): AdminNotification {
  return {
    id: Number(r.id),
    type: String(r.type),
    orderId: r.order_id === null ? null : Number(r.order_id),
    title: String(r.title),
    body: String(r.body),
    read: Boolean(r.read),
    createdAt: String(r.created_at),
  };
}

export function getOrderItems(orderId: number): OrderItem[] {
  return (db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(orderId) as Row[]).map(mapItem);
}

export function getOrderHistory(orderId: number): StatusEntry[] {
  return (db.prepare('SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY id').all(orderId) as Row[])
    .map((r) => ({ status: r.status as OrderStatus, note: (r.note as string | null) ?? null, createdAt: String(r.created_at) }));
}

export function getOrderById(id: number, withHistory = true): Order | null {
  const r = db.prepare('SELECT *, (SELECT username FROM users WHERE users.id = orders.user_id) AS account_name FROM orders WHERE id = ?').get(id) as Row | undefined;
  if (!r) return null;
  return mapOrder(r, getOrderItems(id), withHistory ? getOrderHistory(id) : undefined);
}

/** Lädt Positionen für viele Bestellungen in einer Abfrage. */
export function attachItems(rows: Row[]): Order[] {
  if (!rows.length) return [];
  const ids = rows.map((r) => Number(r.id));
  const items = db.prepare(`SELECT * FROM order_items WHERE order_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).all(...ids) as Row[];
  const byOrder = new Map<number, OrderItem[]>();
  for (const it of items) {
    const k = Number(it.order_id);
    if (!byOrder.has(k)) byOrder.set(k, []);
    byOrder.get(k)!.push(mapItem(it));
  }
  return rows.map((r) => mapOrder(r, byOrder.get(Number(r.id)) || []));
}

export function getProduct(id: number): Product | null {
  const r = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Row | undefined;
  return r ? mapProduct(r) : null;
}

export function getCategory(id: number): Category | null {
  const r = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Row | undefined;
  return r ? mapCategory(r) : null;
}
