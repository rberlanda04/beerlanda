// Catálogo de categorias com o texto de SEO de cada uma.
//
// Compartilhado entre o app React e a camada SSR do Express — por isso este
// arquivo não importa React, ícones nem nada do Node: os dois lados precisam
// conseguir importá-lo. O slug é fixo (não derivado do nome) pra que uma
// eventual mudança de rótulo não quebre URLs já indexadas pelo Google.

export interface CategorySeo {
  /** Exatamente como está gravado em `product.category` no Firestore. */
  name: string;
  slug: string;
  /** <title> da página de categoria. */
  title: string;
  /** meta description — até ~160 caracteres. */
  description: string;
  /** Texto de apoio abaixo do H1, visível na página. */
  intro: string;
}

export const CATEGORY_SEO: CategorySeo[] = [
  {
    name: "Sabonetes",
    slug: "sabonetes",
    title: "Sabonetes Artesanais Naturais | Beerlanda",
    description:
      "Sabonetes artesanais feitos à mão com mel, própolis, aveia e óleos essenciais puros. Sem parabenos nem corantes sintéticos. Entrega para todo o Brasil.",
    intro:
      "Cada barra é feita à mão em pequenos lotes, com óleos vegetais nobres e ativos naturais do apiário — sem parabenos, corantes sintéticos ou espumantes industriais."
  },
  {
    name: "Bálsamos",
    slug: "balsamos",
    title: "Bálsamos Corporais e Labiais Naturais | Beerlanda",
    description:
      "Bálsamos corporais e labiais com cera de abelha, manteiga de karité e própolis. Hidratação profunda e cicatrização natural. Entrega para todo o Brasil.",
    intro:
      "Hidratação concentrada com cera de abelha e manteiga de karité — os mesmos bálsamos que nossos clientes usam no cuidado pós-tatuagem e na pele ressecada."
  },
  {
    name: "Velas",
    slug: "velas",
    title: "Velas Naturais de Cera de Abelha | Beerlanda",
    description:
      "Velas artesanais de cera natural com óleos essenciais puros. Queima limpa, sem parafina e sem fragrância sintética. Entrega para todo o Brasil.",
    intro:
      "Velas de cera natural com óleos essenciais puros: queima mais limpa e mais longa que a parafina, sem fragrância sintética no ambiente."
  },
  {
    name: "Sais",
    slug: "sais",
    title: "Sais de Banho e Escalda-Pés Naturais | Beerlanda",
    description:
      "Sais de banho e escalda-pés artesanais com ervas e óleos essenciais para relaxamento. Feitos à mão pela Beerlanda. Entrega para todo o Brasil.",
    intro:
      "Sais de banho e escalda-pés combinados com ervas e óleos essenciais — o ritual de relaxamento mais simples de incorporar no fim do dia."
  },
  {
    name: "Outros",
    slug: "outros",
    title: "Artesanato e Itens de Bem-Estar | Beerlanda",
    description:
      "Itens artesanais da Beerlanda: ecobags, amigurumis, ecopads e outros produtos feitos à mão com materiais naturais. Entrega para todo o Brasil.",
    intro:
      "O que não cabe numa prateleira só: peças em algodão, amigurumis e itens reutilizáveis, todos feitos à mão no mesmo ateliê."
  }
];

export function categoryToSlug(name: string): string | null {
  const found = CATEGORY_SEO.find(
    (c) => c.name.toLowerCase() === String(name || "").toLowerCase()
  );
  return found ? found.slug : null;
}

export function findCategoryBySlug(slug: string): CategorySeo | null {
  return CATEGORY_SEO.find((c) => c.slug === String(slug || "").toLowerCase()) || null;
}
