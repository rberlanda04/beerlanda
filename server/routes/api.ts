import express from 'express';
import rateLimit from 'express-rate-limit';
import { Order } from '../../src/types';
import { MOCK_COUPONS, MOCK_REVIEWS } from '../data/mock';
import { randomUUID } from 'crypto';
import { fetchGoogleDriveFiles, renameDriveFile, cleanString, getProductsFromSheet, getCouponsFromSheet, getReviewsFromSheet, writeGoogleSheetRows, isAuthorizedAdmin, upsertProductRow, deleteProductRow, backfillMissingProductPhotos, slugify } from '../services/googleService';
import { uploadImageBuffer } from '../services/storageService';
import { syncProductsToFirestore, setProductInFirestore, deleteProductFromFirestore, getProductsFromFirestore, saveOrder, saveCustomer } from '../services/firestoreService';

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
    whatsappPhone: process.env.WHATSAPP_PHONE || "5541998996996",
    contactEmail: process.env.CONTACT_EMAIL || "beerlandaprodutosartesanais@gmail.com",
    googleSheetId: process.env.GOOGLE_SHEET_ID,
    googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID
  });
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
    const token = getRequestToken(req);
    const coupons = await getCouponsFromSheet(token);
    const coupon = coupons.find(c => c.code === code.trim().toUpperCase() && c.active);

    if (!coupon) {
      return res.status(404).json({ valid: false, message: "Cupom inválido ou expirado" });
    }

    res.json({ valid: true, coupon });
  } catch (error) {
    res.status(500).json({ error: "Erro ao validar cupom" });
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
// os dados, só completa o que está em branco) e garante que Cupons/Avaliações
// tenham ao menos os dados padrão para o site funcionar.
router.post("/api/admin/sync-sheets", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const token = getRequestToken(req);
    if (!token) return res.status(401).json({ error: "Token de autenticação Google ausente ou inválido." });

    const { updated, total } = await backfillMissingProductPhotos(token);

    const couponHeaders = ["codigo", "tipo", "valor", "ativo", "limite_uso"];
    const couponRows = MOCK_COUPONS.map(c => [
      c.code,
      c.type,
      c.value,
      c.active ? "Sim" : "Não",
      c.useLimit || ""
    ]);
    const couponSheetData = [couponHeaders, ...couponRows];

    const reviewHeaders = ["id", "nome", "estrelas", "comentario", "ativo"];
    const reviewRows = MOCK_REVIEWS.map(r => [
      r.id,
      r.name,
      r.rating,
      r.comment,
      r.active ? "Sim" : "Não"
    ]);
    const reviewSheetData = [reviewHeaders, ...reviewRows];

    const cSuccess = await writeGoogleSheetRows("Cupons!A1:E50", couponSheetData, token);
    const rSuccess = await writeGoogleSheetRows("Avaliacoes!A1:E50", reviewSheetData, token);

    // Atualiza o espelho no Firestore com o estado mais recente da planilha
    // (já com as fotos/IDs preenchidos), pra loja carregar rápido.
    const freshProducts = await getProductsFromSheet(token);
    await syncProductsToFirestore(freshProducts);

    if (cSuccess && rSuccess) {
      res.json({ success: true, message: `Fotos preenchidas: ${updated} de ${total} produtos. Firestore atualizado. Cupons e Avaliações configurados.` });
    } else {
      res.status(500).json({ error: "Falha ao gravar as abas de Cupons/Avaliações." });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// PORTAL ADMINISTRATIVO: CRUD DE PRODUTOS (fonte de dados = Google Sheets)
// -------------------------------------------------------------

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
    active: body.active !== false
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

// 4. Checkout - Registrar Pedido e Gerar Links de Conversão do WhatsApp
router.post("/api/checkout", publicWriteLimiter, async (req, res) => {
  const { clientName, phone, email, address, items, total, couponCode, discountApplied } = req.body;

  if (!clientName || !phone || !email || !address || !items || !total) {
    return res.status(400).json({ error: "Todos os campos de checkout são obrigatórios." });
  }

  const orderId = `BL-${Math.floor(100000 + Math.random() * 900000)}`;
  const orderDate = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  // Format details for saving
  const formattedItems = items
    .map((item: any) => `${item.product.name} (x${item.quantity}) - R$ ${(item.product.promoPrice || item.product.price).toFixed(2)}`)
    .join(", ");

  const newOrder: Order = {
    id: orderId,
    date: orderDate,
    clientName,
    phone,
    email,
    address,
    items: formattedItems,
    total,
    paymentStatus: "Pendente (WhatsApp)"
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

  // --- GERAR MENSAGEM DO WHATSAPP FORMATADA (Alta Conversão) ---
  const lineSeparator = "----------------------------------------";
  const wppMessage = `🍯 *NOVO PEDIDO BEERLANDA - #${orderId}* 🍯\n` +
    `📅 Data: ${orderDate}\n\n` +
    `👤 *Cliente:* ${clientName}\n` +
    `📞 WhatsApp: ${phone}\n` +
    `📧 E-mail: ${email}\n` +
    `📍 *Endereço de Entrega:* ${address}\n\n` +
    `${lineSeparator}\n` +
    `🛒 *PRODUTOS ADQUIRIDOS:*\n` +
    items.map((item: any) => `• ${item.product.name} x${item.quantity} (R$ ${(item.product.promoPrice || item.product.price).toFixed(2)} un)`).join("\n") + `\n\n` +
    (couponCode ? `🏷️ *Cupom Aplicado:* ${couponCode} (-R$ ${discountApplied.toFixed(2)})\n` : "") +
    `💰 *Valor Total do Pedido:* R$ ${total.toFixed(2)}\n` +
    `${lineSeparator}\n` +
    `Olá Beerlanda! Acabei de finalizar meu pedido no site. Como posso realizar o pagamento via Pix para agilizar o envio? 🐝✨`;

  const rawWppPhone = process.env.WHATSAPP_PHONE || "5541998996996";
  const wppPhone = rawWppPhone.replace(/\D/g, "");
  const wppUrl = `https://api.whatsapp.com/send?phone=${wppPhone}&text=${encodeURIComponent(wppMessage)}`;

  res.json({
    success: true,
    orderId,
    whatsappUrl: wppUrl,
    whatsappMessage: wppMessage,
    total
  });
});

// -------------------------------------------------------------
// SEO TÉCNICO: DYNAMIC SITEMAP & ROBOTS.TXT
// -------------------------------------------------------------

// Robots.txt
router.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  const sitemapUrl = process.env.APP_URL 
    ? `${process.env.APP_URL.replace(/\/$/, "")}/sitemap.xml` 
    : "https://beerlanda.com.br/sitemap.xml";

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
    
    const baseUrl = process.env.APP_URL 
      ? process.env.APP_URL.replace(/\/$/, "")
      : "https://beerlanda.com.br";

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
