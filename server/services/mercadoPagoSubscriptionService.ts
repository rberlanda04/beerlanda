import { MercadoPagoConfig, PreApproval, PreApprovalPlan } from "mercadopago";

function getClient(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
  }
  return new MercadoPagoConfig({ accessToken });
}

interface CreatePlanParams {
  reason: string;
  price: number;
  baseUrl: string;
}

// Cria o "molde" de um plano recorrente mensal (preço + periodicidade). Feito
// uma única vez por plano — o ID retornado é reaproveitado em toda assinatura
// nova daquele plano, então nunca precisamos repetir preço/frequência por
// cliente (elimina risco de cobrar um valor diferente do combinado).
async function createSubscriptionPlan(params: CreatePlanParams): Promise<{ id: string } | null> {
  try {
    const plan = new PreApprovalPlan(getClient());
    const result = await plan.create({
      body: {
        reason: params.reason,
        back_url: params.baseUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: params.price,
          currency_id: "BRL"
        }
      }
    });

    if (!result.id) {
      console.warn("[Mercado Pago] Plano criado sem id:", JSON.stringify(result));
      return null;
    }
    return { id: result.id };
  } catch (error) {
    console.error(`[Mercado Pago] Falha ao criar plano "${params.reason}":`, error);
    return null;
  }
}

interface CreateSubscriptionParams {
  planId: string;
  payerEmail: string;
  reason: string;
  externalReference: string;
  baseUrl: string;
}

// Assina um cliente a um plano já existente — o Mercado Pago hospeda a
// autorização do cartão (init_point); a gente nunca vê o número do cartão.
async function createSubscription(params: CreateSubscriptionParams): Promise<{ id: string; initPoint: string } | null> {
  try {
    const preApproval = new PreApproval(getClient());
    const result = await preApproval.create({
      body: {
        preapproval_plan_id: params.planId,
        payer_email: params.payerEmail,
        reason: params.reason,
        external_reference: params.externalReference,
        back_url: params.baseUrl,
        status: "pending"
      }
    });

    if (!result.init_point || !result.id) {
      console.warn("[Mercado Pago] Assinatura criada sem init_point/id:", JSON.stringify(result));
      return null;
    }
    return { id: result.id, initPoint: result.init_point };
  } catch (error) {
    console.error("[Mercado Pago] Falha ao criar assinatura:", error);
    return null;
  }
}

async function getSubscriptionDetails(preapprovalId: string) {
  try {
    const preApproval = new PreApproval(getClient());
    return await preApproval.get({ id: preapprovalId });
  } catch (error) {
    console.error(`[Mercado Pago] Falha ao buscar assinatura "${preapprovalId}":`, error);
    return null;
  }
}

export { createSubscriptionPlan, createSubscription, getSubscriptionDetails };
