import { tr } from '../lib/i18n';
/**
 * Hintergrundbild von MineOS (vom Betreiber bereitgestellt).
 * Liegt als client/assets/wallpaper.jpg vor und wird beim Build nach dist/public kopiert.
 * Zum Austauschen einfach die Datei ersetzen (am besten 1920×1080 oder größer).
 */
export const WALLPAPER_URL = '/wallpaper.jpg';
/** Bliss-Hintergrund – nur im XP-Theme auswählbar */
export const BLISS_URL = '/bliss.jpg';

/** Aktueller Desktophintergrund je nach Theme */
export function wallpaperFor(s: { skin: 'win7' | 'xp'; xpWallpaper: 'bliss' | 'senorpollo' }): string {
  return s.skin === 'xp' && s.xpWallpaper === 'bliss' ? BLISS_URL : WALLPAPER_URL;
}

export const GLASS_COLORS: { name: string; rgb: string }[] = [
  { get name() { return tr("Himmel", "Sky"); }, rgb: '116, 184, 252' },
  { get name() { return tr("Dämmerung", "Twilight"); }, rgb: '50, 100, 190' },
  { get name() { return tr("Meer", "Sea"); }, rgb: '40, 160, 170' },
  { get name() { return tr("Blatt", "Leaf"); }, rgb: '100, 180, 80' },
  { get name() { return tr("Limette", "Lime"); }, rgb: '160, 200, 60' },
  { get name() { return tr("Sonne", "Sun"); }, rgb: '240, 200, 60' },
  { get name() { return tr("Kürbis", "Pumpkin"); }, rgb: '240, 140, 50' },
  { get name() { return tr("Rubin", "Ruby"); }, rgb: '200, 50, 60' },
  { get name() { return tr("Fuchsia", "Fuchsia"); }, rgb: '220, 70, 170' },
  { get name() { return tr("Rosa", "Blush"); }, rgb: '240, 160, 200' },
  { get name() { return tr("Violett", "Violet"); }, rgb: '140, 90, 200' },
  { get name() { return tr("Lavendel", "Lavender"); }, rgb: '170, 150, 220' },
  { get name() { return tr("Taupe", "Taupe"); }, rgb: '160, 140, 120' },
  { get name() { return tr("Schokolade", "Chocolate"); }, rgb: '110, 70, 40' },
  { get name() { return tr("Schiefer", "Slate"); }, rgb: '100, 110, 120' },
  { get name() { return tr("Frost", "Frost"); }, rgb: '230, 235, 240' },
];
