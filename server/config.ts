import fs from 'node:fs';
import path from 'node:path';

// .env laden (Node >= 21.7 bringt einen eingebauten Parser mit)
const envFile = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn('[config] .env konnte nicht gelesen werden:', err);
  }
}

function bool(v: string | undefined, def = false): boolean {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'ja', 'on'].includes(v.toLowerCase());
}

function int(v: string | undefined, def: number): number {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : def;
}

const dataDir = path.resolve(process.cwd(), process.env.DATA_DIR || './data');

export const config = {
  port: int(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),
  dataDir,
  dbFile: path.join(dataDir, 'mineos.db'),
  uploadDir: path.join(dataDir, 'uploads'),
  publicDir: path.resolve(process.cwd(), process.env.PUBLIC_DIR || './dist/public'),
  discordWebhookUrl: (process.env.DISCORD_WEBHOOK_URL || '').trim(),
  discordMention: (process.env.DISCORD_MENTION ?? '').trim(),
  discordNotifyStatus: bool(process.env.DISCORD_NOTIFY_STATUS, false),
  trustProxy: bool(process.env.TRUST_PROXY, false),
  cookieSecure: bool(process.env.COOKIE_SECURE, false),
  orderRateLimit: int(process.env.ORDER_RATE_LIMIT, 5),
  ipHashSecret: (process.env.IP_HASH_SECRET || '').trim(),
  sessionHours: int(process.env.SESSION_HOURS, 12),
  isProduction: process.env.NODE_ENV === 'production',
};

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });
