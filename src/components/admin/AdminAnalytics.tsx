import { useEffect, useState, type ReactNode } from "react";
import {
  RefreshCw, TrendingUp, PieChart as PieChartIcon, Package, Users,
  Layers, Truck, Filter, CalendarDays, Crown
} from "lucide-react";
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
const BROWN = "#6B4F3A";
// Sequência fixa: a mesma categoria mantém a mesma cor entre um gráfico e
// outro, senão a leitura muda de significado a cada bloco.
const SERIES = ["#D4AF37", "#4F6F52", "#B45309", "#6B4F3A", "#8C7A5B", "#9CA3AF", "#DC2626"];

function ChartCard({ icon: Icon, title, hint, children, wide }: {
  icon: any; title: string; hint?: string; children: ReactNode; wide?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-natural-border bg-white p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <h3 className="font-display text-sm font-bold text-natural-darkbrown flex items-center gap-2">
        <Icon className="h-4 w-4 text-natural-gold" />
        {title}
      </h3>
      {hint && <p className="text-[10px] text-natural-text/50 mt-0.5 mb-3">{hint}</p>}
      <div className={hint ? "" : "mt-4"}>{children}</div>
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

  if (error) return <p className="text-xs text-rose-600">{error}</p>;

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
      </div>
    );
  }

  const revenueChartData = data.revenueByDay.map((d) => ({ ...d, label: formatDayLabel(d.date) }));
  const customersChartData = data.newCustomersByDay.map((d) => ({ ...d, label: formatDayLabel(d.date) }));
  const ticketChartData = data.ticketByDay
    .filter((d) => d.ticket > 0)
    .map((d) => ({ ...d, label: formatDayLabel(d.date) }));
  const funnel = data.paymentFunnel;

  return (
    <div className="space-y-5">
      {/* Funil: a leitura mais direta de onde a venda escapa */}
      <div className="rounded-2xl border border-natural-border bg-white p-5">
        <h3 className="font-display text-sm font-bold text-natural-darkbrown flex items-center gap-2">
          <Filter className="h-4 w-4 text-natural-gold" />
          Do pedido ao pagamento
        </h3>
        <p className="text-[10px] text-natural-text/50 mt-0.5 mb-4">
          Pedido criado e não pago é carrinho que chegou no Mercado Pago e desistiu
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-natural-text/60">Pedidos criados</p>
            <p className="text-2xl font-bold text-natural-darkbrown">{funnel.created}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-natural-text/60">Chegaram a pagar</p>
            <p className="text-2xl font-bold text-emerald-600">{funnel.paid}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-natural-text/60">Não concluíram</p>
            <p className="text-2xl font-bold text-rose-500">{funnel.lost}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-natural-text/60">Taxa de conclusão</p>
            <p className="text-2xl font-bold text-natural-gold">{funnel.conversionRate.toFixed(0)}%</p>
          </div>
        </div>
        {funnel.created > 0 && (
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-rose-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${funnel.conversionRate}%` }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard icon={TrendingUp} title="Faturamento (últimos 30 dias)" wide>
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

        <ChartCard
          icon={Layers} title="Faturamento por categoria"
          hint="Onde está o dinheiro, não só o volume de peças"
        >
          {data.revenueByCategory.length === 0 ? (
            <EmptyState text="Ainda sem pedido pago com itens detalhados." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.revenueByCategory} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D2" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip formatter={(v: number, name) => name === "revenue" ? formatCurrency(v) : v} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {data.revenueByCategory.map((_, i) => (
                    <Cell key={i} fill={SERIES[i % SERIES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard icon={PieChartIcon} title="Pedidos por status">
          {data.ordersByStatus.length === 0 ? (
            <EmptyState text="Nenhum pedido registrado ainda." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.ordersByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80}>
                  {data.ordersByStatus.map((_, idx) => (
                    <Cell key={idx} fill={SERIES[idx % SERIES.length]} />
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

        <ChartCard
          icon={CalendarDays} title="Vendas por dia da semana"
          hint="Serve pra escolher quando postar e quando abrir promoção"
        >
          {data.salesByWeekday.every((d) => d.orders === 0) ? (
            <EmptyState text="Ainda sem pedido pago pra identificar padrão." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.salesByWeekday}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D2" />
                <XAxis dataKey="weekday" tick={{ fontSize: 9 }} tickFormatter={(v: string) => v.slice(0, 3)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={(v: number, name) => name === "revenue" ? formatCurrency(v) : v} />
                <Bar dataKey="orders" fill={BROWN} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          icon={Truck} title="Como os pedidos foram entregues"
          hint="Inclui retirada em mãos e frete a combinar"
        >
          {data.shippingSplit.length === 0 ? (
            <EmptyState text="Ainda sem pedido pago." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.shippingSplit} dataKey="count" nameKey="service" cx="50%" cy="50%" outerRadius={80}>
                  {data.shippingSplit.map((_, idx) => (
                    <Cell key={idx} fill={SERIES[idx % SERIES.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          icon={TrendingUp} title="Ticket médio por dia"
          hint="Mostra se o valor do pedido está subindo ou caindo"
        >
          {ticketChartData.length === 0 ? (
            <EmptyState text="Ainda sem dias com venda paga." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={ticketChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E6D2" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} width={70} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="ticket" stroke={ORGANIC} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
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

        <ChartCard
          icon={Crown} title="Quem mais comprou"
          hint="Vale um agrado, um cupom ou um bilhete escrito à mão"
        >
          {data.topCustomers.length === 0 ? (
            <EmptyState text="Ainda sem cliente com pedido pago." />
          ) : (
            <ul className="divide-y divide-natural-border">
              {data.topCustomers.map((c) => (
                <li key={c.email} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-natural-darkbrown">{c.name}</p>
                    <p className="truncate text-[10px] text-natural-text/50">
                      {c.email} · {c.orders} pedido{c.orders === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-bold text-natural-gold">
                    {formatCurrency(c.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
