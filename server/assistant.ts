import { z } from 'zod';
import { db, getSetting, setSetting } from './db';
import { Router, HttpError, readJson, type Ctx } from './http';
import { requireUser, requireAdmin } from './auth';
import { rateLimit } from './security';
import { formatMoney } from '../shared/money';
import type { AiSettings, AssistantStatus } from '../shared/types';

/**
 * MineBot – KI-Assistent für alles rund um Minecraft und den Shop.
 * Läuft über die Claude-API von Anthropic. Den API-Schlüssel trägt ein Admin in der
 * Shop-Verwaltung ein (oder als Umgebungsvariable ANTHROPIC_API_KEY). Der Schlüssel
 * bleibt auf dem Server und wird nie an Browser geschickt.
 */

export const AI_MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5'] as const;
const DEFAULT_MODEL = 'claude-haiku-5-5';
const API_BASE = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '');

function aiConfig() {
  const envKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  const key = envKey || getSetting('ai_api_key') || '';
  const model = (process.env.MINEOS_AI_MODEL || getSetting('ai_model') || DEFAULT_MODEL).trim();
  const enabled = getSetting('ai_enabled') !== '0';
  const limit = Number(getSetting('ai_limit') || 30);
  return { key, model, enabled, limitPerHour: Number.isFinite(limit) ? limit : 30, fromEnv: !!envKey };
}

/* ─────────── Systemanweisung ─────────── */

function shopContext(): string {
  const cats = db.prepare('SELECT id, name, name_en FROM categories WHERE active = 1 ORDER BY sort_order').all() as { id: number; name: string; name_en: string | null }[];
  const prods = db.prepare(`
    SELECT p.name, p.name_en, p.price_cents, p.unit_label, p.stock, p.category_id FROM products p
    JOIN categories c ON c.id = p.category_id WHERE p.active = 1 AND c.active = 1
    ORDER BY c.sort_order, p.name LIMIT 120`).all() as { name: string; name_en: string | null; price_cents: number; unit_label: string; stock: number | null; category_id: number }[];
  const lines: string[] = [];
  for (const c of cats) {
    lines.push(`Kategorie „${c.name}“${c.name_en && c.name_en !== c.name ? ` (EN: ${c.name_en})` : ''}:`);
    const list = prods.filter((p) => p.category_id === c.id);
    if (!list.length) lines.push('  (zurzeit keine Produkte)');
    for (const p of list) {
      lines.push(`  - ${p.name}${p.name_en && p.name_en !== p.name ? ` / ${p.name_en}` : ''}: ${formatMoney(p.price_cents)} pro ${p.unit_label}${p.stock === 0 ? ' – ausverkauft' : p.stock != null ? ` – noch ${p.stock} verfügbar` : ''}`);
    }
  }
  return lines.join('\n');
}

