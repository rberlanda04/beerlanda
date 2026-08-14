import { useEffect, useState, type ReactNode } from "react";
import { RefreshCw, TrendingUp, PieChart as PieChartIcon, Package, Users } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import { AnalyticsData } from "../../types";
import { formatCurrency } from "../../utils";
import { adminFetch } from "../../lib/adminApi";

interface AdminAnalyticsProps {
  token: string;
}

const GOLD = "#D4AF37";
const ORGANIC = "#4F6F52";
const STATUS_COLORS = ["#D4AF37", "#4F6F52", "#B45309", "#9CA3AF", "#DC2626"];

function ChartCard({ icon: Icon, title, children }: { icon: any; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-natural-border bg-white p-5">
      <h3 className="font-display text-sm font-bold text-natural-darkbrown flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-natural-gold" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-xs text-natural-text py-16 text-center">{text}</p>;
}

function formatDayLabel(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

export default function AdminAnalytics({ token }: AdminAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<AnalyticsData>("/api/admin/analytics", token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return <p className="text-xs text-rose-600">{error}</p>;
  }

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
      </div>
    );
  }

  const revenueChartData = data.revenueByDay.map((d) => ({ ...d, label: formatDayLabel(d.date) }));
  const customersChartData = data.newCustomersByDay.map((d) => ({ ...d, label: formatDayLabel(d.date) }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <ChartCard icon={TrendingUp} title="Faturamento (últimos 30 dias)">
        {data.revenueByDay.every((d) => d.revenue === 0) ? (
          <EmptyState text="Nenhum pedido pago ainda nos últimos 30 dias." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D2" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} width={70} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Line type="monotone" dataKey="revenue" stroke={GOLD} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard icon={PieChartIcon} title="Pedidos por status">
        {data.ordersByStatus.length === 0 ? (
          <EmptyState text="Nenhum pedido registrado ainda." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.ordersByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={(entry) => entry.status}>
                {data.ordersByStatus.map((_, idx) => (
                  <Cell key={idx} fill={STATUS_COLORS[idx % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard icon={Package} title="Produtos mais vendidos">
        {data.topProducts.length === 0 ? (
          <EmptyState text="Ainda sem dados — só pedidos feitos depois desta atualização entram aqui." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.topProducts} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D2" />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={120} />
              <Tooltip />
              <Bar dataKey="quantity" fill={ORGANIC} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard icon={Users} title="Clientes novos (últimos 30 dias)">
        {data.newCustomersByDay.every((d) => d.count === 0) ? (
          <EmptyState text="Nenhum cliente novo registrado nos últimos 30 dias." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={customersChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D2" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
