import data from './mcIcons.json';

/**
 * Original-Minecraft-Icons aus dem Resource Pack (erzeugt mit scripts/mc-icons.py).
 * Eintrag: id → [Art ('i' = flaches Item, 'b' = gerenderter Block), englischer Name]
 */
const MC = data as unknown as Record<string, ['i' | 'b', string]>;

/** Ältere MineOS-Icon-Namen → Minecraft-IDs */
const ALIAS: Record<string, string> = {
  lapis: 'lapis_lazuli',
  redstone_dust: 'redstone',
  totem: 'totem_of_undying',
  eye_of_ender: 'ender_eye',
  hay_bale: 'hay_block',
};

/** Items mit Verzauberungsschimmer */
export const MC_GLINT = new Set(['enchanted_book', 'enchanted_golden_apple', 'nether_star', 'experience_bottle', 'end_crystal', 'debug_stick']);

export function mcIcon(key: string): { id: string; src: string; kind: 'i' | 'b'; name: string } | null {
  const id = ALIAS[key] ?? key;
  const e = MC[id];
  return e ? { id, src: `/mc/${id}.png`, kind: e[0], name: e[1] } : null;
}

/** Alle verfügbaren Icons (für die Icon-Auswahl im Adminbereich) */
export const MC_ICON_LIST: { id: string; name: string; kind: 'i' | 'b' }[] =
  Object.entries(MC).map(([id, [kind, name]]) => ({ id, name, kind })).sort((a, b) => a.name.localeCompare(b.name));
