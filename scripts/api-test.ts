/**
 * End-to-End-Test der API (npm test).
 * Startet einen eigenen Server mit temporärer Datenbank, einer Discord-Attrappe
 * und einer Microsoft-Anmelde-Attrappe und prüft alle wichtigen Abläufe.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineos-test-'));
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
function check(name: string, cond: unknown, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✘ ${name}`, extra ?? ''); }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });
}

// ── Discord-Attrappe ──
const webhookHits: any[] = [];
const discord = http.createServer(async (req, res) => {
  const body = await readBody(req);
  try { webhookHits.push(JSON.parse(body)); } catch { webhookHits.push(body); }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"id":"1"}');
});

await new Promise<void>((r) => discord.listen(0, '127.0.0.1', () => r()));

const server = spawn(process.execPath, ['--import', 'tsx', '--disable-warning=ExperimentalWarning', 'server/index.ts'], {
  cwd: root,
  env: {
    ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, PUBLIC_URL: BASE,
    DISCORD_WEBHOOK_URL: `http://127.0.0.1:${(discord.address() as any).port}/api/webhooks/1/test`,
    DISCORD_NOTIFY_STATUS: 'true', ORDER_RATE_LIMIT: '12',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE + '/api/health')).ok) break; } catch { /* startet noch */ }
  await sleep(250);
}

