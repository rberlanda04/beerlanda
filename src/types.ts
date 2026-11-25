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

  /** Faturamento pago dos últimos 30 dias e dos 30 anteriores, pra mostrar tendência. */
  revenue30d: number;
  revenuePrev30d: number;
  /** Pedidos pagos nos últimos 30 dias e nos 30 anteriores. */
  orders30d: number;
  ordersPrev30d: number;
  /** Valor médio dos pedidos pagos. */
  averageTicket: number;

  /**
   * Acessos à loja, contados por sessão (uma visita por aba aberta). Vêm do
   * contador próprio no Firestore, não do Google Analytics — o GA4 segue no
   * site para análise detalhada, mas não é legível de dentro do painel.
   * Visitas ao próprio /admin não entram na conta.
   */
  visitsToday: number;
  visits30d: number;
  visitsPrev30d: number;
  /** Acessos por dia nos últimos 30 dias, em ordem crescente de data. */
  visitsByDay: { date: string; sessions: number }[];
  /** Pagos que ainda não foram postados — a fila de trabalho do dia. */
  awaitingShipment: number;
  /** Pagamentos pendentes criados há mais de 48h: provavelmente não vão entrar. */
  stalePending: number;
  /** Produtos sem estoque e produtos com 1 ou 2 unidades. */
  outOfStock: number;
  lowStock: { id: string; name: string; stock: number }[];
  /** Produtos que ainda mostram o placeholder no lugar da foto. */
  missingPhotos: number;
  /** Itens que exigem ação, já ordenados por urgência. */
  alerts: DashboardAlert[];
}

export interface DashboardAlert {
  /** Define o ícone e a cor no painel. */
  level: "urgente" | "atencao" | "info";
  title: string;
  detail: string;
  /** Id da aba do portal que resolve o alerta, pra virar um clique. */
  goTo?: "orders" | "products" | "messages" | "reviews" | "integracoes";
}

export interface AnalyticsData {
  revenueByDay: { date: string; revenue: number }[];
  ordersByStatus: { status: string; count: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  newCustomersByDay: { date: string; count: number }[];

  /** Quanto cada categoria faturou — mostra onde está o dinheiro, não só o volume. */
  revenueByCategory: { category: string; revenue: number; quantity: number }[];
  /** Clientes que mais gastaram, pra saber quem merece atenção. */
  topCustomers: { name: string; email: string; orders: number; total: number }[];
  /** Quantos pedidos foram criados e quantos chegaram a ser pagos. */
  paymentFunnel: { created: number; paid: number; lost: number; conversionRate: number };
  /** Transportadora escolhida nos pedidos, incluindo retirada. */
  shippingSplit: { service: string; count: number }[];
  /** Ticket médio por dia, pra ver se o valor do pedido sobe ou cai. */
  ticketByDay: { date: string; ticket: number }[];
  /** Em que dia da semana as vendas acontecem — pauta o calendário de posts. */
  salesByWeekday: { weekday: string; orders: number; revenue: number }[];
}

/**
 * Uma opção de frete cotada, vinda de qualquer transportadora.
 *
 * A lista é variável: o Melhor Envio devolve Correios, Jadlog, Azul e outras no
 * mesmo retorno, e quais aparecem depende do CEP e do peso. Por isso o checkout
 * renderiza o que vier em vez de blocos fixos por serviço.
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
