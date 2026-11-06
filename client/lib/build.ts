declare const __MINEOS_BUILD__: string | undefined;
/** Kennung des Builds, zu dem diese Oberfläche gehört */
export const CLIENT_BUILD: string = typeof __MINEOS_BUILD__ !== 'undefined' ? __MINEOS_BUILD__ : 'dev';
