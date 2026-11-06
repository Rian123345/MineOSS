import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';

// Alle Ausgaben zusätzlich in data/mineos-log.txt schreiben (hilft bei der Fehlersuche)
const logFile = path.join(config.dataDir, 'mineos-log.txt');
try { if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1_000_000) fs.renameSync(logFile, logFile + '.alt'); } catch { /* egal */ }
for (const level of ['log', 'warn', 'error'] as const) {
  const orig = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    orig(...args);
    try { fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${args.map((a) => (a instanceof Error ? a.stack : String(a))).join(' ')}\n`); } catch { /* egal */ }
  };
}
process.on('uncaughtException', (err) => {
  console.error('\n  ✘ Unerwarteter Fehler – MineOS wird beendet:\n', err);
  console.error('    Details stehen in data/mineos-log.txt\n');
  process.exit(1);
});
process.on('unhandledRejection', (err) => console.error('[server] Unbehandelter Fehler:', err));

import './db';
import { seedIfEmpty } from './seed';
import { Router, clientIp, handleError, securityHeaders, sendJson, HttpError, type Ctx } from './http';
import { checkCsrf } from './security';
import { registerPublicRoutes } from './routes/public';
import { registerAdminRoutes } from './routes/admin';
import { adminCount } from './auth';
import { registerAccountRoutes, ensureSetupCode } from './accounts';
import { BUILD_ID } from './version';
import { db } from './db';

seedIfEmpty();

const router = new Router();
registerAccountRoutes(router);
registerPublicRoutes(router);
registerAdminRoutes(router);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

function serveFile(res: http.ServerResponse, file: string, cache: string, method: string) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { sendJson(res, 404, { error: 'Nicht gefunden.' }); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cache,
    });
    if (method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

function serveStatic(ctx: Ctx) {
  const method = ctx.req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Methode nicht erlaubt.');
  const pathname = decodeURIComponent(ctx.url.pathname);

  // Hochgeladene Produktbilder (Dateiname streng geprüft → kein Path-Traversal)
  if (pathname.startsWith('/uploads/')) {
    const name = pathname.slice('/uploads/'.length);
    if (!/^[a-f0-9]{32}\.(png|jpg|gif|webp)$/.test(name)) throw new HttpError(404, 'Nicht gefunden.');
    serveFile(ctx.res, path.join(config.uploadDir, name), 'public, max-age=31536000, immutable', method);
    return;
  }

  const root = config.publicDir;
  const target = path.normalize(path.join(root, pathname));
  if (target !== root && !target.startsWith(root + path.sep)) throw new HttpError(404, 'Nicht gefunden.');
  if (pathname !== '/' && fs.existsSync(target) && fs.statSync(target).isFile()) {
    const immutable = /-[A-Z0-9]{8}\.(js|css)$/.test(target);
    serveFile(ctx.res, target, immutable ? 'public, max-age=31536000, immutable' : 'no-cache', method);
    return;
  }
  // SPA-Fallback
  const index = path.join(root, 'index.html');
  if (!fs.existsSync(index)) {
    ctx.res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    ctx.res.end('MineOS wurde noch nicht gebaut. Bitte "npm run build" ausführen.');
    return;
  }
  serveFile(ctx.res, index, 'no-cache', method);
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  const ctx: Ctx = {
    req, res, params: {}, ip: clientIp(req),
    url: new URL(req.url || '/', 'http://localhost'),
  };
  try {
    if (ctx.url.pathname.startsWith('/api/')) {
      checkCsrf(ctx);
      const m = router.match(req.method || 'GET', ctx.url.pathname);
      if (m === null) throw new HttpError(404, 'API-Endpunkt nicht gefunden.');
      if (m === 'method') throw new HttpError(405, 'Methode nicht erlaubt.');
      ctx.params = m.params;
      const result = await m.handler(ctx);
      if (result !== undefined && !res.headersSent) sendJson(res, res.statusCode || 200, result);
      return;
    }
    serveStatic(ctx);
  } catch (err) {
    handleError(res, err);
  }
});

server.requestTimeout = 30_000;
server.headersTimeout = 15_000;

function startupHints() {
  const code = ensureSetupCode();
  if (code) {
    console.log('');
    console.log('  ==================================================');
    console.log('     Noch kein Administrator: Das erste Konto, das du');
    console.log(`     auf diesem PC (http://localhost:${config.port}) erstellst,`);
    console.log('     wird automatisch Administrator.');
    console.log('');
    console.log(`     Einrichtungscode (für IP/Domain/Handy):  ${code}`);
    console.log('  ==================================================');
    console.log('');
  }
}
startupHints();

function openBrowser(url: string) {
  if (process.env.MINEOS_OPEN_BROWSER !== '1') return;
  try {
    // Windows: rundll32 öffnet zuverlässig den Standardbrowser (ohne Probleme mit Anführungszeichen)
    const [cmd, args] = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).on('error', () => {}).unref();
  } catch { /* kein Browser verfügbar */ }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fragt nach, welches Programm auf dem Port läuft. */
async function probe(port: number): Promise<{ app?: string; version?: string; build?: string; ok?: boolean; time?: string } | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2500) });
    return (await res.json()) as any;
  } catch { return null; }
}

