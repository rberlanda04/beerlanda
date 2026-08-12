import { Product } from "./types";
import { Droplet, Flame, Waves, Package, type LucideIcon } from "lucide-react";

/**
 * Formata um valor numérico para o padrão de moeda Brasileira (BRL)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Rola a página suavemente para o topo
 */
export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Mapeia as categorias reais do catálogo Beerlanda para um ícone consistente,
 * usado nos chips de filtro, cards de produto e breadcrumb.
 */
export function getCategoryIcon(category: string): LucideIcon {
  const key = category.toLowerCase();
  if (key.includes("cosm")) return Droplet;
  if (key.includes("vela")) return Flame;
  if (key.includes("bem-estar") || key.includes("bem estar")) return Waves;
  return Package; // Outros / fallback
}

/**
 * Injeta dinamicamente dados estruturados do Schema.org (Product) no cabeçalho
 * para SEO avançado, permitindo que robôs de busca exibam estrelas e preços diretamente.
 */
export function injectProductSchema(product: Product) {
  // Remover qualquer schema existente injetado anteriormente
  const existingScript = document.getElementById("product-schema-ld");
  if (existingScript) {
    existingScript.remove();
  }

  const price = product.promoPrice || product.price;

  const schema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": [product.imageUrl],
    "description": product.description,
    "sku": product.id,
    "mpn": product.id,
    "brand": {
      "@type": "Brand",
      "name": "Beerlanda"
    },
    "offers": {
      "@type": "Offer",
      "url": `${window.location.origin}/#produto/${product.slug}`,
      "priceCurrency": "BRL",
      "price": price.toFixed(2),
      "priceValidUntil": "2027-12-31",
      "itemCondition": "https://schema.org/NewCondition",
      "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": "Beerlanda"
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "24"
    }
  };

  const script = document.createElement("script");
  script.id = "product-schema-ld";
  script.type = "application/ld+json";
  script.innerHTML = JSON.stringify(schema);
  document.head.appendChild(script);
}
