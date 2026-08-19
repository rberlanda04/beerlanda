import { useState, useEffect, lazy, Suspense } from "react";
import { Product, Review, CartItem, Coupon } from "./types";
import { scrollToTop } from "./utils";

// Subcomponentes
import Header from "./components/Header";
import Footer from "./components/Footer";
import HomeView from "./components/HomeView";
import ProductView from "./components/ProductView";
import CartDrawer from "./components/CartDrawer";
import CheckoutView from "./components/CheckoutView";
import PaymentStatusView from "./components/PaymentStatusView";
import ClubeView from "./components/ClubeView";
import ClubeWelcomeView from "./components/ClubeWelcomeView";

import { motion, AnimatePresence } from "motion/react";

// Carregado sob demanda: só quem acessa /admin paga o custo (inclui recharts,
// usado nos gráficos de Análises) — clientes da loja nunca baixam esse chunk.
const AdminPortal = lazy(() => import("./components/AdminPortal"));

export default function App() {
  if (window.location.pathname === "/admin") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-natural-bg" />}>
        <AdminPortal />
      </Suspense>
    );
  }

  // --- ESTADO GLOBAL ---
  const [appConfig, setAppConfig] = useState<{ contactEmail: string }>({
    contactEmail: "beerlandaprodutosartesanais@gmail.com"
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentView, setCurrentView] = useState<"home" | "product" | "checkout" | "payment-success" | "payment-failure" | "payment-pending" | "clube" | "clube-welcome">("home");
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // --- CARREGAR DADOS DA API NO BOOT ---
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);

        // Buscar configurações globais
        const configRes = await fetch("/api/config");
        if (configRes.ok) {
          const configData = await configRes.json();
          setAppConfig(configData);
        }

        // Buscar produtos
        const prodRes = await fetch("/api/products");
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          setProducts(prodData);
        }

        // Buscar avaliações
        const revRes = await fetch("/api/reviews");
        if (revRes.ok) {
          const revData = await revRes.json();
          setReviews(revData);
        }
      } catch (error) {
        console.error("Falha ao carregar dados do servidor Beerlanda:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();

    // Carregar carrinho do localStorage
    const savedCart = localStorage.getItem("beerlanda_cart");
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (e) {
        console.error("Erro ao ler carrinho do localStorage", e);
      }
    }

    // Carregar cupom aplicado do localStorage
    const savedCoupon = localStorage.getItem("beerlanda_coupon");
    if (savedCoupon) {
      try {
        setAppliedCoupon(JSON.parse(savedCoupon));
      } catch (e) {
        console.error("Erro ao ler cupom do localStorage", e);
      }
    }
  }, []);

  // --- PERSISTIR CARRINHO ---
  useEffect(() => {
    localStorage.setItem("beerlanda_cart", JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (appliedCoupon) {
      localStorage.setItem("beerlanda_coupon", JSON.stringify(appliedCoupon));
    } else {
      localStorage.removeItem("beerlanda_coupon");
    }
  }, [appliedCoupon]);

  // --- ROTEADOR BASEADO EM HASH (Excelente para iframes) ---
  useEffect(() => {
    function handleHashChange() {
      // Links de produto compartilhados (sitemap, WhatsApp, Instagram) usam
      // caminho real (/produto/slug) pra ter meta tags corretas no SSR — se
      // não há hash, mas a URL já chegou nesse caminho, trata como se fosse.
      let hash = window.location.hash;
      if (!hash) {
        const pathMatch = window.location.pathname.match(/^\/produto\/([^/]+)\/?$/);
        if (pathMatch) hash = `#produto/${pathMatch[1]}`;
      }

      if (hash.startsWith("#produto/")) {
        const slug = hash.replace("#produto/", "");
        // Procurar produto pelo slug
        const found = products.find((p) => p.slug === slug);
        if (found) {
          setSelectedProduct(found);
          setCurrentView("product");
        } else if (products.length > 0) {
          // Se não encontrou mas produtos já carregaram, volta pro início
          window.location.hash = "";
        }
      } else if (hash === "#checkout") {
        if (cartItems.length === 0) {
          window.location.hash = "";
        } else {
          setCurrentView("checkout");
          setSelectedProduct(null);
        }
      } else if (hash === "#pagamento/sucesso") {
        setCurrentView("payment-success");
        setSelectedProduct(null);
        setCartItems([]);
        setAppliedCoupon(null);
      } else if (hash === "#pagamento/erro") {
        setCurrentView("payment-failure");
        setSelectedProduct(null);
      } else if (hash === "#pagamento/pendente") {
        setCurrentView("payment-pending");
        setSelectedProduct(null);
        setCartItems([]);
        setAppliedCoupon(null);
      } else if (hash === "#clube") {
        setCurrentView("clube");
        setSelectedProduct(null);
      } else if (hash === "#abelhas") {
        setCurrentView("clube-welcome");
        setSelectedProduct(null);
      } else {
        // Padrão: Home
        setCurrentView("home");
        setSelectedProduct(null);
      }
      scrollToTop();
    }

    // Registrar o escutador de hash
    window.addEventListener("hashchange", handleHashChange);
    
    // Executar uma vez no boot (depois que produtos carregarem)
    if (products.length > 0) {
      handleHashChange();
    }

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [products, cartItems.length]);

  // --- FUNÇÕES DE NAVEGAÇÃO ---
  const navigateToHome = () => {
    window.location.hash = "";
  };

  const navigateToProduct = (product: Product) => {
    window.location.hash = `#produto/${product.slug}`;
  };

  const navigateToCheckout = () => {
    setIsCartOpen(false);
    window.location.hash = "#checkout";
  };

  // --- LÓGICA DO CARRINHO ---
  const handleAddToCart = (product: Product, quantity = 1) => {
    setCartItems((prevItems) => {
      const existing = prevItems.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = Math.min(product.stock, existing.quantity + quantity);
        return prevItems.map((item) =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prevItems, { product, quantity: Math.min(product.stock, quantity) }];
    });
    
    // Abrir o carrinho automaticamente para feedback visual sutil
    setIsCartOpen(true);
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveCartItem(productId);
      return;
    }

    setCartItems((prevItems) =>
      prevItems.map((item) => {
        if (item.product.id === productId) {
          const stockLimit = item.product.stock;
          return { ...item, quantity: Math.min(stockLimit, quantity) };
        }
        return item;
      })
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.product.id !== productId));
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-brand-50" id="beerlanda-app-root">
      
      {/* Header global */}
      <Header
        cartCount={cartCount}
        onOpenCart={() => setIsCartOpen(true)}
        currentView={currentView}
        onNavigateHome={navigateToHome}
      />

      {/* Conteúdo Principal com Animações de Transição */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {currentView === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <HomeView
                products={products}
                reviews={reviews}
                onSelectProduct={navigateToProduct}
                onAddToCart={handleAddToCart}
                isLoading={isLoading}
              />
            </motion.div>
          )}

          {currentView === "product" && selectedProduct && (
            <motion.div
              key="product"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <ProductView
                product={selectedProduct}
                reviews={reviews}
                onBack={navigateToHome}
                onAddToCart={handleAddToCart}
              />
            </motion.div>
          )}

          {currentView === "checkout" && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <CheckoutView
                cartItems={cartItems}
                appliedCoupon={appliedCoupon}
                onBackToCart={() => setIsCartOpen(true)}
              />
            </motion.div>
          )}

          {currentView === "clube" && (
            <motion.div
              key="clube"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <ClubeView onBackToHome={navigateToHome} />
            </motion.div>
          )}

          {currentView === "clube-welcome" && (
            <motion.div
              key="clube-welcome"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <ClubeWelcomeView onBackToHome={navigateToHome} />
            </motion.div>
          )}

          {(currentView === "payment-success" || currentView === "payment-failure" || currentView === "payment-pending") && (
            <motion.div
              key="payment-status"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <PaymentStatusView
                status={currentView === "payment-success" ? "success" : currentView === "payment-failure" ? "failure" : "pending"}
                onBackToHome={navigateToHome}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Gaveta do Carrinho de Compras */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onCheckout={navigateToCheckout}
        appliedCoupon={appliedCoupon}
        onApplyCoupon={setAppliedCoupon}
      />

      {/* Footer global */}
      <Footer appConfig={appConfig} />
    </div>
  );
}
