import { ShoppingBag, ArrowLeft, Heart, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import logoImg from "../assets/images/logo2.png";

interface HeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  currentView: string;
  onNavigateHome: () => void;
}

export default function Header({ cartCount, onOpenCart, currentView, onNavigateHome }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-natural-border bg-white/75 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Lado Esquerdo - Navegação / Logo */}
        <div className="flex items-center gap-4">
          {currentView !== "home" && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onNavigateHome}
              className="flex items-center justify-center rounded-full p-2 text-natural-darkbrown hover:bg-natural-card transition-colors"
              aria-label="Voltar para a página inicial"
              id="back-to-home-btn"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
          )}

          <button
            onClick={onNavigateHome}
            className="flex items-center group text-left transition-transform hover:scale-[1.03] duration-300"
            id="logo-brand-btn"
          >
            <img
              src={logoImg}
              alt="Beerlanda - Produtos Artesanais"
              className="h-12 sm:h-14 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </button>
        </div>

        {/* Lado Direito - Ações */}
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-1.5 rounded-full bg-natural-organic/10 px-3 py-1 text-xs font-semibold text-natural-organic md:flex">
            <Sparkles className="h-3 w-3" />
            100% Puro & Sustentável
          </span>

          {/* Botão de Carrinho com Badge Animada */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenCart}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-natural-card text-natural-darkbrown border border-natural-border hover:bg-natural-border transition-colors"
            aria-label="Ver carrinho de compras"
            id="open-cart-header-btn"
          >
            <ShoppingBag className="h-5.5 w-5.5" />
            {cartCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-natural-gold text-[10px] font-bold text-white shadow-md ring-2 ring-white"
              >
                {cartCount}
              </motion.span>
            )}
          </motion.button>
        </div>
      </div>
    </header>
  );
}
