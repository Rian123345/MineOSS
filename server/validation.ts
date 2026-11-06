import { z } from 'zod';
import { EDITIONS, MAX_CART_LINES, ORDER_STATUSES } from '../shared/constants';

/** Entfernt Steuerzeichen und überflüssige Leerzeichen. */
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g, '').trim();

const text = (max: number) => z.string().transform(clean).pipe(z.string().max(max, `Maximal ${max} Zeichen.`));
const optionalText = (max: number) =>
  z.union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null ? null : clean(v) || null))
    .pipe(z.string().max(max, `Maximal ${max} Zeichen.`).nullable());

export const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1, 'Menge muss mindestens 1 sein.').max(10_000),
  }).strict()).min(1, 'Der Warenkorb ist leer.').max(MAX_CART_LINES, 'Zu viele Positionen.'),
  // Java: 3–16 Zeichen [A-Za-z0-9_]; Bedrock-Gamertags: bis 16 Zeichen inkl. Leerzeichen
  playerName: text(16).pipe(z.string().min(3, 'Der Spielername muss mindestens 3 Zeichen haben.')),
  edition: z.enum(EDITIONS, { errorMap: () => ({ message: 'Bitte wähle Java oder Bedrock.' }) }),
  discordName: optionalText(40),
  deliveryTime: optionalText(100),
  notes: optionalText(1000),
  // Honeypot: Bots füllen dieses unsichtbare Feld aus
  website: z.string().max(200).optional(),
  // Zeitstempel, wann das Formular geöffnet wurde (Bots sind zu schnell)
  formStartedAt: z.number().optional(),
}).strict().superRefine((o, ctx) => {
  const re = o.edition === 'java' ? /^[A-Za-z0-9_]{3,16}$/ : /^[A-Za-z0-9][A-Za-z0-9 ]{1,14}[A-Za-z0-9]$/;
  if (!re.test(o.playerName)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['playerName'],
      message: o.edition === 'java'
        ? 'Java-Namen bestehen aus 3–16 Zeichen: Buchstaben, Ziffern und _.'
        : 'Bedrock-Gamertags bestehen aus 3–16 Zeichen: Buchstaben, Ziffern und Leerzeichen.',
    });
  }
  if (o.discordName && !/^[A-Za-z0-9_.]{2,32}(#\d{4})?$/.test(o.discordName)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discordName'], message: 'Ungültiger Discord-Name (2–32 Zeichen: Buchstaben, Ziffern, _ und .).' });
  }
  const ids = o.items.map((i) => i.productId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Doppelte Produkte im Warenkorb.' });
  }
});

export const trackSchema = z.object({
  orderNumber: z.string().transform((s) => s.trim().toUpperCase()).pipe(z.string().regex(/^MC-[A-Z0-9]{6}$/, 'Ungültige Bestellnummer (Format: MC-XXXXXX).')),
  accessCode: z.string().transform((s) => s.replace(/[\s-]/g, '').toUpperCase()).pipe(z.string().regex(/^[A-Z0-9]{10}$/, 'Ungültiger Zugriffscode.')),
}).strict();

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Minecraft-Name fehlt.').max(64),
  password: z.string().min(1, 'Passwort fehlt.').max(200),
}).strict();

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
}).strict();

export const statusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: optionalText(500),
  adminNote: optionalText(2000).optional(),
}).strict();

const iconKey = z.string().regex(/^[a-z0-9_]{1,40}$/, 'Ungültiger Icon-Name.');
const imageUrl = z.union([z.string().regex(/^\/uploads\/[a-f0-9]{32}\.(png|jpg|webp|gif)$/, 'Ungültige Bild-URL.'), z.null()]);

export const productSchema = z.object({
  categoryId: z.number().int().positive(),
  name: text(80).pipe(z.string().min(2, 'Name zu kurz.')),
  description: text(1000),
  nameEn: optionalText(80),
  descriptionEn: optionalText(1000),
  priceCents: z.number().int().min(0).max(100_000_000_000),
  unitLabel: text(40).pipe(z.string().min(1, 'Einheit fehlt.')),
  stock: z.number().int().min(0).max(10_000_000).nullable(),
  minQty: z.number().int().min(1).max(10_000),
  maxQty: z.number().int().min(1).max(10_000),
  icon: iconKey,
  imageUrl: imageUrl,
  active: z.boolean(),
  featured: z.boolean(),
}).strict().refine((p) => p.maxQty >= p.minQty, { path: ['maxQty'], message: 'Höchstmenge muss ≥ Mindestmenge sein.' });

export const productPatchSchema = z.object({
  priceCents: z.number().int().min(0).max(100_000_000_000).optional(),
  active: z.boolean().optional(),
  stock: z.number().int().min(0).max(10_000_000).nullable().optional(),
}).strict();

export const categorySchema = z.object({
  name: text(60).pipe(z.string().min(2, 'Name zu kurz.')),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,60}$/, 'Nur a–z, 0–9 und Bindestriche.').optional(),
  description: text(300),
  nameEn: optionalText(60),
  descriptionEn: optionalText(300),
  icon: iconKey,
  sortOrder: z.number().int().min(0).max(100_000),
  active: z.boolean(),
}).strict();

export const uploadSchema = z.object({
  dataUrl: z.string().max(3_000_000),
}).strict();

export function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'kategorie';
}

/** Minecraft-Name: Java 3–16 Zeichen (A–Z, 0–9, _), Bedrock-Gamertags auch mit Leerzeichen; Geyser-Präfix . oder * erlaubt */
const mcName = z.string().transform(clean).pipe(
  z.string().regex(/^[.*]?[A-Za-z0-9_](?:[A-Za-z0-9_]| (?! )){2,15}$/, 'Minecraft-Name: 3–16 Zeichen (Buchstaben, Ziffern, _ – bei Bedrock auch Leerzeichen).'),
).refine((v) => !v.endsWith(' '), 'Der Name darf nicht mit einem Leerzeichen enden.');

export const registerSchema = z.object({
  username: mcName,
  password: z.string().max(200),
  edition: z.enum(EDITIONS, { errorMap: () => ({ message: 'Bitte wähle Java oder Bedrock.' }) }),
}).strict();

export const userPatchSchema = z.object({
  role: z.enum(['customer', 'admin']).optional(),
  blocked: z.boolean().optional(),
  resetPassword: z.literal(true).optional(),
}).strict();

export const discordSettingsSchema = z.object({
  // undefined = unverändert lassen, null/'' = entfernen
  webhookUrl: z.union([
    z.literal(''), z.null(),
    z.string().trim().regex(/^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/, 'Das ist keine gültige Discord-Webhook-URL (https://discord.com/api/webhooks/…).'),
  ]).optional(),
  mention: z.string().trim().max(40).refine((m) => m === '' || m === '@here' || m === '@everyone' || /^<@[!&]?\d+>$/.test(m), 'Erlaubt: leer, @here, @everyone, <@BenutzerID> oder <@&RollenID>.'),
  notifyStatus: z.boolean(),
}).strict();
