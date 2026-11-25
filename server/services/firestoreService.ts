import { initializeApp, getApps, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Product, Order, Coupon, Customer, ContactMessage, DashboardStats, DashboardAlert, AnalyticsData, Subscriber, SubscriptionTier, MonthlyCollection, SubscriptionConfig, Review } from "../../src/types";
import { randomUUID } from "crypto";
import { getServiceAccountCredentials } from "./gcpCredentials";

// cert() valida o formato da chave na hora — se FIREBASE_SERVICE_ACCOUNT_KEY
// estiver malformada (colada errado no painel da plataforma, por exemplo),
// isso NÃO pode derrubar o carregamento do módulo inteiro: numa função
// serverless (Vercel), um throw aqui crasha TODAS as rotas, até as que nunca
// tocam no Firestore. Por isso cai pra ADC nesse caso, e o erro real só
// aparece quando alguma rota tentar ler/gravar de verdade.
function buildFirebaseCredential() {
  const serviceAccount = getServiceAccountCredentials();
  if (serviceAccount) {
    try {
      return cert(serviceAccount as any);
    } catch (error: any) {
      console.error("[Firestore] FIREBASE_SERVICE_ACCOUNT_KEY inválida, caindo para Application Default Credentials:", error.message);
    }
  }
  return applicationDefault();
}

