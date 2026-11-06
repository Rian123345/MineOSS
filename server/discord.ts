import { config } from './config';
import { db, getSetting } from './db';
import type { Order } from '../shared/types';
import { EDITION_LABELS, STATUS_LABELS, type OrderStatus } from '../shared/constants';

/** Einstellungen: Werte aus der .env haben Vorrang, sonst die in der Shop-Verwaltung gespeicherten. */
export function discordConfig() {
  const fromEnv = !!config.discordWebhookUrl;
  return {
    webhookUrl: config.discordWebhookUrl || getSetting('discord_webhook_url') || '',
    mention: process.env.DISCORD_MENTION !== undefined && fromEnv ? config.discordMention : (getSetting('discord_mention') ?? '@here'),
    notifyStatus: fromEnv ? config.discordNotifyStatus : getSetting('discord_notify_status') === '1',
    fromEnv,
  };
}

const STATUS_EMBED_COLORS: Record<OrderStatus, number> = {
  new: 0x2f7fd8,
  accepted: 0x7a4fd0,
  farming: 0xd98b16,
  ready: 0x1f9e5a,
  completed: 0x4a7a2a,
  cancelled: 0xc0392b,
};

import { formatMoney } from '../shared/money';
const euro = formatMoney;

/** Verhindert Formatierungs-Tricks in Kundeneingaben. */
function esc(s: string): string {
  return s.replace(/([\\*_~`|>#\[\]()-])/g, '\\$1').replace(/@/g, '@\u200b');
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function allowedMentions() {
  const m = discordConfig().mention;
  if (!m) return { parse: [] as string[] };
  if (m === '@here' || m === '@everyone') return { parse: ['everyone'] };
  const user = /^<@!?(\d+)>$/.exec(m);
  if (user) return { parse: [] as string[], users: [user[1]] };
  const role = /^<@&(\d+)>$/.exec(m);
  if (role) return { parse: [] as string[], roles: [role[1]] };
  return { parse: [] as string[] };
}

function itemFields(order: Order) {
  const lines = order.items.map(
    (i) => `\`${i.quantity}×\` **${esc(i.productName)}** · ${esc(i.unitLabel)} — ${euro(i.lineTotalCents)}`,
  );
  const fields: { name: string; value: string; inline: boolean }[] = [];
  let chunk = '';
  for (const line of lines) {
    if ((chunk + '\n' + line).length > 1000) {
      fields.push({ name: fields.length ? 'Items (Fortsetzung)' : '📦 Bestellte Items', value: chunk, inline: false });
      chunk = line;
    } else {
      chunk = chunk ? chunk + '\n' + line : line;
    }
  }
  if (chunk) fields.push({ name: fields.length ? 'Items (Fortsetzung)' : '📦 Bestellte Items', value: chunk, inline: false });
  return fields.slice(0, 10);
}

function adminLink(order: Order) {
  return config.publicUrl ? `${config.publicUrl}/#admin/orders/${order.id}` : undefined;
}

export function buildNewOrderPayload(order: Order) {
  const unix = Math.floor(new Date(order.createdAt).getTime() / 1000);
  const fields = [
    { name: '🧾 Bestellnummer', value: `**${order.orderNumber}**`, inline: true },
    { name: '🎮 Spielername', value: esc(order.playerName), inline: true },
    { name: '🧩 Edition', value: EDITION_LABELS[order.edition], inline: true },
    ...itemFields(order),
    { name: '🔢 Gesamtmenge', value: `${order.items.reduce((s, i) => s + i.quantity, 0)} Einheiten in ${order.items.length} Position(en)`, inline: true },
    { name: '💰 Gesamtpreis (Ingame-Geld)', value: `**${euro(order.totalCents)}**`, inline: true },
    { name: '🕒 Bestellt am', value: `<t:${unix}:F> (<t:${unix}:R>)`, inline: false },
  ];
  if (order.discordName) fields.push({ name: '💬 Discord', value: esc(order.discordName), inline: true });
  if (order.accountName) fields.push({ name: '🪪 Shop-Konto', value: esc(order.accountName), inline: true });
  if (order.deliveryTime) fields.push({ name: '📅 Gewünschte Übergabe', value: esc(truncate(order.deliveryTime, 200)), inline: true });
  if (order.notes) fields.push({ name: '📝 Zusätzliche Informationen', value: esc(truncate(order.notes, 1000)), inline: false });

  return {
    username: 'MineOS Store',
    content: `${discordConfig().mention ? discordConfig().mention + ' ' : ''}🛒 **Neue Bestellung eingegangen!** \`${order.orderNumber}\` von **${esc(order.playerName)}** über **${euro(order.totalCents)}**`,
    allowed_mentions: allowedMentions(),
    embeds: [
      {
        title: `Neue Bestellung ${order.orderNumber}`,
        url: adminLink(order),
        description: 'Eine neue Bestellung wartet auf Bearbeitung. Öffne die **Shop-Verwaltung** in MineOS, um sie anzunehmen.',
        color: STATUS_EMBED_COLORS.new,
        fields: fields.slice(0, 25),
        footer: { text: 'MineOS · Minecraft Store' },
        timestamp: order.createdAt,
      },
    ],
  };
}

export function buildStatusPayload(order: Order, note: string | null) {
  return {
    username: 'MineOS Store',
    allowed_mentions: { parse: [] as string[] },
    embeds: [
      {
        title: `Bestellung ${order.orderNumber}: ${STATUS_LABELS[order.status]}`,
        url: adminLink(order),
        color: STATUS_EMBED_COLORS[order.status],
        fields: [
          { name: 'Spieler', value: esc(order.playerName), inline: true },
          { name: 'Gesamtpreis', value: euro(order.totalCents), inline: true },
          { name: 'Neuer Status', value: STATUS_LABELS[order.status], inline: true },
          ...(note ? [{ name: 'Notiz', value: esc(truncate(note, 500)), inline: false }] : []),
        ],
        footer: { text: 'MineOS · Statusänderung' },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendWebhook(payload: unknown): Promise<{ ok: boolean; message: string }> {
  const url = discordConfig().webhookUrl;
  if (!url) return { ok: false, message: 'Kein Discord-Webhook eingerichtet (Shop-Verwaltung → Einstellungen).' };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'wait=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return { ok: true, message: 'gesendet' };
      if (res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
        await sleep(Math.min(10_000, Math.ceil((body.retry_after ?? 1) * 1000)));
        continue;
      }
      const text = await res.text().catch(() => '');
      if (res.status >= 500 && attempt < 3) { await sleep(1000 * attempt); continue; }
      return { ok: false, message: `HTTP ${res.status} ${truncate(text, 200)}` };
    } catch (err) {
      if (attempt === 3) return { ok: false, message: `Netzwerkfehler: ${(err as Error).message}` };
      await sleep(1000 * attempt);
    }
  }
  return { ok: false, message: 'Rate-Limit von Discord' };
}

export async function notifyNewOrder(order: Order) {
  if (!discordConfig().webhookUrl) {
    db.prepare('UPDATE orders SET discord_status = ? WHERE id = ?').run('nicht eingerichtet', order.id);
    return;
  }
  const r = await sendWebhook(buildNewOrderPayload(order));
  db.prepare('UPDATE orders SET discord_status = ? WHERE id = ?').run(r.ok ? 'gesendet' : `Fehler: ${r.message}`, order.id);
  if (!r.ok) console.warn(`[discord] Benachrichtigung für ${order.orderNumber} fehlgeschlagen: ${r.message}`);
}

export async function notifyStatusChange(order: Order, note: string | null) {
  const d = discordConfig();
  if (!d.webhookUrl || !d.notifyStatus) return;
  const r = await sendWebhook(buildStatusPayload(order, note));
  if (!r.ok) console.warn(`[discord] Statusmeldung für ${order.orderNumber} fehlgeschlagen: ${r.message}`);
}

if (config.discordWebhookUrl && !/^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/.test(config.discordWebhookUrl)) {
  console.warn('[discord] Hinweis: DISCORD_WEBHOOK_URL sieht nicht wie eine Discord-Webhook-URL aus.');
}
