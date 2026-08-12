import React, { useState } from "react";
import { CartItem, Coupon } from "../types";
import { formatCurrency } from "../utils";
import { Sparkles, MessageCircle, ArrowLeft, CheckCircle2, Copy, AlertCircle, ShoppingBag, Truck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CheckoutViewProps {
  cartItems: CartItem[];
  appliedCoupon: Coupon | null;
  onBackToCart: () => void;
  onClearCart: () => void;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.replace(/^(\d*)/, "($1");
  if (digits.length <= 7) return digits.replace(/^(\d{2})(\d*)/, "($1) $2");
  return digits.replace(/^(\d{2})(\d{5}|\d{4})(\d*)/, "($1) $2-$3");
}

function maskCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return digits.replace(/^(\d{5})(\d*)/, "$1-$2");
}

export default function CheckoutView({ cartItems, appliedCoupon, onBackToCart, onClearCart }: CheckoutViewProps) {
  // Estado do formulário
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    zipCode: "",
    street: "",
    number: "",
    neighborhood: "",
    cityState: "",
    complement: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Estado de Sucesso
  const [successOrder, setSuccessOrder] = useState<{
    orderId: string;
    whatsappUrl: string;
    whatsappMessage: string;
    total: number;
  } | null>(null);

  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Calcular valores
  const subtotal = cartItems.reduce((acc, item) => {
    const price = item.product.promoPrice || item.product.price;
    return acc + price * item.quantity;
  }, 0);

  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === "percentage") {
      discountAmount = subtotal * (appliedCoupon.value / 100);
    } else {
      discountAmount = Math.min(appliedCoupon.value, subtotal);
    }
  }

  const total = Math.max(0, subtotal - discountAmount);

  // Validar formulário
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Nome completo é obrigatório";
    if (!formData.phone.trim()) {
      errors.phone = "Número do WhatsApp é obrigatório";
    } else if (formData.phone.replace(/\D/g, "").length < 10) {
      errors.phone = "Por favor, digite um WhatsApp válido com DDD";
    }
    if (!formData.email.trim()) {
      errors.email = "E-mail é obrigatório";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Endereço de e-mail inválido";
    }
    if (!formData.street.trim()) errors.street = "Nome da rua é obrigatório";
    if (!formData.number.trim()) errors.number = "Número residencial é obrigatório";
    if (!formData.zipCode.trim()) errors.zipCode = "CEP é obrigatório";
    if (!formData.neighborhood.trim()) errors.neighborhood = "Bairro é obrigatório";
    if (!formData.cityState.trim()) errors.cityState = "Cidade e Estado são obrigatórios";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submeter Pedido
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    const fullAddress = `${formData.street}, Nº ${formData.number}${formData.complement ? ` - ${formData.complement}` : ""}, Bairro: ${formData.neighborhood}, CEP: ${formData.zipCode}, Cidade/Estado: ${formData.cityState}`;

    const payload = {
      clientName: formData.name,
      phone: formData.phone,
      email: formData.email,
      address: fullAddress,
      items: cartItems,
      total,
      couponCode: appliedCoupon?.code || null,
      discountApplied: discountAmount
    };

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessOrder({
          orderId: data.orderId,
          whatsappUrl: data.whatsappUrl,
          whatsappMessage: data.whatsappMessage,
          total: data.total
        });
      } else {
        alert(data.error || "Houve uma falha ao processar o checkout. Tente novamente.");
      }
    } catch (err) {
      console.error("Erro no checkout:", err);
      alert("Erro de conexão com o servidor. Verifique e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyMessage = () => {
    if (successOrder) {
      navigator.clipboard.writeText(successOrder.whatsappMessage);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const handleFinishAndRedirect = () => {
    if (successOrder) {
      window.open(successOrder.whatsappUrl, "_blank", "noopener,noreferrer");
      onClearCart();
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:py-8">
      
      {/* Botão de retorno rápido */}
      <button
        onClick={onBackToCart}
        className="inline-flex items-center gap-1.5 rounded-lg border border-natural-border bg-white px-3.5 py-1.5 text-xs font-bold text-natural-text hover:bg-natural-card transition-colors mb-6 cursor-pointer"
        id="back-to-cart-from-checkout-btn"
      >
        <ArrowLeft className="h-4 w-4" />
        Ajustar itens do Carrinho
      </button>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        
        {/* Lado Esquerdo - Formulário de Entrega & Faturamento */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-natural-border p-6 sm:p-8 shadow-xs">
          <h2 className="font-display text-2xl font-bold text-natural-darkbrown border-b border-natural-border pb-4 flex items-center gap-2">
            <Truck className="h-6 w-6 text-natural-gold" />
            Dados para Entrega
          </h2>

          <form onSubmit={handleSubmitOrder} className="mt-6 space-y-4">
            
            {/* Campo Nome */}
            <div>
              <label htmlFor="name" className="block text-xs font-bold text-natural-darkbrown uppercase tracking-wider mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                id="name"
                placeholder="Ex: Mariana dos Santos"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full rounded-xl border px-3 py-2.5 text-xs focus:outline-hidden bg-natural-card/40 text-natural-darkbrown ${
                  formErrors.name ? "border-rose-400 focus:border-rose-500" : "border-natural-border focus:border-natural-gold"
                }`}
              />
              {formErrors.name && (
                <p className="mt-1 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {formErrors.name}
                </p>
              )}
            </div>

            {/* Linha WhatsApp e Email */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className="block text-xs font-bold text-natural-darkbrown uppercase tracking-wider mb-1">
                  WhatsApp (com DDD)
                </label>
                <input
                  type="tel"
                  id="phone"
                  placeholder="Ex: (11) 99999-9999"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs focus:outline-hidden bg-natural-card/40 text-natural-darkbrown ${
                    formErrors.phone ? "border-rose-400 focus:border-rose-500" : "border-natural-border focus:border-natural-gold"
                  }`}
                />
                {formErrors.phone && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formErrors.phone}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-bold text-natural-darkbrown uppercase tracking-wider mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  id="email"
                  placeholder="Ex: mariana@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs focus:outline-hidden bg-natural-card/40 text-natural-darkbrown ${
                    formErrors.email ? "border-rose-400 focus:border-rose-500" : "border-natural-border focus:border-natural-gold"
                  }`}
                />
                {formErrors.email && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formErrors.email}
                  </p>
                )}
              </div>
            </div>

            {/* Linha CEP e Bairro */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label htmlFor="zipCode" className="block text-xs font-bold text-natural-darkbrown uppercase tracking-wider mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  id="zipCode"
                  placeholder="Ex: 01310-100"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: maskCep(e.target.value) })}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs focus:outline-hidden bg-natural-card/40 text-natural-darkbrown ${
                    formErrors.zipCode ? "border-rose-400 focus:border-rose-500" : "border-natural-border focus:border-natural-gold"
                  }`}
                />
                {formErrors.zipCode && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formErrors.zipCode}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="neighborhood" className="block text-xs font-bold text-natural-darkbrown uppercase tracking-wider mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  id="neighborhood"
                  placeholder="Ex: Bela Vista"
                  value={formData.neighborhood}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs focus:outline-hidden bg-natural-card/40 text-natural-darkbrown ${
                    formErrors.neighborhood ? "border-rose-400 focus:border-rose-500" : "border-natural-border focus:border-natural-gold"
                  }`}
                />
                {formErrors.neighborhood && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formErrors.neighborhood}
                  </p>
                )}
              </div>
            </div>

            {/* Rua e Número */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="sm:col-span-3">
                <label htmlFor="street" className="block text-xs font-bold text-natural-darkbrown uppercase tracking-wider mb-1">
                  Rua / Logradouro
                </label>
                <input
                  type="text"
                  id="street"
                  placeholder="Ex: Avenida Paulista"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs focus:outline-hidden bg-natural-card/40 text-natural-darkbrown ${
                    formErrors.street ? "border-rose-400 focus:border-rose-500" : "border-natural-border focus:border-natural-gold"
                  }`}
                />
                {formErrors.street && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formErrors.street}
                  </p>
                )}
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="number" className="block text-xs font-bold text-natural-darkbrown uppercase tracking-wider mb-1">
                  Número
                </label>
                <input
                  type="text"
                  id="number"
                  placeholder="Ex: 1000"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs focus:outline-hidden bg-natural-card/40 text-natural-darkbrown ${
                    formErrors.number ? "border-rose-400 focus:border-rose-500" : "border-natural-border focus:border-natural-gold"
                  }`}
                />
                {formErrors.number && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formErrors.number}
                  </p>
                )}
              </div>
            </div>

            {/* Complemento e Cidade/Estado */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="complement" className="block text-xs font-bold text-natural-darkbrown uppercase tracking-wider mb-1">
                  Complemento (Opcional)
                </label>
                <input
                  type="text"
                  id="complement"
                  placeholder="Ex: Apto 42, Bloco B"
                  value={formData.complement}
                  onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                  className="w-full rounded-xl border border-natural-border px-3 py-2.5 text-xs focus:border-natural-gold focus:outline-hidden bg-natural-card/40 text-natural-darkbrown"
                />
              </div>

              <div>
                <label htmlFor="cityState" className="block text-xs font-bold text-natural-darkbrown uppercase tracking-wider mb-1">
                  Cidade / Estado
                </label>
                <input
                  type="text"
                  id="cityState"
                  placeholder="Ex: São Paulo - SP"
                  value={formData.cityState}
                  onChange={(e) => setFormData({ ...formData, cityState: e.target.value })}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs focus:outline-hidden bg-natural-card/40 text-natural-darkbrown ${
                    formErrors.cityState ? "border-rose-400 focus:border-rose-500" : "border-natural-border focus:border-natural-gold"
                  }`}
                />
                {formErrors.cityState && (
                  <p className="mt-1 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {formErrors.cityState}
                  </p>
                )}
              </div>
            </div>

            {/* Botão invisível do form para submit nativo */}
            <input type="submit" className="hidden" />
          </form>
        </div>

        {/* Lado Direito - Resumo do Pedido e Pagamento */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-natural-card border border-natural-border rounded-2xl p-6 shadow-xs">
            <h3 className="font-display text-lg font-bold text-natural-darkbrown border-b border-natural-border pb-3 flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-natural-gold" />
              Resumo do Pedido
            </h3>

            {/* Itens */}
            <div className="mt-4 max-h-[220px] overflow-y-auto space-y-3 pr-2">
              {cartItems.map((item) => {
                const price = item.product.promoPrice || item.product.price;
                return (
                  <div key={item.product.id} className="flex justify-between items-center text-xs text-natural-darkbrown">
                    <div className="flex flex-col max-w-[70%]">
                      <span className="font-bold text-natural-darkbrown line-clamp-1">{item.product.name}</span>
                      <span className="text-[10px] text-natural-text/60">Qtd: {item.quantity} x {formatCurrency(price)}</span>
                    </div>
                    <span className="font-mono font-bold text-natural-darkbrown">{formatCurrency(price * item.quantity)}</span>
                  </div>
                );
              })}
            </div>

            {/* Subtotais */}
            <div className="mt-6 border-t border-natural-border pt-4 space-y-2">
              <div className="flex justify-between text-xs text-natural-text/70">
                <span>Subtotal dos Produtos</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              
              {appliedCoupon && (
                <div className="flex justify-between text-xs text-natural-organic font-bold">
                  <span>Desconto aplicado ({appliedCoupon.code})</span>
                  <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-xs text-natural-organic font-bold">
                <span className="flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" />
                  Frete
                </span>
                <span className="uppercase text-[10px] bg-natural-organic/10 text-natural-organic px-2 py-0.5 rounded font-bold">Grátis</span>
              </div>

              <div className="flex justify-between text-base font-bold text-natural-darkbrown border-t border-natural-border pt-3">
                <span>Total Final</span>
                <span className="font-mono text-natural-gold">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Botão de Fechamento de Alta Conversão */}
            <button
              onClick={handleSubmitOrder}
              disabled={isSubmitting}
              className="mt-6 w-full rounded-xl bg-natural-gold py-4 text-center text-sm font-bold text-white shadow-md hover:bg-natural-gold/90 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              id="confirm-checkout-btn"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Gravando pedido...
                </>
              ) : (
                <>
                  <MessageCircle className="h-5 w-5 fill-white text-natural-gold" />
                  Finalizar Pedido no WhatsApp
                </>
              )}
            </button>
            
            <p className="mt-3 text-[10px] text-center text-natural-text/50 leading-relaxed">
              Ao clicar no botão, seu pedido será registrado na planilha do Google e você será redirecionado para o WhatsApp para receber os dados do Pix e finalizar sua compra.
            </p>
          </div>
        </div>

      </div>

      {/* -------------------------------------------------------------
          MODAL DE SUCESSO DO PEDIDO (Gera o link final do Whatsapp)
         ------------------------------------------------------------- */}
      <AnimatePresence>
        {successOrder && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-lg rounded-2xl bg-white p-6 md:p-8 shadow-2xl border border-natural-border text-center"
              id="success-checkout-modal"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8 fill-emerald-50" />
              </div>

              <h3 className="mt-4 font-display text-2xl font-bold text-natural-darkbrown">
                Pedido Gerado com Sucesso!
              </h3>
              
              <p className="mt-2 text-xs text-natural-text/70">
                Seu pedido <strong className="font-mono text-natural-gold bg-natural-gold/10 px-1.5 py-0.5 rounded">#{successOrder.orderId}</strong> foi salvo em tempo real no nosso banco de dados.
              </p>

              {/* Mensagem Formata para Envio */}
              <div className="mt-6 rounded-2xl border border-natural-border bg-natural-card/50 p-4 text-left">
                <div className="flex items-center justify-between border-b border-natural-border pb-2 mb-2">
                  <span className="text-[10px] font-bold text-natural-darkbrown uppercase tracking-wider">
                    Mensagem que será enviada:
                  </span>
                  <button
                    onClick={handleCopyMessage}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-natural-gold hover:underline cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    {copiedText ? "Copiado!" : "Copiar Texto"}
                  </button>
                </div>
                <div className="max-h-[140px] overflow-y-auto text-[11px] text-natural-text/80 font-mono whitespace-pre-line leading-relaxed">
                  {successOrder.whatsappMessage}
                </div>
              </div>

              {/* Ação Principal - Botão WhatsApp */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={handleFinishAndRedirect}
                  className="w-full rounded-xl bg-emerald-600 py-3.5 text-center text-sm font-bold text-white shadow-md hover:bg-emerald-700 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  id="whatsapp-redirect-btn"
                >
                  <MessageCircle className="h-5 w-5 fill-white text-emerald-600" />
                  Ir para o WhatsApp & Pagar via Pix
                </button>

                <p className="text-[10px] text-natural-text/50">
                  Caso o aplicativo não abra automaticamente, copie o texto acima e envie para nosso suporte.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
