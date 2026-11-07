import { z } from 'zod';
import { db, nowIso, tx } from '../db';
import { Router, HttpError, readJson, type Ctx } from '../http';
import { requireUser, requireAdmin } from '../auth';
import { enforceRateLimit } from '../security';
import { broadcast, addUserClient, sendToUser } from '../events';
import { notifySupportRequest } from '../discord';
import type { SupportMessage, SupportThread } from '../../shared/types';

/**
 * MineChat – Hilfe-Chat: Jeder Spieler hat genau einen Verlauf mit dem Support-Team.
 * Admins sehen alle Verläufe, antworten und markieren sie als erledigt.
 */

type Row = Record<string, unknown>;

const messageSchema = z.object({
  body: z.string().transform((s) => s.replace(/\r\n/g, '\n').trim()).pipe(
    z.string().min(1, 'Die Nachricht ist leer.').max(2000, 'Maximal 2000 Zeichen.'),
  ),
}).strict();
const statusSchema = z.object({ status: z.enum(['open', 'closed']) }).strict();

function mapMessage(r: Row): SupportMessage {
  return {
    id: Number(r.id),
    sender: r.sender as SupportMessage['sender'],
    authorName: (r.author_name as string | null) ?? null,
    body: String(r.body),
    createdAt: String(r.created_at),
  };
}

function mapThread(r: Row): SupportThread {
  return {
    id: Number(r.id),
    userId: Number(r.user_id),
    userName: String(r.user_name ?? ''),
    status: r.status as SupportThread['status'],
    userUnread: Number(r.user_unread),
    adminUnread: Number(r.admin_unread),
    lastMessageAt: String(r.last_message_at),
    lastMessage: (r.last_body as string | null) ?? null,
    lastSender: (r.last_sender as SupportMessage['sender'] | null) ?? null,
  };
}

const THREAD_SELECT = `
  SELECT t.*, u.username AS user_name,
    (SELECT body FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
    (SELECT sender FROM support_messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_sender
  FROM support_threads t JOIN users u ON u.id = t.user_id`;

function messagesOf(threadId: number): SupportMessage[] {
  return (db.prepare(`
    SELECT m.*, u.username AS author_name FROM support_messages m LEFT JOIN users u ON u.id = m.author_id
    WHERE m.thread_id = ? ORDER BY m.id DESC LIMIT 300`).all(threadId) as Row[]).reverse().map(mapMessage);
}

function threadById(id: number): SupportThread | null {
  const r = db.prepare(`${THREAD_SELECT} WHERE t.id = ?`).get(id) as Row | undefined;
  return r ? mapThread(r) : null;
}

/* ─────────── Spieler ─────────── */

function myThread(ctx: Ctx) {
  const user = requireUser(ctx);
  const r = db.prepare(`${THREAD_SELECT} WHERE t.user_id = ?`).get(user.id) as Row | undefined;
  if (!r) return { thread: null, messages: [] };
  const thread = mapThread(r);
  if (thread.userUnread) {
    db.prepare('UPDATE support_threads SET user_unread = 0 WHERE id = ?').run(thread.id);
    thread.userUnread = 0;
  }
  return { thread, messages: messagesOf(thread.id) };
}

function myUnread(ctx: Ctx) {
  const user = requireUser(ctx);
  const r = db.prepare('SELECT user_unread FROM support_threads WHERE user_id = ?').get(user.id) as { user_unread: number } | undefined;
  return { unread: Number(r?.user_unread ?? 0) };
}

async function sendMine(ctx: Ctx) {
  const user = requireUser(ctx);
  enforceRateLimit(ctx, 'support-msg', 20, 10 * 60_000, 'Du hast sehr viele Nachrichten geschickt. Bitte warte ein paar Minuten.');
  const { body } = messageSchema.parse(await readJson(ctx, 16 * 1024));
  const now = nowIso();
  let notifyDiscord = false;
  const threadId = tx(() => {
    let t = db.prepare('SELECT id, status, last_message_at, admin_unread FROM support_threads WHERE user_id = ?').get(user.id) as Row | undefined;
    if (!t) {
      const r = db.prepare('INSERT INTO support_threads (user_id, status, last_message_at, created_at) VALUES (?, ?, ?, ?)').run(user.id, 'open', now, now);
      t = { id: Number(r.lastInsertRowid), status: 'open', admin_unread: 0, last_message_at: now };
      notifyDiscord = true;
    } else if (t.status === 'closed' || (Number(t.admin_unread) === 0 && Date.now() - Date.parse(String(t.last_message_at)) > 60 * 60_000)) {
      notifyDiscord = true; // neue Anfrage nach „Erledigt“ oder nach längerer Pause
    }
    const id = Number(t.id);
    db.prepare('INSERT INTO support_messages (thread_id, sender, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)').run(id, 'user', user.id, body, now);
    db.prepare("UPDATE support_threads SET status = 'open', admin_unread = admin_unread + 1, last_message_at = ? WHERE id = ?").run(now, id);
    return id;
  });
  const thread = threadById(threadId)!;
  const message = messagesOf(threadId).at(-1)!;
  broadcast('support.message', { thread, message });
  if (notifyDiscord) void notifySupportRequest(user.name, body);
  ctx.res.statusCode = 201;
  return { thread, message };
}

