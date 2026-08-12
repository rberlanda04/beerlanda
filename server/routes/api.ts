import express from 'express';
import path from 'path';
import fs from 'fs';
import { Order } from '../../src/types';
import { MOCK_PRODUCTS, MOCK_COUPONS, MOCK_REVIEWS, IN_MEMORY_ORDERS } from '../data/mock';
import { fetchGoogleDriveFiles, renameDriveFile, cleanString, findImageForProduct, getProductsFromSheet, getCouponsFromSheet, getReviewsFromSheet, writeGoogleSheetRows } from '../services/googleService';

const router = express.Router();

function getRequestToken(req: any): string | undefined {
  return req.headers.authorization?.replace(/^Bearer\s+/i, "");
}

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
router.get("/api/products", async (req, res) => {
  try {
    const token = getRequestToken(req);
    const products = await getProductsFromSheet(token);
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
router.post("/api/validate-coupon", async (req, res) => {
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
router.get("/api/admin/drive-files", async (req, res) => {
  try {
    const token = getRequestToken(req);
    if (!token) {
      return res.status(401).json({ error: "Token de autenticação Google ausente ou inválido." });
    }
    const files = await fetchGoogleDriveFiles(token);
    res.json({ success: true, files });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Renomear arquivos no Google Drive correspondentes à base de produtos
router.post("/api/admin/rename-files", async (req, res) => {
  try {
    const token = getRequestToken(req);
    if (!token) {
      return res.status(401).json({ error: "Token de autenticação Google ausente ou inválido." });
    }

    const driveFiles = await fetchGoogleDriveFiles(token);
    if (!driveFiles || driveFiles.length === 0) {
      return res.status(400).json({ error: "Nenhum arquivo encontrado na pasta do Drive." });
    }

    const report: any[] = [];
    let renamedCount = 0;

    for (const product of MOCK_PRODUCTS) {
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

// Sincronizar todos os dados com o Google Sheets do Usuário
router.post("/api/admin/sync-sheets", async (req, res) => {
  try {
    const token = getRequestToken(req);
    if (!token) {
      return res.status(401).json({ error: "Token de autenticação Google ausente ou inválido." });
    }

    // 1. Obter imagens do Drive atualizadas para os produtos
    const driveFiles = await fetchGoogleDriveFiles(token) || [];

    // 2. Preparar valores de produtos para gravação
    const productHeaders = ["id", "nome", "descricao", "preco", "imagem_url", "estoque", "categoria", "slug_seo", "ativo"];
    const productRows = MOCK_PRODUCTS.map(p => {
      const imgUrl = findImageForProduct(p.name, driveFiles);
      return [
        p.id,
        p.name,
        p.description,
        p.price,
        imgUrl,
        p.stock,
        p.category,
        p.slug,
        "Sim"
      ];
    });
    const productSheetData = [productHeaders, ...productRows];

    // 3. Preparar valores de cupons
    const couponHeaders = ["codigo", "tipo", "valor", "ativo", "limite_uso"];
    const couponRows = MOCK_COUPONS.map(c => [
      c.code,
      c.type,
      c.value,
      c.active ? "Sim" : "Não",
      c.useLimit || ""
    ]);
    const couponSheetData = [couponHeaders, ...couponRows];

    // 4. Preparar valores padrão de avaliações (opcional, para dar match se não existir)
    const reviewHeaders = ["id", "nome", "estrelas", "comentario", "ativo"];
    const reviewRows = MOCK_REVIEWS.map(r => [
      r.id,
      r.name,
      r.rating,
      r.comment,
      r.active ? "Sim" : "Não"
    ]);
    const reviewSheetData = [reviewHeaders, ...reviewRows];

    // 5. Gravar dados no Google Sheet
    const pSuccess = await writeGoogleSheetRows("Produtos!A1:I100", productSheetData, token);
    const cSuccess = await writeGoogleSheetRows("Cupons!A1:E50", couponSheetData, token);
    const rSuccess = await writeGoogleSheetRows("Avaliacoes!A1:E50", reviewSheetData, token);

    if (pSuccess && cSuccess && rSuccess) {
      res.json({ success: true, message: "Planilhas de Produtos, Cupons e Avaliações configuradas com sucesso!" });
    } else {
      res.status(500).json({ error: "Falha ao gravar em uma ou mais abas da planilha do Google." });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Checkout - Registrar Pedido e Gerar Links de Conversão do WhatsApp
router.post("/api/checkout", async (req, res) => {
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

  // Add to local logs
  IN_MEMORY_ORDERS.push(newOrder);

  // --- GOOGLE SHEETS APPEND LOGIC ---
  // Se o cliente configurou o Google Service Account, poderíamos append de forma segura aqui.
  // Como o Sheets API com Key simples só permite leitura, documentamos o código de escrita via Service Account
  // e salvamos em um arquivo JSON local simulando o banco de dados persistente.
  try {
    const ordersDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(ordersDir)) {
      fs.mkdirSync(ordersDir);
    }
    const ordersPath = path.join(ordersDir, "orders.json");
    let currentOrders: Order[] = [];
    if (fs.existsSync(ordersPath)) {
      try {
        currentOrders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));
      } catch (e) {
        currentOrders = [];
      }
    }
    currentOrders.push(newOrder);
    fs.writeFileSync(ordersPath, JSON.stringify(currentOrders, null, 2));
    console.log(`[Database] Pedido ${orderId} registrado localmente com sucesso!`);
  } catch (e) {
    console.error("[Database] Erro ao gravar pedido local:", e);
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
