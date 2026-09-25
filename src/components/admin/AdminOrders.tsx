import { useEffect, useState } from "react";
import { RefreshCw, Package, Check } from "lucide-react";
import { Order } from "../../types";
import { formatCurrency } from "../../utils";
import { adminFetch } from "../../lib/adminApi";

interface AdminOrdersProps {
  token: string;
}

type Fulfillment = NonNullable<Order["fulfillmentStatus"]>;

const FULFILLMENT: { id: Fulfillment; label: string; tone: string }[] = [
  { id: "aguardando", label: "Aguardando", tone: "bg-gray-100 text-gray-600" },
  { id: "separando", label: "Separando", tone: "bg-sky-100 text-sky-700" },
  { id: "postado", label: "Postado", tone: "bg-indigo-100 text-indigo-700" },
  { id: "entregue", label: "Entregue", tone: "bg-emerald-100 text-emerald-700" },
  { id: "cancelado", label: "Cancelado", tone: "bg-rose-100 text-rose-700" }
];

function statusTone(status: string) {
  if (status === "Pago") return "bg-emerald-100 text-emerald-700";
  if (status?.startsWith("Pendente")) return "bg-amber-100 text-amber-700";
  if (status === "Recusado" || status === "Cancelado") return "bg-rose-100 text-rose-700";
  return "bg-gray-100 text-gray-600";
}

export default function AdminOrders({ token }: AdminOrdersProps) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  // Rascunho do código de rastreio por pedido, pra digitar sem salvar a cada tecla.
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});

  const load = () => {
    adminFetch<Order[]>("/api/admin/orders", token)
      .then(setOrders)
      .catch((e) => setError(e.message));
  };

  useEffect(load, [token]);

  const save = async (order: Order, fields: { fulfillmentStatus: Fulfillment; trackingCode?: string }) => {
    setSavingId(order.id);
    setError(null);
    try {
      await adminFetch(`/api/admin/orders/${order.id}/fulfillment`, token, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields)
      });
      setSavedId(order.id);
      setTimeout(() => setSavedId(null), 1800);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  if (error && !orders) return <p className="text-xs text-rose-600">{error}</p>;
  if (!orders) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
      </div>
    );
  }

  const pendentes = orders.filter(
    (o) => o.paymentStatus === "Pago" && (o.fulfillmentStatus || "aguardando") !== "entregue" && o.fulfillmentStatus !== "cancelado"
  ).length;

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{error}</p>}

      <div className="rounded-2xl border border-natural-border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-natural-border flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold text-natural-darkbrown">Pedidos ({orders.length})</h3>
          {pendentes > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-natural-gold/15 px-3 py-1 text-[11px] font-bold text-natural-darkbrown">
              <Package className="h-3.5 w-3.5 text-natural-gold" />
              {pendentes} pago{pendentes > 1 ? "s" : ""} aguardando envio
            </span>
          )}
        </div>
        {orders.length === 0 ? (
          <p className="text-center text-xs text-natural-text py-10">Nenhum pedido ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-natural-card text-natural-text uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="text-left p-3">Pedido</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Itens</th>
                  <th className="text-left p-3">Total</th>
                  <th className="text-left p-3">Pagamento</th>
                  <th className="text-left p-3">Expedição</th>
                  <th className="text-left p-3">Rastreio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-natural-border">
                {orders.map((o) => {
                  const current: Fulfillment = o.fulfillmentStatus || "aguardando";
                  const tone = FULFILLMENT.find((f) => f.id === current)?.tone || "bg-gray-100 text-gray-600";
                  const draft = trackingDraft[o.id] ?? o.trackingCode ?? "";
                  const isSaving = savingId === o.id;

                  return (
                    <tr key={o.id} id={`admin-order-row-${o.id}`}>
                      <td className="p-3 font-mono font-bold whitespace-nowrap">{o.id}</td>
                      <td className="p-3 whitespace-nowrap">{o.date}</td>
                      <td className="p-3">
                        <div className="font-semibold">{o.clientName}</div>
                        <div className="text-natural-text/50">{o.email}</div>
                        <div className="text-natural-text/50">{o.phone}</div>
                      </td>
                      <td className="p-3 max-w-[220px] truncate" title={o.items}>{o.items}</td>
                      <td className="p-3 font-bold whitespace-nowrap">{formatCurrency(o.total)}</td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${statusTone(o.paymentStatus)}`}>
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        <select
                          value={current}
                          disabled={isSaving}
                          onChange={(e) => save(o, { fulfillmentStatus: e.target.value as Fulfillment })}
                          className={`rounded-full border-0 px-2 py-1 text-[10px] font-bold cursor-pointer disabled:opacity-50 ${tone}`}
                          id={`fulfillment-${o.id}`}
                          aria-label={`Etapa de expedição do pedido ${o.id}`}
                        >
                          {FULFILLMENT.map((f) => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={draft}
                            disabled={isSaving}
                            onChange={(e) => setTrackingDraft({ ...trackingDraft, [o.id]: e.target.value.toUpperCase() })}
                            onBlur={() => {
                              const next = draft.trim();
                              if (next !== (o.trackingCode || "")) {
                                save(o, { fulfillmentStatus: current, trackingCode: next });
                              }
                            }}
                            placeholder="AA123456789BR"
                            className="w-[120px] rounded-lg border border-natural-border px-2 py-1 font-mono text-[10px] uppercase"
                            id={`tracking-${o.id}`}
                            aria-label={`Código de rastreio do pedido ${o.id}`}
                          />
                          {savedId === o.id && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                          {isSaving && <RefreshCw className="h-3 w-3 animate-spin text-natural-gold shrink-0" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-natural-text/60 leading-relaxed">
        O estoque baixa sozinho quando o pagamento é aprovado, e volta se o pagamento for cancelado
        ou reembolsado — não precisa ajustar na mão.
      </p>
    </div>
  );
}
