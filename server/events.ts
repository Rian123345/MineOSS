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
