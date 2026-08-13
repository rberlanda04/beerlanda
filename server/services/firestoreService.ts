import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Product, Order } from "../../src/types";

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

// Espelho rápido dos produtos para a loja não depender da API do Sheets a
// cada visita — a planilha continua sendo a fonte editável pelo lojista;
// isso aqui é só cache/leitura otimizada, atualizado a cada sync ou edição.
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

// Pedidos e clientes só existem no fluxo do app (não vêm da planilha), então
// o Firestore é a fonte real deles — substitui o arquivo local em disco, que
// se perde a cada reinício/instância nova do Cloud Run.
async function saveOrder(order: Order): Promise<void> {
  await db.collection("orders").doc(order.id).set({ ...order, createdAt: new Date().toISOString() });
}

interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
}

async function saveCustomer(customer: CustomerInfo): Promise<void> {
  const id = customer.phone.replace(/\D/g, "") || customer.email.toLowerCase();
  if (!id) return;
  await db.collection("customers").doc(id).set(
    { ...customer, lastOrderAt: new Date().toISOString() },
    { merge: true }
  );
}

async function updateOrderPayment(fields: { orderId: string; paymentStatus: string; mpPreferenceId?: string; mpPaymentId?: string }): Promise<void> {
  const { orderId, ...rest } = fields;
  await db.collection("orders").doc(orderId).set(rest, { merge: true });
}

interface ContactMessage {
  name: string;
  email: string;
  message: string;
}

// Perguntas gerais dos clientes (substitui o contato via WhatsApp).
async function saveMessage(msg: ContactMessage): Promise<void> {
  await db.collection("messages").add({ ...msg, createdAt: new Date().toISOString(), read: false });
}

export { syncProductsToFirestore, setProductInFirestore, deleteProductFromFirestore, getProductsFromFirestore, saveOrder, saveCustomer, updateOrderPayment, saveMessage };
