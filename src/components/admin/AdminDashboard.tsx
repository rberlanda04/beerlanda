import { useEffect, useState } from "react";
import { ShoppingBag, DollarSign, Clock, Users, Package, Mail, RefreshCw } from "lucide-react";
import { DashboardStats } from "../../types";
import { formatCurrency } from "../../utils";
import { adminFetch } from "../../lib/adminApi";

interface AdminDashboardProps {
  token: string;
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-2xl border border-natural-border bg-white p-5 flex items-center gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-natural-text/60">{label}</p>
        <p className="text-lg font-bold text-natural-darkbrown">{value}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard({ token }: AdminDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<DashboardStats>("/api/admin/dashboard", token)
      .then(setStats)
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return <p className="text-xs text-rose-600">{error}</p>;
  }

  if (!stats) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Faturamento (pago)" value={formatCurrency(stats.totalRevenue)} tone="bg-emerald-100 text-emerald-600" />
        <StatCard icon={ShoppingBag} label="Pedidos totais" value={stats.totalOrders} tone="bg-natural-gold/10 text-natural-gold" />
        <StatCard icon={Clock} label="Pagamentos pendentes" value={stats.pendingCount} tone="bg-amber-100 text-amber-600" />
        <StatCard icon={Users} label="Clientes" value={stats.totalCustomers} tone="bg-sky-100 text-sky-600" />
        <StatCard icon={Package} label="Produtos" value={stats.totalProducts} tone="bg-purple-100 text-purple-600" />
        <StatCard icon={Mail} label="Mensagens não lidas" value={stats.unreadMessages} tone="bg-rose-100 text-rose-600" />
      </div>

      <div className="rounded-2xl border border-natural-border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-natural-border">
          <h3 className="font-display text-sm font-bold text-natural-darkbrown">Pedidos recentes</h3>
        </div>
        {stats.recentOrders.length === 0 ? (
          <p className="text-center text-xs text-natural-text py-10">Nenhum pedido ainda.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-natural-card text-natural-text uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left p-3">Pedido</th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Total</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-natural-border">
              {stats.recentOrders.map((o) => (
                <tr key={o.id}>
                  <td className="p-3 font-mono">{o.id}</td>
                  <td className="p-3">{o.clientName}</td>
                  <td className="p-3">{formatCurrency(o.total)}</td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      o.paymentStatus === "Pago" ? "bg-emerald-100 text-emerald-700" :
                      o.paymentStatus?.startsWith("Pendente") ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