function systemPrompt(lang: 'de' | 'en', userName: string): string {
  return `Du bist „MineBot“, der freundliche Hilfe-Assistent im „SeñorPollo Shop“ – einem Minecraft-Item-Shop, der als Website im Stil eines alten Windows läuft (MineOS).

Deine Aufgaben:
1. Fragen rund um Minecraft beantworten (Java und Bedrock): Crafting-Rezepte, Redstone, Farmen, Mobs, Verzauberungen, Tränke, Biome, Bauen, Befehle, Spielmechaniken, Updates.
2. Fragen zum Shop beantworten: wie man bestellt, was es gibt, was es kostet.

So funktioniert der Shop:
- Spieler melden sich mit ihrem Minecraft-Namen und einem Passwort an.
- Im „Minecraft Store“ legen sie Items in den Warenkorb und bestellen. Es gibt die Kategorien Daily Quest Items und Weekly Quest Items; „Meist gekaufte Sachen“ zeigt automatisch die beliebtesten Produkte.
- Bezahlt wird mit Ingame-Geld ($) erst bei der Übergabe im Spiel. Die Items werden nach der Bestellung gefarmt und persönlich übergeben.
- Den Status (Neu, Angenommen, Wird gefarmt, Bereit zur Übergabe, Abgeschlossen) sehen Spieler unter „Meine Bestellungen“.
- Bei Problemen mit einer Bestellung, Bezahlung oder Übergabe hilft das Support-Team: im MineChat links auf „Support-Team“ klicken und schreiben.
- Updates und Infos gibt es im Discord: https://discord.gg/nmvUnG3V4q

Aktuelles Sortiment mit Preisen:
${shopContext()}

Regeln:
- Antworte ${lang === 'en' ? 'auf Englisch' : 'auf Deutsch'}, außer der Spieler schreibt in einer anderen Sprache – dann in seiner Sprache. Duze den Spieler.
- Kurz und klar: meist 2–6 Sätze oder eine kurze Liste. Keine Tabellen, keine Überschriften. **Fett** und Listen mit „- “ sind erlaubt.
- Nenne nur Preise und Produkte aus der Liste oben. Erfinde keine Rabatte, Lieferzeiten, Regeln oder Zusagen. Wenn du etwas über den Shop nicht weißt, verweise auf das Support-Team.
- Du kannst keine Bestellungen ändern, stornieren oder einsehen und hast keinen Zugriff auf Konten – dafür ist das Support-Team da.
- Bleib bei Minecraft und dem Shop. Bei anderen Themen erkläre freundlich in einem Satz, dass du nur dafür da bist.
- Keine Hilfe zu Cheats, Hacked Clients, X-Ray, Duping, Griefing, Account-Diebstahl oder dem Umgehen von Server-Regeln.
- Frag niemals nach Passwörtern oder persönlichen Daten.
- Wenn du bei Minecraft-Details unsicher bist (z. B. Unterschiede zwischen Versionen), sag das ehrlich.

Der Spieler, mit dem du schreibst, heißt ${userName}.`;
}

/* ─────────── Anfrage an die Claude-API ─────────── */

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(4000),
  }).strict()).min(1).max(30),
  lang: z.enum(['de', 'en']).default('de'),
}).strict();

async function callClaude(key: string, model: string, system: string, messages: { role: 'user' | 'assistant'; content: string }[], maxTokens = 800): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    throw new HttpError(502, (err as Error).name === 'TimeoutError' ? 'Der KI-Assistent hat zu lange gebraucht. Bitte versuch es noch einmal.' : 'Der KI-Dienst ist gerade nicht erreichbar.');
  }
  const data = (await res.json().catch(() => ({}))) as {
    content?: { type: string; text?: string }[]; stop_reason?: string; error?: { type?: string; message?: string };
  };
  if (!res.ok) {
    console.warn('[ki] Claude-API-Fehler', res.status, data.error?.type, data.error?.message);
    if (res.status === 401 || res.status === 403) throw new HttpError(502, 'Der API-Schlüssel für den KI-Assistenten ist ungültig. Ein Admin muss ihn in der Shop-Verwaltung prüfen.');
    if (res.status === 429) throw new HttpError(503, 'Der KI-Assistent ist gerade ausgelastet. Bitte versuch es gleich noch einmal.');
    if (res.status === 404 || (res.status === 400 && /model/i.test(data.error?.message ?? ''))) throw new HttpError(502, 'Das eingestellte KI-Modell gibt es nicht. Ein Admin muss es in der Shop-Verwaltung ändern.');
    throw new HttpError(502, 'Der KI-Dienst hat einen Fehler gemeldet. Bitte versuch es später noch einmal.');
  }
  const text = (data.content ?? []).filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('\n').trim();
  if (data.stop_reason === 'refusal' || !text) return '';
  return text;
}

function status(ctx: Ctx): AssistantStatus {
  requireUser(ctx);
  const c = aiConfig();
  return { enabled: c.enabled && !!c.key, model: c.enabled && c.key ? c.model : null };
}

