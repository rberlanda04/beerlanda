export interface Product {
  id: string;
  name: string;
  description: string;
  composition?: string;
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
  /** Soma dos itens antes de desconto e frete. Ausente em pedidos antigos. */
  subtotal?: number;
  /** Desconto do cupom em reais, já calculado no servidor. */
  discount?: number;
  /** Cupom efetivamente aceito no fechamento (não o que o cliente digitou). */
  couponCode?: string;
  total: number;
  shippingCost?: number;
  /**
   * Transportadora e serviço escolhidos, como texto livre — ex: "Correios PAC",
   * "Jadlog .Package" — ou "A_COMBINAR" quando a cotação não saiu. Deixou de
   * ser uma lista fechada quando o frete passou a vir de um agregador, que
   * responde com transportadoras que não dá pra enumerar de antemão.
   */
  shippingService?: string;
  paymentStatus: string;
  paymentMethod?: "mercadopago";
  mpPreferenceId?: string;
  mpPaymentId?: string;
  createdAt?: string;
  /** Etapa da expedição. Ausente em pedidos antigos — tratar como "aguardando". */
  fulfillmentStatus?: "aguardando" | "separando" | "postado" | "entregue" | "cancelado";
  trackingCode?: string;
  fulfillmentUpdatedAt?: string;
  /** Marca de que a baixa de estoque deste pedido já foi aplicada. */
  stockCommitted?: boolean;
  stockMovedAt?: string;
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

/**
 * Uma opção de frete cotada, vinda de qualquer transportadora.
 *
 * Antes o cálculo devolvia uma estrutura fixa com PAC e SEDEX, porque a API
 * dos Correios só responde por um serviço de cada vez. Agregadores devolvem
 * uma lista variável — Correios, Jadlog, Azul e outras no mesmo retorno —,
 * então o checkout passa a renderizar o que vier em vez de dois blocos fixos.
 */
export interface ShippingQuote {
  /** Identificador estável desta opção, usado na seleção do checkout. */
  id: string;
  /** Nome do serviço: "PAC", "SEDEX", ".Package". */
  service: string;
  /** Transportadora: "Correios", "Jadlog". */
  carrier: string;
  price: number;
  /** Prazo em dias úteis. 0 quando a transportadora não informa. */
  days: number;
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
