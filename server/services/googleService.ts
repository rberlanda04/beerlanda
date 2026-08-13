import { Product, Coupon, Review } from '../../src/types';
import { MOCK_PRODUCTS, MOCK_COUPONS, MOCK_REVIEWS } from '../data/mock';
import { hostProductImage } from './storageService';

async function fetchGoogleSheetRows(range: string, token?: string): Promise<any[][] | null> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!sheetId) {
    return null;
  }

  try {
    let url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
    const headers: Record<string, string> = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (apiKey) {
      url += `?key=${apiKey}`;
    } else {
      return null;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`[Google Sheets] Failed to fetch range "${range}": ${response.status} ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    return data.values || null;
  } catch (error) {
    console.error(`[Google Sheets] Connection error for range "${range}":`, error);
    return null;
  }
}

async function createSheetTabIfNotExist(tabName: string, token: string): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return;

  try {
    // Verificar se a aba já existe
    const urlMetadata = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
    const resMetadata = await fetch(urlMetadata, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (resMetadata.ok) {
      const metadata = await resMetadata.json();
      const sheetExists = metadata.sheets?.some((s: any) => s.properties?.title === tabName);
      if (sheetExists) {
        console.log(`[Google Sheets] A aba "${tabName}" já existe.`);
        return;
      }
    }

    // Criar a aba
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName
              }
            }
          }
        ]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Google Sheets] Falha ao criar aba "${tabName}":`, errText);
    } else {
      console.log(`[Google Sheets] Aba "${tabName}" criada com sucesso.`);
    }
  } catch (e) {
    console.error(`[Google Sheets] Erro ao garantir existência da aba "${tabName}":`, e);
  }
}

