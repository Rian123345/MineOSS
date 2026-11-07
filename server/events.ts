import type { ServerResponse } from 'node:http';

/**
 * Echtzeit-Kanal für den Adminbereich über Server-Sent Events (SSE).
 * Der Browser hält eine Verbindung offen; neue Bestellungen werden sofort gepusht.
 */
const clients = new Set<ServerResponse>();

export function addClient(res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx: Pufferung abschalten
  });
  res.write('retry: 3000\n\n');
  res.write(`event: hello\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  clients.add(res);
  res.on('close', () => clients.delete(res));
}

export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

export function clientCount() {
  return clients.size;
}

// Heartbeat, damit Proxys die Verbindung nicht trennen
setInterval(() => {
  for (const res of clients) {
    try { res.write(': ping\n\n'); } catch { clients.delete(res); }
  }
}, 25_000).unref();

/* ─────────── Kanal für angemeldete Spieler (MineChat-Antworten) ─────────── */
const userClients = new Map<number, Set<ServerResponse>>();

export function addUserClient(res: ServerResponse, userId: number) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  res.write(`event: hello\ndata: {}\n\n`);
  let set = userClients.get(userId);
  if (!set) userClients.set(userId, (set = new Set()));
  set.add(res);
  res.on('close', () => { set!.delete(res); if (!set!.size) userClients.delete(userId); });
}

export function sendToUser(userId: number, event: string, data: unknown) {
  const set = userClients.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { set.delete(res); }
  }
}

setInterval(() => {
  for (const set of userClients.values()) for (const res of set) {
    try { res.write(': ping\n\n'); } catch { set.delete(res); }
  }
}, 25_000).unref();
