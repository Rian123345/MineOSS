import type { Edition, OrderStatus } from './constants';

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  /** Englischer Name/Beschreibung (optional, für die Sprachumschaltung) */
  nameEn?: string | null;
  descriptionEn?: string | null;
  icon: string;
  sortOrder: number;
  active: boolean;
  productCount?: number;
}

export interface Product {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  nameEn?: string | null;
  descriptionEn?: string | null;
  priceCents: number;
  unitLabel: string;
  /** null = unbegrenzt / wird auf Anfrage gefarmt */
  stock: number | null;
  minQty: number;
  maxQty: number;
  icon: string;
  imageUrl: string | null;
  active: boolean;
  featured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Catalog {
  categories: Category[];
  products: Product[];
  /** „Meist gekaufte Sachen“ – automatisch aus den Bestellungen, beste zuerst */
  topProductIds?: number[];
}

export interface CartLine {
  productId: number;
  quantity: number;
}

export interface OrderItem {
  productId: number | null;
  productName: string;
  unitLabel: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  icon?: string;
  imageUrl?: string | null;
}

export interface StatusEntry {
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  playerName: string;
  edition: Edition;
  discordName: string | null;
  deliveryTime: string | null;
  notes: string | null;
  status: OrderStatus;
  totalCents: number;
  itemCount: number;
  adminNote: string | null;
  discordStatus: string | null;
  userId?: number | null;
  accountName?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  history?: StatusEntry[];
}

export interface PublicOrderView {
  orderNumber: string;
  playerName: string;
  edition: Edition;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  deliveryTime: string | null;
  items: OrderItem[];
  history: StatusEntry[];
}

export interface OrderCreated {
  orderNumber: string;
  accessCode: string;
  totalCents: number;
  createdAt: string;
  items: OrderItem[];
}

export interface DashboardStats {
  total: number;
  byStatus: Record<OrderStatus, number>;
  open: number;
  revenueCents: number;
  revenueOpenCents: number;
  perDay: { day: string; count: number; revenueCents: number }[];
  recent: Order[];
  topProducts: { name: string; quantity: number; revenueCents: number }[];
}

export interface SessionUser {
  id: number;
  name: string;
  edition: 'java' | 'bedrock' | null;
  role: 'customer' | 'admin';
}

export interface AuthStatus {
  user: SessionUser | null;
  noAdmin: boolean;
  setupAllowed: boolean;
  isLocal: boolean;
  version?: string;
  build?: string;
}

export interface ShopUser extends SessionUser {
  blocked: boolean;
  orderCount: number;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface MyOrderSummary {
  orderNumber: string;
  status: import('./constants').OrderStatus;
  totalCents: number;
  createdAt: string;
  playerName: string;
  items: OrderItem[];
}

export interface AdminNotification {
  id: number;
  type: string;
  orderId: number | null;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