async function writeGoogleSheetRows(range: string, values: any[][], token: string): Promise<boolean> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return false;

  const tabName = range.split("!")[0];
  await createSheetTabIfNotExist(tabName, token);

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Google Sheets] Falha ao gravar no intervalo "${range}":`, errText);
      return false;
    }
    console.log(`[Google Sheets] Gravou ${values.length} linhas em "${range}" com sucesso.`);
    return true;
  } catch (error) {
    console.error(`[Google Sheets] Erro de conexão ao gravar no Sheets em "${range}":`, error);
    return false;
  }
}

async function appendGoogleSheetRow(tabName: string, row: (string | number)[], token: string): Promise<boolean> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return false;

  await createSheetTabIfNotExist(tabName, token);

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: [row] })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Google Sheets] Falha ao adicionar linha em "${tabName}":`, errText);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[Google Sheets] Erro de conexão ao adicionar linha em "${tabName}":`, error);
    return false;
  }
}

async function getSheetIdByTitle(tabName: string, token: string): Promise<number | null> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return null;
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const sheet = data.sheets?.find((s: any) => s.properties?.title === tabName);
    return sheet?.properties?.sheetId ?? null;
  } catch (error) {
    console.error(`[Google Sheets] Erro ao buscar sheetId da aba "${tabName}":`, error);
    return null;
  }
}

// A planilha real da Beerlanda ("Base de dados - Site") usa este layout fixo
// na aba de produtos — nome, preço em texto "R$ X,00", composição, estoque,
// ID (em branco até ser preenchido por este app) e imagem.
const PRODUCT_TAB = "base_de_dados_beerlanda";
const PRODUCT_RANGE = `${PRODUCT_TAB}!A1:F5000`;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function deriveCategoryFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("sabonete")) return "Sabonetes";
  if (n.includes("vela")) return "Velas";
  if (n.includes("balsamo") || n.includes("bálsamo")) return "Bálsamos";
  if (n.includes("escalda") || n.includes("sais") || n.includes("sal ")) return "Sais";
  return "Outros";
}

function parseBRLPrice(raw: string): number {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^\d.,]/g, "").trim();
  const normalized = cleaned.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  return parseFloat(normalized) || 0;
}

function formatBRLPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function productToRow(p: Partial<Product> & { id: string }): (string | number)[] {
  return [
    p.name || "",
    formatBRLPrice(p.price ?? 0),
    p.description || "",
    p.stock ?? 0,
    p.id,
    p.imageUrl || ""
  ];
}

// Row numbers here are 1-based sheet rows (row 1 = header), matching what the Sheets API expects in A1 ranges.
// ID lives in column E (index 4) in the real sheet's layout.
async function findProductRowNumber(id: string, token: string): Promise<number | null> {
  const rows = await fetchGoogleSheetRows(PRODUCT_RANGE, token);
  if (!rows) return null;
  const idx = rows.findIndex((row, i) => i > 0 && row[4] === id);
  return idx === -1 ? null : idx + 1;
}

async function upsertProductRow(product: Partial<Product> & { id: string }, token: string): Promise<boolean> {
  const row = productToRow(product);
  const existingRowNumber = await findProductRowNumber(product.id, token);
  if (existingRowNumber) {
    return writeGoogleSheetRows(`${PRODUCT_TAB}!A${existingRowNumber}:F${existingRowNumber}`, [row], token);
  }
  return appendGoogleSheetRow(PRODUCT_TAB, row, token);
}

async function deleteProductRow(id: string, token: string): Promise<boolean> {
  const rowNumber = await findProductRowNumber(id, token);
  if (!rowNumber) return false;

  const sheetId = process.env.GOOGLE_SHEET_ID;
  const tabSheetId = await getSheetIdByTitle(PRODUCT_TAB, token);
  if (!sheetId || tabSheetId === null) return false;

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId: tabSheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber
            }
          }
        }]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Google Sheets] Falha ao excluir a linha do produto "${id}":`, errText);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[Google Sheets] Erro de conexão ao excluir a linha do produto "${id}":`, error);
    return false;
  }
}

// -------------------------------------------------------------
// ADMIN AUTHORIZATION
// -------------------------------------------------------------
// Read lazily (not as a module-level constant): server.ts's static imports
// resolve this module before its own dotenv.config() call runs, so
// process.env.ADMIN_EMAILS would otherwise still be undefined here.
function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Resolves the Google account email behind an OAuth access token by asking
// Google directly, so the server never has to trust a client-supplied identity.
async function getVerifiedEmailFromToken(token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const data = await res.json();
    // Google's tokeninfo endpoint names this field "verified_email" for OAuth
    // access tokens (what we get from Firebase's GoogleAuthProvider credential)
    // vs. "email_verified" for ID tokens — accept either so we don't silently
    // reject a legitimately verified account.
    const verified = data.verified_email ?? data.email_verified;
    const isVerified = verified === true || verified === "true";
    if (!data.email || !isVerified) return null;
    return String(data.email).toLowerCase();
  } catch (error) {
    console.error("[Auth] Erro ao verificar token junto ao Google:", error);
    return null;
  }
}

async function isAuthorizedAdmin(token: string): Promise<boolean> {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    console.warn("[Auth] ADMIN_EMAILS não configurado — nenhum admin autorizado.");
    return false;
  }
  const email = await getVerifiedEmailFromToken(token);
  return !!email && adminEmails.includes(email);
}

// Map Google Sheets rows to typed objects using column headers
function mapRowsToObjects<T>(rows: any[][]): T[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h) => String(h).trim().toLowerCase());
  const dataRows = rows.slice(1);

  return dataRows.map((row) => {
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] !== undefined ? row[index] : "";
    });
    return obj as T;
  });
}

// -------------------------------------------------------------
// GOOGLE DRIVE API INTEGRATION
// -------------------------------------------------------------
async function fetchGoogleDriveFiles(token?: string): Promise<any[] | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  try {
    let url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType)&pageSize=100`;
    const headers: Record<string, string> = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (apiKey) {
      url += `&key=${apiKey}`;
    } else {
      console.warn("[Google Drive] Sem API Key ou token OAuth declarados.");
      return null;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`[Google Drive] Falha ao listar arquivos: ${response.status} ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    return data.files || null;
  } catch (error) {
    console.error("[Google Drive] Erro de conexão ao buscar imagens:", error);
    return null;
  }
}

async function renameDriveFile(fileId: string, newName: string, token: string): Promise<boolean> {
  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: newName
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Google Drive] Falha ao renomear arquivo ${fileId} para "${newName}":`, errText);
      return false;
    }
    console.log(`[Google Drive] Arquivo ${fileId} renomeado para "${newName}" com sucesso.`);
    return true;
  } catch (error) {
    console.error(`[Google Drive] Erro de conexão ao renomear arquivo ${fileId}:`, error);
    return false;
  }
}

