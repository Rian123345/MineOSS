import { tr } from './i18n';
// Gemeinsame Konstanten für Server und Client.

export const ORDER_STATUSES = [
  'new',
  'accepted',
  'farming',
  'ready',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Bezeichnungen im Adminbereich */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  get new() { return tr("Neue Bestellung", "New order"); },
  get accepted() { return tr("Angenommen", "Accepted"); },
  get farming() { return tr("Wird gefarmt", "Farming"); },
  get ready() { return tr("Bereit zur Übergabe", "Ready for handover"); },
  get completed() { return tr("Abgeschlossen", "Completed"); },
  get cancelled() { return tr("Storniert", "Cancelled"); },
};

/** Bezeichnungen in der Kunden-Bestellverfolgung */
export const CUSTOMER_STEPS: { status: OrderStatus; label: string; hint: string }[] = [
  { status: 'new', get label() { return tr("Bestellung eingegangen", "Order received"); }, get hint() { return tr("Deine Bestellung ist bei uns angekommen.", "Your order has reached us."); } },
  { status: 'accepted', get label() { return tr("Bestellung angenommen", "Order accepted"); }, get hint() { return tr("Wir haben deine Bestellung geprüft und angenommen.", "We checked and accepted your order."); } },
  { status: 'farming', get label() { return tr("Items werden gefarmt", "Items are being farmed"); }, get hint() { return tr("Deine Items werden gerade in Minecraft gesammelt.", "Your items are being collected in Minecraft right now."); } },
  { status: 'ready', get label() { return tr("Items sind bereit", "Items are ready"); }, get hint() { return tr("Alles ist gefarmt – die Übergabe kann stattfinden.", "Everything is farmed – the handover can take place."); } },
  { status: 'completed', get label() { return tr("Bestellung abgeschlossen", "Order completed"); }, get hint() { return tr("Die Items wurden übergeben. Viel Spaß!", "The items have been handed over. Have fun!"); } },
];

export const STATUS_COLORS: Record<OrderStatus, string> = {
  new: '#2f7fd8',
  accepted: '#7a4fd0',
  farming: '#d98b16',
  ready: '#1f9e5a',
  completed: '#4a7a2a',
  cancelled: '#c0392b',
};

export const EDITIONS = ['java', 'bedrock'] as const;
export type Edition = (typeof EDITIONS)[number];
export const EDITION_LABELS: Record<Edition, string> = { java: 'Java Edition', bedrock: 'Bedrock Edition' };

export const MAX_CART_LINES = 50;
export const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
