import express from 'express';
import rateLimit from 'express-rate-limit';
import { Order, Coupon, Subscriber, MonthlyCollection } from '../../src/types';
import { MOCK_REVIEWS } from '../data/mock';
import { randomUUID } from 'crypto';
import { fetchGoogleDriveFiles, renameDriveFile, cleanString, getProductsFromSheet, getReviewsFromSheet, writeGoogleSheetRows, appendGoogleSheetRow, isAuthorizedAdmin, upsertProductRow, deleteProductRow, backfillMissingProductPhotos, slugify } from '../services/googleService';
import { uploadImageBuffer } from '../services/storageService';
import {
  syncProductsToFirestore, setProductInFirestore, deleteProductFromFirestore, getProductsFromFirestore,
  saveOrder, saveCustomer, updateOrderPayment, getOrdersFromFirestore, getCustomersFromFirestore,
  getUnsyncedOrders, markOrderSynced, getUnsyncedCustomers, markCustomerSynced,
  saveMessage, getMessagesFromFirestore, markMessageRead, getUnsyncedMessages, markMessageSynced,
  getCouponsFromFirestore, setCouponInFirestore, deleteCouponFromFirestore,
  getDashboardStats, getAnalyticsData,
  saveSubscriber, updateSubscriberStatusById, getSubscribersFromFirestore, getInterestedCount, getCategoryVotes,
  getMonthlyCollection, saveMonthlyCollection, getSubscriptionConfig, saveSubscriptionConfig
} from '../services/firestoreService';
import { createPaymentPreference, getPaymentDetails } from '../services/mercadoPagoService';
import { createSubscriptionPlan, getSubscriptionDetails } from '../services/mercadoPagoSubscriptionService';
import { getShippingOptions, defaultWeightForCategory } from '../services/correiosService';

const router = express.Router();

function getRequestToken(req: any): string | undefined {
  return req.headers.authorization?.replace(/^Bearer\s+/i, "");
}