function cleanString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]/g, "");     // mantém apenas alfanuméricos
}

function findImageForProduct(productName: string, driveFiles: any[]): string {
  if (!driveFiles || driveFiles.length === 0) {
    return getFallbackUnsplashImage(productName);
  }

  const cleanedName = cleanString(productName);

  // 1. Tenta correspondência exata desconsiderando caracteres especiais
  for (const file of driveFiles) {
    const cleanedFileName = cleanString(file.name.replace(/\.[^/.]+$/, ""));
    if (cleanedFileName === cleanedName) {
      return `https://drive.google.com/uc?export=view&id=${file.id}`;
    }
  }

  // 2. Tenta correspondência parcial (substring)
  for (const file of driveFiles) {
    const cleanedFileName = cleanString(file.name.replace(/\.[^/.]+$/, ""));
    if (cleanedName.includes(cleanedFileName) || cleanedFileName.includes(cleanedName)) {
      return `https://drive.google.com/uc?export=view&id=${file.id}`;
    }
  }

  // 3. Tenta correspondência por palavras-chave principais
  const words = productName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  for (const file of driveFiles) {
    const fileLower = file.name.toLowerCase();
    const hasWord = words.some(word => fileLower.includes(word));
    if (hasWord) {
      return `https://drive.google.com/uc?export=view&id=${file.id}`;
    }
  }

  return getFallbackUnsplashImage(productName);
}

function getFallbackUnsplashImage(productName: string): string {
  const nameLower = productName.toLowerCase();
  if (nameLower.includes("sabonete")) {
    return "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600";
  } else if (nameLower.includes("vela")) {
    return "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=600";
  } else if (nameLower.includes("balsamo") || nameLower.includes("bálsamo")) {
    return "https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&q=80&w=600";
  } else if (nameLower.includes("abelha") || nameLower.includes("chaveiro")) {
    return "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=600";
  } else if (nameLower.includes("escalda") || nameLower.includes("sais")) {
    return "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&q=80&w=600";
  }
  return "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=600";
}

// Lê a planilha real da Beerlanda: Nome | Preço unitário | Composição: | Estoque | ID | Imagem.
// IDs em branco são derivados do nome e gravados de volta (só quando há token —
// leituras públicas via API key nunca escrevem), então toda edição futura passa
// a mirar a mesma linha de forma estável, mesmo que o nome do produto mude depois.
async function getProductsFromSheet(token?: string): Promise<Product[]> {
  const rows = await fetchGoogleSheetRows(PRODUCT_RANGE, token);

  if (!rows || rows.length <= 1) {
    const driveFiles = await fetchGoogleDriveFiles(token) || [];
    console.log("[Google Sheets] Usando dados mockados com imagens dinâmicas do Google Drive.");
    return MOCK_PRODUCTS.map(p => ({
      ...p,
      imageUrl: findImageForProduct(p.name, driveFiles)
    }));
  }

  const products: Product[] = [];
  const idBackfills: { row: number; id: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row[0] || "").trim();
    if (!name) continue;

    const price = parseBRLPrice(row[1]);
    const description = String(row[2] || "").trim() || "Produto artesanal Beerlanda, feito à mão.";
    const stock = parseInt(String(row[3])) || 0;

    let id = row[4] ? String(row[4]).trim() : "";
    if (!id) {
      id = `prod-${slugify(name)}`;
      if (token) idBackfills.push({ row: i + 1, id });
    }

    const imageUrl = row[5] ? String(row[5]).trim() : getFallbackUnsplashImage(name);

    products.push({
      id,
      name,
      description,
      price,
      promoPrice: undefined,
      imageUrl,
      stock,
      category: deriveCategoryFromName(name),
      slug: slugify(name),
      active: true
    });
  }

  if (token && idBackfills.length > 0) {
    for (const b of idBackfills) {
      await writeGoogleSheetRows(`${PRODUCT_TAB}!E${b.row}:E${b.row}`, [[b.id]], token);
    }
    console.log(`[Google Sheets] ${idBackfills.length} ID(s) de produto preenchido(s) automaticamente.`);
  }

  return products;
}

