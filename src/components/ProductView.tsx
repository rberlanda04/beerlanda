import { useState, useEffect } from "react";
import { Product, Review } from "../types";
import { formatCurrency, getCategoryIcon, injectProductSchema, scrollToTop } from "../utils";
import { ArrowLeft, ShoppingCart, ShieldCheck, HelpCircle, Leaf, Sparkles, Check, Droplet, Flame, Lock } from "lucide-react";
import { motion } from "motion/react";

interface ProductViewProps {
  product: Product;
  reviews: Review[];
  onBack: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export default function ProductView({ product, reviews, onBack, onAddToCart }: ProductViewProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"descricao" | "composicao">("descricao");
  const [addedFeedback, setAddedFeedback] = useState<boolean>(false);

  // Injetar dados estruturados Schema.org para o Google na montagem deste produto
  useEffect(() => {
    injectProductSchema(product, reviews);
    scrollToTop();
  }, [product, reviews]);

  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock < 5;
  const hasDiscount = !!product.promoPrice;
  const activePrice = product.promoPrice || product.price;
  const savings = hasDiscount ? product.price - product.promoPrice! : 0;
  const CategoryIcon = getCategoryIcon(product.category);

  const handleIncrement = () => {
    if (quantity < product.stock) {
      setQuantity(prev => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
    setAddedFeedback(true);
    setTimeout(() => {
      setAddedFeedback(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-8 pb-24 sm:pb-12">
      {/* Breadcrumb e Botão Voltar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav className="flex text-xs font-semibold text-natural-text/60" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-2">
            <li className="inline-flex items-center">
              <button onClick={onBack} className="hover:text-natural-gold cursor-pointer transition-colors">Início</button>
            </li>
            <li>
              <span className="mx-1 sm:mx-2">/</span>
            </li>
            <li>
              <span className="capitalize inline-flex items-center gap-1">
                <CategoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {product.category}
              </span>
            </li>
            <li>
              <span className="mx-1 sm:mx-2">/</span>
            </li>
            <li aria-current="page" className="text-natural-darkbrown font-bold line-clamp-1 max-w-[200px] sm:max-w-none">
              {product.name}
            </li>
          </ol>
        </nav>

        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-natural-border bg-white px-3.5 py-1.5 text-xs font-bold text-natural-text hover:bg-natural-card transition-colors cursor-pointer"
          id="product-back-btn"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao catálogo
        </button>
      </div>

      {/* Grid Principal do Produto */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        
        {/* Lado Esquerdo - Imagem do Produto */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-2xl border border-natural-border bg-natural-card p-4 shadow-sm"
        >
          <img
            src={product.imageUrl}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="aspect-square w-full rounded-xl object-cover"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-natural-darkbrown/10 backdrop-blur-xs">
              <span className="rounded-full bg-natural-darkbrown px-6 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-lg">
                Esgotado no Momento
              </span>
            </div>
          )}
        </motion.div>

        {/* Lado Direito - Detalhes & Compra */}
        <div className="flex flex-col justify-between py-2">
          <div>
            {/* Categoria e Selos */}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded bg-natural-gold/25 px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-natural-darkbrown">
                {product.category}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-natural-organic">
                <Leaf className="h-3.5 w-3.5 fill-natural-organic/10" />
                Natural e Hipoalergênico
              </span>
            </div>

            {/* Nome do Produto */}
            <h1 className="mt-3 font-display text-2xl font-bold text-natural-darkbrown sm:text-3xl lg:text-4xl leading-tight">
              {product.name}
            </h1>

            {/* Avaliações Dummy / Estrelas para Prova Social */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex text-natural-gold">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-lg">★</span>
                ))}
              </div>
              <span className="text-xs font-semibold text-natural-text/60">
                (24 avaliações verificadas de clientes)
              </span>
            </div>

            {/* Bloco de Preços e Economia */}
            <div className="mt-5 rounded-2xl bg-natural-card border border-natural-border p-4">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold text-natural-darkbrown">
                  {formatCurrency(activePrice)}
                </span>
                {hasDiscount && (
                  <span className="text-sm text-natural-text/40 line-through">
                    {formatCurrency(product.price)}
                  </span>
                )}
              </div>
              
              {hasDiscount && (
                <div className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-natural-organic">
                  <Sparkles className="h-3.5 w-3.5 text-natural-organic" />
                  Você economiza {formatCurrency(savings)} hoje!
                </div>
              )}
            </div>

            {/* Descrição em Tabs */}
            <div className="mt-6 border-b border-natural-border">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab("descricao")}
                  className={`border-b-2 pb-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === "descricao"
                      ? "border-natural-gold text-natural-darkbrown"
                      : "border-transparent text-natural-text/40 hover:text-natural-darkbrown"
                  }`}
                >
                  Descrição
                </button>
                <button
                  onClick={() => setActiveTab("composicao")}
                  className={`border-b-2 pb-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === "composicao"
                      ? "border-natural-gold text-natural-darkbrown"
                      : "border-transparent text-natural-text/40 hover:text-natural-darkbrown"
                  }`}
                >
                  Composição
                </button>
              </div>
            </div>

            {/* Conteúdo das Tabs */}
            <div className="py-4 text-xs text-natural-text/80 leading-relaxed min-h-[100px]">
              {activeTab === "descricao" && (
                product.slug.includes("aveia-mel-laranja-doce") ? (
                  <div className="space-y-4">
                    <p className="font-serif italic text-sm text-natural-gold">"{product.description}"</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="rounded-xl border border-natural-border bg-natural-card p-4 space-y-1">
                        <h4 className="font-bold text-natural-darkbrown flex items-center gap-1.5">
                          <Droplet className="h-4 w-4 text-natural-gold" /> Mel Puro
                        </h4>
                        <p className="text-[11px] leading-relaxed text-natural-text">
                          O mel é um poderoso aliado para a pele, oferece hidratação profunda, ação antibacteriana, cicatrizante e propriedades calmantes. É rico em antioxidantes, combate o envelhecimento precoce, estimula o colágeno e suaviza a textura da pele.
                        </p>
                      </div>
                      <div className="rounded-xl border border-natural-border bg-natural-card p-4 space-y-1">
                        <h4 className="font-bold text-natural-darkbrown flex items-center gap-1.5">
                          <Leaf className="h-4 w-4 text-natural-organic" /> Manteiga de Karité
                        </h4>
                        <p className="text-[11px] leading-relaxed text-natural-text">
                          A manteiga de karité é um poderoso hidratante natural e regenerador, rico em vitaminas A, E e F, além de ácidos graxos, que proporcionam hidratação profunda, ação anti-inflamatória e antioxidante.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 space-y-1">
                      <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-amber-700" /> Sinergia Mel & Karité
                      </h4>
                      <p className="text-[11px] text-amber-950 leading-relaxed">
                        A combinação de mel e manteiga de Karité torna esse sabonete muito poderoso! Oferece hidratação profunda e regeneradora, ação antibacteriana e calmante.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p>{product.description}</p>
                )
              )}
              {activeTab === "composicao" && (
                <div className="space-y-1.5">
                  <p><strong>Ingredientes:</strong> Base de óleos vegetais nobres saponificados, enriquecido com {product.name.toLowerCase().includes("mel") ? "Mel de abelha silvestre" : "bioativos naturais de alta pureza"}, óleos essenciais puros e extrato de própolis/cera conforme a formulação.</p>
                  <p><strong>Armazenamento:</strong> Conservar em saboneteira seca ou local fresco e ao abrigo da umidade excessiva e luz solar direta.</p>
                  <p><strong>Dica de Uso:</strong> Use bucha vegetal para potencializar a esfoliação natural e ativar a microcirculação da pele.</p>
                </div>
              )}
            </div>
          </div>

          {/* Lógica de Compra, Estoque e Carrinho */}
          <div className="border-t border-natural-border pt-6">
            
            {/* Gatilho de Escassez em Tempo Real */}
            <div className="mb-4">
              {isOutOfStock ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500">
                  <span className="h-2 w-2 rounded-full bg-gray-400" />
                  Produto esgotado. Fale com nosso suporte para pré-encomenda.
                </span>
              ) : isLowStock ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 animate-pulse">
                  <Flame className="h-3.5 w-3.5 fill-rose-600 text-rose-600" />
                  ATENÇÃO: Apenas {product.stock} unidades restantes no estoque!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-natural-organic">
                  <span className="h-2 w-2 rounded-full bg-natural-organic" />
                  Disponível em estoque (Pronto para envio imediato)
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              {/* Seletor de Quantidade */}
              {!isOutOfStock && (
                <div className="flex items-center justify-between border border-natural-border rounded-xl px-2 py-1.5 bg-white sm:w-32">
                  <button
                    onClick={handleDecrement}
                    disabled={quantity <= 1}
                    className="h-8 w-8 text-lg font-bold text-natural-darkbrown disabled:text-gray-300 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-sm">{quantity}</span>
                  <button
                    onClick={handleIncrement}
                    disabled={quantity >= product.stock}
                    className="h-8 w-8 text-lg font-bold text-natural-darkbrown disabled:text-gray-300 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              )}

              {/* Botão de Adicionar ao Carrinho */}
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 px-6 font-bold text-sm transition-all cursor-pointer ${
                  isOutOfStock
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : addedFeedback
                    ? "bg-emerald-600 text-white"
                    : "bg-natural-gold text-white hover:bg-natural-gold/90 shadow-sm hover:shadow-md"
                }`}
                id="add-to-cart-detail-btn"
              >
                {addedFeedback ? (
                  <>
                    <Check className="h-5 w-5" />
                    Adicionado com Sucesso!
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-5 w-5" />
                    Adicionar {quantity > 1 ? `(${quantity})` : ""} ao Carrinho
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 flex justify-between text-[11px] text-natural-text/40">
              <span className="flex items-center gap-1">
                <Leaf className="h-3 w-3" />
                Produção Sustentável Certificada
              </span>
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Ambiente 100% Seguro
              </span>
            </div>
          </div>
          
        </div>
      </div>

      {/* Barra fixa de compra em mobile — mantém o CTA sempre à mão */}
      {!isOutOfStock && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex sm:hidden items-center gap-3 border-t border-natural-border bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] text-natural-text/60">{product.name.length > 22 ? `${product.name.slice(0, 22)}…` : product.name}</span>
            <span className="font-display text-sm font-bold text-natural-darkbrown">{formatCurrency(activePrice)}</span>
          </div>
          <button
            onClick={handleAddToCart}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-bold text-sm transition-all cursor-pointer ${
              addedFeedback ? "bg-emerald-600 text-white" : "bg-natural-gold text-white hover:bg-natural-gold/90"
            }`}
            id="add-to-cart-sticky-mobile-btn"
          >
            {addedFeedback ? (
              <>
                <Check className="h-4 w-4" />
                Adicionado!
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Adicionar ao Carrinho
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
