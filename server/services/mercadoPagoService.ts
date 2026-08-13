import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

function getClient(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
  }
  return new MercadoPagoConfig({ accessToken });
}

interface PreferenceItemInput {
  title: string;
  quantity: number;
  unitPrice: number;
}

interface CreatePreferenceParams {
  orderId: string;
  items: PreferenceItemInput[];
  payerName: string;
  payerEmail: string;
  baseUrl: string;
}

// Checkout Pro: gera uma página de pagamento hospedada pelo Mercado Pago
// (cartão e Pix nativamente) — evita que dados de cartão passem pelo nosso
// servidor, então não há necessidade de conformidade PCI própria.
async function createPaymentPreference(params: CreatePreferenceParams): Promise<{ initPoint: string; preferenceId: string } | null> {
  try {
    // auto_return exige uma back_url.success pública em HTTPS — o Mercado
    // Pago rejeita localhost, então só habilitamos em ambientes publicados.
    const isPublicHttps = params.baseUrl.startsWith("https://");

    const preference = new Preference(getClient());
    const result = await preference.create({
      body: {
        items: params.items.map((item) => ({
          id: params.orderId,
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          currency_id: "BRL"
        })),
        payer: {
          name: params.payerName,
          email: params.payerEmail
        },
        external_reference: params.orderId,
        back_urls: {
          success: `${params.baseUrl}/#pagamento/sucesso`,
          failure: `${params.baseUrl}/#pagamento/erro`,
          pending: `${params.baseUrl}/#pagamento/pendente`
        },
        ...(isPublicHttps ? { auto_return: "approved" as const } : {}),
        notification_url: isPublicHttps ? `${params.baseUrl}/api/webhooks/mercadopago` : undefined
      }
    });

    if (!result.init_point || !result.id) return null;
    return { initPoint: result.init_point, preferenceId: result.id };
  } catch (error) {
    console.error("[Mercado Pago] Falha ao criar preferência de pagamento:", error);
    return null;
  }
}

async function getPaymentDetails(paymentId: string) {
  try {
    const payment = new Payment(getClient());
    return await payment.get({ id: paymentId });
  } catch (error) {
    console.error(`[Mercado Pago] Falha ao buscar pagamento "${paymentId}":`, error);
    return null;
  }
}

export { createPaymentPreference, getPaymentDetails };
