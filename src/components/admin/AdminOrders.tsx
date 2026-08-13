import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Order } from "../../types";
import { formatCurrency } from "../../utils";
import { adminFetch } from "../../lib/adminApi";

interface AdminOrdersProps {
  token: string;
}

function statusTone(status: string) {
  if (status === "Pago") return "bg-emerald-100 text-emerald-700";
  if (status?.startsWith("Pendente")) return "bg-amber-100 text-amber-700";
  if (status === "Recusado" || status === "Cancelado") return "bg-rose-100 text-rose-700";
  return "bg-gray-100 text-gray-600";
}

export default function AdminOrders({ token }: AdminOrdersProps) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<Order[]>("/api/admin/orders", token)
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) return <p className="text-xs text-rose-600">{error}</p>;
  if (!orders) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-natural-border bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-natural-border flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-natural-darkbrown">Pedidos ({orders.length})</h3>
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
                <th className="text-left p-3">Contato</th>
                <th className="text-left p-3">Itens</th>
                <th className="text-left p-3">Total</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-natural-border">
              {orders.map((o) => (
                <tr key={o.id} id={`admin-order-row-${o.id}`}>
                  <td className="p-3 font-mono font-bold">{o.id}</td>
                  <td className="p-3 whitespace-nowrap">{o.date}</td>
                  <td className="p-3">{o.clientName}</td>
                  <td className="p-3">
                    <div>{o.email}</div>
                    <div className="text-natural-text/50">{o.phone}</div>
                  </td>
                  <td className="p-3 max-w-[260px] truncate" title={o.items}>{o.items}</td>
                  <td className="p-3 font-bold">{formatCurrency(o.total)}</td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${statusTone(o.paymentStatus)}`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
