// Cotação de frete via Melhor Envio.
//
// Agregador: uma chamada devolve Correios, Jadlog, Azul e outras com tarifa
// já negociada pela plataforma, sem exigir contrato próprio com nenhuma
// transportadora. É o que permite a loja cotar frete sem depender da
// liberação do contrato dos Correios.
//
// Dois detalhes do contrato da API que diferem do resto do projeto e são
// fonte fácil de erro: o peso vai em QUILOS (aqui tudo é grama) e o header
// User-Agent é obrigatório, precisando conter nome da aplicação e um e-mail
// de contato — sem ele a requisição é recusada.

import { ShippingQuote } from "../../src/types";

const PRODUCTION_URL = "https://melhorenvio.com.br";
const SANDBOX_URL = "https://sandbox.melhorenvio.com.br";

function baseUrl(): string {
  return process.env.MELHOR_ENVIO_SANDBOX === "true" ? SANDBOX_URL : PRODUCTION_URL;
}

function userAgent(): string {
  const contact = process.env.CONTACT_EMAIL || "beerlandaprodutosartesanais@gmail.com";
  return `Beerlanda (${contact})`;
}

export interface QuoteInput {
  destinationCep: string;
  /** Peso total do carrinho, em gramas (convertido para kg na chamada). */
  totalWeightGrams: number;
  /** Valor declarado das mercadorias, usado como valor segurado. */
  declaredValue: number;
  dimensions: { comprimento: number; largura: number; altura: number };
}

interface MelhorEnvioService {
  id: number;
  name?: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  company?: { id: number; name?: string };
  error?: string;
}

function parsePrice(raw: unknown): number {
  const value = parseFloat(String(raw ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : 0;
}

/**
 * Cota o frete e devolve as opções disponíveis, da mais barata para a mais cara.
 * Lança se as credenciais faltarem ou a API recusar — nunca inventa preço.
 */
async function quoteViaMelhorEnvio(input: QuoteInput): Promise<ShippingQuote[]> {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  const originCep = process.env.CORREIOS_ORIGIN_CEP;

  if (!token) {
    throw new Error("MELHOR_ENVIO_TOKEN não configurado.");
  }
  if (!originCep) {
    throw new Error("CORREIOS_ORIGIN_CEP não configurado (é o CEP de origem dos envios).");
  }

  const body = {
    from: { postal_code: originCep.replace(/\D/g, "") },
    to: { postal_code: input.destinationCep.replace(/\D/g, "") },
    products: [
      {
        id: "carrinho",
        // A API espera centímetros (inteiros) e quilos.
        width: Math.round(input.dimensions.largura),
        height: Math.round(input.dimensions.altura),
        length: Math.round(input.dimensions.comprimento),
        weight: Number((Math.max(input.totalWeightGrams, 50) / 1000).toFixed(3)),
        insurance_value: Number(input.declaredValue.toFixed(2)),
        quantity: 1
      }
    ]
  };

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        // Obrigatório pela documentação: nome da aplicação e e-mail de contato.
        "User-Agent": userAgent()
      },
      body: JSON.stringify(body)
    });
  } catch (error: any) {
    throw new Error(`Falha de conexão com o Melhor Envio: ${error.message}`);
  }

  if (!response.ok) {
    const text = (await response.text().catch(() => "")).slice(0, 300);
    if (response.status === 401) {
      throw new Error(`Melhor Envio recusou o token (401). O token expira em 30 dias e precisa ser renovado. ${text}`);
    }
    throw new Error(`Melhor Envio respondeu ${response.status}: ${text}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Melhor Envio devolveu um formato inesperado (esperado um array de serviços).");
  }

  const quotes = (data as MelhorEnvioService[])
    // Serviços indisponíveis para a rota vêm com `error` preenchido ou sem
    // preço — em vez de mostrar uma opção quebrada, some da lista.
    .filter((service) => !service.error && parsePrice(service.custom_price ?? service.price) > 0)
    .map((service) => ({
      id: String(service.id),
      service: service.name || `Serviço ${service.id}`,
      carrier: service.company?.name || "Transportadora",
      // A documentação recomenda custom_price e custom_delivery_time: eles já
      // consideram as taxas ou descontos configurados na conta.
      price: parsePrice(service.custom_price ?? service.price),
      days: Number(service.custom_delivery_time ?? service.delivery_time ?? 0) || 0
    }))
    .sort((a, b) => a.price - b.price);

  if (quotes.length === 0) {
    throw new Error("Nenhuma transportadora atende este CEP com os dados informados.");
  }

  return quotes;
}

export { quoteViaMelhorEnvio, baseUrl as melhorEnvioBaseUrl };
