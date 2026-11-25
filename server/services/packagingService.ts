// Peso e caixa do pedido — o que a cotação de frete precisa saber sobre o
// pacote, independente de qual transportadora vai levá-lo.
//
// Isto vivia dentro da integração direta dos Correios. Quando ela saiu (a loja
// cota tudo pelo Melhor Envio), estas duas coisas continuaram necessárias:
// nenhuma delas é dos Correios, são do pacote.

const DEFAULT_WEIGHT_BY_CATEGORY: Record<string, number> = {
  "Sabonetes": 110,
  "Bálsamos": 130,
  "Velas": 250,
  "Sais": 70,
  "Outros": 30
};

/**
 * Peso de reserva, em gramas, para um produto que não tem peso cadastrado.
 * É uma estimativa — produto sem peso é o que faz a loja cobrar frete errado,
 * então o painel avisa quando algum está assim.
 */
export function defaultWeightForCategory(category: string): number {
  return DEFAULT_WEIGHT_BY_CATEGORY[category] ?? 60;
}

export interface PackageDimensions {
  comprimento: number;
  largura: number;
  altura: number;
}

/**
 * Escolhe uma caixa por faixa de peso total do carrinho. As medidas respeitam
 * o mínimo aceito pelas transportadoras (16x11x2 cm).
 */
export function pickPackageDimensions(totalWeightGrams: number): PackageDimensions {
  if (totalWeightGrams <= 300) return { comprimento: 20, largura: 15, altura: 5 };
  if (totalWeightGrams <= 1000) return { comprimento: 25, largura: 20, altura: 10 };
  return { comprimento: 30, largura: 25, altura: 15 };
}
