import type { IncomingMessage, ServerResponse } from 'node:http';
import { ZodError } from 'zod';
import { config } from './config';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
  ip: string;
  /** wird von requireUser gesetzt */
  user?: { id: number; name: string; edition: 'java' | 'bedrock' | null; role: 'customer' | 'admin' };
}

type Handler = (ctx: Ctx) => Promise<unknown> | unknown;
interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler) {
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' + path.replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$',
    );
    this.routes.push({ method, pattern, keys, handler });
    return this;
  }
  get(p: string, h: Handler) { return this.add('GET', p, h); }
  post(p: string, h: Handler) { return this.add('POST', p, h); }
  put(p: string, h: Handler) { return this.add('PUT', p, h); }
  patch(p: string, h: Handler) { return this.add('PATCH', p, h); }
  delete(p: string, h: Handler) { return this.add('DELETE', p, h); }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null | 'method' {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.pattern.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params };
    }
    return pathMatched ? 'method' : null;
  }
}

export function clientIp(req: IncomingMessage): string {
  if (config.trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
    if (first) return first;
    const real = req.headers['x-real-ip'];
    if (typeof real === 'string' && real) return real;
  }
  return req.socket.remoteAddress || 'unknown';
}

export async function readBody(req: IncomingMessage, limitBytes: number): Promise<Buffer> {
  const len = Number(req.headers['content-length'] || 0);
  if (len > limitBytes) throw new HttpError(413, 'Anfrage zu groß.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limitBytes) throw new HttpError(413, 'Anfrage zu groß.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function readJson(ctx: Ctx, limitBytes = 64 * 1024): Promise<unknown> {
  const type = ctx.req.headers['content-type'] || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Erwarte JSON (Content-Type: application/json).');
  const buf = await readBody(ctx.req, limitBytes);
  if (buf.length === 0) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new HttpError(400, 'Ungültiges JSON.');
  }
}

export function sendJson(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch { /* ignorieren */ }
  }
  return out;
}

export function setCookie(res: ServerResponse, name: string, value: string, opts: { maxAge?: number; secure: boolean }) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.secure) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  const list = Array.isArray(prev) ? prev : prev ? [String(prev)] : [];
  res.setHeader('Set-Cookie', [...list, parts.join('; ')]);
}

export function securityHeaders(res: ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
}

/** Wandelt beliebige Fehler in eine saubere JSON-Antwort um. */
export function handleError(res: ServerResponse, err: unknown) {
  if (res.headersSent) { res.end(); return; }
  if (err instanceof HttpError) {
    sendJson(res, err.status, { error: err.message, details: err.details });
    return;
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    sendJson(res, 400, { error: 'Bitte überprüfe deine Eingaben.', fields });
    return;
  }
  console.error('[server] Unerwarteter Fehler:', err);
  sendJson(res, 500, { error: 'Interner Serverfehler.' });
}
