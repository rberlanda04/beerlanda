import { initializeApp, getApps, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Product, Order, Coupon, Customer, ContactMessage, DashboardStats, AnalyticsData, Subscriber, SubscriptionTier, MonthlyCollection, SubscriptionConfig } from "../../src/types";
import { randomUUID } from "crypto";
import { getServiceAccountCredentials } from "./gcpCredentials";

if (!getApps().length) {
  const serviceAccount = getServiceAccountCredentials();
  initializeApp({
    credential: serviceAccount ? cert(serviceAccount as any) : applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT || "beerlanda"
  });
}

const db = getFirestore();
// Product.promoPrice is legitimately absent for most products — without this,
// Firestore throws on any write containing an undefined field.
db.settings({ ignoreUndefinedProperties: true });

// -------------------------------------------------------------
// PRODUTOS (espelho da planilha — planilha continua sendo a fonte editável)
// -------------------------------------------------------------
async function syncProductsToFirestore(products: Product[]): Promise<number> {
  if (products.length === 0) return 0;
  const batch = db.batch();
  const col = db.collection("products");
  const now = new Date().toISOString();
  for (const p of products) {
    batch.set(col.doc(p.id), { ...p, updatedAt: now }, { merge: true });
  }
  await batch.commit();
  return products.length;
}

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

// Pedidos ainda não replicados na aba "vendas" da planilha real (lida em
// memória, não via query .where — Firestore "!=" ignora documentos sem o
// campo, o que excluiria justamente os pedidos nunca sincronizados).
async function getUnsyncedOrders(): Promise<Order[]> {
  const snap = await db.collection("orders").get();
  return snap.docs.map((d) => d.data() as Order & { syncedToSheet?: boolean }).filter((o) => !o.syncedToSheet);
}

async function markOrderSynced(orderId: string): Promise<void> {
  await db.collection("orders").doc(orderId).set({ syncedToSheet: true }, { merge: true });
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

async function getUnsyncedCustomers(): Promise<{ id: string; customer: Customer }[]> {
  const snap = await db.collection("customers").get();
  return snap.docs
    .filter((d) => !d.data().syncedToSheet)
    .map((d) => ({ id: d.id, customer: d.data() as Customer }));
}

async function markCustomerSynced(id: string): Promise<void> {
  await db.collection("customers").doc(id).set({ syncedToSheet: true }, { merge: true });
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

async function getUnsyncedMessages(): Promise<ContactMessage[]> {
  const snap = await db.collection("messages").get();
  return snap.docs
    .filter((d) => !d.data().syncedToSheet)
    .map((d) => ({ id: d.id, ...d.data() }) as ContactMessage);
}

async function markMessageSynced(id: string): Promise<void> {
  await db.collection("messages").doc(id).set({ syncedToSheet: true }, { merge: true });
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
  const approved = orders.filter((o) => o.paymentStatus === "Pago");
  const pending = orders.filter((o) => o.paymentStatus?.startsWith("Pendente"));

  return {
    totalOrders: orders.length,
    totalRevenue: approved.reduce((sum, o) => sum + (o.total || 0), 0),
    approvedCount: approved.length,
    pendingCount: pending.length,
    totalCustomers: customersSnap.size,
    totalProducts: productsSnap.size,
    unreadMessages: unreadSnap.size,
    recentOrders: orders.slice(0, 5)
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

  return { revenueByDay, ordersByStatus, topProducts, newCustomersByDay };
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
  syncProductsToFirestore, setProductInFirestore, deleteProductFromFirestore, getProductsFromFirestore,
  saveOrder, updateOrderPayment, getOrdersFromFirestore, getUnsyncedOrders, markOrderSynced,
  saveCustomer, getCustomersFromFirestore, getUnsyncedCustomers, markCustomerSynced,
  saveMessage, getMessagesFromFirestore, markMessageRead, getUnsyncedMessages, markMessageSynced,
  getCouponsFromFirestore, setCouponInFirestore, deleteCouponFromFirestore,
  getDashboardStats, getAnalyticsData,
  saveSubscriber, setSubscriberPreapproval, updateSubscriberStatusById, getSubscribersFromFirestore, getInterestedCount, getCategoryVotes,
  getMonthlyCollection, saveMonthlyCollection, getSubscriptionConfig, saveSubscriptionConfig
};
