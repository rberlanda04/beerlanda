// Cálculo de frete via API REST dos Correios (PAC e SEDEX).
//
// AVISO: os nomes exatos de campo/rota do contrato oficial (ex: "pcFinal" vs "valor",
// "prazoEntrega" vs "prazo") podem variar por versão da API. `parseServiceResponse`
// tenta as variações mais comuns documentadas — se a resposta real vier em outro
// formato, é o único ponto a ajustar, sem impacto no resto do sistema.

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

async function fetchServicePrice(
  serviceCode: string,
  destinationCep: string,
  weightGrams: number,
  dims: PackageDimensions
): Promise<ShippingOption> {
  const apiKey = process.env.CORREIOS_API_KEY;
  const token = process.env.CORREIOS_TOKEN;
  const originCep = process.env.CORREIOS_ORIGIN_CEP;

  if (!apiKey || !token || !originCep) {
    throw new Error("Credenciais dos Correios não configuradas (CORREIOS_API_KEY / CORREIOS_TOKEN / CORREIOS_ORIGIN_CEP).");
  }

  const url = `${CORREIOS_BASE_URL}/preco/v1/nacional/${serviceCode}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Api-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        cepOrigem: originCep.replace(/\D/g, ""),
        cepDestino: destinationCep.replace(/\D/g, ""),
        psObjeto: weightGrams,
        comprimento: dims.comprimento,
        largura: dims.largura,
        altura: dims.altura
      })
    });
  } catch (error: any) {
    throw new Error(`Falha de conexão com a API dos Correios: ${error.message}`);
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

export { getShippingOptions, defaultWeightForCategory };
