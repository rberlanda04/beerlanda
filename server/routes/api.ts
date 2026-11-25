import express from 'express';
import rateLimit from 'express-rate-limit';
import { Order, Coupon, Subscriber, MonthlyCollection } from '../../src/types';
import { MOCK_REVIEWS, MOCK_PRODUCTS } from '../data/mock';
import { CATEGORY_SEO, categoryToSlug, findCategoryBySlug } from '../../src/lib/categories';
import { randomUUID } from 'crypto';
import { isAuthorizedAdmin, slugify } from '../services/googleService';
import { renderPageHtml } from '../services/seoService';
import { uploadImageBuffer } from '../services/storageService';
import {
  setProductInFirestore, deleteProductFromFirestore, getProductsFromFirestore,
  saveOrder, saveCustomer, updateOrderPayment, getOrdersFromFirestore, getCustomersFromFirestore,
  getOrderById, claimOrderEmail, getPendingOrdersBetween,
  saveCampaignRecord, getCampaignHistory, setEmailOptOut,
  commitStockForOrder, releaseStockForOrder, updateOrderFulfillment,
  saveMessage, getMessagesFromFirestore, markMessageRead,
  getReviewsFromFirestore, setReviewInFirestore, deleteReviewFromFirestore,
  getCouponsFromFirestore, setCouponInFirestore, deleteCouponFromFirestore,
  getDashboardStats, getAnalyticsData,
  saveSubscriber, updateSubscriberStatusById, getSubscribersFromFirestore, getInterestedCount, getCategoryVotes,
  getMonthlyCollection, saveMonthlyCollection, getSubscriptionConfig, saveSubscriptionConfig
} from '../services/firestoreService';

const FALLBACK_PRODUCT_IMAGE = "https://storage.googleapis.com/beerlanda-product-images/branding/bee-placeholder.svg";
import { createPaymentPreference, getPaymentDetails } from '../services/mercadoPagoService';
import { createSubscriptionPlan, getSubscriptionDetails } from '../services/mercadoPagoSubscriptionService';
import { defaultWeightForCategory, diagnoseCorreios } from '../services/correiosService';
import { getShippingQuotes, activeShippingProvider, diagnoseShipping } from '../services/shippingService';
import { lookupCep } from '../services/cepService';
import { sendEmail, sendBulk, isEmailConfigured, verifyEmailConnection } from '../services/emailService';
import {
  pedidoRecebido, pagamentoAprovado, pagamentoNaoConcluido, pedidoPostado,
  retiradaPronta, carrinhoAbandonado, campanha, respostaCliente, primeiroNome
} from '../services/emailTemplates';

const router = express.Router();

function getRequestToken(req: any): string | undefined {
  return req.headers.authorization?.replace(/^Bearer\s+/i, "");
}

// Only lets requests through whose Google account is on the ADMIN_EMAILS
// allowlist — without this, any signed-in Google user could trigger writes
// to the store's data (products, coupons, reviews...) via these endpoints.
async function requireAdmin(req: any, res: any, next: any) {
  const token = getRequestToken(req);
  if (!token) {
    return res.status(401).json({ error: "Token de autenticação Google ausente ou inválido." });
  }
  const authorized = await isAuthorizedAdmin(token);
  if (!authorized) {
    return res.status(403).json({ error: "Esta conta Google não tem permissão de administrador." });
  }
  next();
}

// Endpoints públicos sem login (checkout, cupom) só têm essa barreira contra abuso/spam.
const publicWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." }
});

// Cálculo de frete pode ser chamado mais vezes enquanto o cliente ajusta o
// CEP ou compara serviços — limite um pouco mais generoso que o de escrita.
const shippingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." }
});

// Limite extra nas rotas admin, além do allowlist de e-mail, contra tentativas repetidas.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." }
});

// -------------------------------------------------------------
// ENDPOINTS DA API
// -------------------------------------------------------------

// 0. Configurações Globais
router.get("/api/config", (req, res) => {
  res.json({
    contactEmail: process.env.CONTACT_EMAIL || "beerlandaprodutosartesanais@gmail.com",
    mercadoPagoPublicKey: process.env.MERCADOPAGO_PUBLIC_KEY || "",
    // Só dígitos com DDI, ex: 5541998765432. Vazio esconde o botão de
    // WhatsApp na retirada, que continua funcionando pelo telefone do pedido.
    whatsappNumber: (process.env.WHATSAPP_NUMBER || "").replace(/\D/g, ""),
    pickupCity: process.env.PICKUP_CITY || "Curitiba e região"
  });
});

// Formulário de contato: perguntas gerais chegam aqui em vez de WhatsApp.
router.post("/api/contact", publicWriteLimiter, async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Nome, e-mail e mensagem são obrigatórios." });
  }
  try {
    await saveMessage({ name, email, message });
    res.json({ success: true });
  } catch (error) {
    console.error("[Firestore] Erro ao gravar mensagem de contato:", error);
    res.status(500).json({ error: "Não foi possível enviar sua mensagem agora. Tente novamente." });
  }
});