/** Findet die Prozess-ID, die auf dem Port lauscht – nur wenn es ein Node.js-Prozess ist. */
function findNodePidOnPort(port: number): number | null {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true });
      for (const line of out.split(/\r?\n/)) {
        const cols = line.trim().split(/\s+/);
        if (cols.length < 5 || !cols[1].endsWith(`:${port}`) || !/:0$/.test(cols[2])) continue;
        const pid = Number(cols[cols.length - 1]);
        if (!pid || pid === process.pid) continue;
        const task = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
        if (/node(\.exe)?"/i.test(task)) return pid;
      }
    } else {
      const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
      for (const p of out.split(/\s+/).map(Number).filter(Boolean)) {
        if (p === process.pid) continue;
        const comm = execFileSync('ps', ['-p', String(p), '-o', 'comm='], { encoding: 'utf8' });
        if (/node/i.test(comm)) return p;
      }
    }
  } catch { /* Werkzeug nicht vorhanden */ }
  return null;
}

let currentPort = config.port;

function listen(port: number) {
  currentPort = port;
  server.listen(port, config.host);
}

server.on('listening', () => {
  (config as { port: number }).port = currentPort;
  const url = `http://localhost:${currentPort}`;
  console.log(`\n  ▶ MineOS läuft auf ${url}`);
  console.log('    Dieses Fenster offen lassen – schließen beendet den Shop.\n');
  openBrowser(url);
});

let takeoverTried = false;
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code !== 'EADDRINUSE') {
    console.error('\n  ✘ MineOS konnte nicht starten:', err.message, '\n');
    process.exit(1);
  }
  void (async () => {
    const port = currentPort;
    const running = await probe(port);
    const isMineOS = !!running && (running.app === 'MineOS' || (running.ok === true && 'time' in running));

    // Exakt derselbe Build läuft schon → nur Browser öffnen. Jede andere MineOS-Version wird ersetzt.
    if (isMineOS && running!.build === BUILD_ID) {
      console.log(`\n  ✔ MineOS läuft bereits in einem anderen Fenster – der Browser wird geöffnet.\n`);
      openBrowser(`http://localhost:${port}`);
      await sleep(1500);
      process.exit(0);
    }

    if (isMineOS && !takeoverTried) {
      // Eine ältere MineOS-Version läuft noch → automatisch beenden und übernehmen
      takeoverTried = true;
      const pid = findNodePidOnPort(port);
      if (pid) {
        console.log(`\n  ↻ Eine andere MineOS-Version läuft noch (Prozess ${pid}${running!.version ? `, Version ${running!.version}` : ''}) – sie wird beendet und durch diese ersetzt …`);
        try { process.kill(pid); } catch { /* evtl. schon beendet */ }
        if (process.platform === 'win32') {
          try { execFileSync('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { /* schon beendet */ }
        }
        for (let i = 0; i < 20 && (await probe(port)); i++) await sleep(250);
        await sleep(300);
        listen(port);
        return;
      }
      console.error('\n  ✘ Eine ältere MineOS-Version läuft noch, konnte aber nicht automatisch beendet werden.');
      console.error('    Bitte alle schwarzen MineOS-Fenster schließen (oder den PC neu starten) und erneut starten.\n');
      process.exit(1);
    }

    // Port von einem anderen Programm belegt → nächsten freien Port versuchen
    if (port < config.port + 10) {
      console.warn(`  Port ${port} ist belegt – versuche Port ${port + 1} …`);
      listen(port + 1);
      return;
    }
    console.error(`\n  ✘ Kein freier Port zwischen ${config.port} und ${port} gefunden. Trage in der Datei .env z. B. PORT=4000 ein.\n`);
    process.exit(1);
  })();
});

listen(config.port);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log('\n[server] Fahre herunter …');
    server.close();
    try { db.close(); } catch { /* bereits geschlossen */ }
    process.exit(0);
  });
}
