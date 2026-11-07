/** Versionsnummer von MineOS */
export const MINEOS_VERSION = '1.8.1';

declare const __MINEOS_BUILD__: string | undefined;
/** Eindeutige Kennung dieses Builds (wird beim Bauen eingesetzt). So erkennt MineOS alte, noch laufende Versionen sicher. */
export const BUILD_ID: string = typeof __MINEOS_BUILD__ !== 'undefined' ? __MINEOS_BUILD__ : 'dev';
