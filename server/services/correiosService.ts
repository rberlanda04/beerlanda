// Cálculo de frete via API REST dos Correios (PAC e SEDEX).
//
// AVISO: os nomes exatos de campo/rota do contrato oficial (ex: "pcFinal" vs "valor",
// "prazoEntrega" vs "prazo") podem variar por versão da API. `parseServiceResponse`
// tenta as variações mais comuns documentadas — se a resposta real vier em outro
// formato, é o único ponto a ajustar, sem impacto no resto do sistema.

import { getValidCorreiosToken } from "./correiosAuthService";

const CORREIOS_BASE_URL = "https://api.correios.com.br";
const PAC_CODE = "03298";
const SEDEX_CODE = "03220";

const DEFAULT_WEIGHT_BY_CATEGORY: Record<string, number> = {
  "Sabonetes": 110,
  "Bálsamos": 130,
  "Velas": 250,
  "Sais": 70,
  "Outros": 30
};

function defaultWeightForCategory(category: string): number {
  return DEFAULT_WEIGHT_BY_CATEGORY[category] ?? 60;
}

interface PackageDimensions {
  comprimento: number;
  largura: number;
  altura: number;
}

// Escolhe uma caixa por faixa de peso total do carrinho, respeitando os
// mínimos dos Correios (16x11x2cm).
function pickPackageDimensions(totalWeightGrams: number): PackageDimensions {
  if (totalWeightGrams <= 300) return { comprimento: 20, largura: 15, altura: 5 };
  if (totalWeightGrams <= 1000) return { comprimento: 25, largura: 20, altura: 10 };
  return { comprimento: 30, largura: 25, altura: 15 };
}

interface ShippingOption {
  price: number;
  days: number;
}

interface ShippingOptions {
  pac: ShippingOption;
  sedex: ShippingOption;
}

function parseServiceResponse(data: any, serviceCode: string): ShippingOption {
  const rawPrice = data.pcFinal ?? data.valor ?? data.preco ?? data.price;
  const rawDays = data.prazoEntrega ?? data.prazo ?? data.deliveryTime ?? 0;

  const price = parseFloat(String(rawPrice ?? "").replace(",", "."));
  const days = parseInt(String(rawDays), 10);

  if (!price || Number.isNaN(price)) {
    throw new Error(`Correios não retornou um preço válido para o serviço ${serviceCode}.`);
  }

  return { price, days: Number.isNaN(days) ? 0 : days };
}

async function callCorreiosPricing(
  serviceCode: string,
  destinationCep: string,
  weightGrams: number,
  dims: PackageDimensions,
  token: string
): Promise<Response> {
  const apiKey = process.env.CORREIOS_API_KEY;
  const originCep = process.env.CORREIOS_ORIGIN_CEP;

  const url = `${CORREIOS_BASE_URL}/preco/v1/nacional/${serviceCode}`;

  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Api-Key": apiKey!,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      cepOrigem: originCep!.replace(/\D/g, ""),
      cepDestino: destinationCep.replace(/\D/g, ""),
      psObjeto: weightGrams,
      comprimento: dims.comprimento,
      largura: dims.largura,
      altura: dims.altura
    })
  });
}

