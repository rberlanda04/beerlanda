import { useState } from "react";
import { CartItem, Coupon } from "../types";
import { formatCurrency } from "../utils";
import { X, Trash2, ShoppingBag, Tag, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
  appliedCoupon: Coupon | null;
  onApplyCoupon: (coupon: Coupon | null) => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  appliedCoupon,
  onApplyCoupon,
}: CartDrawerProps) {
  const [couponInput, setCouponInput] = useState<string>("");
  const [couponError, setCouponError] = useState<string>("");
  const [couponSuccess, setCouponSuccess] = useState<string>("");
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // Calcular valores básicos do carrinho
  const subtotal = cartItems.reduce((acc, item) => {
    const price = item.product.promoPrice || item.product.price;
    return acc + price * item.quantity;
  }, 0);

  // Calcular desconto aplicado
  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === "percentage") {
      discountAmount = subtotal * (appliedCoupon.value / 100);
    } else {
      discountAmount = Math.min(appliedCoupon.value, subtotal);
    }
  }

  const total = Math.max(0, subtotal - discountAmount);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;

    setIsValidating(true);
    setCouponError("");
    setCouponSuccess("");

    try {
      const response = await fetch("/api/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setCouponError(data.message || "Erro ao validar cupom");
        onApplyCoupon(null);
      } else {
        const coupon: Coupon = data.coupon;
        onApplyCoupon(coupon);
        setCouponSuccess(`Cupom ${coupon.code} aplicado com sucesso!`);
        setCouponInput("");
      }
    } catch (error) {
      setCouponError("Erro de conexão ao validar o cupom.");
      onApplyCoupon(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    onApplyCoupon(null);
    setCouponSuccess("");
    setCouponError("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur/Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
          />

          {/* Painel do Carrinho Lateral */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-natural-bg shadow-2xl border-l border-natural-border"
            aria-modal="true"
            aria-label="Carrinho de Compras"
            id="cart-drawer-container"
          >
            {/* Cabeçalho do Carrinho */}
            <div className="flex h-16 items-center justify-between border-b border-natural-border bg-white px-6">
              <div className="flex items-center gap-2 text-natural-darkbrown">
                <ShoppingBag className="h-5 w-5 text-natural-gold" />
                <h2 className="font-display text-lg font-bold">Meu Carrinho</h2>
                <span className="rounded-full bg-natural-gold/25 px-2.5 py-0.5 font-mono text-xs font-bold text-natural-darkbrown">
                  {cartItems.reduce((sum, i) => sum + i.quantity, 0)}
                </span>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1 text-natural-text/60 hover:bg-natural-card hover:text-natural-darkbrown transition-colors cursor-pointer"
                aria-label="Fechar carrinho"
                id="close-cart-btn"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo Central */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {cartItems.length === 0 ? (
                // Estado Vazio
                <div className="flex h-full flex-col items-center justify-center text-center py-20 gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-natural-card text-natural-gold">
                    <ShoppingBag className="h-10 w-10" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-natural-darkbrown">Seu carrinho está vazio</h3>
                    <p className="mt-1 text-xs text-natural-text/60 max-w-xs mx-auto">
                      Explore nossos sabonetes, bálsamos, velas e artesanato natural à base de abelha para começar a cuidar de você hoje!
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-xl bg-natural-gold px-6 py-2.5 text-xs font-bold text-white hover:bg-natural-gold/90 transition-colors cursor-pointer"
                  >
                    Voltar à Loja
                  </button>
                </div>
              ) : (
                // Lista de Itens do Carrinho
                <div className="space-y-4">
                  {cartItems.map((item) => {
                    const price = item.product.promoPrice || item.product.price;
                    return (
                      <motion.div
                        key={item.product.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        className="flex gap-4 rounded-xl bg-white p-3 border border-natural-border shadow-xs"
                      >
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="h-16 w-16 rounded-lg object-cover bg-natural-card"
                        />
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-natural-gold">
                              {item.product.category}
                            </span>
                            <h4 className="font-display text-xs font-bold text-natural-darkbrown line-clamp-1">
                              {item.product.name}
                            </h4>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            {/* Controle de Quantidade */}
                            <div className="flex items-center gap-2 border border-natural-border rounded-lg px-2 py-0.5 bg-natural-card">
                              <button
                                onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                                className="text-xs font-bold text-natural-darkbrown hover:text-natural-gold px-1 cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-mono text-xs font-bold text-natural-darkbrown">{item.quantity}</span>
                              <button
                                onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                                disabled={item.quantity >= item.product.stock}
                                className="text-xs font-bold text-natural-darkbrown hover:text-natural-gold px-1 disabled:opacity-30 cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            {/* Preço Total do Item */}
                            <span className="text-xs font-bold text-natural-darkbrown">
                              {formatCurrency(price * item.quantity)}
                            </span>
                          </div>
                        </div>

                        {/* Botão Remover */}
                        <button
                          onClick={() => onRemoveItem(item.product.id)}
                          className="self-start rounded-md p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                          aria-label="Remover item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Painel Inferior de Fechamento */}
            {cartItems.length > 0 && (
              <div className="border-t border-natural-border bg-white p-6 shadow-lg">
                
                {/* Seção de Cupons */}
                <div className="mb-5">
                  <h4 className="text-xs font-bold text-natural-darkbrown flex items-center gap-1.5 uppercase tracking-wider mb-2">
                    <Tag className="h-3.5 w-3.5 text-natural-gold" />
                    Cupom de Desconto
                  </h4>

                  {appliedCoupon ? (
                    <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Ativo: {appliedCoupon.code} (-{appliedCoupon.type === "percentage" ? `${appliedCoupon.value}%` : formatCurrency(appliedCoupon.value)})
                      </div>
                      <button
                        onClick={handleRemoveCoupon}
                        className="text-[10px] font-bold uppercase text-rose-700 hover:underline cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="EX: MEL10 ou BEMVINDO15"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          className="w-full rounded-xl border border-natural-border px-3 py-2.5 text-xs font-mono uppercase tracking-wider focus:border-natural-gold focus:outline-hidden bg-natural-card/50 text-natural-darkbrown"
                        />
                      </div>
                      <button
                        onClick={handleApplyCoupon}
                        disabled={isValidating || !couponInput.trim()}
                        className="rounded-xl bg-natural-card border border-natural-border px-4 py-2.5 text-xs font-bold text-natural-darkbrown hover:bg-natural-gold/15 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isValidating ? "Validando..." : "Aplicar"}
                      </button>
                    </div>
                  )}

                  {couponError && (
                    <p className="mt-1.5 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {couponError}
                    </p>
                  )}
                  {couponSuccess && (
                    <p className="mt-1.5 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {couponSuccess}
                    </p>
                  )}
                </div>

                {/* Resumo de Custos */}
                <div className="space-y-2.5 border-t border-natural-border pt-4">
                  <div className="flex justify-between text-xs text-natural-text/60">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCurrency(subtotal)}</span>
                  </div>

                  {appliedCoupon && (
                    <div className="flex justify-between text-xs text-natural-organic font-bold">
                      <span>Desconto ({appliedCoupon.code})</span>
                      <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-base font-bold text-natural-darkbrown border-t border-natural-border pt-2.5">
                    <span>Total Estimado</span>
                    <span className="font-mono text-natural-gold">{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Botão Próximo Passo */}
                <button
                  onClick={onCheckout}
                  className="mt-6 w-full rounded-xl bg-natural-gold py-3.5 text-center text-sm font-bold text-white shadow-md hover:bg-natural-gold/90 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  id="go-to-checkout-btn"
                >
                  <Sparkles className="h-4 w-4" />
                  Ir para o Checkout de 1 Página
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
