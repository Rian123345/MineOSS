import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { config } from './config';
import { CATEGORY_EN, PRODUCT_EN } from './seed-en';

/**
 * Datenbank: SQLite über das in Node.js eingebaute Modul `node:sqlite`.
 * Keine externe Datenbank nötig – alles liegt in data/mineos.db
 * (WAL-Modus, Fremdschlüssel aktiv, Transaktionen für Bestellungen).
 */
export const db = new DatabaseSync(config.dbFile);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  PRAGMA synchronous = NORMAL;
`);

const MIGRATIONS: (string | (() => void))[] = [
  // v1 – Grundschema
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT 'chest',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE products (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
    unit_label   TEXT NOT NULL DEFAULT '1 Stück',
    stock        INTEGER CHECK (stock IS NULL OR stock >= 0),
    min_qty      INTEGER NOT NULL DEFAULT 1 CHECK (min_qty >= 1),
    max_qty      INTEGER NOT NULL DEFAULT 64 CHECK (max_qty >= 1),
    icon         TEXT NOT NULL DEFAULT 'chest',
    image_url    TEXT,
    active       INTEGER NOT NULL DEFAULT 1,
    featured     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX idx_products_category ON products(category_id);

  CREATE TABLE orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number   TEXT NOT NULL UNIQUE,
    access_hash    TEXT NOT NULL,
    player_name    TEXT NOT NULL,
    edition        TEXT NOT NULL CHECK (edition IN ('java','bedrock')),
    discord_name   TEXT,
    delivery_time  TEXT,
    notes          TEXT,
    status         TEXT NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new','accepted','farming','ready','completed','cancelled')),
    total_cents    INTEGER NOT NULL,
    item_count     INTEGER NOT NULL,
    ip_hash        TEXT,
    admin_note     TEXT,
    discord_status TEXT,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX idx_orders_status  ON orders(status);
  CREATE INDEX idx_orders_created ON orders(created_at);

  CREATE TABLE order_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name     TEXT NOT NULL,
    unit_label       TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    line_total_cents INTEGER NOT NULL,
    icon             TEXT,
    image_url        TEXT
  );
  CREATE INDEX idx_order_items_order ON order_items(order_id);

  CREATE TABLE order_status_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status     TEXT NOT NULL,
    note       TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX idx_history_order ON order_status_history(order_id);

  CREATE TABLE admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    last_login_at TEXT
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    expires_at TEXT NOT NULL,
    ip_hash    TEXT
  );

  CREATE TABLE notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,
    order_id   INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    read       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  `,
  // v2 – Anmeldung mit Microsoft-Konto
  `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ms_id         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    email         TEXT,
    role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
    blocked       INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    last_login_at TEXT
  );

  CREATE TABLE user_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    expires_at TEXT NOT NULL,
    ip_hash    TEXT
  );
  CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);

  ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  CREATE INDEX idx_orders_user ON orders(user_id);

  DROP TABLE sessions;
  `,
  // v3 – Anmeldung mit Minecraft-Name + Passwort (statt Microsoft)
  `
  ALTER TABLE users ADD COLUMN username TEXT;
  ALTER TABLE users ADD COLUMN password_hash TEXT;
  ALTER TABLE users ADD COLUMN edition TEXT;
  CREATE UNIQUE INDEX idx_users_username ON users(username COLLATE NOCASE);
  -- Frühere Microsoft-Konten können sich nicht mehr anmelden → Sitzungen beenden
  DELETE FROM user_sessions;
  `,
  // v4 – Englische Namen/Beschreibungen für Produkte und Kategorien (Sprachumschaltung)
  () => {
    db.exec(`
      ALTER TABLE categories ADD COLUMN name_en TEXT;
      ALTER TABLE categories ADD COLUMN description_en TEXT;
      ALTER TABLE products ADD COLUMN name_en TEXT;
      ALTER TABLE products ADD COLUMN description_en TEXT;
    `);
    const cat = db.prepare('UPDATE categories SET name_en = ?, description_en = ? WHERE slug = ? AND name_en IS NULL');
    for (const [slug, [n, d]] of Object.entries(CATEGORY_EN)) cat.run(n, d, slug);
    const prod = db.prepare('UPDATE products SET name_en = ?, description_en = ? WHERE name = ? AND name_en IS NULL');
    for (const [name, [n, d]] of Object.entries(PRODUCT_EN)) prod.run(n, d, name);
  },
];

function migrate() {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  let version = Number(row.user_version);
  while (version < MIGRATIONS.length) {
    tx(() => {
      const m = MIGRATIONS[version];
      if (typeof m === 'function') m(); else db.exec(m);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
    version++;
    console.log(`[db] Migration auf Version ${version} ausgeführt`);
  }
}

let txDepth = 0;
/** Führt fn in einer Transaktion aus (verschachtelbar über Savepoints). */
export function tx<T>(fn: () => T): T {
  const sp = `sp_${txDepth}`;
  db.exec(txDepth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
  txDepth++;
  try {
    const result = fn();
    txDepth--;
    db.exec(txDepth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
    return result;
  } catch (err) {
    txDepth--;
    db.exec(txDepth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
    throw err;
  }
}

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function nowIso() {
  return new Date().toISOString();
}

migrate();

// Geheimnis für IP-Pseudonymisierung (wird einmalig erzeugt, wenn nicht in .env)
export const ipSecret: string = (() => {
  if (config.ipHashSecret) return config.ipHashSecret;
  let s = getSetting('ip_hash_secret');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    setSetting('ip_hash_secret', s);
  }
  return s;
})();
