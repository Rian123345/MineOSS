import { getLang } from './i18n';

/**
 * Der Server antwortet immer auf Deutsch (auch Discord bleibt deutsch).
 * Ist Englisch eingestellt, werden seine Meldungen hier übersetzt.
 */
const EXACT: Record<string, string> = {
  'Zu viele Versuche. Bitte warte 15 Minuten.': 'Too many attempts. Please wait 15 minutes.',
  'MineOS ist bereits eingerichtet.': 'MineOS is already set up.',
  'Der Einrichtungscode ist falsch.': 'The setup code is wrong.',
  'Zu viele neue Konten von dieser Verbindung. Bitte später erneut versuchen.': 'Too many new accounts from this connection. Please try again later.',
  'Dieser Minecraft-Name ist bereits registriert. Melde dich stattdessen an.': 'This Minecraft name is already registered. Please sign in instead.',
  'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.': 'Too many sign-in attempts. Please wait 15 minutes.',
  'Dieses Konto ist vorübergehend gesperrt. Bitte in 15 Minuten erneut versuchen.': 'This account is temporarily locked. Please try again in 15 minutes.',
  'Dieses Konto wurde für den Shop gesperrt.': 'This account has been blocked from the shop.',
  'Das aktuelle Passwort ist falsch.': 'The current password is wrong.',
  'Minecraft-Name oder Passwort ist falsch.': 'Minecraft name or password is wrong.',
  'Menge muss mindestens 1 sein.': 'Quantity must be at least 1.',
  'Der Warenkorb ist leer.': 'The cart is empty.',
  'Zu viele Positionen.': 'Too many items.',
  'Der Spielername muss mindestens 3 Zeichen haben.': 'The player name must have at least 3 characters.',
  'Bitte wähle Java oder Bedrock.': 'Please choose Java or Bedrock.',
  'Ungültiger Discord-Name (2–32 Zeichen: Buchstaben, Ziffern, _ und .).': 'Invalid Discord name (2–32 characters: letters, digits, _ and .).',
  'Doppelte Produkte im Warenkorb.': 'Duplicate products in the cart.',
  'Ungültige Bestellnummer (Format: MC-XXXXXX).': 'Invalid order number (format: MC-XXXXXX).',
  'Ungültiger Zugriffscode.': 'Invalid access code.',
  'Passwort fehlt.': 'Password missing.',
  'Ungültiger Icon-Name.': 'Invalid icon name.',
  'Ungültige Bild-URL.': 'Invalid image URL.',
  'Name zu kurz.': 'Name too short.',
  'Einheit fehlt.': 'Unit missing.',
  'Höchstmenge muss ≥ Mindestmenge sein.': 'Maximum quantity must be ≥ minimum quantity.',
  'Nur a–z, 0–9 und Bindestriche.': 'Only a–z, 0–9 and hyphens.',
  'Der Name darf nicht mit einem Leerzeichen enden.': 'The name must not end with a space.',
  'Das ist keine gültige Discord-Webhook-URL (https://discord.com/api/webhooks/…).': 'That is not a valid Discord webhook URL (https://discord.com/api/webhooks/…).',
  'Erlaubt: leer, @here, @everyone, <@BenutzerID> oder <@&RollenID>.': 'Allowed: empty, @here, @everyone, <@UserID> or <@&RoleID>.',
  'Das Passwort muss mindestens 8 Zeichen lang sein.': 'The password must be at least 8 characters long.',
  'Das Passwort ist zu lang.': 'The password is too long.',
  'Dieses Passwort ist zu leicht zu erraten. Bitte wähle ein anderes.': 'This password is too easy to guess. Please choose another one.',
  'Das Passwort darf nicht dein Minecraft-Name sein.': 'The password must not be your Minecraft name.',
  'Bitte melde dich mit deinem Minecraft-Namen an.': 'Please sign in with your Minecraft name.',
  'Nur Administratoren haben hierauf Zugriff.': 'Only administrators have access to this.',
  'Anfrage zu groß.': 'Request too large.',
  'Erwarte JSON (Content-Type: application/json).': 'Expected JSON (Content-Type: application/json).',
  'Ungültiges JSON.': 'Invalid JSON.',
  'Bitte überprüfe deine Eingaben.': 'Please check your input.',
  'Interner Serverfehler.': 'Internal server error.',
  'Ungültige Anfrage (CSRF-Schutz).': 'Invalid request (CSRF protection).',
  'Ungültige Herkunft der Anfrage.': 'Invalid request origin.',
  'Benutzer nicht gefunden.': 'User not found.',
  'Es muss mindestens ein Administrator bleiben.': 'At least one administrator must remain.',
  'Du kannst dich nicht selbst sperren oder herabstufen.': 'You cannot block or demote yourself.',
  'Unbekannter Status.': 'Unknown status.',
  'Bestellung nicht gefunden.': 'Order not found.',
  'Nur abgeschlossene oder stornierte Bestellungen können gelöscht werden.': 'Only completed or cancelled orders can be deleted.',
  'Kategorie existiert nicht.': 'Category does not exist.',
  'Produkt nicht gefunden.': 'Product not found.',
  'Kategorie nicht gefunden.': 'Category not found.',
  'Dieser Kurzname ist bereits vergeben.': 'This short name is already taken.',
  'Nur PNG, JPG, GIF oder WEBP erlaubt.': 'Only PNG, JPG, GIF or WEBP allowed.',
  'Das Bild ist größer als 2 MB.': 'The image is larger than 2 MB.',
  'Die Datei ist kein gültiges Bild.': 'The file is not a valid image.',
  'Discord ist nicht verbunden.': 'Discord is not connected.',
  'Bestellnummer konnte nicht erzeugt werden.': 'Could not generate an order number.',
  'Du hast in kurzer Zeit zu viele Bestellungen aufgegeben. Bitte warte ein paar Minuten.': 'You placed too many orders in a short time. Please wait a few minutes.',
  'Die Bestellung wurde als Spam erkannt.': 'The order was detected as spam.',
  'Das ging etwas zu schnell. Bitte prüfe deine Angaben und sende erneut.': 'That was a bit too fast. Please check your details and submit again.',
  'Ein Produkt in deinem Warenkorb ist nicht mehr verfügbar. Bitte aktualisiere den Warenkorb.': 'A product in your cart is no longer available. Please update your cart.',
  'Der Bestellwert ist zu hoch. Bitte teile die Bestellung auf oder kontaktiere uns.': 'The order value is too high. Please split the order or contact us.',
  'Keine Bestellung mit dieser Nummer und diesem Zugriffscode gefunden.': 'No order found with this number and access code.',
  'Der Minecraft-Name muss 3–16 Zeichen lang sein und darf nur Buchstaben, Ziffern und _ enthalten.': 'The Minecraft name must be 3–16 characters long and may only contain letters, digits and _.',
  'nicht eingerichtet': 'not set up',
  'gesendet': 'sent',
  'Methode nicht erlaubt.': 'Method not allowed.',
  'Nicht gefunden.': 'Not found.',
  'API-Endpunkt nicht gefunden.': 'API endpoint not found.',
  'Kein Discord-Webhook eingerichtet (Shop-Verwaltung → Einstellungen).': 'No Discord webhook set up (Shop Management → Settings).',
  'Rate-Limit von Discord': 'Discord rate limit',
  'Dies ist eine Testnachricht aus der MineOS Shop-Verwaltung.': 'This is a test message from MineOS Shop Management.',
};

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Maximal (\d+) Zeichen\.$/, (m) => `Maximum ${m[1]} characters.`],
  [/^Zu viele Anfragen\. Bitte warte (\d+) Sekunden\.$/, (m) => `Too many requests. Please wait ${m[1]} seconds.`],
  [/^Die Kategorie enthält noch (\d+) Produkt\(e\)\. Verschiebe oder lösche diese zuerst\.$/, (m) => `The category still contains ${m[1]} product(s). Move or delete them first.`],
  [/^Für (.+) gibt es bereits (\d+) unbearbeitete Bestellungen\. Bitte warte, bis diese angenommen wurden\.$/, (m) => `${m[1]} already has ${m[2]} unprocessed orders. Please wait until they have been accepted.`],
  [/^Für „(.+)“ sind (\d+)–(\d+) Einheiten bestellbar\.$/, (m) => `For “${m[1]}” you can order ${m[2]}–${m[3]} units.`],
  [/^Von „(.+)“ sind nur noch (\d+) Einheiten verfügbar\.$/, (m) => `Only ${m[2]} units of “${m[1]}” are left.`],
  [/^Discord-Test fehlgeschlagen: Netzwerkfehler: (.*)$/s, (m) => `Discord test failed: network error: ${m[1]}`],
  [/^Discord-Test fehlgeschlagen: (.*)$/s, (m) => `Discord test failed: ${serverText(m[1])}`],
  [/^Fehler: (.*)$/s, (m) => `Error: ${serverText(m[1])}`],
  [/^Netzwerkfehler: (.*)$/s, (m) => `Network error: ${m[1]}`],
  [/^Neue Bestellung (MC-[A-Z0-9]+)$/, (m) => `New order ${m[1]}`],
  [/^(.+) hat (\d+) Position\(en\) für (.+) bestellt\.$/, (m) => `${m[1]} ordered ${m[2]} item(s) for ${m[3]}.`],
  [/^Bestellung (MC-[A-Z0-9]+): (.+)$/, (m) => `Order ${m[1]}: ${serverText(m[2])}`],
  [/^Status geändert: (.+)$/, (m) => `Status changed: ${serverText(m[1])}`],
  [/^Neue Bestellung$/, () => 'New order'], [/^Angenommen$/, () => 'Accepted'], [/^Wird gefarmt$/, () => 'Farming'],
  [/^Bereit zur Übergabe$/, () => 'Ready for handover'], [/^Abgeschlossen$/, () => 'Completed'], [/^Storniert$/, () => 'Cancelled'],
];

/** Übersetzt eine Meldung des Servers in die eingestellte Sprache */
export function serverText(msg: string): string;
export function serverText(msg: string | null | undefined): string | null | undefined;
export function serverText(msg: string | null | undefined) {
  if (!msg || getLang() === 'de') return msg;
  if (EXACT[msg]) return EXACT[msg];
  for (const [re, fn] of PATTERNS) { const m = msg.match(re); if (m) return fn(m); }
  return msg;
}

export function serverFields(fields?: Record<string, string>) {
  if (!fields || getLang() === 'de') return fields;
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, serverText(v)]));
}
