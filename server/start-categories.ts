/**
 * Die Kategorien, mit denen der Shop startet.
 * „Meist gekaufte Sachen“ ist keine echte Kategorie: Der Store berechnet sie
 * automatisch aus den Bestellungen (siehe topProductIds in routes/public.ts).
 */
export interface StartCategory {
  slug: string;
  name: string;
  description: string;
  nameEn: string;
  descriptionEn: string;
  icon: string;
}

export const START_CATEGORIES: StartCategory[] = [
  {
    slug: 'daily-quest-items', name: 'Daily Quest Items', icon: 'clock',
    description: 'Items für die täglichen Quests – schnell erledigt, jeden Tag neu.',
    nameEn: 'Daily Quest Items', descriptionEn: 'Items for the daily quests – done fast, new every day.',
  },
  {
    slug: 'weekly-quest-items', name: 'Weekly Quest Items', icon: 'writable_book',
    description: 'Items für die wöchentlichen Quests.',
    nameEn: 'Weekly Quest Items', descriptionEn: 'Items for the weekly quests.',
  },
];

/** Legt die Start-Kategorien an (db wird übergeben, damit es keinen Import-Kreis gibt) */
export function insertStartCategories(db: { prepare(sql: string): { run(...a: unknown[]): unknown } }) {
  const ins = db.prepare('INSERT INTO categories (slug, name, description, icon, sort_order, active, name_en, description_en) VALUES (?, ?, ?, ?, ?, 1, ?, ?)');
  START_CATEGORIES.forEach((c, i) => ins.run(c.slug, c.name, c.description, c.icon, (i + 1) * 10, c.nameEn, c.descriptionEn));
}