async function fetchServicePrice(
  serviceCode: string,
  destinationCep: string,
  weightGrams: number,
  dims: PackageDimensions
): Promise<ShippingOption> {
  const apiKey = process.env.CORREIOS_API_KEY;
  const originCep = process.env.CORREIOS_ORIGIN_CEP;

  if (!apiKey || !originCep) {
    throw new Error("Credenciais dos Correios não configuradas (CORREIOS_API_KEY / CORREIOS_ORIGIN_CEP).");
  }

  let token = await getValidCorreiosToken();

  let response: Response;
  try {
    response = await callCorreiosPricing(serviceCode, destinationCep, weightGrams, dims, token);
  } catch (error: any) {
    throw new Error(`Falha de conexão com a API dos Correios: ${error.message}`);
  }

  // Token pode ter sido revogado ou o cache local ficou dessincronizado do
  // servidor — força uma renovação e tenta mais uma vez antes de desistir.
  if (response.status === 401) {
    token = await getValidCorreiosToken(true);
    try {
      response = await callCorreiosPricing(serviceCode, destinationCep, weightGrams, dims, token);
    } catch (error: any) {
      throw new Error(`Falha de conexão com a API dos Correios: ${error.message}`);
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    // 401/403 pode ser token expirado OU a conta não ter o produto de API
    // "Preço e Prazo" liberado no contrato — o corpo da resposta dos Correios
    // normalmente diz qual dos dois é (ver campo "msgs"), por isso repassamos
    // a mensagem original em vez de adivinhar.
    throw new Error(`Correios respondeu ${response.status} para o serviço ${serviceCode}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  return parseServiceResponse(data, serviceCode);
}

// Calcula PAC e SEDEX em paralelo para o peso total do carrinho. Lança erro
// (nunca inventa um preço) se qualquer uma das chamadas falhar.
async function getShippingOptions(destinationCep: string, totalWeightGrams: number): Promise<ShippingOptions> {
  const weight = Math.max(totalWeightGrams, 50);
  const dims = pickPackageDimensions(weight);

  const [pac, sedex] = await Promise.all([
    fetchServicePrice(PAC_CODE, destinationCep, weight, dims),
    fetchServicePrice(SEDEX_CODE, destinationCep, weight, dims)
  ]);

  return { pac, sedex };
}

// -------------------------------------------------------------
// DIAGNÓSTICO (usado pelo painel admin)
// -------------------------------------------------------------
// A integração com os Correios depende de duas coisas que estão fora do nosso
// código: a credencial do contrato ser válida e o contrato ter os produtos de
// API habilitados. Quando o frete não calcula, a diferença entre esses dois
// motivos é o que decide o que pedir aos Correios — e ficar rodando script na
// mão pra descobrir isso não escala. Esta função faz a cadeia inteira
// (credencial → autenticação → autorização → cotação) e devolve em que degrau
// parou, o que aquilo significa e qual é o próximo passo.

export type CorreiosStage = "credenciais" | "autenticacao" | "autorizacao" | "cotacao";

export interface CorreiosDiagnostic {
  ok: boolean;
  stage: CorreiosStage;
  title: string;
  detail: string;
  /** O que precisa ser feito, quando há algo a fazer. */
  action: string | null;
  /** Resposta crua dos Correios, pra anexar num chamado com eles. */
  raw?: string;
  /** Preenchido só quando a cotação funciona de verdade. */
  quote?: ShippingOptions;
  checkedAt: string;
}

async function diagnoseCorreios(): Promise<CorreiosDiagnostic> {
  const checkedAt = new Date().toISOString();
  const apiKey = process.env.CORREIOS_API_KEY;
  const originCep = process.env.CORREIOS_ORIGIN_CEP;
  const userId = process.env.CORREIOS_USER_ID;
  const accessCode = process.env.CORREIOS_ACCESS_CODE;

  const missing = [
    !apiKey && "CORREIOS_API_KEY",
    !originCep && "CORREIOS_ORIGIN_CEP",
    !userId && "CORREIOS_USER_ID",
    !accessCode && "CORREIOS_ACCESS_CODE"
  ].filter(Boolean);

  if (missing.length > 0) {
    return {
      ok: false,
      stage: "credenciais",
      title: "Credenciais incompletas",
      detail: `Faltando no ambiente: ${missing.join(", ")}.`,
      action: "Preencher as variáveis que faltam no serviço e publicar de novo.",
      checkedAt
    };
  }

  // 1. Autenticação — prova se o código de acesso do contrato ainda vale.
  let token: string;
  try {
    token = await getValidCorreiosToken(true);
  } catch (error: any) {
    const is401 = /\(401\)/.test(error.message);
    return {
      ok: false,
      stage: "autenticacao",
      title: is401 ? "Código de acesso recusado" : "Falha ao autenticar",
      detail: is401
        ? `Os Correios recusaram o par CNPJ ${userId} + código de acesso (HTTP 401). O código costuma ser invalidado quando um novo é gerado no portal.`
        : error.message,
      action: is401
        ? "Gerar um novo código de acesso no portal dos Correios e atualizar CORREIOS_ACCESS_CODE."
        : "Verificar a resposta abaixo e tentar novamente.",
      raw: error.message,
      checkedAt
    };
  }

  // 2. Autorização + cotação — prova se o contrato tem o produto de API
  // "Preço e Prazo" habilitado. Usa um CEP de destino fixo só como sonda.
  const dims = pickPackageDimensions(300);
  let response: Response;
  try {
    response = await callCorreiosPricing(PAC_CODE, "01310100", 300, dims, token);
  } catch (error: any) {
    return {
      ok: false,
      stage: "autorizacao",
      title: "Sem conexão com os Correios",
      detail: `Falha de rede ao consultar a API de preço: ${error.message}`,
      action: "Tentar novamente em alguns instantes.",
      checkedAt
    };
  }

  if (!response.ok) {
    const raw = (await response.text().catch(() => "")).slice(0, 500);
    const isRestricted = /GTW-012/.test(raw);
    return {
      ok: false,
      stage: "autorizacao",
      title: isRestricted ? "Contrato sem a API de preço habilitada" : `Correios respondeu ${response.status}`,
      detail: isRestricted
        ? `A autenticação funciona (o token foi emitido), mas o contrato do CNPJ ${userId} não tem o produto de API de Preço e Prazo habilitado — é o erro GTW-012.`
        : raw || `HTTP ${response.status} sem corpo.`,
      action: isRestricted
        ? "Pedir aos Correios a habilitação dos produtos de API no contrato, citando o erro GTW-012 e a resposta abaixo."
        : "Levar a resposta abaixo ao suporte dos Correios.",
      raw,
      checkedAt
    };
  }

  // 3. Cotação real ponta a ponta.
  try {
    const quote = await getShippingOptions("01310100", 300);
    return {
      ok: true,
      stage: "cotacao",
      title: "Frete funcionando",
      detail: `Cotação de teste (300 g, ${originCep} → 01310-100): PAC R$ ${quote.pac.price.toFixed(2)} em ${quote.pac.days} dia(s), SEDEX R$ ${quote.sedex.price.toFixed(2)} em ${quote.sedex.days} dia(s).`,
      action: null,
      quote,
      checkedAt
    };
  } catch (error: any) {
    return {
      ok: false,
      stage: "cotacao",
      title: "A API respondeu, mas a cotação falhou",
      detail: error.message,
      action: "Conferir o formato da resposta dos Correios (parseServiceResponse em correiosService.ts).",
      raw: error.message,
      checkedAt
    };
  }
}

export { getShippingOptions, defaultWeightForCategory, diagnoseCorreios };
