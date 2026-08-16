import React, { useState, useEffect, useRef } from "react";
import { CartItem, Coupon } from "../types";
import { formatCurrency, maskPhone, maskCep } from "../utils";
import { ArrowLeft, AlertCircle, ShoppingBag, Truck, CreditCard, ShieldCheck, RefreshCw, CheckCircle2 } from "lucide-react";

interface ShippingOption {
  price: number;
  days: number;
}

interface ShippingOptions {
  pac: ShippingOption;
  sedex: ShippingOption;
}

interface CheckoutViewProps {
  cartItems: CartItem[];
  appliedCoupon: Coupon | null;
  onBackToCart: () => void;
}

export default function CheckoutView({ cartItems, appliedCoupon, onBackToCart }: CheckoutViewProps) {
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
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Estado do cálculo de frete (Correios)
  const [shippingOptions, setShippingOptions] = useState<ShippingOptions | null>(null);
  const [selectedShipping, setSelectedShipping] = useState<"pac" | "sedex" | "combinar" | null>(null);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const lastCalculatedCep = useRef<string>("");

  const calculateShipping = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8 || digits === lastCalculatedCep.current) return;

    lastCalculatedCep.current = digits;
    setIsCalculatingShipping(true);
    setShippingError(null);
    setShippingOptions(null);
    setSelectedShipping(null);

    try {
      const response = await fetch("/api/shipping/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep: digits,
          items: cartItems.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setShippingError(data.error || "Não foi possível calcular o frete agora.");
        return;
      }
      setShippingOptions(data);
      setSelectedShipping("pac");
    } catch {
      setShippingError("Erro de conexão ao calcular o frete.");
    } finally {
      setIsCalculatingShipping(false);
    }
  };

  // Dispara o cálculo assim que o CEP chega a 8 dígitos
  useEffect(() => {
    const digits = formData.zipCode.replace(/\D/g, "");
    if (digits.length !== 8) return;
    const timer = setTimeout(() => calculateShipping(formData.zipCode), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.zipCode]);

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

  const shippingCost =
    (selectedShipping === "pac" || selectedShipping === "sedex") && shippingOptions
      ? shippingOptions[selectedShipping].price
      : 0;
  const total = Math.max(0, subtotal - discountAmount + shippingCost);

  // Validar formulário
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Nome completo é obrigatório";
    if (!formData.phone.trim()) {
      errors.phone = "Telefone é obrigatório";
    } else if (formData.phone.replace(/\D/g, "").length < 10) {
      errors.phone = "Por favor, digite um telefone válido com DDD";
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
    if (!selectedShipping) errors.shipping = "Escolha uma opção de frete para continuar";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submeter Pedido — sempre segue para o checkout do Mercado Pago (cartão ou Pix)
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setPaymentError(null);

    const fullAddress = `${formData.street}, Nº ${formData.number}${formData.complement ? ` - ${formData.complement}` : ""}, Bairro: ${formData.neighborhood}, CEP: ${formData.zipCode}, Cidade/Estado: ${formData.cityState}`;

    const payload = {
      clientName: formData.name,
      phone: formData.phone,
      email: formData.email,
      address: fullAddress,
      items: cartItems,
      total,
      shippingCost,
      shippingService: selectedShipping === "sedex" ? "SEDEX" : selectedShipping === "combinar" ? "A_COMBINAR" : "PAC",
    };

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.paymentUrl) {
        setPaymentError(data.error || "Não foi possível abrir o pagamento agora. Tente novamente em instantes.");
        setIsSubmitting(false);
        return;
      }

      window.location.href = data.paymentUrl;
    } catch (err) {
      console.error("Erro no checkout:", err);
      setPaymentError("Erro de conexão com o servidor. Verifique e tente novamente.");
      setIsSubmitting(false);
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

            {/* Linha Telefone e Email */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className="block text-xs font-bold text-natural-darkbrown uppercase tracking-wider mb-1">
                  Telefone (com DDD)
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

              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-natural-darkbrown mb-2">
                  <Truck className="h-3.5 w-3.5 text-natural-gold" />
                  Frete
                </div>

                {selectedShipping === "combinar" ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] text-amber-800 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Frete a combinar — vamos calcular e enviar o valor por WhatsApp/Instagram antes do envio.
                    </p>
                    <button
                      type="button"
                      onClick={() => { lastCalculatedCep.current = ""; calculateShipping(formData.zipCode); }}
                      className="mt-1.5 text-[11px] font-bold text-amber-800 underline cursor-pointer"
                    >
                      Tentar calcular o frete agora
                    </button>
                  </div>
                ) : formData.zipCode.replace(/\D/g, "").length !== 8 ? (
                  <p className="text-[11px] text-natural-text/60">Preencha o CEP para calcular o frete.</p>
                ) : isCalculatingShipping ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-natural-text/60">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Calculando frete...
                  </p>
                ) : shippingError ? (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 space-y-1.5">
                    <p className="text-[11px] text-rose-700 font-medium">{shippingError}</p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => { lastCalculatedCep.current = ""; calculateShipping(formData.zipCode); }}
                        className="text-[11px] font-bold text-rose-700 underline cursor-pointer"
                      >
                        Tentar novamente
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedShipping("combinar")}
                        className="text-[11px] font-bold text-natural-darkbrown underline cursor-pointer"
                      >
                        Continuar mesmo assim (frete a combinar)
                      </button>
                    </div>
                  </div>
                ) : shippingOptions ? (
                  <div className="space-y-2">
                    {(["pac", "sedex"] as const).map((key) => {
                      const opt = shippingOptions[key];
                      const isSelected = selectedShipping === key;
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => setSelectedShipping(key)}
                          className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
                            isSelected ? "border-natural-gold bg-natural-gold/10" : "border-natural-border bg-white hover:bg-natural-card"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 font-bold text-natural-darkbrown">
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-natural-gold" />}
                            {key === "pac" ? "PAC" : "SEDEX"}
                            <span className="font-normal text-natural-text/60">— até {opt.days} dia{opt.days === 1 ? "" : "s"}</span>
                          </span>
                          <span className="font-mono font-bold text-natural-darkbrown">{formatCurrency(opt.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {formErrors.shipping && (
                  <p className="mt-1.5 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.shipping}
                  </p>
                )}
              </div>

              <div className="flex justify-between text-base font-bold text-natural-darkbrown border-t border-natural-border pt-3">
                <span>Total Final</span>
                <span className="font-mono text-natural-gold">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Aviso de pagamento */}
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-natural-border bg-white p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-natural-gold/10 text-natural-gold">
                <CreditCard className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1">
                <span className="block text-xs font-bold text-natural-darkbrown">Cartão ou Pix</span>
                <span className="block text-[10px] text-natural-text/60">Pagamento imediato e seguro via Mercado Pago</span>
              </div>
            </div>

            {paymentError && (
              <p className="mt-3 text-[11px] text-rose-600 font-medium flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {paymentError}
              </p>
            )}

            {/* Botão de Fechamento de Alta Conversão */}
            <button
              onClick={handleSubmitOrder}
              disabled={isSubmitting || !selectedShipping}
              className="mt-4 w-full rounded-xl bg-natural-gold py-4 text-center text-sm font-bold text-white shadow-md hover:bg-natural-gold/90 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              id="confirm-checkout-btn"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Abrindo pagamento...
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5" />
                  Pagar com Cartão ou Pix
                </>
              )}
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-center text-natural-text/50 leading-relaxed">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-natural-organic" />
              Seu pedido é registrado e você será levado para o ambiente seguro do Mercado Pago para concluir o pagamento.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
