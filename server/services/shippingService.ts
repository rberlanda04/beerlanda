// Escolhe de onde vem a cotação de frete e entrega sempre o mesmo formato
// para o resto do app.
//
// Existem dois caminhos porque eles servem a momentos diferentes do negócio:
//
// - Melhor Envio (padrão quando há token): agregador com tarifa negociada,
//   não exige contrato próprio, e devolve Correios junto com Jadlog, Azul e
//   outras. É o que permite a loja cotar frete sem depender de liberação de
//   contrato.
// - Correios direto: usa o contrato próprio da Beerlanda. Em volume maior a
//   tarifa do contrato pode superar a do agregador, então a integração fica
//   pronta para voltar a ser a preferida — basta remover o token do Melhor
//   Envio do ambiente.

import { ShippingQuote } from "../../src/types";
import { getShippingOptions as getCorreiosOptions, pickPackageDimensions } from "./correiosService";
import { quoteViaMelhorEnvio } from "./melhorEnvioService";

export type ShippingProvider = "melhor-envio" | "correios";

export function activeShippingProvider(): ShippingProvider {
  return process.env.MELHOR_ENVIO_TOKEN ? "melhor-envio" : "correios";
}

export interface QuoteRequest {
  destinationCep: string;
  totalWeightGrams: number;
  /** Valor das mercadorias, usado como valor segurado pelo agregador. */
  declaredValue: number;
}

/**
 * Devolve as opções de frete disponíveis, da mais barata para a mais cara.
 * Lança se a cotação falhar — cobrar um frete inventado é pior que não cotar.
 */
export async function getShippingQuotes(request: QuoteRequest): Promise<ShippingQuote[]> {
  const weight = Math.max(request.totalWeightGrams, 50);
  const dimensions = pickPackageDimensions(weight);

  if (activeShippingProvider() === "melhor-envio") {
    return quoteViaMelhorEnvio({
      destinationCep: request.destinationCep,
      totalWeightGrams: weight,
      declaredValue: request.declaredValue,
      dimensions
    });
  }

  // Correios direto: dois serviços fixos, adaptados para a mesma lista.
  const correios = await getCorreiosOptions(request.destinationCep, weight);
  return [
    { id: "pac", service: "PAC", carrier: "Correios", price: correios.pac.price, days: correios.pac.days },
    { id: "sedex", service: "SEDEX", carrier: "Correios", price: correios.sedex.price, days: correios.sedex.days }
  ].sort((a, b) => a.price - b.price);
}

export interface ShippingDiagnostic {
  ok: boolean;
  provider: ShippingProvider;
  title: string;
  detail: string;
  action: string | null;
  raw?: string;
  checkedAt: string;
}

/**
 * Cotação de teste ponta a ponta pelo provedor ativo, usada pelo painel admin
 * para o time conferir sozinho se o frete está funcionando.
 */
export async function diagnoseShipping(): Promise<ShippingDiagnostic> {
  const checkedAt = new Date().toISOString();
  const provider = activeShippingProvider();

  try {
    // Sonda fixa: 300 g, R$ 80, do CEP de origem para a Av. Paulista.
    const quotes = await getShippingQuotes({
      destinationCep: "01310100",
      totalWeightGrams: 300,
      declaredValue: 80
    });

    const cheapest = quotes[0];
    return {
      ok: true,
      provider,
      title: "Frete funcionando",
      detail:
        `Cotação de teste (300 g, ${process.env.CORREIOS_ORIGIN_CEP} → 01310-100) devolveu ${quotes.length} ` +
        `opç${quotes.length === 1 ? "ão" : "ões"}. Mais barata: ${cheapest.carrier} ${cheapest.service} ` +
        `por R$ ${cheapest.price.toFixed(2)}${cheapest.days > 0 ? ` em ${cheapest.days} dia(s) úteis` : ""}.`,
      action: null,
      raw: quotes.map((q) => `${q.carrier} ${q.service}: R$ ${q.price.toFixed(2)}${q.days ? ` / ${q.days}d` : ""}`).join("\n"),
      checkedAt
    };
  } catch (error: any) {
    const message = String(error.message || error);
    const isAuth = /401|token/i.test(message);
    const isMissingToken = /MELHOR_ENVIO_TOKEN não configurado/.test(message);

    return {
      ok: false,
      provider,
      title: isMissingToken
        ? "Melhor Envio não configurado"
        : isAuth
          ? "Token do Melhor Envio recusado"
          : "A cotação falhou",
      detail: message,
      action: isMissingToken
        ? "Gerar um token no painel do Melhor Envio e configurar MELHOR_ENVIO_TOKEN no serviço."
        : isAuth
          ? "O token do Melhor Envio vale 30 dias. Gerar um novo e atualizar MELHOR_ENVIO_TOKEN."
          : "Conferir a resposta abaixo; se for erro da transportadora, tentar de novo em instantes.",
      raw: message,
      checkedAt
    };
  }
}