// 1. Listar Produtos Ativos
// Firestore é a fonte de dados; cai pro catálogo de exemplo só se o Firestore
// estiver mesmo vazio (loja recém-criada, antes do primeiro produto cadastrado).
router.get("/api/products", async (req, res) => {
  try {
    const products = (await getProductsFromFirestore()) || MOCK_PRODUCTS;
    const activeProducts = products.filter(p => p.active);
    res.json(activeProducts);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

// Favoritos da Home: 3 produtos escolhidos a partir das categorias mais
// marcadas em "o que você mais costuma usar?" no formulário do Clube da
// Colmeia — não é curadoria manual, reflete o que a comunidade já disse.
const FAVORITES_CATEGORY_FALLBACK = ["Sabonetes", "Bálsamos", "Velas", "Sais", "Outros"];

router.get("/api/favorites", async (req, res) => {
  try {
    const products = (await getProductsFromFirestore()) || MOCK_PRODUCTS;
    const activeProducts = products.filter(p => p.active && p.stock > 0);

    const votes = await getCategoryVotes();
    const categoriesPresent = Array.from(new Set(activeProducts.map(p => p.category)));
    const rankedCategories = categoriesPresent.sort((a, b) => {
      const diff = (votes[b] || 0) - (votes[a] || 0);
      if (diff !== 0) return diff;
      return FAVORITES_CATEGORY_FALLBACK.indexOf(a) - FAVORITES_CATEGORY_FALLBACK.indexOf(b);
    });

    const picked: typeof activeProducts = [];
    const basedOn: string[] = [];
    for (const category of rankedCategories) {
      if (picked.length >= 3) break;
      const candidate = activeProducts.find(p => p.category === category && !picked.includes(p));
      if (candidate) {
        picked.push(candidate);
        basedOn.push(category);
      }
    }
    for (const p of activeProducts) {
      if (picked.length >= 3) break;
      if (!picked.includes(p)) picked.push(p);
    }

    res.json({ products: picked, basedOn });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Listar Avaliações Ativas (Prova Social)
router.get("/api/reviews", async (req, res) => {
  try {
    const reviews = (await getReviewsFromFirestore()) || MOCK_REVIEWS;
    const activeReviews = reviews.filter(r => r.active);
    res.json(activeReviews);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar avaliações" });
  }
});

// 3. Validar Cupom de Desconto
router.post("/api/validate-coupon", publicWriteLimiter, async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Código do cupom é obrigatório" });
  }

  try {
    const coupons = await getCouponsFromFirestore();
    const coupon = coupons.find(c => c.code === code.trim().toUpperCase() && c.active);

    if (!coupon) {
      return res.status(404).json({ valid: false, message: "Cupom inválido ou expirado" });
    }

    res.json({ valid: true, coupon });
  } catch (error) {
    res.status(500).json({ error: "Erro ao validar cupom" });
  }
});

// Cálculo de frete real pro CEP de destino, a partir do peso e do valor do
// carrinho. Quem responde é o provedor ativo (Melhor Envio ou Correios
// direto) — a rota não precisa saber qual. Nunca inventa um valor: se a
// cotação falhar, o frontend recebe um erro claro pra oferecer "tentar
// novamente" ou seguir com frete a combinar.
// Auto-preenchimento do endereço no checkout: a cliente digita só o CEP e o
// número. Cada campo a menos pra digitar no celular é carrinho que não é
// abandonado — e o endereço vem padronizado, sem erro de digitação que
// atrapalha a postagem depois.
router.get("/api/cep/:cep", shippingLimiter, async (req, res) => {
  try {
    const found = await lookupCep(req.params.cep);
    if (!found) return res.status(404).json({ error: "CEP não encontrado." });
    // Endereço de CEP não muda: deixa o navegador guardar por um dia.
    res.set("Cache-Control", "public, max-age=86400");
    res.json(found);
  } catch (error: any) {
    console.error("[CEP] Falha na consulta:", error.message);
    res.status(502).json({ error: "Não foi possível consultar o CEP agora." });
  }
});

router.post("/api/shipping/calculate", shippingLimiter, async (req, res) => {
  const { cep, items } = req.body;

  if (!cep || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "CEP e itens do carrinho são obrigatórios." });
  }

  try {
    const products = (await getProductsFromFirestore()) || MOCK_PRODUCTS;

    let totalWeightGrams = 0;
    let declaredValue = 0;

    for (const item of items) {
      const quantity = Number(item.quantity) || 1;
      const product = products.find(p => p.id === item.productId);
      totalWeightGrams += (product?.weightGrams ?? defaultWeightForCategory(product?.category || "")) * quantity;
      // Valor segurado: o que a transportadora cobre em caso de extravio.
      declaredValue += (product?.promoPrice ?? product?.price ?? 0) * quantity;
    }

    const quotes = await getShippingQuotes({ destinationCep: cep, totalWeightGrams, declaredValue });
    res.json(quotes);
  } catch (error: any) {
    // Detalhe técnico (ex: resposta crua da transportadora) só no log do
    // servidor — o cliente recebe uma mensagem genérica e acionável.
    console.error(`[Frete/${activeShippingProvider()}] Falha ao calcular:`, error.message);
    res.status(502).json({ error: "Não foi possível calcular o frete agora. Tente novamente em instantes ou fale com a gente." });
  }
});

// -------------------------------------------------------------
// CLUBE DA COLMEIA (assinatura mensal recorrente)
// -------------------------------------------------------------

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

// Normaliza APP_URL: garante esquema (https://) e sem barra final. Sem isso,
// um valor tipo "beerlanda.com.br" (sem "https://") quebra as back_urls
// enviadas pro Mercado Pago e as URLs absolutas do sitemap/robots.txt.
function resolveAppBaseUrl(req: any): string {
  const raw = process.env.APP_URL;
  if (raw && raw !== "MY_APP_URL") {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return withScheme.replace(/\/$/, "");
  }
  return `${req.protocol}://${req.get("host")}`;
}

// Prévia pública do mês corrente: só tema/história quando o admin marcar como
// revelado — a lista de produtos nunca é exposta aqui (a graça é a surpresa).
router.get("/api/clube/current-collection", async (req, res) => {
  try {
    const month = currentMonthKey();
    const [essencial, premium] = await Promise.all([
      getMonthlyCollection(month, "essencial"),
      getMonthlyCollection(month, "premium")
    ]);
    const teaser = (c: MonthlyCollection | null) => (c?.revealed ? { theme: c.theme, story: c.story } : null);
    res.json({ month, essencial: teaser(essencial), premium: teaser(premium) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fase atual do Clube: só captação de interesse, sem cobrança — guarda a
// pessoa como "interessada" pra já ir construindo a Primeira Colmeia. A
// integração de cobrança recorrente (mercadoPagoSubscriptionService.ts,
// /api/admin/subscription-plans/setup) já existe e fica pronta pra quando as
// assinaturas pagas abrirem, só não é chamada aqui ainda.
router.post("/api/subscribe", publicWriteLimiter, async (req, res) => {
  const { name, phone, email, city, categories, aromas, tier } = req.body;

  if (!name || !phone || !email || !city || (tier !== "essencial" && tier !== "premium")) {
    return res.status(400).json({ error: "Nome, contato, cidade e formato preferido são obrigatórios." });
  }

  try {
    await saveSubscriber({
      name,
      phone,
      email,
      city,
      categories: Array.isArray(categories) ? categories : [],
      aromas: Array.isArray(aromas) ? aromas : [],
      tier
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Clube da Colmeia] Falha ao registrar interesse:", error);
    res.status(500).json({ error: "Não foi possível registrar seu interesse agora. Tente novamente em instantes." });
  }
});

// Contador público (só o número) pra mostrar quantas pessoas já fazem parte
// da Primeira Colmeia — reforça pertencimento sem expor nenhum dado pessoal.
router.get("/api/clube/interesse-count", async (req, res) => {
  try {
    const count = await getInterestedCount();
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// PORTAL ADMINISTRATIVO: CRUD DE PRODUTOS (Firestore)
// -------------------------------------------------------------

function parseCouponBody(body: any): Coupon | null {
  const code = String(body.code || "").trim().toUpperCase();
  const type = body.type === "fixed" ? "fixed" : "percentage";
  const value = Number(body.value);
  if (!code || !value || value <= 0) return null;
  return {
    code,
    type,
    value,
    active: body.active !== false,
    useLimit: body.useLimit !== undefined && body.useLimit !== "" ? Number(body.useLimit) : undefined
  };
}

function parseProductBody(body: any) {
  const name = String(body.name || "").trim();
  const category = String(body.category || "").trim();
  if (!name || !category) return null;
  return {
    name,
    description: String(body.description || ""),
    composition: String(body.composition || ""),
    price: Number(body.price) || 0,
    promoPrice: body.promoPrice !== undefined && body.promoPrice !== "" ? Number(body.promoPrice) : undefined,
    imageUrl: String(body.imageUrl || "") || FALLBACK_PRODUCT_IMAGE,
    stock: Number(body.stock) || 0,
    category,
    slug: body.slug ? String(body.slug) : slugify(name),
    active: body.active !== false,
    weightGrams: body.weightGrams !== undefined && body.weightGrams !== "" ? Number(body.weightGrams) : undefined
  };
}

// Lista todos os produtos (incluindo inativos) para a tabela do portal
router.get("/api/admin/products", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const products = (await getProductsFromFirestore()) || MOCK_PRODUCTS;
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/admin/products", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const parsed = parseProductBody(req.body);
    if (!parsed) return res.status(400).json({ error: "Nome e categoria são obrigatórios." });

    const id = `prod-${randomUUID().slice(0, 8)}`;
    const product = { id, ...parsed };
    await setProductInFirestore(product);
    res.json({ success: true, product });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/api/admin/products/:id", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const parsed = parseProductBody(req.body);
    if (!parsed) return res.status(400).json({ error: "Nome e categoria são obrigatórios." });

    const product = { id: req.params.id, ...parsed };
    await setProductInFirestore(product);
    res.json({ success: true, product });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/admin/products/:id", adminLimiter, requireAdmin, async (req, res) => {
  try {
    await deleteProductFromFirestore(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload de uma imagem (base64) para o Storage, retorna a URL pública estável
router.post("/api/admin/products/:id/image", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const { imageBase64, contentType } = req.body;
    if (!imageBase64 || !contentType || !String(contentType).startsWith("image/")) {
      return res.status(400).json({ error: "Envie uma imagem válida em base64." });
    }
    const buffer = Buffer.from(imageBase64, "base64");
    const ext = String(contentType).split("/")[1]?.split("+")[0] || "jpg";
    const imageUrl = await uploadImageBuffer(buffer, `products/${req.params.id}-${Date.now()}.${ext}`, contentType);
    res.json({ success: true, imageUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// PORTAL ADMINISTRATIVO: DASHBOARD, PEDIDOS, CLIENTES, MENSAGENS, CUPONS
// -------------------------------------------------------------

router.get("/api/admin/dashboard", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/admin/analytics", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const data = await getAnalyticsData();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cria os 2 planos recorrentes no Mercado Pago (uma vez só) e guarda os IDs —
// idempotente: se já existir configuração completa, não recria.
router.post("/api/admin/subscription-plans/setup", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const existing = await getSubscriptionConfig();
    if (existing.essencialPlanId && existing.premiumPlanId) {
      return res.json({ success: true, alreadyConfigured: true, config: existing });
    }

    // #abelhas é a tela de agradecimento de quem concluir o pagamento —
    // distinta do formulário em #clube.
    const baseUrl = `${resolveAppBaseUrl(req)}/#abelhas`;

    const essencial = existing.essencialPlanId
      ? { id: existing.essencialPlanId }
      : await createSubscriptionPlan({ reason: "Colmeia Essencial — Clube da Colmeia Beerlanda", price: 35, baseUrl });
    const premium = existing.premiumPlanId
      ? { id: existing.premiumPlanId }
      : await createSubscriptionPlan({ reason: "Colmeia Premium — Clube da Colmeia Beerlanda", price: 80, baseUrl });

    if (!essencial || !premium) {
      return res.status(502).json({ error: "Não foi possível criar um ou mais planos no Mercado Pago." });
    }

    const config = { essencialPlanId: essencial.id, premiumPlanId: premium.id };
    await saveSubscriptionConfig(config);
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Curadoria da "colheita do mês": tema, história e produtos por plano.
router.get("/api/admin/monthly-collection", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const month = String(req.query.month || currentMonthKey());
    const [essencial, premium] = await Promise.all([
      getMonthlyCollection(month, "essencial"),
      getMonthlyCollection(month, "premium")
    ]);
    res.json({ month, essencial, premium });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/api/admin/monthly-collection", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const { month, tier, theme, story, productIds, revealed } = req.body;
    if (!month || (tier !== "essencial" && tier !== "premium")) {
      return res.status(400).json({ error: "Mês e plano são obrigatórios." });
    }
    const collection: MonthlyCollection = {
      month: String(month),
      tier,
      theme: String(theme || ""),
      story: String(story || ""),
      productIds: Array.isArray(productIds) ? productIds : [],
      revealed: Boolean(revealed)
    };
    await saveMonthlyCollection(collection);
    res.json({ success: true, collection });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/admin/subscribers", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const subscribers = await getSubscribersFromFirestore();
    res.json(subscribers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/admin/orders", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const orders = await getOrdersFromFirestore();
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/admin/customers", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const customers = await getCustomersFromFirestore();
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/admin/messages", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const messages = await getMessagesFromFirestore();
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/api/admin/messages/:id/read", adminLimiter, requireAdmin, async (req, res) => {
  try {
    await markMessageRead(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/admin/coupons", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const coupons = await getCouponsFromFirestore();
    res.json(coupons);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/admin/coupons", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const coupon = parseCouponBody(req.body);
    if (!coupon) return res.status(400).json({ error: "Código, tipo e valor são obrigatórios." });
    await setCouponInFirestore(coupon);
    res.json({ success: true, coupon });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/api/admin/coupons/:code", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const coupon = parseCouponBody({ ...req.body, code: req.params.code });
    if (!coupon) return res.status(400).json({ error: "Código, tipo e valor são obrigatórios." });
    await setCouponInFirestore(coupon);
    res.json({ success: true, coupon });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/admin/coupons/:code", adminLimiter, requireAdmin, async (req, res) => {
  try {
    await deleteCouponFromFirestore(req.params.code);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// PORTAL ADMINISTRATIVO: CRUD DE AVALIAÇÕES (Firestore)
// -------------------------------------------------------------
function parseReviewBody(body: any) {
  const name = String(body.name || "").trim();
  const rating = Number(body.rating);
  if (!name || !rating || rating < 1 || rating > 5) return null;
  return {
    name,
    rating,
    comment: String(body.comment || "").trim(),
    active: body.active !== false
  };
}

router.get("/api/admin/reviews", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const reviews = (await getReviewsFromFirestore()) || MOCK_REVIEWS;
    res.json(reviews);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/admin/reviews", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const parsed = parseReviewBody(req.body);
    if (!parsed) return res.status(400).json({ error: "Nome e nota (1 a 5) são obrigatórios." });
    const review = { id: `rev-${randomUUID().slice(0, 8)}`, ...parsed };
    await setReviewInFirestore(review);
    res.json({ success: true, review });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/api/admin/reviews/:id", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const parsed = parseReviewBody(req.body);
    if (!parsed) return res.status(400).json({ error: "Nome e nota (1 a 5) são obrigatórios." });
    const review = { id: req.params.id, ...parsed };
    await setReviewInFirestore(review);
    res.json({ success: true, review });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/admin/reviews/:id", adminLimiter, requireAdmin, async (req, res) => {
  try {
    await deleteReviewFromFirestore(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Expedição: deixa o pedido andar de "aguardando" até "entregue" e guarda o
// código de rastreio, pra a operação acontecer no painel em vez de na memória
// de quem embala.
const FULFILLMENT_STATUSES = ["aguardando", "separando", "postado", "entregue", "cancelado"] as const;

router.put("/api/admin/orders/:id/fulfillment", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const { fulfillmentStatus, trackingCode } = req.body;
    if (!FULFILLMENT_STATUSES.includes(fulfillmentStatus)) {
      return res.status(400).json({ error: `Etapa inválida. Use uma de: ${FULFILLMENT_STATUSES.join(", ")}.` });
    }
    await updateOrderFulfillment(req.params.id, {
      fulfillmentStatus,
      ...(trackingCode !== undefined ? { trackingCode: String(trackingCode).trim().toUpperCase() } : {})
    });

    // Avisa a cliente quando o pacote sai (ou quando a retirada fica pronta).
    // Só uma vez por pedido: corrigir o código de rastreio depois não dispara
    // outro e-mail.
    let emailSent = false;
    if (fulfillmentStatus === "postado") {
      const order = await getOrderById(req.params.id);
      if (order?.email && (await claimOrderEmail(req.params.id, "postado"))) {
        const aviso = order.shippingService === "RETIRADA" ? retiradaPronta(order) : pedidoPostado(order);
        emailSent = await sendEmail({ to: order.email, ...aviso });
      }
    }

    res.json({ success: true, emailSent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// DIAGNÓSTICO DE INTEGRAÇÕES
// -------------------------------------------------------------
// Deixa o próprio time conferir em que pé está a integração dos Correios sem
// depender de ninguém rodar script: útil justamente enquanto a liberação do
// contrato está pendente, pra saber na hora quando ela sair.
// -------------------------------------------------------------
// E-MAIL: DIAGNÓSTICO, RESPOSTA MANUAL E CAMPANHA
// -------------------------------------------------------------

router.get("/api/admin/email/status", adminLimiter, requireAdmin, async (_req, res) => {
  res.json({
    configured: isEmailConfigured(),
    from: process.env.SMTP_USER || process.env.CONTACT_EMAIL || "",
    ...(await verifyEmailConnection())
  });
});

/** Envia um e-mail de teste pra própria loja, pra conferir como chega. */
router.post("/api/admin/email/test", adminLimiter, requireAdmin, async (req, res) => {
  const to = String(req.body?.to || process.env.CONTACT_EMAIL || "").trim();
  const modelo = campanha({
    titulo: "Teste de envio da loja",
    corpo:
      "Se você está lendo isto, o envio de e-mail da Beerlanda está funcionando.\n\n" +
      "Este é o mesmo visual que as clientes recebem nas campanhas: cabeçalho da marca, " +
      "corpo do texto e um botão opcional.",
    botaoTexto: "Ver a loja",
    botaoUrl: process.env.APP_URL || "https://beerlanda.com.br"
  });
  const ok = await sendEmail({ to, ...modelo });
  res.json({ success: ok, to });
});

/** Resposta manual a uma mensagem do formulário de contato. */
router.post("/api/admin/email/reply", adminLimiter, requireAdmin, async (req, res) => {
  const { to, nome, assunto, mensagem, mensagemOriginal } = req.body || {};
  if (!to || !assunto || !mensagem) {
    return res.status(400).json({ error: "Destinatário, assunto e mensagem são obrigatórios." });
  }
  const ok = await sendEmail({
    to: String(to),
    ...respostaCliente({ nome, assunto: String(assunto), mensagem: String(mensagem), mensagemOriginal })
  });
  res.json({ success: ok });
});

/** Quem recebe a campanha, conforme o público escolhido. */
async function campaignAudience(audience: string): Promise<{ email: string; name?: string }[]> {
  if (audience === "assinantes") {
    const subs = (await getSubscribersFromFirestore()) || [];
    return subs
      .filter((s: any) => s.email && s.status === "ativo" && !s.emailOptOut)
      .map((s: any) => ({ email: s.email, name: s.name }));
  }
  if (audience === "compradores") {
    const orders = (await getOrdersFromFirestore(500)) || [];
    const pagos = orders.filter((o) => o.paymentStatus === "Pago" && o.email);
    return pagos.map((o) => ({ email: o.email, name: o.clientName }));
  }
  // "clientes": todo mundo que já deixou e-mail num pedido
  const customers = (await getCustomersFromFirestore()) || [];
  return customers
    .filter((c: any) => c.email && !c.emailOptOut)
    .map((c: any) => ({ email: c.email, name: c.name }));
}

router.get("/api/admin/campaigns/audience", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const lista = await campaignAudience(String(req.query.audience || "clientes"));
    const unicos = new Set(lista.map((r) => r.email.toLowerCase()));
    res.json({ total: unicos.size, sample: Array.from(unicos).slice(0, 5) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Pré-visualização: devolve o HTML pronto, sem enviar nada. */
router.post("/api/admin/campaigns/preview", adminLimiter, requireAdmin, async (req, res) => {
  const { titulo, corpo, botaoTexto, botaoUrl } = req.body || {};
  if (!titulo || !corpo) return res.status(400).json({ error: "Título e corpo são obrigatórios." });
  const { html } = campanha({
    titulo: String(titulo),
    corpo: String(corpo),
    botaoTexto,
    botaoUrl,
    nomeDestinatario: "Maria",
    unsubscribeUrl: `${resolveAppBaseUrl(req)}/descadastrar?e=exemplo%40email.com`
  });
  res.json({ html });
});

router.post("/api/admin/campaigns/send", adminLimiter, requireAdmin, async (req, res) => {
  const { titulo, corpo, botaoTexto, botaoUrl, audience } = req.body || {};
  if (!titulo || !corpo) return res.status(400).json({ error: "Título e corpo são obrigatórios." });
  if (!isEmailConfigured()) {
    return res.status(400).json({ error: "SMTP não configurado — nenhum e-mail sai da loja ainda." });
  }

  try {
    const base = resolveAppBaseUrl(req);
    const lista = await campaignAudience(String(audience || "clientes"));
    if (lista.length === 0) {
      return res.status(400).json({ error: "Nenhum destinatário nesse público." });
    }

    const resultado = await sendBulk(lista, (r) =>
      campanha({
        titulo: String(titulo),
        corpo: String(corpo),
        botaoTexto,
        botaoUrl,
        nomeDestinatario: r.name,
        unsubscribeUrl: `${base}/descadastrar?e=${encodeURIComponent(r.email)}`
      })
    );

    // Histórico: evita disparar a mesma campanha duas vezes sem perceber.
    await saveCampaignRecord({
      titulo: String(titulo),
      audience: String(audience || "clientes"),
      ...resultado
    });

    res.json(resultado);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/admin/campaigns", adminLimiter, requireAdmin, async (_req, res) => {
  try {
    res.json(await getCampaignHistory());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Descadastro em um clique, sem login — exigido em qualquer e-mail de campanha. */
router.get("/descadastrar", async (req, res) => {
  const email = String(req.query.e || "").trim().toLowerCase();
  let ok = false;
  if (email) {
    try {
      await setEmailOptOut(email);
      ok = true;
    } catch (error: any) {
      console.error("[E-mail] Falha ao descadastrar:", error.message);
    }
  }
  res.set("Content-Type", "text/html; charset=utf-8").send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Beerlanda</title></head>
<body style="margin:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:460px;margin:80px auto;padding:36px;background:#fff;border:1px solid #E8DCC8;border-radius:12px;text-align:center;">
  <div style="font-family:Georgia,serif;font-size:24px;color:#4A3728;font-weight:bold;">Beer<span style="color:#C9A227;">landa</span></div>
  <p style="color:#4A4036;font-size:14px;line-height:1.6;margin-top:22px;">
    ${ok
      ? "Pronto. Você não vai mais receber nossos e-mails de novidade e promoção.<br><br>Avisos sobre pedidos que você fizer continuam chegando — são eles que trazem o código de rastreio."
      : "Não conseguimos identificar esse endereço. Se quiser sair da lista, responda qualquer e-mail nosso que a gente tira na mão."}
  </p>
  <a href="${process.env.APP_URL || "https://beerlanda.com.br"}" style="display:inline-block;margin-top:14px;color:#C9A227;font-weight:bold;text-decoration:none;font-size:13px;">Voltar para a loja</a>
</div></body></html>`);
});

router.get("/api/admin/correios/status", adminLimiter, requireAdmin, async (req, res) => {
  try {
    res.json(await diagnoseCorreios());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cotação de teste pelo provedor que está ativo de verdade (Melhor Envio ou
// Correios direto) — é o que diz se o checkout consegue cotar frete hoje.
router.get("/api/admin/frete/status", adminLimiter, requireAdmin, async (req, res) => {
  try {
    res.json(await diagnoseShipping());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Checkout - Registra o Pedido e Gera o Link de Pagamento (Mercado Pago)
const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Avisa a cliente quando o pagamento muda de estado.
 *
 * `claimOrderEmail` é o que impede repetição: o Mercado Pago reenvia o mesmo
 * webhook várias vezes por pagamento, e sem a trava a pessoa recebe a mesma
 * confirmação quatro ou cinco vezes.
 */
async function notifyPaymentStatusChange(orderId: string, paymentStatus: string): Promise<void> {
  const mapa: Record<string, string> = {
    "Pago": "pago",
    "Recusado": "recusado",
    "Cancelado": "cancelado",
    "Reembolsado": "reembolsado"
  };
  const kind = mapa[paymentStatus];
  if (!kind || !isEmailConfigured()) return;

  try {
    const order = await getOrderById(orderId);
    if (!order?.email) return;
    if (!(await claimOrderEmail(orderId, kind))) return;

    const mensagem =
      kind === "pago"
        ? pagamentoAprovado(order)
        : pagamentoNaoConcluido(order, kind as "recusado" | "cancelado" | "reembolsado");

    await sendEmail({ to: order.email, ...mensagem });
  } catch (error: any) {
    console.error(`[E-mail] Falha ao avisar status do pedido ${orderId}:`, error.message);
  }
}

router.post("/api/checkout", publicWriteLimiter, async (req, res) => {
  const { clientName, phone, email, address, items, cep, couponCode, shippingQuoteId } = req.body;

  if (!clientName || !phone || !email || !address || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Todos os campos de checkout são obrigatórios." });
  }

  // -----------------------------------------------------------------
  // Preço, desconto e frete são decididos AQUI, nunca pelo que chega no
  // corpo da requisição. O carrinho é um objeto do navegador: qualquer
  // pessoa pode editá-lo antes de enviar. Antes desta checagem dava pra
  // POSTar o mesmo pedido com "price": 0.01 e o link de pagamento do
  // Mercado Pago saía com esse valor.
  // -----------------------------------------------------------------
  const catalog = (await getProductsFromFirestore()) || MOCK_PRODUCTS;
  const byId = new Map(catalog.map((p: any) => [p.id, p]));

  const orderItems: { productId: string; name: string; quantity: number; unitPrice: number }[] = [];
  for (const raw of items) {
    const productId = String(raw?.productId ?? raw?.product?.id ?? "");
    const product: any = byId.get(productId);
    if (!product || product.active === false) {
      return res.status(400).json({ error: "Um dos produtos do carrinho não está mais disponível. Atualize a página." });
    }
    const quantity = Math.floor(Number(raw?.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).json({ error: `Quantidade inválida para "${product.name}".` });
    }
    const promo = Number(product.promoPrice);
    const unitPrice = money(promo > 0 ? promo : Number(product.price));
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return res.status(400).json({ error: `"${product.name}" está sem preço cadastrado.` });
    }
    orderItems.push({ productId, name: product.name, quantity, unitPrice });
  }

  const subtotal = money(orderItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0));

  // Cupom revalidado no servidor: o desconto não pode vir pronto do cliente.
  let discount = 0;
  let appliedCouponCode: string | null = null;
  if (couponCode) {
    const coupons = (await getCouponsFromFirestore()) || [];
    const coupon = coupons.find((c: Coupon) => c.code === String(couponCode).trim().toUpperCase() && c.active);
    if (coupon) {
      discount = money(coupon.type === "percentage"
        ? subtotal * (coupon.value / 100)
        : Math.min(coupon.value, subtotal));
      appliedCouponCode = coupon.code;
    }
  }

  // Frete recotado agora. O id da opção identifica a escolha, mas quem diz
  // o preço é a transportadora, não o navegador.
  let shippingCost = 0;
  let shippingService = "A_COMBINAR";
  if (shippingQuoteId === "retirada") {
    // Retirada no ateliê: sem frete, combinada pelo WhatsApp depois do
    // pagamento. A expedição precisa distinguir isso de "não consegui cotar".
    shippingService = "RETIRADA";
  } else if (shippingQuoteId && shippingQuoteId !== "combinar" && cep) {
    try {
      const quotes = await getShippingQuotes({
        destinationCep: String(cep).replace(/\D/g, ""),
        totalWeightGrams: orderItems.reduce((acc, i) => {
          const p: any = byId.get(i.productId);
          return acc + (p?.weightGrams ?? defaultWeightForCategory(p?.category || "")) * i.quantity;
        }, 0),
        declaredValue: subtotal
      });
      const chosen = quotes.find(q => q.id === shippingQuoteId);
      if (chosen) {
        shippingCost = money(chosen.price);
        shippingService = `${chosen.carrier} ${chosen.service}`.slice(0, 60);
      }
    } catch (error: any) {
      // Frete indisponível não bloqueia a venda: vira "a combinar" e a
      // Beerlanda acerta o valor depois, como já era o comportamento.
      console.warn("[Checkout] Recotação de frete falhou, seguindo como A_COMBINAR:", error.message);
    }
  }

  const total = money(Math.max(0, subtotal - discount + shippingCost));

  const orderId = `BL-${Math.floor(100000 + Math.random() * 900000)}`;
  const orderDate = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const formattedItems = orderItems
    .map((i) => `${i.name} (x${i.quantity}) - R$ ${i.unitPrice.toFixed(2)}`)
    .join(", ");

  const newOrder: Order = {
    id: orderId,
    date: orderDate,
    createdAt: new Date().toISOString(),
    clientName,
    phone,
    email,
    address,
    items: formattedItems,
    orderItems,
    subtotal,
    discount,
    couponCode: appliedCouponCode || undefined,
    total,
    shippingCost,
    // Guarda exatamente o que o cliente escolheu ("Jadlog .Package",
    // "Correios SEDEX"...) — a expedição precisa saber por onde despachar.
    shippingService,
    paymentStatus: "Pendente (Mercado Pago)",
    paymentMethod: "mercadopago"
  };

  // Persistência real do pedido: Firestore (não o disco local, que some a
  // cada reinício/nova instância do Cloud Run — pedidos ficavam se perdendo
  // silenciosamente em produção antes desta mudança).
  try {
    await saveOrder(newOrder);
    await saveCustomer({ name: clientName, phone, email, address });
    console.log(`[Firestore] Pedido ${orderId} registrado com sucesso.`);
  } catch (e) {
    console.error("[Firestore] Erro ao gravar pedido:", e);
  }

  const baseUrl = resolveAppBaseUrl(req);

  // O Mercado Pago não aceita linha de desconto nem valor negativo, então o
  // desconto do cupom é diluído proporcionalmente nos itens. Sem isso o site
  // mostrava o total com desconto e a cobrança saía pelo valor cheio — a
  // cliente pagava mais do que foi combinado na tela.
  const discountFactor = subtotal > 0 ? (subtotal - discount) / subtotal : 1;
  const preferenceItems = orderItems.map((i) => ({
    title: i.name,
    quantity: i.quantity,
    unitPrice: money(i.unitPrice * discountFactor)
  }));

  // Arredondar item a item deixa alguns centavos de diferença; o resto vai
  // no primeiro item pra cobrança bater exatamente com o total exibido.
  const itemsSum = money(preferenceItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0));
  const drift = money(money(subtotal - discount) - itemsSum);
  if (drift !== 0 && preferenceItems.length > 0) {
    const first = preferenceItems[0];
    first.unitPrice = money(first.unitPrice + drift / first.quantity);
  }

  if (newOrder.shippingCost > 0) {
    preferenceItems.push({
      title: `Frete (${newOrder.shippingService})`,
      quantity: 1,
      unitPrice: newOrder.shippingCost
    });
  }

  const preference = await createPaymentPreference({
    orderId,
    items: preferenceItems,
    payerName: clientName,
    payerEmail: email,
    baseUrl
  });

  if (!preference) {
    console.error(`[Mercado Pago] Não foi possível gerar o link de pagamento do pedido ${orderId}.`);
    return res.status(502).json({ error: "Não foi possível abrir o pagamento agora. Tente novamente em instantes." });
  }

  await updateOrderPayment({ orderId, paymentStatus: "Pendente (Mercado Pago)", mpPreferenceId: preference.preferenceId });

  // Guarda o link pra poder reenviá-lo no e-mail de carrinho abandonado,
  // horas depois, quando a preferência já não está mais na memória.
  await updateOrderPayment({ orderId, paymentUrl: preference.initPoint } as any);

  // E-mail não bloqueia a resposta: a cliente precisa ser levada pro Mercado
  // Pago agora, e a confirmação pode sair meio segundo depois.
  void sendEmail({
    to: email,
    ...pedidoRecebido(newOrder, preference.initPoint)
  });

  res.json({
    success: true,
    orderId,
    paymentUrl: preference.initPoint,
    total
  });
});

// -------------------------------------------------------------
// CARRINHO ABANDONADO
// -------------------------------------------------------------

/**
 * Lembra quem criou o pedido e não pagou.
 *
 * Janela de 24 a 72 horas: antes de 24h o Pix ainda pode estar aberto e o
 * lembrete vira cobrança chata; depois de 72h o interesse esfriou e o e-mail
 * só gasta a cota diária do Gmail.
 */
async function runAbandonedCartSweep(): Promise<{ checked: number; sent: number }> {
  if (!isEmailConfigured()) return { checked: 0, sent: 0 };
  const HORA = 60 * 60 * 1000;
  const candidatos = await getPendingOrdersBetween(24 * HORA, 72 * HORA);
  let sent = 0;
  for (const order of candidatos) {
    if (!order.email) continue;
    if (!(await claimOrderEmail(order.id, "abandonado"))) continue;
    const ok = await sendEmail({
      to: order.email,
      ...carrinhoAbandonado(order, (order as any).paymentUrl)
    });
    if (ok) sent++;
    // Espaça os envios: o Gmail trata rajada como uso atípico.
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (candidatos.length > 0) {
    console.log(`[Carrinho abandonado] ${candidatos.length} pendente(s) na janela, ${sent} e-mail(s) enviado(s).`);
  }
  return { checked: candidatos.length, sent };
}

// Gatilho externo (Cloud Scheduler). O Cloud Run dorme quando não há tráfego,
// então um timer interno sozinho não é confiável — este endpoint garante a
// execução no horário. Protegido por segredo próprio, não pelo login de admin,
// porque quem chama é uma máquina.
router.post("/api/tasks/abandoned-cart", async (req, res) => {
  const secret = process.env.TASKS_SECRET;
  if (!secret || req.headers["x-tasks-secret"] !== secret) {
    return res.status(401).json({ error: "Não autorizado." });
  }
  try {
    res.json(await runAbandonedCartSweep());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook do Mercado Pago: notificação assíncrona de status de pagamento.
// É a fonte confiável de "foi pago de verdade" — o redirect do navegador
// sozinho não garante isso (a pessoa pode fechar a aba antes de voltar).
router.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    const paymentId = req.query["data.id"] || req.body?.data?.id;
    const type = req.query.type || req.body?.type;

    // Assinaturas do Clube da Colmeia: evento separado dos pagamentos avulsos.
    if (type === "subscription_preapproval" && paymentId) {
      const subscription = await getSubscriptionDetails(String(paymentId));
      if (subscription?.external_reference) {
        const subscriptionStatusMap: Record<string, Subscriber["status"]> = {
          authorized: "ativo",
          paused: "pausado",
          cancelled: "cancelado",
          pending: "pendente"
        };
        const status = subscriptionStatusMap[subscription.status || ""] || "pendente";
        await updateSubscriberStatusById(subscription.external_reference, status);
        console.log(`[Clube da Colmeia] Assinante ${subscription.external_reference} atualizado para "${status}".`);
      }
      return res.status(200).send("ok");
    }

    if (type !== "payment" || !paymentId) {
      return res.status(200).send("ignored");
    }

    const payment = await getPaymentDetails(String(paymentId));
    if (!payment || !payment.external_reference) {
      return res.status(200).send("no reference");
    }

    const statusMap: Record<string, string> = {
      approved: "Pago",
      pending: "Pendente (Mercado Pago)",
      in_process: "Pendente (Mercado Pago)",
      rejected: "Recusado",
      cancelled: "Cancelado",
      refunded: "Reembolsado"
    };
    const paymentStatus = statusMap[payment.status || ""] || "Pendente (Mercado Pago)";

    const orderId = payment.external_reference;

    await updateOrderPayment({
      orderId,
      paymentStatus,
      mpPaymentId: String(paymentId)
    });

    console.log(`[Mercado Pago] Pedido ${orderId} atualizado para "${paymentStatus}".`);

    // Estoque acompanha o pagamento: baixa quando entra, devolve quando sai.
    // As funções são idempotentes, então o reenvio de webhook do Mercado Pago
    // (que é esperado) não baixa duas vezes.
    if (paymentStatus === "Pago") {
      const movement = await commitStockForOrder(orderId);
      if (movement.applied) {
        console.log(`[Estoque] Pedido ${orderId}: baixa aplicada.`);
        // A venda já foi paga — não dá pra desfazer aqui. O aviso existe pra
        // alguém conferir o físico antes de prometer a entrega.
        movement.oversold.forEach((item) =>
          console.warn(`[Estoque] ATENÇÃO pedido ${orderId}: "${item.name}" vendeu ${item.requested} com apenas ${item.available} em estoque.`)
        );
        if (movement.missing.length > 0) {
          console.warn(`[Estoque] Pedido ${orderId}: produto(s) não encontrado(s) no catálogo: ${movement.missing.join(", ")}.`);
        }
      } else {
        console.log(`[Estoque] Pedido ${orderId}: baixa não aplicada (${movement.reason}).`);
      }
    } else if (paymentStatus === "Cancelado" || paymentStatus === "Reembolsado") {
      const movement = await releaseStockForOrder(orderId);
      console.log(
        movement.applied
          ? `[Estoque] Pedido ${orderId}: itens devolvidos ao estoque (${paymentStatus.toLowerCase()}).`
          : `[Estoque] Pedido ${orderId}: nada a devolver (${movement.reason}).`
      );
    }

    // Avisa a cliente da mudança de status. O Mercado Pago reenvia o mesmo
    // webhook várias vezes, então só dispara quando o status mudou de fato —
    // senão a pessoa recebe a mesma confirmação quatro vezes.
    await notifyPaymentStatusChange(orderId, paymentStatus);

    res.status(200).send("ok");
  } catch (error) {
    console.error("[Mercado Pago] Erro ao processar webhook:", error);
    res.status(200).send("error handled");
  }
});

// -------------------------------------------------------------
// SEO TÉCNICO: DYNAMIC SITEMAP & ROBOTS.TXT
// -------------------------------------------------------------

// Robots.txt
router.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  const sitemapUrl = `${resolveAppBaseUrl(req)}/sitemap.xml`;

  res.send(
    `User-agent: *\n` +
    `Allow: /\n` +
    `Disallow: /api/\n` +
    `Disallow: /checkout\n\n` +
    `Sitemap: ${sitemapUrl}`
  );
});

// Sitemap.xml dinâmico
router.get("/sitemap.xml", async (req, res) => {
  try {
    const products = (await getProductsFromFirestore()) || MOCK_PRODUCTS;
    const activeProducts = products.filter(p => p.active);

    const baseUrl = resolveAppBaseUrl(req);
    const today = new Date().toISOString().split("T")[0];

    // lastmod só vale como sinal se for verdade: o Firestore grava updatedAt a
    // cada edição no admin, então usamos a data real do produto e caímos pra
    // hoje apenas quando ela não existe.
    const lastModOf = (product: any): string => {
      const raw = product?.updatedAt;
      if (!raw) return today;
      const date = new Date(raw);
      return Number.isNaN(date.getTime()) ? today : date.toISOString().split("T")[0];
    };

    const entry = (loc: string, lastmod: string, changefreq: string, priority: string) =>
      `  <url>\n` +
      `    <loc>${loc}</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>${changefreq}</changefreq>\n` +
      `    <priority>${priority}</priority>\n` +
      `  </url>\n`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    xml += entry(`${baseUrl}/`, today, "daily", "1.0");

    // Categorias sem nenhum produto ativo ficam de fora: página vazia indexada
    // conta como conteúdo raso e prejudica o domínio inteiro.
    CATEGORY_SEO.forEach((category) => {
      const hasProducts = activeProducts.some(
        p => String(p.category).toLowerCase() === category.name.toLowerCase()
      );
      if (hasProducts) {
        xml += entry(`${baseUrl}/categoria/${category.slug}`, today, "weekly", "0.9");
      }
    });

    activeProducts.forEach((product) => {
      xml += entry(`${baseUrl}/produto/${product.slug}`, lastModOf(product), "weekly", "0.8");
    });

    xml += entry(`${baseUrl}/clube`, today, "monthly", "0.6");

    xml += `</urlset>\n`;

    res.type("application/xml");
    res.send(xml);
  } catch (error) {
    res.status(500).send("Erro ao gerar sitemap");
  }
});

// -------------------------------------------------------------
// PÁGINAS INDEXÁVEIS (metadados montados no servidor)
// -------------------------------------------------------------
// O app é uma SPA e o roteador interno reage a #hash, mas o Google e os
// scrapers de link (WhatsApp, Instagram, Facebook) leem o HTML cru, sem
// executar JavaScript. Cada rota abaixo entrega esse HTML já com título,
// descrição, Open Graph, canonical e JSON-LD próprios — o cliente assume a
// navegação a partir daí. Adicionar um tipo de página novo é declarar um
// objeto no renderPageHtml, não repetir a injeção de tags.

router.get("/produto/:slug", async (req, res, next) => {
  try {
    const products = (await getProductsFromFirestore()) || MOCK_PRODUCTS;
    const product = products.find(p => p.slug === req.params.slug && p.active);
    if (!product) return next();

    const reviews = ((await getReviewsFromFirestore()) || MOCK_REVIEWS).filter(r => r.active);

    const baseUrl = resolveAppBaseUrl(req);
    const url = `${baseUrl}/produto/${product.slug}`;
    const image = product.imageUrl || `${baseUrl}/og-image.png`;
    const categorySlug = categoryToSlug(product.category);

    const productSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description,
      image,
      url,
      sku: product.id,
      brand: { "@type": "Brand", name: "Beerlanda" },
      offers: {
        "@type": "Offer",
        priceCurrency: "BRL",
        price: String(product.promoPrice ?? product.price),
        availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url
      },
      // Avaliações da Beerlanda não são vinculadas a um produto específico, então
      // a nota reflete a satisfação geral da loja — nunca um número inventado por
      // item, o que o Google trata como dado estruturado enganoso.
      ...(reviews.length > 0 ? {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1),
          reviewCount: String(reviews.length)
        }
      } : {})
    };

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: `${baseUrl}/` },
        ...(categorySlug
          ? [{ "@type": "ListItem", position: 2, name: product.category, item: `${baseUrl}/categoria/${categorySlug}` }]
          : []),
        { "@type": "ListItem", position: categorySlug ? 3 : 2, name: product.name, item: url }
      ]
    };

    res.type("html").send(renderPageHtml({
      title: `${product.name} | Beerlanda`,
      description: product.description,
      url,
      image,
      type: "product",
      schemas: [productSchema, breadcrumbSchema]
    }));
  } catch (error) {
    next();
  }
});

// Páginas de categoria: as buscas comerciais que trazem gente nova são por
// categoria ("sabonete artesanal", "bálsamo de cera de abelha"), não pelo nome
// exato de um produto. Sem uma URL própria por categoria, o site só tinha a
// Home competindo por esses termos.
router.get("/categoria/:slug", async (req, res, next) => {
  try {
    const category = findCategoryBySlug(req.params.slug);
    if (!category) return next();

    const products = (await getProductsFromFirestore()) || MOCK_PRODUCTS;
    const inCategory = products.filter(
      p => p.active && String(p.category).toLowerCase() === category.name.toLowerCase()
    );

    const baseUrl = resolveAppBaseUrl(req);
    const url = `${baseUrl}/categoria/${category.slug}`;

    // Prévia de link no WhatsApp/Instagram/Facebook não renderiza SVG, e o
    // placeholder de abelha é justamente um SVG — então a vitrine da categoria
    // usa a primeira foto real que encontrar e só cai pra og-image padrão se
    // nenhum produto da categoria tiver foto própria.
    const showcaseImage = inCategory
      .map(p => p.imageUrl)
      .find(src => src && !/\.svg(\?|$)/i.test(src));

    const itemListSchema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: category.title,
      numberOfItems: inCategory.length,
      itemListElement: inCategory.map((p, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: p.name,
        url: `${baseUrl}/produto/${p.slug}`
      }))
    };

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: `${baseUrl}/` },
        { "@type": "ListItem", position: 2, name: category.name, item: url }
      ]
    };

    res.type("html").send(renderPageHtml({
      title: category.title,
      description: category.description,
      url,
      image: showcaseImage,
      schemas: [itemListSchema, breadcrumbSchema]
    }));
  } catch (error) {
    next();
  }
});

// O Clube da Colmeia é o link mais compartilhado no Instagram/WhatsApp — sem
// metadados próprios, toda divulgação dele mostrava a prévia genérica da Home.
router.get("/clube", (req, res, next) => {
  try {
    const baseUrl = resolveAppBaseUrl(req);
    const url = `${baseUrl}/clube`;

    res.type("html").send(renderPageHtml({
      title: "Clube da Colmeia — Assinatura de Produtos Artesanais | Beerlanda",
      description:
        "Entre para a Primeira Colmeia e receba caixas surpresa com produtos artesanais curados à mão pelo nosso ateliê. Sem custo e sem compromisso para entrar na lista.",
      url,
      schemas: [{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Clube da Colmeia",
        description: "Clube de assinatura de produtos artesanais da Beerlanda.",
        url,
        isPartOf: { "@type": "WebSite", name: "Beerlanda", url: `${baseUrl}/` }
      }]
    }));
  } catch (error) {
    next();
  }
});

export default router;