// Only lets requests through whose Google account is on the ADMIN_EMAILS
// allowlist — without this, any signed-in Google user could trigger writes
// to the store's Sheet/Drive via these endpoints.
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
    googleSheetId: process.env.GOOGLE_SHEET_ID,
    googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
    mercadoPagoPublicKey: process.env.MERCADOPAGO_PUBLIC_KEY || ""
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
// Lê do espelho no Firestore (rápido, sem bater na API do Sheets a cada
// visita); se ainda não houver espelho (primeira execução), cai pra planilha.
router.get("/api/products", async (req, res) => {
  try {
    let products = await getProductsFromFirestore();
    if (!products) {
      const token = getRequestToken(req);
      products = await getProductsFromSheet(token);
    }
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
    let products = await getProductsFromFirestore();
    if (!products) {
      const token = getRequestToken(req);
      products = await getProductsFromSheet(token);
    }
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
    const token = getRequestToken(req);
    const reviews = await getReviewsFromSheet(token);
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

// Cálculo de frete real (Correios): PAC + SEDEX pro CEP de destino, a partir
// do peso total do carrinho. Nunca inventa um valor — se a API falhar, o
// frontend recebe um erro claro pra mostrar "tentar novamente".
router.post("/api/shipping/calculate", shippingLimiter, async (req, res) => {
  const { cep, items } = req.body;

  if (!cep || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "CEP e itens do carrinho são obrigatórios." });
  }

  try {
    let products = await getProductsFromFirestore();
    if (!products) {
      products = await getProductsFromSheet();
    }

    const totalWeightGrams = items.reduce((sum: number, item: any) => {
      const product = products!.find(p => p.id === item.productId);
      const weight = product?.weightGrams ?? defaultWeightForCategory(product?.category || "");
      return sum + weight * (Number(item.quantity) || 1);
    }, 0);

    const options = await getShippingOptions(cep, totalWeightGrams);
    res.json(options);
  } catch (error: any) {
    // Detalhe técnico (ex: mensagem crua da API dos Correios) só no log do
    // servidor — o cliente recebe uma mensagem genérica e acionável.
    console.error("[Correios] Falha ao calcular frete:", error.message);
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
// ENDPOINTS DO PAINEL ADMIN (Sincronização e Organização)
// -------------------------------------------------------------

// Listar arquivos do Drive da pasta
router.get("/api/admin/drive-files", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const token = getRequestToken(req);
    const files = await fetchGoogleDriveFiles(token);
    res.json({ success: true, files });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Renomear arquivos no Google Drive correspondentes à base de produtos
router.post("/api/admin/rename-files", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const token = getRequestToken(req);

    const driveFiles = await fetchGoogleDriveFiles(token);
    if (!driveFiles || driveFiles.length === 0) {
      return res.status(400).json({ error: "Nenhum arquivo encontrado na pasta do Drive." });
    }

    const report: any[] = [];
    let renamedCount = 0;
    const products = await getProductsFromSheet(token);

    for (const product of products) {
      const cleanedName = cleanString(product.name);
      let matchedFile: any = null;

      // 1. Tenta correspondência exata desconsiderando caracteres especiais
      for (const file of driveFiles) {
        const cleanedFileName = cleanString(file.name.replace(/\.[^/.]+$/, ""));
        if (cleanedFileName === cleanedName) {
          matchedFile = file;
          break;
        }
      }

      // 2. Tenta correspondência parcial
      if (!matchedFile) {
        for (const file of driveFiles) {
          const cleanedFileName = cleanString(file.name.replace(/\.[^/.]+$/, ""));
          if (cleanedName.includes(cleanedFileName) || cleanedFileName.includes(cleanedName)) {
            matchedFile = file;
            break;
          }
        }
      }

      // 3. Tenta correspondência por palavras-chave
      if (!matchedFile) {
        const words = product.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        for (const file of driveFiles) {
          const fileLower = file.name.toLowerCase();
          const hasWord = words.some(word => fileLower.includes(word));
          if (hasWord) {
            matchedFile = file;
            break;
          }
        }
      }

      if (matchedFile) {
        const extension = matchedFile.name.split(".").pop() || "jpg";
        const targetName = `${product.name}.${extension}`;

        if (matchedFile.name !== targetName) {
          const success = await renameDriveFile(matchedFile.id, targetName, token);
          if (success) {
            renamedCount++;
            report.push({ product: product.name, from: matchedFile.name, to: targetName, id: matchedFile.id });
          } else {
            report.push({ product: product.name, error: "Falha ao renomear arquivo", fileId: matchedFile.id });
          }
        } else {
          report.push({ product: product.name, status: "Já renomeado", name: targetName, id: matchedFile.id });
        }
      } else {
        report.push({ product: product.name, status: "Não encontrado no Drive" });
      }
    }

    res.json({ success: true, renamedCount, report });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Preenche fotos e IDs faltantes na planilha real de produtos (a fonte de
// dados é a planilha em si, mantida manualmente — este botão não sobrescreve
// os dados, só completa o que está em branco), garante que Avaliações tenha
// ao menos os dados padrão, e atualiza o espelho de produtos no Firestore.
router.post("/api/admin/sync-sheets", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const token = getRequestToken(req);
    if (!token) return res.status(401).json({ error: "Token de autenticação Google ausente ou inválido." });

    const { updated, total } = await backfillMissingProductPhotos(token);

    const reviewHeaders = ["id", "nome", "estrelas", "comentario", "ativo"];
    const reviewRows = MOCK_REVIEWS.map(r => [
      r.id,
      r.name,
      r.rating,
      r.comment,
      r.active ? "Sim" : "Não"
    ]);
    const reviewSheetData = [reviewHeaders, ...reviewRows];

    const rSuccess = await writeGoogleSheetRows("Avaliacoes!A1:E50", reviewSheetData, token);

    // Atualiza o espelho no Firestore com o estado mais recente da planilha
    // (já com as fotos/IDs preenchidos), pra loja carregar rápido.
    const freshProducts = await getProductsFromSheet(token);
    await syncProductsToFirestore(freshProducts);

    if (rSuccess) {
      res.json({ success: true, message: `Fotos preenchidas: ${updated} de ${total} produtos. Firestore atualizado. Avaliações configuradas.` });
    } else {
      res.status(500).json({ error: "Falha ao gravar a aba de Avaliações." });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// PORTAL ADMINISTRATIVO: CRUD DE PRODUTOS (fonte de dados = Google Sheets)
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
    price: Number(body.price) || 0,
    promoPrice: body.promoPrice !== undefined && body.promoPrice !== "" ? Number(body.promoPrice) : undefined,
    imageUrl: String(body.imageUrl || ""),
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
    const token = getRequestToken(req);
    const products = await getProductsFromSheet(token);
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/admin/products", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const token = getRequestToken(req);
    if (!token) return res.status(401).json({ error: "Token de autenticação Google ausente ou inválido." });

    const parsed = parseProductBody(req.body);
    if (!parsed) return res.status(400).json({ error: "Nome e categoria são obrigatórios." });

    const id = `prod-${randomUUID().slice(0, 8)}`;
    const product = { id, ...parsed };
    const ok = await upsertProductRow(product, token);
    if (!ok) return res.status(500).json({ error: "Falha ao gravar o produto na planilha." });
    await setProductInFirestore(product);
    res.json({ success: true, product });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/api/admin/products/:id", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const token = getRequestToken(req);
    if (!token) return res.status(401).json({ error: "Token de autenticação Google ausente ou inválido." });

    const parsed = parseProductBody(req.body);
    if (!parsed) return res.status(400).json({ error: "Nome e categoria são obrigatórios." });

    const product = { id: req.params.id, ...parsed };
    const ok = await upsertProductRow(product, token);
    if (!ok) return res.status(500).json({ error: "Falha ao atualizar o produto na planilha." });
    await setProductInFirestore(product);
    res.json({ success: true, product });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/admin/products/:id", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const token = getRequestToken(req);
    if (!token) return res.status(401).json({ error: "Token de autenticação Google ausente ou inválido." });

    const ok = await deleteProductRow(req.params.id, token);
    if (!ok) return res.status(404).json({ error: "Produto não encontrado na planilha." });
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

    const baseUrl = `${resolveAppBaseUrl(req)}/#clube`;

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

// Replica pedidos/clientes/mensagens novos do Firestore para as abas que já
// existiam na planilha real da loja (vendas/clientes/mensagens) — só o que
// ainda não foi sincronizado, sem tocar nas linhas históricas já existentes.
router.post("/api/admin/sync-firestore-to-sheet", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const token = getRequestToken(req);
    if (!token) return res.status(401).json({ error: "Token de autenticação Google ausente ou inválido." });

    const [unsyncedOrders, unsyncedCustomers, unsyncedMessages] = await Promise.all([
      getUnsyncedOrders(),
      getUnsyncedCustomers(),
      getUnsyncedMessages()
    ]);

    let ordersSynced = 0;
    for (const order of unsyncedOrders) {
      const ok = await appendGoogleSheetRow("vendas", [
        order.date,
        order.clientName,
        String(order.total).replace(".", ","),
        order.items,
        order.paymentStatus
      ], token);
      if (ok) {
        await markOrderSynced(order.id);
        ordersSynced++;
      }
    }

    let customersSynced = 0;
    for (const { id, customer } of unsyncedCustomers) {
      const ok = await appendGoogleSheetRow("clientes", [
        customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleString("pt-BR") : "",
        customer.name,
        customer.email
      ], token);
      if (ok) {
        await markCustomerSynced(id);
        customersSynced++;
      }
    }

    let messagesSynced = 0;
    for (const msg of unsyncedMessages) {
      const ok = await appendGoogleSheetRow("mensagens", [
        msg.createdAt ? new Date(msg.createdAt).toLocaleString("pt-BR") : "",
        msg.name,
        msg.email,
        msg.message
      ], token);
      if (ok) {
        await markMessageSynced(msg.id);
        messagesSynced++;
      }
    }

    res.json({
      success: true,
      message: `Sincronizado: ${ordersSynced} pedido(s), ${customersSynced} cliente(s), ${messagesSynced} mensagem(ns).`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Checkout - Registra o Pedido e Gera o Link de Pagamento (Mercado Pago)
router.post("/api/checkout", publicWriteLimiter, async (req, res) => {
  const { clientName, phone, email, address, items, total, shippingCost, shippingService } = req.body;

  if (!clientName || !phone || !email || !address || !items || !total) {
    return res.status(400).json({ error: "Todos os campos de checkout são obrigatórios." });
  }

  const orderId = `BL-${Math.floor(100000 + Math.random() * 900000)}`;
  const orderDate = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const formattedItems = items
    .map((item: any) => `${item.product.name} (x${item.quantity}) - R$ ${(item.product.promoPrice || item.product.price).toFixed(2)}`)
    .join(", ");

  const orderItems = items.map((item: any) => ({
    productId: item.product.id,
    name: item.product.name,
    quantity: item.quantity,
    unitPrice: item.product.promoPrice || item.product.price
  }));

  const newOrder: Order = {
    id: orderId,
    date: orderDate,
    clientName,
    phone,
    email,
    address,
    items: formattedItems,
    orderItems,
    total,
    shippingCost: Number(shippingCost) || 0,
    shippingService: shippingService === "SEDEX" ? "SEDEX" : shippingService === "A_COMBINAR" ? "A_COMBINAR" : "PAC",
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

  const preferenceItems = items.map((item: any) => ({
    title: item.product.name,
    quantity: item.quantity,
    unitPrice: item.product.promoPrice || item.product.price
  }));

  if (newOrder.shippingCost && newOrder.shippingCost > 0) {
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

  res.json({
    success: true,
    orderId,
    paymentUrl: preference.initPoint,
    total
  });
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

    await updateOrderPayment({
      orderId: payment.external_reference,
      paymentStatus,
      mpPaymentId: String(paymentId)
    });

    console.log(`[Mercado Pago] Pedido ${payment.external_reference} atualizado para "${paymentStatus}".`);
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
    const products = await getProductsFromSheet();
    const activeProducts = products.filter(p => p.active);
    
    const baseUrl = resolveAppBaseUrl(req);

    res.type("application/xml");

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Home
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    // Active Products
    activeProducts.forEach((prod) => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/produto/${prod.slug}</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>\n`;
    res.send(xml);
  } catch (error) {
    res.status(500).send("Erro ao gerar sitemap");
  }
});

export default router;