// Ação administrativa explícita: para cada produto sem foto na planilha,
// tenta achar a correspondente no Drive, hospeda no bucket próprio e grava
// a URL estável de volta na coluna Imagem.
async function backfillMissingProductPhotos(token: string): Promise<{ updated: number; total: number }> {
  const rows = await fetchGoogleSheetRows(PRODUCT_RANGE, token);
  if (!rows || rows.length <= 1) return { updated: 0, total: 0 };

  const driveFiles = await fetchGoogleDriveFiles(token) || [];
  let updated = 0;
  let total = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row[0] || "").trim();
    if (!name) continue;
    total++;
    if (row[5]) continue;

    const driveUrl = findImageForProduct(name, driveFiles);
    const hostedUrl = await hostProductImage(slugify(name), driveUrl);
    if (hostedUrl && hostedUrl !== driveUrl) {
      const wrote = await writeGoogleSheetRows(`${PRODUCT_TAB}!F${i + 1}:F${i + 1}`, [[hostedUrl]], token);
      if (wrote) updated++;
    }
  }

  return { updated, total };
}

async function getCouponsFromSheet(token?: string): Promise<Coupon[]> {
  const rows = await fetchGoogleSheetRows("Cupons!A1:E50", token);
  if (!rows) {
    return MOCK_COUPONS;
  }

  const raw = mapRowsToObjects<any>(rows);
  return raw.map((item) => {
    const code = String(item.codigo || item.code || "").trim().toUpperCase();
    const typeVal = String(item.tipo || item.type).trim().toLowerCase();
    const type = typeVal.includes("valor") || typeVal.includes("fixed") || typeVal.includes("fixo") ? "fixed" : "percentage";
    const value = parseFloat(String(item.valor || item.value).replace(",", ".")) || 0;
    const activeVal = String(item.ativo).trim().toLowerCase();
    const active = activeVal === "sim" || activeVal === "yes" || activeVal === "true" || activeVal === "1" || activeVal === "";
    const limitStr = item.limite_uso || item.limit;
    const useLimit = limitStr ? parseInt(String(limitStr)) : undefined;

    return { code, type, value, active, useLimit };
  });
}

async function getReviewsFromSheet(token?: string): Promise<Review[]> {
  const rows = await fetchGoogleSheetRows("Avaliacoes!A1:E50", token);
  if (!rows) {
    return MOCK_REVIEWS;
  }

  const raw = mapRowsToObjects<any>(rows);
  return raw.map((item, index) => {
    const id = item.id || `sheet-rev-${index}`;
    const name = item.nome || item.name || "Cliente Satisfeito";
    const rating = parseInt(String(item.estrelas || item.rating || item.nota)) || 5;
    const comment = item.comentario || item.comment || "";
    const activeVal = String(item.ativo).trim().toLowerCase();
    const active = activeVal !== "não" && activeVal !== "no" && activeVal !== "false" && activeVal !== "0";

    return { id, name, rating, comment, active };
  });
}

export { fetchGoogleSheetRows, createSheetTabIfNotExist, writeGoogleSheetRows, fetchGoogleDriveFiles, renameDriveFile, cleanString, findImageForProduct, getProductsFromSheet, getCouponsFromSheet, getReviewsFromSheet, isAuthorizedAdmin, upsertProductRow, deleteProductRow, backfillMissingProductPhotos, slugify, deriveCategoryFromName, PRODUCT_TAB };