if (!getApps().length) {
  initializeApp({
    credential: buildFirebaseCredential(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT || "beerlanda"
  });
}

const db = getFirestore();
// Product.promoPrice is legitimately absent for most products — without this,
// Firestore throws on any write containing an undefined field.
db.settings({ ignoreUndefinedProperties: true });

// -------------------------------------------------------------
// PRODUTOS (Firestore é a fonte de dados — gerenciados direto pelo portal admin)
// -------------------------------------------------------------
async function setProductInFirestore(product: Product): Promise<void> {
  await db.collection("products").doc(product.id).set({ ...product, updatedAt: new Date().toISOString() }, { merge: true });
}

async function deleteProductFromFirestore(id: string): Promise<void> {
  await db.collection("products").doc(id).delete();
}

async function getProductsFromFirestore(): Promise<Product[] | null> {
  try {
    const snap = await db.collection("products").get();
    if (snap.empty) return null;
    return snap.docs.map((d) => d.data() as Product);
  } catch (error) {
    console.error("[Firestore] Erro ao ler produtos:", error);
    return null;
  }
}

// -------------------------------------------------------------
// PEDIDOS E CLIENTES (só existem no fluxo do app — Firestore é a fonte real,
// substitui o arquivo local em disco, que se perdia a cada reinício/nova
// instância do Cloud Run)
// -------------------------------------------------------------
async function saveOrder(order: Order): Promise<void> {
  await db.collection("orders").doc(order.id).set({ ...order, createdAt: new Date().toISOString() });
}

async function updateOrderPayment(fields: { orderId: string; paymentStatus: string; mpPreferenceId?: string; mpPaymentId?: string }): Promise<void> {
  const { orderId, ...rest } = fields;
  await db.collection("orders").doc(orderId).set(rest, { merge: true });
}

async function getOrdersFromFirestore(limit = 200): Promise<Order[]> {
  const snap = await db.collection("orders").orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((d) => d.data() as Order);
}

// -------------------------------------------------------------
// BAIXA DE ESTOQUE
// -------------------------------------------------------------
// Duas coisas obrigam isto a ser uma transação com marca de idempotência:
//
// 1. O Mercado Pago reenvia o mesmo webhook (é o comportamento normal dele,
//    não uma falha). Sem a marca `stockCommitted` no pedido, o mesmo pedido
//    baixaria o estoque a cada reenvio.
// 2. Dois pedidos pagos no mesmo instante leriam o mesmo saldo e gravariam o
//    mesmo resultado, vendendo a última unidade duas vezes.
//
// O saldo nunca vai abaixo de zero — a venda já foi paga, recusá-la aqui não
// desfaz nada —, mas a falta é devolvida em `oversold` para o log avisar que
// aquele item precisa de conferência no estoque físico.

export interface StockMovement {
  applied: boolean;
  reason?: string;
  oversold: { productId: string; name: string; requested: number; available: number }[];
  missing: string[];
}

async function moveStockForOrder(orderId: string, direction: "commit" | "release"): Promise<StockMovement> {
  return db.runTransaction<StockMovement>(async (tx) => {
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await tx.get(orderRef);

    if (!orderSnap.exists) {
      return { applied: false, reason: "pedido não encontrado", oversold: [], missing: [] };
    }

    const order = orderSnap.data() as Order & { stockCommitted?: boolean };
    const alreadyCommitted = order.stockCommitted === true;

    if (direction === "commit" && alreadyCommitted) {
      return { applied: false, reason: "estoque já baixado antes", oversold: [], missing: [] };
    }
    if (direction === "release" && !alreadyCommitted) {
      return { applied: false, reason: "não havia estoque baixado a devolver", oversold: [], missing: [] };
    }

    // Pedidos antigos, criados antes de orderItems existir, só têm a lista em
    // texto — não há como saber o que baixar, então ficam de fora em vez de
    // adivinhar.
    const items = order.orderItems || [];
    if (items.length === 0) {
      return { applied: false, reason: "pedido sem itens estruturados", oversold: [], missing: [] };
    }

    // O Firestore exige todas as leituras antes de qualquer escrita.
    const refs = items.map((item) => db.collection("products").doc(item.productId));
    const snaps = await tx.getAll(...refs);

    const oversold: StockMovement["oversold"] = [];
    const missing: string[] = [];
    const writes: { ref: typeof refs[number]; stock: number }[] = [];

    items.forEach((item, index) => {
      const snap = snaps[index];
      if (!snap.exists) {
        missing.push(item.productId);
        return;
      }
      const current = Number(snap.data()?.stock) || 0;
      if (direction === "commit") {
        if (current < item.quantity) {
          oversold.push({ productId: item.productId, name: item.name, requested: item.quantity, available: current });
        }
        writes.push({ ref: refs[index], stock: Math.max(0, current - item.quantity) });
      } else {
        writes.push({ ref: refs[index], stock: current + item.quantity });
      }
    });

    const now = new Date().toISOString();
    writes.forEach((write) => tx.update(write.ref, { stock: write.stock, updatedAt: now }));
    tx.update(orderRef, {
      stockCommitted: direction === "commit",
      stockMovedAt: now
    });

    return { applied: true, oversold, missing };
  });
}

/** Baixa o estoque de um pedido pago. Seguro de chamar várias vezes. */
async function commitStockForOrder(orderId: string): Promise<StockMovement> {
  return moveStockForOrder(orderId, "commit");
}

/** Devolve ao estoque os itens de um pedido cancelado ou reembolsado. */
async function releaseStockForOrder(orderId: string): Promise<StockMovement> {
  return moveStockForOrder(orderId, "release");
}

// -------------------------------------------------------------
// EXPEDIÇÃO
// -------------------------------------------------------------
async function updateOrderFulfillment(
  orderId: string,
  fields: { fulfillmentStatus: NonNullable<Order["fulfillmentStatus"]>; trackingCode?: string }
): Promise<void> {
  await db.collection("orders").doc(orderId).set(
    {
      fulfillmentStatus: fields.fulfillmentStatus,
      ...(fields.trackingCode !== undefined ? { trackingCode: fields.trackingCode } : {}),
      fulfillmentUpdatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

async function saveCustomer(customer: Omit<Customer, "lastOrderAt" | "createdAt">): Promise<void> {
  const id = customer.phone.replace(/\D/g, "") || customer.email.toLowerCase();
  if (!id) return;
  const ref = db.collection("customers").doc(id);
  // createdAt só é gravado na primeira compra — necessário pro gráfico de
  // "novos clientes ao longo do tempo" (clientes cadastrados antes desta
  // mudança recebem createdAt na próxima compra que fizerem, não retroativo).
  const existing = await ref.get();
  const createdAt = existing.exists ? existing.data()?.createdAt : new Date().toISOString();
  await ref.set(
    { ...customer, lastOrderAt: new Date().toISOString(), createdAt },
    { merge: true }
  );
}

async function getCustomersFromFirestore(): Promise<Customer[]> {
  const snap = await db.collection("customers").orderBy("lastOrderAt", "desc").get();
  return snap.docs.map((d) => d.data() as Customer);
}

// -------------------------------------------------------------
// MENSAGENS DE CONTATO (substitui o contato via WhatsApp)
// -------------------------------------------------------------
async function saveMessage(msg: { name: string; email: string; message: string }): Promise<void> {
  await db.collection("messages").add({ ...msg, createdAt: new Date().toISOString(), read: false });
}

async function getMessagesFromFirestore(): Promise<ContactMessage[]> {
  const snap = await db.collection("messages").orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContactMessage);
}

async function markMessageRead(id: string): Promise<void> {
  await db.collection("messages").doc(id).set({ read: true }, { merge: true });
}

// -------------------------------------------------------------
// AVALIAÇÕES (gerenciadas direto pelo portal admin)
// -------------------------------------------------------------
async function getReviewsFromFirestore(): Promise<Review[] | null> {
  try {
    const snap = await db.collection("reviews").get();
    if (snap.empty) return null;
    return snap.docs.map((d) => d.data() as Review);
  } catch (error) {
    console.error("[Firestore] Erro ao ler avaliações:", error);
    return null;
  }
}

async function setReviewInFirestore(review: Review): Promise<void> {
  await db.collection("reviews").doc(review.id).set(review, { merge: true });
}

async function deleteReviewFromFirestore(id: string): Promise<void> {
  await db.collection("reviews").doc(id).delete();
}

// -------------------------------------------------------------
// CUPONS PROMOCIONAIS (gerenciados direto pelo portal admin)
// -------------------------------------------------------------
async function getCouponsFromFirestore(): Promise<Coupon[]> {
  const snap = await db.collection("coupons").get();
  return snap.docs.map((d) => d.data() as Coupon);
}

async function setCouponInFirestore(coupon: Coupon): Promise<void> {
  await db.collection("coupons").doc(coupon.code.toUpperCase()).set(coupon);
}

async function deleteCouponFromFirestore(code: string): Promise<void> {
  await db.collection("coupons").doc(code.toUpperCase()).delete();
}

// -------------------------------------------------------------
// DASHBOARD
// -------------------------------------------------------------
async function getDashboardStats(): Promise<DashboardStats> {
  const [ordersSnap, customersSnap, productsSnap, unreadSnap] = await Promise.all([
    db.collection("orders").orderBy("createdAt", "desc").get(),
    db.collection("customers").get(),
    db.collection("products").get(),
    db.collection("messages").where("read", "==", false).get()
  ]);

  const orders = ordersSnap.docs.map((d) => d.data() as Order);
  const products = productsSnap.docs.map((d) => d.data() as Product);
  const approved = orders.filter((o) => o.paymentStatus === "Pago");
  const pending = orders.filter((o) => o.paymentStatus?.startsWith("Pendente"));

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const since = (days: number) => now - days * DAY;
  const placedAt = (o: Order) => (o.createdAt ? new Date(o.createdAt).getTime() : NaN);
  const inWindow = (o: Order, from: number, to: number) => {
    const t = placedAt(o);
    return !Number.isNaN(t) && t >= from && t < to;
  };

  const paid30 = approved.filter((o) => inWindow(o, since(30), now));
  const paidPrev30 = approved.filter((o) => inWindow(o, since(60), since(30)));
  const sum = (list: Order[]) => list.reduce((acc, o) => acc + (o.total || 0), 0);

  // "Postado" e "entregue" já saíram; o resto dos pagos é fila de expedição.
  const awaitingShipment = approved.filter(
    (o) => !["postado", "entregue", "cancelado"].includes(o.fulfillmentStatus || "aguardando")
  ).length;

  // Pix e boleto expiram. Pendente com mais de 48h quase nunca vira venda, e
  // ficar no contador de "pendentes" faz parecer que há dinheiro a receber.
  const stalePending = pending.filter((o) => {
    const t = placedAt(o);
    return !Number.isNaN(t) && t < since(2);
  }).length;

  const active = products.filter((p) => p.active !== false);
  const outOfStock = active.filter((p) => (p.stock ?? 0) === 0).length;
  const lowStock = active
    .filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 2)
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 }));
  const missingPhotos = active.filter((p) => !p.imageUrl || p.imageUrl.includes("bee-placeholder")).length;

  // Alertas em ordem de urgência: primeiro o que custa venda ou atrasa cliente.
  const alerts: DashboardAlert[] = [];
  if (awaitingShipment > 0) {
    alerts.push({
      level: "urgente",
      title: `${awaitingShipment} pedido${awaitingShipment === 1 ? "" : "s"} pago${awaitingShipment === 1 ? "" : "s"} esperando envio`,
      detail: "Cliente já pagou e ainda não recebeu código de rastreio.",
      goTo: "orders"
    });
  }
  if (unreadSnap.size > 0) {
    alerts.push({
      level: "urgente",
      title: `${unreadSnap.size} mensagem${unreadSnap.size === 1 ? "" : "ns"} sem resposta`,
      detail: "Contato pelo formulário do site aguardando retorno.",
      goTo: "messages"
    });
  }
  if (outOfStock > 0) {
    alerts.push({
      level: "atencao",
      title: `${outOfStock} produto${outOfStock === 1 ? "" : "s"} esgotado${outOfStock === 1 ? "" : "s"}`,
      detail: "Aparecem na loja marcados como esgotados e não vendem.",
      goTo: "products"
    });
  }
  if (missingPhotos > 0) {
    alerts.push({
      level: "atencao",
      title: `${missingPhotos} produto${missingPhotos === 1 ? "" : "s"} sem foto`,
      detail: "Mostram o desenho de abelha no lugar da imagem — é o que mais derruba conversão.",
      goTo: "products"
    });
  }
  if (lowStock.length > 0) {
    alerts.push({
      level: "info",
      title: `${lowStock.length} produto${lowStock.length === 1 ? "" : "s"} com estoque baixo`,
      detail: lowStock.slice(0, 3).map((p) => `${p.name} (${p.stock})`).join(" · "),
      goTo: "products"
    });
  }
  if (stalePending > 0) {
    alerts.push({
      level: "info",
      title: `${stalePending} pagamento${stalePending === 1 ? "" : "s"} parado${stalePending === 1 ? "" : "s"} há mais de 48h`,
      detail: "Pix ou boleto que provavelmente expirou — vale cancelar pra limpar a lista.",
      goTo: "orders"
    });
  }

  return {
    totalOrders: orders.length,
    totalRevenue: sum(approved),
    approvedCount: approved.length,
    pendingCount: pending.length,
    totalCustomers: customersSnap.size,
    totalProducts: productsSnap.size,
    unreadMessages: unreadSnap.size,
    recentOrders: orders.slice(0, 8),
    revenue30d: sum(paid30),
    revenuePrev30d: sum(paidPrev30),
    orders30d: paid30.length,
    ordersPrev30d: paidPrev30.length,
    averageTicket: approved.length > 0 ? sum(approved) / approved.length : 0,
    awaitingShipment,
    stalePending,
    outOfStock,
    lowStock: lowStock.slice(0, 8),
    missingPhotos,
    alerts
  };
}

