import { db, tx } from './db';
import { START_CATEGORIES, insertStartCategories } from './start-categories';

/** Leerer Shop beim ersten Start: nur die Start-Kategorien, Produkte legst du in der Shop-Verwaltung an */
export function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number };
  if (Number(row.n) > 0) return;
  tx(() => insertStartCategories(db));
  console.log(`[db] Start-Kategorien angelegt: ${START_CATEGORIES.map((c) => c.name).join(', ')}`);
}
