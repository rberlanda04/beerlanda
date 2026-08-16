export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  promoPrice?: number;
  imageUrl: string;
  stock: number;
  category: string;
  slug: string;
  active: boolean;
  weightGrams?: number;
}

export interface Coupon {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
  useLimit?: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  date: string;
  clientName: string;
  phone: string;
  email: string;
  address: string;
  items: string; // Formatted list of items
  orderItems?: OrderItem[]; // Structured line items (only present on orders created after this field was added)
  total: number;
  shippingCost?: number;
  shippingService?: "PAC" | "SEDEX" | "A_COMBINAR";
  paymentStatus: string;
  paymentMethod?: "mercadopago";
  mpPreferenceId?: string;
  mpPaymentId?: string;
  createdAt?: string;
}

export interface Customer {
  name: string;
  phone: string;
  email: string;
  address: string;
  lastOrderAt?: string;
  createdAt?: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  read: boolean;
  createdAt?: string;
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  approvedCount: number;
  pendingCount: number;
  totalCustomers: number;
  totalProducts: number;
  unreadMessages: number;
  recentOrders: Order[];
}

export interface AnalyticsData {
  revenueByDay: { date: string; revenue: number }[];
  ordersByStatus: { status: string; count: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  newCustomersByDay: { date: string; count: number }[];
}

export interface Review {
  id: string;
  name: string;
  rating: number; // 1-5
  comment: string;
  active: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

// --- Clube da Colmeia (assinatura mensal) ---

export type SubscriptionTier = "essencial" | "premium";

export interface Subscriber {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  categories: string[];
  aromas: string[];
  tier: SubscriptionTier;
  // "interessado": captado na fase de lista de interesse (sem cobrança ainda).
  // Os demais status ficam prontos pra quando as assinaturas pagas abrirem.
  status: "interessado" | "pendente" | "ativo" | "pausado" | "cancelado";
  mpPreapprovalId?: string;
  createdAt?: string;
}

export interface MonthlyCollection {
  month: string; // "YYYY-MM"
  tier: SubscriptionTier;
  theme: string;
  story: string;
  productIds: string[];
  revealed: boolean;
}

export interface SubscriptionConfig {
  essencialPlanId?: string;
  premiumPlanId?: string;
}