async function chat(ctx: Ctx) {
  const user = requireUser(ctx);
  const c = aiConfig();
  if (!c.enabled || !c.key) throw new HttpError(503, 'Der KI-Assistent ist noch nicht eingerichtet. Ein Admin kann ihn in der Shop-Verwaltung unter „Einstellungen“ aktivieren.');
  const input = chatSchema.parse(await readJson(ctx, 64 * 1024));
  // Verlauf säubern: muss mit einer Spieler-Nachricht beginnen und enden, Rollen abwechselnd
  const msgs: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of input.messages.slice(-16)) {
    if (!msgs.length && m.role !== 'user') continue;
    if (msgs.length && msgs[msgs.length - 1].role === m.role) msgs[msgs.length - 1].content += '\n\n' + m.content;
    else msgs.push({ ...m });
  }
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') throw new HttpError(400, 'Bitte stelle eine Frage.');
  const limit = user.role === 'admin' ? Math.max(c.limitPerHour, 200) : c.limitPerHour;
  const rl = rateLimit(`ai:${user.id}`, limit, 60 * 60_000);
  if (!rl.ok) throw new HttpError(429, `Du hast den KI-Assistenten in letzter Zeit sehr oft gefragt. Bitte warte ${Math.ceil(rl.retryAfter / 60)} Minuten.`);
  const answer = await callClaude(c.key, c.model, systemPrompt(input.lang, user.name), msgs);
  return {
    reply: answer || (input.lang === 'en'
      ? 'I can\'t help with that one. Ask me anything about Minecraft or the shop – or write to the support team.'
      : 'Dabei kann ich leider nicht helfen. Frag mich gern etwas zu Minecraft oder zum Shop – oder schreib dem Support-Team.'),
  };
}

/* ─────────── Einstellungen (nur Admins) ─────────── */

const settingsSchema = z.object({
  enabled: z.boolean(),
  model: z.string().trim().regex(/^[a-z0-9][a-z0-9.\-]{2,60}$/, 'Ungültiger Modellname.'),
  limitPerHour: z.number().int().min(1).max(500),
  apiKey: z.string().trim().max(300).optional(),
  clearKey: z.boolean().optional(),
}).strict();

function getAiSettings(ctx: Ctx): AiSettings {
  requireAdmin(ctx);
  const c = aiConfig();
  return {
    enabled: c.enabled, model: c.model, limitPerHour: c.limitPerHour,
    hasKey: !!c.key, keyHint: c.key ? `…${c.key.slice(-4)}` : null, fromEnv: c.fromEnv,
  };
}

async function putAiSettings(ctx: Ctx) {
  requireAdmin(ctx);
  const input = settingsSchema.parse(await readJson(ctx, 4096));
  if (input.apiKey) {
    if (!/^sk-[A-Za-z0-9_\-]{20,}$/.test(input.apiKey)) throw new HttpError(400, 'Das sieht nicht wie ein Claude-API-Schlüssel aus (beginnt mit „sk-“).');
    setSetting('ai_api_key', input.apiKey);
  }
  if (input.clearKey) setSetting('ai_api_key', '');
  setSetting('ai_enabled', input.enabled ? '1' : '0');
  setSetting('ai_model', input.model);
  setSetting('ai_limit', String(input.limitPerHour));
  return getAiSettings(ctx);
}

async function testAi(ctx: Ctx) {
  const admin = requireAdmin(ctx);
  const c = aiConfig();
  if (!c.key) throw new HttpError(400, 'Es ist noch kein API-Schlüssel eingetragen.');
  const reply = await callClaude(c.key, c.model, systemPrompt('de', admin.name), [{ role: 'user', content: 'Sag in einem kurzen Satz Hallo und nenne ein Minecraft-Item, das man aus Diamanten craften kann.' }], 120);
  return { ok: true, reply };
}

export function registerAssistantRoutes(r: Router) {
  r.get('/api/assistant/status', status);
  r.post('/api/assistant/chat', chat);
  r.get('/api/admin/settings/ai', getAiSettings);
  r.put('/api/admin/settings/ai', putAiSettings);
  r.post('/api/admin/ai-test', testAi);
}
