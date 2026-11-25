// Cotação de frete da loja. Entrega sempre o mesmo formato para o resto do app.
//
// A loja cota pelo Melhor Envio: uma chamada devolve Correios, Jadlog, Azul e
// outras com tarifa negociada, sem depender de contrato próprio com nenhuma
// transportadora. A cliente continua vendo "Correios PAC" ou "Correios SEDEX"
// na lista quando é por lá que sai mais barato — o que mudou é só quem cota.

import { ShippingQuote } from "../../src/types";
import { pickPackageDimensions } from "./packagingService";
import { quoteViaMelhorEnvio } from "./melhorEnvioService";

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

  return quoteViaMelhorEnvio({
    destinationCep: request.destinationCep,
    totalWeightGrams: weight,
    declaredValue: request.declaredValue,
    dimensions: pickPackageDimensions(weight)
  });
}

export interface ShippingDiagnostic {
  ok: boolean;
  provider: "melhor-envio";
  title: string;
  detail: string;
  action: string | null;
  raw?: string;
  checkedAt: string;
}

/**
 * Cotação de teste ponta a ponta, usada pelo painel admin para o time conferir
 * sozinho se o frete está funcionando.
 */
export async function diagnoseShipping(): Promise<ShippingDiagnostic> {
  const checkedAt = new Date().toISOString();
  const origem = process.env.ORIGIN_CEP || process.env.CORREIOS_ORIGIN_CEP || "(origem não configurada)";

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
      provider: "melhor-envio",
      title: "Frete funcionando",
      detail:
        `Cotação de teste (300 g, ${origem} → 01310-100) devolveu ${quotes.length} ` +
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
      provider: "melhor-envio",
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
