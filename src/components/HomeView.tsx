import { useState } from "react";
import { Product, Review } from "../types";
import { formatCurrency, getCategoryIcon, PRODUCT_CATEGORIES } from "../utils";
import { Star, ShieldAlert, Sparkles, ArrowRight, CheckCircle, Flame, StarHalf, Search, Heart, ShieldCheck, FlaskConical, Hand, Recycle } from "lucide-react";
import { motion } from "motion/react";

function BeeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <ellipse cx="12" cy="14" rx="5" ry="6" />
      <path d="M7 12.5h10M7.5 15.5h9M8.5 18.5h7" />
      <path d="M12 8V5" />
      <path d="M9.7 5.3c0-.9.7-1.3 1.3-1M14.3 5.3c0-.9-.7-1.3-1.3-1" />
      <path d="M6 9.5c-1.8-1-3.3-.4-3.8.6M18 9.5c1.8-1 3.3-.4 3.8.6" />
    </svg>
  );
}

interface HomeViewProps {
  products: Product[];
  reviews: Review[];
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  isLoading: boolean;
}

export default function HomeView({ products, reviews, onSelectProduct, onAddToCart, isLoading }: HomeViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const discoveredCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const sortedCategories = discoveredCategories.sort((a, b) => {
    const idxA = PRODUCT_CATEGORIES.indexOf(a);
    const idxB = PRODUCT_CATEGORIES.indexOf(b);
    return (idxA === -1 ? PRODUCT_CATEGORIES.length : idxA) - (idxB === -1 ? PRODUCT_CATEGORIES.length : idxB);
  });
  const categories = ["Todos", ...sortedCategories];

  const filteredProducts = products
    .filter((p) => selectedCategory === "Todos" || p.category.toLowerCase() === selectedCategory.toLowerCase())
    .filter((p) => p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  const jornada = [
    { Icon: ShieldCheck, title: "Respeito às abelhas", text: "Cera, mel e própolis, coletados ou adquiridos de pequenos produtores, sempre com sobra garantida para as abelhas." },
    { Icon: FlaskConical, title: "Insumo puro", text: "Cada matéria-prima é selecionada e analisada antes de se transformar em algum dos nossos produtos." },
    { Icon: Hand, title: "Feito à mão", text: "Produção artesanal em pequenos lotes, do envase ao crochê, com atenção em cada detalhe." },
    { Icon: Recycle, title: "Embalagem consciente", text: "Vidro, alumínio, algodão e papel; evitamos ao máximo o uso de plástico descartável em nosso ateliê." },
  ];

  // Animações para o Grid
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <div className="flex flex-col gap-12">

      {/* 1. HERO BANNER - identidade conectada à cultura das abelhas */}
      <section className="relative overflow-hidden rounded-2xl bg-[#5C4033] py-12 px-6 sm:px-12 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm border border-natural-border-dark">
        {/* Textura de favo de mel decorativa */}
        <div className="absolute right-0 top-0 w-1/2 h-full bg-honeycomb opacity-30 pointer-events-none" />
        <div className="absolute right-0 top-0 w-1/2 h-full bg-natural-gold/10 pointer-events-none" />

        {/* Abelha flutuante */}
        <BeeIcon className="absolute top-8 right-10 h-9 w-9 text-natural-gold animate-bee-float pointer-events-none" />


        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-natural-gold/25 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white mb-4">
            <Sparkles className="h-3.5 w-3.5 text-natural-gold" />
            Do apiário para o seu ritual de cuidado
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Natural & Sustentável
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">
            Sabonetes, bálsamos, velas naturais, sais e itens de algodão, feitos à mão, com respeito, amor e tempo. Estoque em tempo real, diretamente do nosso ateliê para você.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a
              href="#catalogo"
              className="inline-flex items-center justify-center rounded-xl bg-natural-gold hover:bg-natural-gold/95 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all"
            >
              Explorar Catálogo
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <div className="flex items-center gap-1.5 text-xs text-white/70">

            </div>
          </div>
        </div>
      </section>

      {/* 2. BUSCA E FILTROS RÁPIDOS (Categorias) */}
      <section id="catalogo" className="scroll-mt-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-natural-darkbrown sm:text-3xl">
              Nossa Colheita Exclusiva
            </h2>
            <p className="text-xs text-natural-text/70 mt-1">
              Busque pelo nome ou filtre por categoria para achar o item perfeito
            </p>
          </div>

          {/* Campo de Busca */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-natural-text/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produto (ex: lavanda, vela...)"
              className="w-full rounded-xl border border-natural-border bg-white pl-9 pr-3 py-2.5 text-xs text-natural-darkbrown focus:border-natural-gold focus:outline-hidden"
              id="product-search-input"
            />
          </div>
        </div>

        {/* Botões de Categorias */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => {
            const CatIcon = cat !== "Todos" ? getCategoryIcon(cat) : null;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold transition-all cursor-pointer ${selectedCategory === cat
                  ? "bg-natural-gold text-white shadow-sm"
                  : "bg-natural-card text-natural-text border border-natural-border hover:bg-natural-border"
                  }`}
                id={`cat-filter-${cat.toLowerCase()}`}
              >
                {CatIcon && <CatIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                {cat}
              </button>
            );
          })}
        </div>

        {/* 3. VITRINE DE PRODUTOS */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-natural-border bg-white">
                <div className="aspect-square w-full bg-natural-card animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-2.5 w-16 rounded bg-natural-border animate-pulse" />
                  <div className="h-3.5 w-3/4 rounded bg-natural-border animate-pulse" />
                  <div className="h-3 w-full rounded bg-natural-border animate-pulse" />
                  <div className="h-5 w-20 rounded bg-natural-border animate-pulse mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-natural-border bg-natural-card p-12 text-center">
            <p className="text-sm text-natural-text/60 font-medium">Nenhum produto encontrado com esses filtros no momento.</p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stock === 0;
              const isLowStock = product.stock > 0 && product.stock < 5;
              const hasDiscount = !!product.promoPrice;
              const activePrice = product.promoPrice || product.price;
              const discountPercent = hasDiscount
                ? Math.round(((product.price - product.promoPrice!) / product.price) * 100)
                : 0;
              const CategoryIcon = getCategoryIcon(product.category);

              return (
                <motion.div
                  key={product.id}
                  variants={itemVariants}
                  whileHover={{ y: -6 }}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-natural-border bg-white shadow-xs hover:shadow-md transition-all"
                  id={`product-card-${product.id}`}
                >

                  {/* Selos Promocionais e de Estoque */}
                  <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
                    {hasDiscount && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 border border-rose-100">
                        <Flame className="h-3 w-3 text-rose-600 fill-rose-600" />
                        {discountPercent}% OFF
                      </span>
                    )}
                    {isOutOfStock && (
                      <span className="rounded-md bg-natural-darkbrown px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                        Esgotado
                      </span>
                    )}
                    {isLowStock && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200 animate-pulse">
                        <ShieldAlert className="h-3 w-3" />
                        Últimas {product.stock} unids.
                      </span>
                    )}
                  </div>

                  {/* Imagem do Produto com Zoom e Fundo Natural */}
                  <div
                    className="relative aspect-square w-full overflow-hidden bg-natural-card border-b border-natural-border cursor-pointer flex items-center justify-center"
                    onClick={() => onSelectProduct(product)}
                  >
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Organic highlight overlay */}
                    <span className="absolute top-3 right-3 bg-natural-organic text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest z-10">
                      Orgânico
                    </span>
                    <div className="absolute inset-0 bg-black/3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Informações */}
                  <div className="flex flex-1 flex-col p-5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-natural-gold">
                      <CategoryIcon className="h-3 w-3" aria-hidden="true" />
                      {product.category}
                    </span>
                    <h3
                      className="mt-1 font-display text-base font-bold text-natural-darkbrown group-hover:text-natural-gold cursor-pointer transition-colors line-clamp-1"
                      onClick={() => onSelectProduct(product)}
                    >
                      {product.name}
                    </h3>
                    <p className="mt-1 text-xs text-natural-text/80 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    {/* Preços com layout de cores Natural Tones */}
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-xl font-bold text-natural-darkbrown">
                        {formatCurrency(activePrice)}
                      </span>
                      {hasDiscount && (
                        <span className="text-xs text-natural-text/50 line-through">
                          {formatCurrency(product.price)}
                        </span>
                      )}
                    </div>

                    {/* Botões ajustados ao tema */}
                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={() => onSelectProduct(product)}
                        className="flex-1 rounded-xl border border-natural-border bg-natural-bg px-4 py-2.5 text-center text-xs font-bold text-natural-text hover:bg-natural-card transition-colors cursor-pointer"
                        id={`view-details-${product.id}`}
                      >
                        Detalhes
                      </button>

                      <button
                        onClick={() => onAddToCart(product)}
                        disabled={isOutOfStock}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-center text-xs font-bold transition-all cursor-pointer ${isOutOfStock
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                          : "bg-natural-gold text-white hover:bg-natural-gold/90 hover:shadow-xs active:scale-95"
                          }`}
                        id={`add-to-cart-${product.id}`}
                      >
                        {isOutOfStock ? "Esgotado" : "Comprar"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </section>

      {/* 4. SEÇÃO PROVA SOCIAL (Avaliações dos Clientes lidas do Sheets) */}
      <section className="rounded-3xl border border-natural-border bg-natural-card p-8 sm:p-12">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-natural-gold">Prova Social Real</span>
          <h2 className="font-display text-2xl font-bold text-natural-darkbrown sm:text-3xl mt-1 inline-flex items-center gap-2">
            Quem Ama, Compartilha
            <Heart className="h-5 w-5 text-rose-500 fill-rose-500" />
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {reviews.slice(0, 4).map((rev) => (
            <div
              key={rev.id}
              className="flex flex-col justify-between rounded-2xl bg-white p-5 border border-natural-border shadow-xs"
              id={`review-card-${rev.id}`}
            >
              <div>
                <div className="flex items-center gap-1 text-natural-gold mb-3">
                  {[...Array(rev.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-natural-gold stroke-natural-gold" />
                  ))}
                  {rev.rating < 5 && (
                    <StarHalf className="h-4 w-4 text-natural-gold fill-natural-gold" />
                  )}
                </div>
                <p className="text-xs text-natural-text/90 leading-relaxed italic">
                  "{rev.comment}"
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-natural-border pt-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-natural-border text-xs font-bold text-natural-darkbrown">
                  {rev.name[0]}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-natural-darkbrown">{rev.name}</h4>
                  <span className="flex items-center gap-0.5 text-[9px] text-natural-organic font-semibold">
                    <CheckCircle className="h-2.5 w-2.5 fill-natural-organic/10" />
                    Comprador Verificado
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. JORNADA: DA COLMEIA AO RITUAL DE AUTOCUIDADO */}
      <section className="relative overflow-hidden rounded-3xl border border-natural-border bg-white p-8 sm:p-12">
        <div className="absolute inset-0 bg-honeycomb opacity-[0.06] pointer-events-none" />
        <div className="relative text-center max-w-xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-natural-gold">Nossa Conexão com as Abelhas</span>
          <h2 className="font-display text-2xl font-bold text-natural-darkbrown sm:text-3xl mt-1 inline-flex items-center gap-2">
            <BeeIcon className="h-6 w-6 text-natural-gold" />
            Da colmeia ao seu ritual de autocuidado
          </h2>
          <p className="text-xs text-natural-text/70 mt-1">
            Cada produto Beerlanda carrega uma jornada de respeito à apicultura natural e artesanal
          </p>
        </div>

        <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {jornada.map((step, idx) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
              className="text-center p-6 border border-natural-border rounded-2xl bg-natural-card/40"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-natural-gold/10 text-natural-gold">
                <step.Icon className="h-6 w-6" />
              </span>
              <h3 className="font-display text-base font-bold text-natural-darkbrown mt-3">{step.title}</h3>
              <p className="text-xs text-natural-text/80 mt-2 leading-relaxed">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
}