function myEvents(ctx: Ctx) {
  const user = requireUser(ctx);
  addUserClient(ctx.res, user.id);
  return undefined;
}

/* ─────────── Admins ─────────── */

function listThreads(ctx: Ctx) {
  requireAdmin(ctx);
  const status = ctx.url.searchParams.get('status');
  const where = status === 'open' || status === 'closed' ? 'WHERE t.status = ?' : '';
  const rows = (where
    ? db.prepare(`${THREAD_SELECT} ${where} ORDER BY t.last_message_at DESC LIMIT 500`).all(status)
    : db.prepare(`${THREAD_SELECT} ORDER BY t.last_message_at DESC LIMIT 500`).all()) as Row[];
  const unread = db.prepare('SELECT COALESCE(SUM(admin_unread), 0) AS n FROM support_threads').get() as { n: number };
  return { threads: rows.map(mapThread), unread: Number(unread.n) };
}

function getThread(ctx: Ctx) {
  requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const thread = threadById(id);
  if (!thread) throw new HttpError(404, 'Chat nicht gefunden.');
  if (thread.adminUnread) {
    db.prepare('UPDATE support_threads SET admin_unread = 0 WHERE id = ?').run(id);
    thread.adminUnread = 0;
    broadcast('support.read', { threadId: id });
  }
  return { thread, messages: messagesOf(id) };
}

async function reply(ctx: Ctx) {
  const admin = requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const { body } = messageSchema.parse(await readJson(ctx, 16 * 1024));
  if (!threadById(id)) throw new HttpError(404, 'Chat nicht gefunden.');
  const now = nowIso();
  tx(() => {
    db.prepare('INSERT INTO support_messages (thread_id, sender, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)').run(id, 'admin', admin.id, body, now);
    db.prepare('UPDATE support_threads SET user_unread = user_unread + 1, admin_unread = 0, last_message_at = ? WHERE id = ?').run(now, id);
  });
  const thread = threadById(id)!;
  const message = messagesOf(id).at(-1)!;
  broadcast('support.message', { thread, message });
  sendToUser(thread.userId, 'support.message', { message, unread: thread.userUnread });
  ctx.res.statusCode = 201;
  return { thread, message };
}

async function setStatus(ctx: Ctx) {
  const admin = requireAdmin(ctx);
  const id = Number(ctx.params.id);
  const { status } = statusSchema.parse(await readJson(ctx, 1024));
  const before = threadById(id);
  if (!before) throw new HttpError(404, 'Chat nicht gefunden.');
  if (before.status === status) return { thread: before };
  const now = nowIso();
  tx(() => {
    db.prepare('UPDATE support_threads SET status = ?, admin_unread = 0 WHERE id = ?').run(status, id);
    const text = status === 'closed' ? `${admin.name} hat die Anfrage als erledigt markiert.` : `${admin.name} hat die Anfrage wieder geöffnet.`;
    db.prepare('INSERT INTO support_messages (thread_id, sender, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)').run(id, 'system', admin.id, text, now);
  });
  const thread = threadById(id)!;
  const message = messagesOf(id).at(-1)!;
  broadcast('support.message', { thread, message });
  sendToUser(thread.userId, 'support.message', { message, unread: thread.userUnread });
  return { thread };
}

export function registerSupportRoutes(r: Router) {
  r.get('/api/support/thread', myThread);
  r.get('/api/support/unread', myUnread);
  r.post('/api/support/messages', sendMine);
  r.get('/api/me/events', myEvents);
  r.get('/api/admin/support/threads', listThreads);
  r.get('/api/admin/support/threads/:id', getThread);
  r.post('/api/admin/support/threads/:id/messages', reply);
  r.patch('/api/admin/support/threads/:id', setStatus);
}