interface Client { cookie: string }
async function api(c: Client | null, method: string, url: string, body?: unknown, opts: { csrf?: boolean; origin?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.csrf !== false) headers['X-Requested-With'] = 'MineOS';
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (c?.cookie) headers.Cookie = c.cookie;
  if (opts.origin) headers.Origin = opts.origin;
  const res = await fetch(BASE + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const set = res.headers.get('set-cookie');
  if (set && c) { const m = /mineos_session=([^;]*)/.exec(set); if (m) c.cookie = m[1] ? `mineos_session=${m[1]}` : ''; }
  const data = await res.json().catch(() => null);
  return { status: res.status, data: data as any };
}

const REMOTE = { 'X-Forwarded-For': '1.2.3.4' };
async function registerUser(name: string, password: string, edition = 'java', headers: Record<string, string> = {}) {
  const c: Client = { cookie: '' };
  const r = await api(c, 'POST', '/api/auth/register', { username: name, password, edition }, { headers });
  return { client: c, res: r };
}
async function loginUser(name: string, password: string, headers: Record<string, string> = {}) {
  const c: Client = { cookie: '' };
  const r = await api(c, 'POST', '/api/auth/login', { username: name, password }, { headers });
  return { client: c, res: r };
}

try {
  console.log('\nKonten');
  const st0 = await api(null, 'GET', '/api/auth/status');
  check('Status: noch kein Admin, Besitzer-Einrichtung lokal erlaubt', st0.data.noAdmin === true && st0.data.setupAllowed === true);
  check('Shop ohne Anmeldung gesperrt', (await api(null, 'GET', '/api/catalog')).status === 401);
  check('Ungültiger Name abgelehnt', (await registerUser('a!', 'gutesPasswort1')).res.status === 400);
  check('Zu kurzes Passwort abgelehnt', (await registerUser('Steve', 'kurz')).res.status === 400);
  check('Zu einfaches Passwort abgelehnt', (await registerUser('Steve', '12345678')).res.status === 400);
  const remoteFirst = await registerUser('Fremder', 'fremdes-passwort', 'java', REMOTE);
  check('Erstes Konto aus dem Internet wird KEIN Admin', remoteFirst.res.status === 201 && remoteFirst.res.data.role === 'customer');
  check('Kunde ohne Admin-Zugriff', (await api(remoteFirst.client, 'GET', '/api/admin/orders')).status === 403);
  const { client: admin, res: regOwner } = await registerUser('Owner', 'besitzer-passwort');
  check('Erstes lokales Konto wird Administrator', regOwner.status === 201 && regOwner.data.role === 'admin');
  const me = await api(admin, 'GET', '/api/auth/status');
  check('Angemeldet als Owner (Admin)', me.data.user?.name === 'Owner' && me.data.user?.role === 'admin' && me.data.setupAllowed === false);
  check('Name bereits vergeben (Groß-/Kleinschreibung egal)', (await registerUser('owner', 'anderes-passwort')).res.status === 409);
  const { client: alex } = await registerUser('Alex_MC', 'alex-passwort', 'bedrock', REMOTE);
  check('Weitere Konten sind Kunden', (await api(alex, 'GET', '/api/auth/status')).data.user?.role === 'customer');
  check('Falsches Passwort abgelehnt', (await loginUser('Alex_MC', 'falsch-falsch')).res.status === 401);
  check('Unbekannter Name abgelehnt', (await loginUser('Niemand', 'irgendwas123')).res.status === 401);
  const relog = await loginUser('alex_mc', 'alex-passwort', REMOTE);
  check('Anmelden (Groß-/Kleinschreibung egal)', relog.res.status === 200 && !!relog.client.cookie);
  check('Kunde hat keinen Admin-Zugriff', (await api(alex, 'GET', '/api/admin/orders')).status === 403);
  check('Kunde darf Discord nicht ändern', (await api(alex, 'PUT', '/api/admin/settings/discord', { mention: '', notifyStatus: false })).status === 403);
  const pw = await api(alex, 'POST', '/api/auth/password', { currentPassword: 'alex-passwort', newPassword: 'neues-alex-passwort' });
  check('Passwort ändern', pw.status === 200);
  check('Neues Passwort funktioniert', (await loginUser('Alex_MC', 'neues-alex-passwort', REMOTE)).res.status === 200);

  console.log('\nKatalog & Sicherheit');
  const cat = await api(alex, 'GET', '/api/catalog');
  check('Katalog nach Anmeldung', cat.status === 200 && cat.data.categories.length === 12 && cat.data.products.length >= 40);
  const diamond = cat.data.products.find((p: any) => p.name === 'Diamant');
  const iron = cat.data.products.find((p: any) => p.name === 'Eisenbarren');
  check('Preise in Ingame-Dollar ($250 Diamant)', diamond.priceCents === 25000);
  check('CSRF: POST ohne Header abgelehnt', (await api(alex, 'POST', '/api/orders', {}, { csrf: false })).status === 403);
  check('CSRF: fremde Origin abgelehnt', (await api(alex, 'POST', '/api/orders', {}, { origin: 'https://evil.example' })).status === 403);
  check('Bestellen ohne Anmeldung gesperrt', (await api(null, 'POST', '/api/orders', { items: [{ productId: diamond.id, quantity: 1 }], playerName: 'Steve', edition: 'java' })).status === 401);
  check('Kein Microsoft mehr nötig (alte Route weg)', (await api(null, 'GET', '/api/auth/microsoft/login')).status === 404);
  check('Path-Traversal bei Uploads blockiert', (await fetch(BASE + '/uploads/..%2f..%2fmineos.db')).status === 404);
  check('Content-Security-Policy gesetzt', !!(await fetch(BASE + '/api/health')).headers.get('content-security-policy'));

  console.log('\nBestellung');
  const bad = await api(alex, 'POST', '/api/orders', { items: [], playerName: 'x', edition: 'pc' });
  check('Ungültige Bestellung → Feldfehler', bad.status === 400 && bad.data.fields?.playerName && bad.data.fields?.edition);
  check('Honeypot erkennt Spam', (await api(alex, 'POST', '/api/orders', { items: [{ productId: diamond.id, quantity: 1 }], playerName: 'Steve', edition: 'java', website: 'x' })).status === 400);
  check('Übermenge abgelehnt', [400, 409].includes((await api(alex, 'POST', '/api/orders', { items: [{ productId: diamond.id, quantity: 100000 }], playerName: 'Steve', edition: 'java' })).status));
  check('Manipulierter Preis abgelehnt', (await api(alex, 'POST', '/api/orders', { items: [{ productId: diamond.id, quantity: 2, priceCents: 1 }], playerName: 'Steve', edition: 'java' })).status === 400);

  const order = await api(alex, 'POST', '/api/orders', {
    items: [{ productId: diamond.id, quantity: 3 }, { productId: iron.id, quantity: 2 }],
    playerName: 'Steve_123', edition: 'java', discordName: 'steve.mc', deliveryTime: 'Samstag 18 Uhr', notes: 'Bitte in Shulker-Kiste',
  });
  check('Bestellung angelegt', order.status === 201, order.data);
  check('Gesamtpreis serverseitig', order.data.totalCents === diamond.priceCents * 3 + iron.priceCents * 2);
  check('Bestellnummer + Zugriffscode', /^MC-[A-Z0-9]{6}$/.test(order.data.orderNumber) && /^[A-Z0-9]{10}$/.test(order.data.accessCode));
  await sleep(400);
  const hook = webhookHits.find((h) => h.embeds?.[0]?.title?.includes(order.data.orderNumber));
  check('Discord-Webhook empfangen', !!hook);
  const hookText = JSON.stringify(hook ?? {});
  check('Discord: Spieler, Items, $-Preis, Konto, Zeit', hookText.includes('Steve\\\\_123') && hookText.includes('Diamant') && hookText.includes('$1,350') && hookText.includes('Alex') && hook?.embeds[0].timestamp, hook?.embeds?.[0]?.fields);
  check('Lagerbestand reduziert', (await api(alex, 'GET', '/api/catalog')).data.products.find((p: any) => p.id === diamond.id).stock === diamond.stock - 3);

  console.log('\nMeine Bestellungen & Verfolgung');
  const mine = await api(alex, 'GET', '/api/me/orders');
  check('Eigene Bestellungen ohne Code sichtbar', mine.data.orders.length === 1 && mine.data.lastDetails.playerName === 'Steve_123');
  check('Eigene Bestellung im Detail', (await api(alex, 'GET', `/api/me/orders/${order.data.orderNumber}`)).data.status === 'new');
  check('Fremde Bestellung nicht abrufbar', (await api(admin, 'GET', `/api/me/orders/${order.data.orderNumber}`)).status === 404);
  const t1 = await api(alex, 'POST', '/api/orders/track', { orderNumber: order.data.orderNumber, accessCode: order.data.accessCode });
  check('Verfolgung per Code', t1.status === 200 && !('adminNote' in t1.data));
  check('Falscher Code → 404', (await api(alex, 'POST', '/api/orders/track', { orderNumber: order.data.orderNumber, accessCode: 'AAAAAAAAAA' })).status === 404);

  console.log('\nAdmin');
  const ac = new AbortController();
  const events: string[] = [];
  const sse = await fetch(BASE + '/api/admin/events', { headers: { Cookie: admin.cookie }, signal: ac.signal });
  check('Echtzeit-Stream verbunden', sse.status === 200);
  (async () => { const r = sse.body!.getReader(); const d = new TextDecoder(); try { for (;;) { const { value, done } = await r.read(); if (done) break; events.push(d.decode(value)); } } catch { /* Ende */ } })();
  await sleep(200);
  const order2 = await api(alex, 'POST', '/api/orders', { items: [{ productId: iron.id, quantity: 1 }], playerName: 'Alex', edition: 'bedrock' });
  await sleep(300);
  check('Neue Bestellung in Echtzeit', events.join('').includes(order2.data.orderNumber));
  const stats = await api(admin, 'GET', '/api/admin/stats');
  check('Dashboard', stats.data.total === 2 && stats.data.byStatus.new === 2);
  const list = await api(admin, 'GET', '/api/admin/orders?status=new');
  check('Bestellliste mit Shop-Konto', list.data.total === 2 && list.data.orders[0].accountName === 'Alex_MC');
  check('Suche nach Konto-Name', (await api(admin, 'GET', '/api/admin/orders?q=alex_mc')).data.total === 2);
  check('Benachrichtigungen', (await api(admin, 'GET', '/api/admin/notifications')).data.unread === 2);
  const oid = list.data.orders.find((o: any) => o.orderNumber === order.data.orderNumber).id;
  const upd = await api(admin, 'PATCH', `/api/admin/orders/${oid}`, { status: 'farming', note: 'Wir legen los!', adminNote: 'intern' });
  check('Status ändern', upd.data.status === 'farming' && upd.data.history.length === 2);
  await sleep(300);
  check('Statusänderung an Discord', webhookHits.some((h) => h.embeds?.[0]?.title?.includes('Wird gefarmt')));
  check('Kunde sieht Status + Nachricht', (await api(alex, 'GET', `/api/me/orders/${order.data.orderNumber}`)).data.history.some((h: any) => h.note === 'Wir legen los!'));
  await api(admin, 'PATCH', `/api/admin/orders/${oid}`, { status: 'cancelled', note: null });
  check('Storno bucht Lager zurück', (await api(alex, 'GET', '/api/catalog')).data.products.find((p: any) => p.id === diamond.id).stock === diamond.stock);

  console.log('\nBenutzerverwaltung');
  const users = await api(admin, 'GET', '/api/admin/users');
  check('Benutzerliste', users.data.length === 3 && users.data.some((u: any) => u.name === 'Alex_MC' && u.edition === 'bedrock'));
  const alexId = users.data.find((u: any) => u.name === 'Alex_MC').id;
  const ownerId = users.data.find((u: any) => u.name === 'Owner').id;
  check('Letzten Admin nicht herabstufbar', (await api(admin, 'PATCH', `/api/admin/users/${ownerId}`, { role: 'customer' })).status === 409);
  check('Kunde sperren', (await api(admin, 'PATCH', `/api/admin/users/${alexId}`, { blocked: true })).status === 200);
  check('Gesperrter Kunde ausgeloggt', (await api(alex, 'GET', '/api/catalog')).status === 401);
  check('Gesperrter Kunde kann sich nicht anmelden', (await loginUser('Alex_MC', 'neues-alex-passwort', REMOTE)).res.status === 403);
  await api(admin, 'PATCH', `/api/admin/users/${alexId}`, { blocked: false, role: 'admin' });
  const reset = await api(admin, 'PATCH', `/api/admin/users/${alexId}`, { resetPassword: true });
  check('Passwort zurücksetzen liefert Einmal-Passwort', typeof reset.data.tempPassword === 'string' && reset.data.tempPassword.length === 10);
  const { client: alex2, res: tempLogin } = await loginUser('Alex_MC', reset.data.tempPassword, REMOTE);
  check('Anmelden mit Einmal-Passwort + Admin-Rechte', tempLogin.status === 200 && (await api(alex2, 'GET', '/api/admin/orders')).status === 200);

  console.log('\nProdukte & Kategorien');
  const newCat = await api(admin, 'POST', '/api/admin/categories', { name: 'Test Kategorie', description: '', icon: 'chest', sortOrder: 999, active: true });
  check('Kategorie anlegen', newCat.status === 201);
  const prod = await api(admin, 'POST', '/api/admin/products', {
    categoryId: newCat.data.id, name: 'Testblock', description: 'x', priceCents: 1_000_000_00, unitLabel: '1 Stück', stock: null,
    minQty: 1, maxQty: 10, icon: 'stone', imageUrl: null, active: true, featured: false,
  });
  check('Produkt mit großem Ingame-Preis ($1,000,000)', prod.status === 201);
  check('Preis ändern', (await api(admin, 'PATCH', `/api/admin/products/${prod.data.id}`, { priceCents: 29900 })).data.priceCents === 29900);
  await api(admin, 'PATCH', `/api/admin/products/${prod.data.id}`, { active: false });
  check('Deaktiviert nicht bestellbar', (await api(admin, 'POST', '/api/orders', { items: [{ productId: prod.data.id, quantity: 1 }], playerName: 'Notch', edition: 'java' })).status === 409);
  check('Volle Kategorie nicht löschbar', (await api(admin, 'DELETE', `/api/admin/categories/${newCat.data.id}`)).status === 409);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const up = await api(admin, 'POST', '/api/admin/upload', { dataUrl: png });
  check('Bild-Upload', up.status === 201);
  check('Gefälschtes Bild abgelehnt', (await api(admin, 'POST', '/api/admin/upload', { dataUrl: 'data:image/png;base64,' + Buffer.from('<script>').toString('base64') })).status === 400);
  check('Produkt + Kategorie löschen', (await api(admin, 'DELETE', `/api/admin/products/${prod.data.id}`)).status === 200 && (await api(admin, 'DELETE', `/api/admin/categories/${newCat.data.id}`)).status === 200);

  console.log('\nDiscord-Einstellungen');
  const ds = await api(admin, 'GET', '/api/admin/settings/discord');
  check('Webhook nur maskiert sichtbar', ds.data.configured && !JSON.stringify(ds.data).includes('/api/webhooks/1/test'));

  console.log('\nSpam-Schutz & Abmelden');
  let limited = false;
  for (let i = 0; i < 8; i++) {
    const r = await api(alex2, 'POST', '/api/orders', { items: [{ productId: iron.id, quantity: 1 }], playerName: `Spieler${i}`, edition: 'java' });
    if (r.status === 429) limited = true;
  }
  check('Rate-Limit greift', limited);
  ac.abort();
  await api(admin, 'POST', '/api/auth/logout', {});
  check('Nach Abmelden kein Zugriff', (await api(admin, 'GET', '/api/catalog')).status === 401);
} catch (e) {
  failed++;
  console.error(e);
  console.log(serverLog);
} finally {
  server.kill();
  discord.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen\n`);
  process.exit(failed ? 1 : 0);
}
