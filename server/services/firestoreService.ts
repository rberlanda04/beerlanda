import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Product, Order, Coupon, Customer, ContactMessage, DashboardStats } from "../../src/types";

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
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

async function saveCustomer(customer: Omit<Customer, "lastOrderAt">): Promise<void> {
  const id = customer.phone.replace(/\D/g, "") || customer.email.toLowerCase();
  if (!id) return;
  await db.collection("customers").doc(id).set(
    { ...customer, lastOrderAt: new Date().toISOString() },
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

export {
  syncProductsToFirestore, setProductInFirestore, deleteProductFromFirestore, getProductsFromFirestore,
  saveOrder, updateOrderPayment, getOrdersFromFirestore, getUnsyncedOrders, markOrderSynced,
  saveCustomer, getCustomersFromFirestore, getUnsyncedCustomers, markCustomerSynced,
  saveMessage, getMessagesFromFirestore, markMessageRead, getUnsyncedMessages, markMessageSynced,
  getCouponsFromFirestore, setCouponInFirestore, deleteCouponFromFirestore,
  getDashboardStats
};
