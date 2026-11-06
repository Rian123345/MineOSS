import { db, tx } from './db';
import { CATEGORY_EN, PRODUCT_EN } from './seed-en';

interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  icon: string;
  products: [name: string, icon: string, priceCents: number, unit: string, stock: number | null, maxQty: number, description: string, featured?: boolean][];
}

const S = '1 Stack (64×)';
const S16 = '1 Stack (16×)';
const ONE = '1 Stück';

export const SEED: SeedCategory[] = [
  {
    slug: 'bloecke', name: 'Blöcke', icon: 'grass_block',
    description: 'Grundlegende Blöcke für jedes Bauprojekt – frisch abgebaut.',
    products: [
      ['Grasblock', 'grass_block', 120, S, null, 64, 'Saftig grüner Grasblock mit Erdseite. Perfekt für Gärten, Landschaftsbau und Tierfarmen. Mit Behutsamkeit abgebaut.'],
      ['Bruchstein', 'cobblestone', 50, S, null, 128, 'Der Klassiker. Robust, günstig und in jeder Menge verfügbar. Ideal für Fundamente und Mauern.'],
      ['Eichenstamm', 'oak_log', 150, S, null, 64, 'Frisch gefällte Eichenstämme. Lassen sich zu Brettern, Stöcken und Kohle weiterverarbeiten.'],
      ['Glas', 'glass', 180, S, null, 64, 'Klar geschmolzenes Glas aus Sand. Für Fenster, Gewächshäuser und Aquarien.'],
      ['Obsidian', 'obsidian', 400, S16, 40, 20, 'Extrem widerstandsfähig gegen Explosionen. Für Netherportale und sichere Bunker.', true],
      ['Tiefenschiefer', 'deepslate', 90, S, null, 64, 'Dunkler, dichter Stein aus den tiefsten Schichten der Welt.'],
    ],
  },
  {
    slug: 'erze-materialien', name: 'Erze und Materialien', icon: 'diamond',
    description: 'Wertvolle Rohstoffe – geschmolzen, gezählt und bereit für die Übergabe.',
    products: [
      ['Diamant', 'diamond', 250, ONE, 500, 256, 'Der begehrteste Edelstein. Für Werkzeuge, Rüstungen und Zaubertische.', true],
      ['Eisenbarren', 'iron_ingot', 300, S, null, 32, 'Geschmolzenes Eisen in Barrenform. Unverzichtbar für Werkzeuge, Eimer, Schienen und Trichter.'],
      ['Goldbarren', 'gold_ingot', 450, S, null, 32, 'Glänzende Goldbarren. Für Antriebsschienen, goldene Äpfel und zum Handeln mit Piglins.'],
      ['Smaragd', 'emerald', 80, ONE, 1000, 512, 'Die Währung der Dorfbewohner. Für Handel und dekorative Smaragdblöcke.'],
      ['Netheritbarren', 'netherite_ingot', 2500, ONE, 25, 16, 'Das stärkste Material des Spiels. Aufwertung für Diamantausrüstung.', true],
      ['Lapislazuli', 'lapis_lazuli', 200, S, null, 32, 'Tiefblaues Mineral – benötigt zum Verzaubern und als Farbstoff.'],
      ['Kohle', 'coal', 100, S, null, 64, 'Zuverlässiger Brennstoff für Öfen und zur Herstellung von Fackeln.'],
      ['Kupferbarren', 'copper_ingot', 150, S, null, 64, 'Für Blitzableiter, Fernrohre und schön oxidierende Kupferblöcke.'],
    ],
  },
  {
    slug: 'redstone', name: 'Redstone', icon: 'redstone',
    description: 'Alles für Schaltungen, Maschinen und automatische Farmen.',
    products: [
      ['Redstone-Staub', 'redstone', 150, S, null, 64, 'Leitet Redstone-Signale. Grundlage jeder Schaltung.', true],
      ['Redstone-Block', 'redstone_block', 900, S16, null, 32, 'Dauerhafte Signalquelle und kompakte Lagerung für Redstone.'],
      ['Kolben', 'piston', 60, ONE, null, 128, 'Schiebt Blöcke. Unentbehrlich für Türen, Farmen und Flugmaschinen.'],
      ['Beobachter', 'observer', 80, ONE, null, 128, 'Erkennt Blockänderungen und sendet einen kurzen Impuls.'],
      ['Trichter', 'hopper', 120, ONE, null, 128, 'Sammelt und transportiert Gegenstände zwischen Behältern.'],
      ['Redstone-Verstärker', 'repeater', 40, ONE, null, 128, 'Verstärkt und verzögert Signale – einstellbar in vier Stufen.'],
      ['Redstone-Fackel', 'redstone_torch', 20, ONE, null, 256, 'Signalquelle und Inverter für Logikschaltungen.'],
    ],
  },
  {
    slug: 'baumaterialien', name: 'Baumaterialien', icon: 'stone_bricks',
    description: 'Veredelte Baublöcke für Burgen, Städte und Kunstwerke.',
    products: [
      ['Steinziegel', 'stone_bricks', 110, S, null, 128, 'Edle Steinziegel für Burgmauern und Festungen.'],
      ['Quarzblock', 'quartz_block', 600, S, null, 32, 'Reinweißer Quarz – modern, elegant und hell.', true],
      ['Weißer Beton', 'white_concrete', 220, S, null, 64, 'Glatter, farbintensiver Beton in Weiß.'],
      ['Sandstein', 'sandstone', 90, S, null, 128, 'Warmer Sandstein für Wüstenbauten und Pyramiden.'],
      ['Ziegelsteine', 'bricks', 250, S, null, 64, 'Rote Ziegelsteine aus gebranntem Ton – gemütlich und klassisch.'],
      ['Terrakotta', 'terracotta', 160, S, null, 64, 'Gebrannter Ton in warmem Orange-Braun.'],
    ],
  },
  {
    slug: 'nahrung', name: 'Nahrung', icon: 'cooked_beef',
    description: 'Damit dein Hungerbalken immer voll bleibt.',
    products: [
      ['Gebratenes Rindfleisch', 'cooked_beef', 200, S, null, 16, 'Eine der besten Nahrungsquellen – stellt viel Hunger und Sättigung wieder her.', true],
      ['Brot', 'bread', 100, S, null, 32, 'Einfach, sättigend und günstig.'],
      ['Goldene Karotte', 'golden_carrot', 350, S, null, 16, 'Höchste Sättigung im Spiel – der Favorit von Profis.'],
      ['Gebackene Kartoffel', 'baked_potato', 90, S, null, 32, 'Warm, lecker und schnell gefarmt.'],
      ['Apfel', 'apple', 150, S, null, 16, 'Knackige Äpfel – Grundlage für goldene Äpfel.'],
    ],
  },
  {
    slug: 'farm-items', name: 'Farm-Items', icon: 'wheat',
    description: 'Feldfrüchte und Pflanzen direkt vom Acker.',
    products: [
      ['Weizen', 'wheat', 60, S, null, 64, 'Für Brot, Kuchen und zum Züchten von Kühen und Schafen.'],
      ['Zuckerrohr', 'sugar_cane', 70, S, null, 64, 'Für Papier, Zucker und Bücherregale.'],
      ['Kürbis', 'pumpkin', 120, S, null, 32, 'Für Kürbiskuchen, Laternen und Schneegolems.'],
      ['Melone', 'melon', 110, S, null, 32, 'Ganze Melonenblöcke – ergeben viele Melonenscheiben.'],
      ['Strohballen', 'hay_block', 140, S, null, 32, 'Kompakter Weizenspeicher. Dämpft auch Fallschaden.'],
      ['Bambus', 'bamboo', 50, S, null, 64, 'Schnell wachsender Brennstoff und Baumaterial.'],
      ['Knochenmehl', 'bone_meal', 80, S, null, 64, 'Lässt Pflanzen sofort wachsen.'],
    ],
  },
  {
    slug: 'mob-drops', name: 'Mob-Drops', icon: 'bone',
    description: 'Erbeutet von Kreaturen der Oberwelt.',
    products: [
      ['Knochen', 'bone', 90, S, null, 64, 'Für Knochenmehl und zum Zähmen von Wölfen.'],
      ['Faden', 'string', 110, S, null, 64, 'Für Bögen, Angeln, Wolle und Stolperdrähte.'],
      ['Schwarzpulver', 'gunpowder', 250, S, null, 32, 'Für TNT und Feuerwerksraketen.', true],
      ['Enderperle', 'ender_pearl', 300, S16, null, 16, 'Teleportiert dich beim Werfen. Zutat für Enderaugen.'],
      ['Schleimball', 'slime_ball', 400, S, null, 16, 'Für Haftkolben, Leinen und Schleimblöcke.'],
      ['Feder', 'feather', 80, S, null, 64, 'Für Pfeile und Federkiele.'],
      ['Leder', 'leather', 160, S, null, 32, 'Für Bücher, Lederrüstung und Gegenstandsrahmen.'],
    ],
  },
  {
    slug: 'seltene-items', name: 'Seltene Items', icon: 'nether_star',
    description: 'Besondere Gegenstände für echte Sammler.',
    products: [
      ['Totem der Unsterblichkeit', 'totem_of_undying', 600, ONE, 20, 8, 'Rettet dich einmalig vor dem Tod. Ein Muss für jeden Kampf.', true],
      ['Elytren', 'elytra', 3500, ONE, 5, 2, 'Flügel zum Gleiten durch die Lüfte. Aus den Endschiffen geborgen.', true],
      ['Verzauberter Goldener Apfel', 'enchanted_golden_apple', 2000, ONE, 5, 4, 'Extrem seltene Leckerei mit starken Effekten.'],
      ['Netherstern', 'nether_star', 2500, ONE, 6, 3, 'Trophäe des Withers. Benötigt für ein Leuchtfeuer.'],
      ['Herz des Meeres', 'heart_of_the_sea', 1500, ONE, 4, 2, 'Kern für einen Aquisitor aus vergrabenen Schätzen.'],
      ['Namensschild', 'name_tag', 300, ONE, 30, 16, 'Gib deinen Tieren einen Namen – sie verschwinden dann nicht mehr.'],
      ['Sattel', 'saddle', 400, ONE, 15, 8, 'Zum Reiten von Pferden, Schweinen und Schreitern.'],
      ['Verzaubertes Buch (Reparatur)', 'enchanted_book', 900, ONE, 10, 4, 'Repariert Ausrüstung automatisch mit Erfahrungspunkten.'],
    ],
  },
  {
    slug: 'nether-items', name: 'Nether-Items', icon: 'blaze_rod',
    description: 'Heiße Ware aus der Unterwelt.',
    products: [
      ['Lohenrute', 'blaze_rod', 500, S16, null, 16, 'Für Braustände und Lohenstaub.'],
      ['Netherwarze', 'nether_wart', 200, S, null, 32, 'Grundzutat für fast alle Tränke.'],
      ['Ghast-Träne', 'ghast_tear', 700, ONE, 30, 16, 'Für Regenerationstränke und Endkristalle.'],
      ['Glowstone', 'glowstone', 350, S, null, 32, 'Leuchtende Blöcke aus der Netherdecke.'],
      ['Antiker Schrott', 'ancient_debris', 1500, ONE, 20, 16, 'Rohmaterial für Netherit. Tief im Nether gefunden.'],
      ['Seelensand', 'soul_sand', 150, S, null, 32, 'Für Netherwarzen-Farmen und Blasensäulen.'],
      ['Magmacreme', 'magma_cream', 400, S16, null, 16, 'Für Feuerresistenz-Tränke.'],
      ['Netherquarz', 'quartz', 180, S, null, 32, 'Für Beobachter, Komparatoren und Quarzblöcke.'],
    ],
  },
  {
    slug: 'end-items', name: 'End-Items', icon: 'ender_eye',
    description: 'Mysteriöses Material aus dem Ende.',
    products: [
      ['Endstein', 'end_stone', 150, S, null, 64, 'Heller, explosionsresistenter Stein aus dem Ende.'],
      ['Purpurblock', 'purpur_block', 300, S, null, 32, 'Lila Baublock aus Chorusfrüchten.'],
      ['Shulker-Schale', 'shulker_shell', 800, ONE, 40, 16, 'Für Shulker-Kisten – tragbare Lagerung.', true],
      ['Enderauge', 'ender_eye', 250, ONE, null, 16, 'Weist den Weg zur Festung und aktiviert das Endportal.'],
      ['Chorusfrucht', 'chorus_fruit', 120, S, null, 32, 'Essbar – teleportiert dich zufällig in der Nähe.'],
      ['Drachenatem', 'dragon_breath', 500, ONE, 20, 16, 'Für Verweiltränke. Vom Enderdrachen gesammelt.'],
      ['Shulker-Kiste', 'shulker_box', 1800, ONE, 10, 8, 'Tragbare Truhe, die ihren Inhalt behält.'],
    ],
  },
  {
    slug: 'werkzeuge', name: 'Werkzeuge', icon: 'diamond_pickaxe',
    description: 'Hochwertige Werkzeuge – auf Wunsch verzaubert.',
    products: [
      ['Diamantspitzhacke', 'diamond_pickaxe', 800, ONE, null, 4, 'Baut alles ab – auch Obsidian. Auf Wunsch mit Effizienz V.', true],
      ['Netheritschwert', 'netherite_sword', 3000, ONE, 5, 2, 'Die mächtigste Nahkampfwaffe im Spiel.'],
      ['Diamantaxt', 'diamond_axe', 700, ONE, null, 4, 'Fällt Bäume im Handumdrehen und schützt im Kampf.'],
      ['Eisenschaufel', 'iron_shovel', 150, ONE, null, 8, 'Gräbt Erde, Sand und Kies im Eiltempo.'],
      ['Bogen', 'bow', 250, ONE, null, 8, 'Fernkampfwaffe – auf Wunsch mit Unendlichkeit.'],
      ['Schild', 'shield', 200, ONE, null, 8, 'Blockt Angriffe und Pfeile.'],
      ['Angel', 'fishing_rod', 150, ONE, null, 8, 'Für Fische, Schätze und Glück des Meeres.'],
      ['Schere', 'shears', 100, ONE, null, 8, 'Schert Schafe und schneidet Blätter.'],
    ],
  },
  {
    slug: 'sonstiges', name: 'Sonstiges', icon: 'chest',
    description: 'Nützliches und Praktisches für jede Gelegenheit.',
    products: [
      ['Erfahrungsfläschchen', 'experience_bottle', 600, S, null, 16, 'Wirf sie für schnelle Erfahrungspunkte.', true],
      ['Feuerwerksrakete', 'firework_rocket', 300, S, null, 16, 'Antrieb für Elytren – Flugdauer 3.'],
      ['Fackel', 'torch', 40, S, null, 64, 'Licht für Höhlen und Basen.'],
      ['Truhe', 'chest', 60, ONE, null, 64, 'Lagert bis zu 27 Stapel Gegenstände.'],
      ['Laterne', 'lantern', 80, ONE, null, 64, 'Stimmungsvolle Beleuchtung.'],
      ['Kompass', 'compass', 120, ONE, null, 8, 'Zeigt zum Weltspawn – oder zu einem Leitstein.'],
      ['Eimer', 'bucket', 90, ONE, null, 16, 'Für Wasser, Lava, Milch und Fische.'],
    ],
  },
];

export function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number };
  if (Number(row.n) > 0) return;
  const insCat = db.prepare('INSERT INTO categories (slug, name, description, icon, sort_order, name_en, description_en) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insProd = db.prepare(`INSERT INTO products
    (category_id, name, description, price_cents, unit_label, stock, min_qty, max_qty, icon, featured, name_en, description_en)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`);
  let products = 0;
  tx(() => {
    SEED.forEach((cat, i) => {
      const ce = CATEGORY_EN[cat.slug];
      const r = insCat.run(cat.slug, cat.name, cat.description, cat.icon, (i + 1) * 10, ce?.[0] ?? null, ce?.[1] ?? null);
      const catId = Number(r.lastInsertRowid);
      for (const [name, icon, price, unit, stock, maxQty, desc, featured] of cat.products) {
        // Preise im Seed sind ganze Ingame-Dollar → intern in Hundertsteln speichern
        const pe = PRODUCT_EN[name];
        insProd.run(catId, name, desc, price * 100, unit, stock, maxQty, icon, featured ? 1 : 0, pe?.[0] ?? null, pe?.[1] ?? null);
        products++;
      }
    });
  });
  console.log(`[db] Beispieldaten angelegt: ${SEED.length} Kategorien, ${products} Produkte`);
}