// -------------------------------------------------------------
// ANÁLISES (gráficos do portal admin)
// -------------------------------------------------------------
function toDayKey(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function last30DaysKeys(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function getAnalyticsData(): Promise<AnalyticsData> {
  const [ordersSnap, customersSnap] = await Promise.all([
    db.collection("orders").orderBy("createdAt", "desc").get(),
    db.collection("customers").get()
  ]);

  const orders = ordersSnap.docs.map((d) => d.data() as Order);
  const customers = customersSnap.docs.map((d) => d.data() as Customer);
  const days = last30DaysKeys();

  // Faturamento por dia (só pedidos pagos)
  const revenueByDayMap = new Map<string, number>(days.map((d) => [d, 0]));
  for (const order of orders) {
    if (order.paymentStatus !== "Pago") continue;
    const key = toDayKey(order.createdAt);
    if (key && revenueByDayMap.has(key)) {
      revenueByDayMap.set(key, (revenueByDayMap.get(key) || 0) + (order.total || 0));
    }
  }
  const revenueByDay = days.map((date) => ({ date, revenue: revenueByDayMap.get(date) || 0 }));

  // Pedidos por status
  const statusCounts = new Map<string, number>();
  for (const order of orders) {
    const status = order.paymentStatus || "Desconhecido";
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }
  const ordersByStatus = Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count }));

  // Produtos mais vendidos — só considera pedidos que já têm orderItems estruturado
  const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.orderItems || []) {
      const current = productTotals.get(item.productId) || { name: item.name, quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.quantity * item.unitPrice;
      productTotals.set(item.productId, current);
    }
  }
  const topProducts = Array.from(productTotals.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Clientes novos por dia
  const newCustomersByDayMap = new Map<string, number>(days.map((d) => [d, 0]));
  for (const customer of customers) {
    const key = toDayKey(customer.createdAt);
    if (key && newCustomersByDayMap.has(key)) {
      newCustomersByDayMap.set(key, (newCustomersByDayMap.get(key) || 0) + 1);
    }
  }
  const newCustomersByDay = days.map((date) => ({ date, count: newCustomersByDayMap.get(date) || 0 }));

  const paidOrders = orders.filter((o) => o.paymentStatus === "Pago");

  // Faturamento por categoria. O pedido guarda o id do produto, então a
  // categoria vem do catálogo atual — produto renomeado ou recategorizado
  // aparece onde está hoje, que é o que interessa pra decidir o que produzir.
  const productsSnap = await db.collection("products").get();
  const categoryById = new Map(
    productsSnap.docs.map((d) => {
      const p = d.data() as Product;
      return [p.id, p.category || "Outros"];
    })
  );
  const categoryTotals = new Map<string, { revenue: number; quantity: number }>();
  for (const order of paidOrders) {
    for (const item of order.orderItems || []) {
      const category = categoryById.get(item.productId) || "Outros";
      const current = categoryTotals.get(category) || { revenue: 0, quantity: 0 };
      current.revenue += item.quantity * item.unitPrice;
      current.quantity += item.quantity;
      categoryTotals.set(category, current);
    }
  }
  const revenueByCategory = Array.from(categoryTotals.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // Melhores clientes, agrupados por e-mail (o nome a pessoa digita diferente
  // a cada compra; o e-mail é o que identifica de verdade).
  const customerTotals = new Map<string, { name: string; email: string; orders: number; total: number }>();
  for (const order of paidOrders) {
    const email = (order.email || "").toLowerCase();
    if (!email) continue;
    const current = customerTotals.get(email) || { name: order.clientName, email, orders: 0, total: 0 };
    current.orders += 1;
    current.total += order.total || 0;
    customerTotals.set(email, current);
  }
  const topCustomers = Array.from(customerTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Quantos chegaram ao fim. Pedido criado e não pago é carrinho que foi até
  // o Mercado Pago e desistiu — é o número que mede o atrito do checkout.
  const created = orders.length;
  const paid = paidOrders.length;
  const paymentFunnel = {
    created,
    paid,
    lost: created - paid,
    conversionRate: created > 0 ? (paid / created) * 100 : 0
  };

  // Transportadora escolhida, normalizada: "A_COMBINAR" e "RETIRADA" viram
  // rótulos legíveis em vez de aparecerem como constante do código.
  const shippingCounts = new Map<string, number>();
  for (const order of paidOrders) {
    const raw = order.shippingService || "A_COMBINAR";
    const label = raw === "RETIRADA" ? "Retirada em mãos" : raw === "A_COMBINAR" ? "A combinar" : raw;
    shippingCounts.set(label, (shippingCounts.get(label) || 0) + 1);
  }
  const shippingSplit = Array.from(shippingCounts.entries())
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count);

  // Ticket médio por dia: só os dias que tiveram venda entram com valor.
  const ticketByDay = days.map((date) => {
    const doDia = paidOrders.filter((o) => toDayKey(o.createdAt) === date);
    const totalDoDia = doDia.reduce((acc, o) => acc + (o.total || 0), 0);
    return { date, ticket: doDia.length > 0 ? totalDoDia / doDia.length : 0 };
  });

  // Dia da semana em que a venda acontece — serve pra escolher quando postar.
  const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const weekdayTotals = WEEKDAYS.map((weekday) => ({ weekday, orders: 0, revenue: 0 }));
  for (const order of paidOrders) {
    if (!order.createdAt) continue;
    const d = new Date(order.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const slot = weekdayTotals[d.getDay()];
    slot.orders += 1;
    slot.revenue += order.total || 0;
  }

  return {
    revenueByDay,
    ordersByStatus,
    topProducts,
    newCustomersByDay,
    revenueByCategory,
    topCustomers,
    paymentFunnel,
    shippingSplit,
    ticketByDay,
    salesByWeekday: weekdayTotals
  };
}

// -------------------------------------------------------------
// CLUBE DA COLMEIA (assinatura mensal)
// -------------------------------------------------------------
async function saveSubscriber(data: { name: string; phone: string; email: string; city: string; categories: string[]; aromas: string[]; tier: SubscriptionTier }): Promise<string> {
  const id = data.phone.replace(/\D/g, "") ? `${data.phone.replace(/\D/g, "")}-${randomUUID().slice(0, 6)}` : randomUUID();
  const subscriber: Subscriber = { id, ...data, status: "interessado", createdAt: new Date().toISOString() };
  await db.collection("subscribers").doc(id).set(subscriber);
  return id;
}

async function getInterestedCount(): Promise<number> {
  const snap = await db.collection("subscribers").count().get();
  return snap.data().count;
}

// Conta quantas vezes cada categoria foi marcada em "o que você mais costuma
// usar?" no formulário do Clube — usado pra destacar os "Favoritos" na Home
// com base no que a comunidade realmente prefere, não numa escolha manual.
async function getCategoryVotes(): Promise<Record<string, number>> {
  const snap = await db.collection("subscribers").get();
  const votes: Record<string, number> = {};
  for (const doc of snap.docs) {
    const categories = (doc.data().categories as string[]) || [];
    for (const category of categories) {
      votes[category] = (votes[category] || 0) + 1;
    }
  }
  return votes;
}

async function setSubscriberPreapproval(id: string, mpPreapprovalId: string): Promise<void> {
  await db.collection("subscribers").doc(id).set({ mpPreapprovalId }, { merge: true });
}

async function updateSubscriberStatusById(id: string, status: Subscriber["status"]): Promise<void> {
  await db.collection("subscribers").doc(id).set({ status }, { merge: true });
}

async function getSubscribersFromFirestore(): Promise<Subscriber[]> {
  const snap = await db.collection("subscribers").orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => d.data() as Subscriber);
}

function monthlyCollectionDocId(month: string, tier: SubscriptionTier): string {
  return `${month}_${tier}`;
}

async function getMonthlyCollection(month: string, tier: SubscriptionTier): Promise<MonthlyCollection | null> {
  const doc = await db.collection("monthlyCollections").doc(monthlyCollectionDocId(month, tier)).get();
  return doc.exists ? (doc.data() as MonthlyCollection) : null;
}

async function saveMonthlyCollection(collection: MonthlyCollection): Promise<void> {
  await db.collection("monthlyCollections").doc(monthlyCollectionDocId(collection.month, collection.tier)).set(collection);
}

async function getSubscriptionConfig(): Promise<SubscriptionConfig> {
  const doc = await db.collection("config").doc("subscriptionPlans").get();
  return doc.exists ? (doc.data() as SubscriptionConfig) : {};
}

async function saveSubscriptionConfig(config: SubscriptionConfig): Promise<void> {
  await db.collection("config").doc("subscriptionPlans").set(config, { merge: true });
}

export {
  setProductInFirestore, deleteProductFromFirestore, getProductsFromFirestore,
  saveOrder, updateOrderPayment, getOrdersFromFirestore,
  commitStockForOrder, releaseStockForOrder, updateOrderFulfillment,
  saveCustomer, getCustomersFromFirestore,
  saveMessage, getMessagesFromFirestore, markMessageRead,
  getReviewsFromFirestore, setReviewInFirestore, deleteReviewFromFirestore,
  getCouponsFromFirestore, setCouponInFirestore, deleteCouponFromFirestore,
  getDashboardStats, getAnalyticsData,
  saveSubscriber, setSubscriberPreapproval, updateSubscriberStatusById, getSubscribersFromFirestore, getInterestedCount, getCategoryVotes,
  getMonthlyCollection, saveMonthlyCollection, getSubscriptionConfig, saveSubscriptionConfig
};
