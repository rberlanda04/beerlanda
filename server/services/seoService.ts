// Camada de SEO server-side.
//
// O app é uma SPA: o HTML que sai do servidor é sempre o mesmo index.html, e
// quem monta a página é o JavaScript. Só que crawler do Google e scraper de
// rede social (WhatsApp, Instagram, Facebook) leem o HTML cru — sem isso, toda
// URL do site devolveria o título, a descrição e a imagem genéricos da Home.
//
// Este módulo centraliza essa injeção: cada rota que precisa ser indexável
// declara seus metadados uma vez e recebe <title>, description, Open Graph,
// Twitter Card, canonical e JSON-LD montados pelo mesmo caminho. Adicionar um
// tipo de página novo (categoria, artigo, landing) é declarar um objeto, não
// repetir dez `.replace()`.

import fs from "fs";
import path from "path";

export interface PageSeo {
  title: string;
  description: string;
  /** URL absoluta e canônica desta página. */
  url: string;
  /** URL absoluta da imagem de compartilhamento. */
  image?: string;
  /** og:type — "website" para páginas comuns, "product" para produto. */
  type?: "website" | "product" | "article";
  /** Blocos JSON-LD (schema.org) adicionados ao <head>. */
  schemas?: Record<string, unknown>[];
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Corta no limite de caracteres sem quebrar palavra no meio. */
export function truncate(text: string, max = 160): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// Em produção o index.html é imutável durante toda a vida da revisão, então
// lemos do disco uma vez só em vez de a cada request. Em dev, relê sempre pra
// refletir edições no arquivo sem reiniciar o servidor.
let cachedTemplate: string | null = null;

function loadTemplate(): string {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && cachedTemplate) return cachedTemplate;

  const indexPath = isProduction
    ? path.join(process.cwd(), "dist", "index.html")
    : path.join(process.cwd(), "index.html");

  const html = fs.readFileSync(indexPath, "utf-8");
  if (isProduction) cachedTemplate = html;
  return html;
}

/** Troca o conteúdo de uma <meta>/<link> já existente no index.html. */
function replaceTag(html: string, pattern: RegExp, replacement: string): string {
  return html.replace(pattern, replacement);
}

/**
 * Devolve o index.html com os metadados desta página já aplicados.
 * Lança se o index.html não puder ser lido — quem chama decide o fallback.
 */
export function renderPageHtml(seo: PageSeo): string {
  const title = escapeHtml(seo.title);
  const description = escapeHtml(truncate(seo.description));
  const url = escapeHtml(seo.url);
  const image = escapeHtml(seo.image || `${new URL(seo.url).origin}/og-image.png`);
  const ogType = seo.type || "website";

  let html = loadTemplate();

  html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  html = replaceTag(html, /<meta name="description" content="[\s\S]*?"\s*\/?>/, `<meta name="description" content="${description}" />`);
  html = replaceTag(html, /<meta property="og:type" content="[\s\S]*?"\s*\/?>/, `<meta property="og:type" content="${ogType}" />`);
  html = replaceTag(html, /<meta property="og:title" content="[\s\S]*?"\s*\/?>/, `<meta property="og:title" content="${title}" />`);
  html = replaceTag(html, /<meta property="og:description" content="[\s\S]*?"\s*\/?>/, `<meta property="og:description" content="${description}" />`);
  html = replaceTag(html, /<meta property="og:image" content="[\s\S]*?"\s*\/?>/, `<meta property="og:image" content="${image}" />`);
  html = replaceTag(html, /<meta property="og:url" content="[\s\S]*?"\s*\/?>/, `<meta property="og:url" content="${url}" />`);
  html = replaceTag(html, /<meta name="twitter:title" content="[\s\S]*?"\s*\/?>/, `<meta name="twitter:title" content="${title}" />`);
  html = replaceTag(html, /<meta name="twitter:description" content="[\s\S]*?"\s*\/?>/, `<meta name="twitter:description" content="${description}" />`);
  html = replaceTag(html, /<meta name="twitter:image" content="[\s\S]*?"\s*\/?>/, `<meta name="twitter:image" content="${image}" />`);
  html = replaceTag(html, /<link rel="canonical" href="[\s\S]*?"\s*\/?>/, `<link rel="canonical" href="${url}" />`);

  if (seo.schemas && seo.schemas.length > 0) {
    // `<` escapado pra que uma descrição de produto com HTML não consiga
    // fechar a tag <script> e injetar markup na página.
    const blocks = seo.schemas
      .map((schema) => `  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`)
      .join("\n");
    html = html.replace("</head>", `${blocks}\n  </head>`);
  }

  return html;
}
