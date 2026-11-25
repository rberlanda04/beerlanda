import { useEffect, useState } from "react";
import {
  ShoppingBag, DollarSign, Clock, Users, Package, Mail, RefreshCw, Truck,
  AlertTriangle, AlertCircle, Info, TrendingUp, TrendingDown, Minus, ImageOff, Receipt, ArrowRight,
  Eye
} from "lucide-react";
import { DashboardStats, DashboardAlert, Order } from "../../types";
import { formatCurrency } from "../../utils";
import { adminFetch } from "../../lib/adminApi";

interface AdminDashboardProps {
  token: string;
  /** Deixa os alertas levarem direto pra aba que resolve o problema. */
  onNavigate?: (tab: string) => void;
}

/**
 * Variação percentual entre dois períodos. Sem base de comparação não existe
 * percentual: sair de zero não é "aumento de 100%", é começar.
 */
function trend(current: number, previous: number): { pct: number; label: string; dir: "up" | "down" | "flat" } | null {
  if (previous === 0) return current > 0 ? { pct: 0, label: "primeiros do período", dir: "up" } : null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 1) return { pct: 0, label: "estável", dir: "flat" };
  return {
    pct: Math.abs(pct),
    label: `${Math.abs(pct).toFixed(0)}% vs. 30 dias antes`,
    dir: pct > 0 ? "up" : "down"
  };
}

function StatCard({
  icon: Icon, label, value, tone, hint, delta
}: {
  icon: any; label: string; value: string | number; tone: string; hint?: string;
  delta?: { pct: number; label: string; dir: "up" | "down" | "flat" } | null;
}) {
  const TrendIcon = delta?.dir === "up" ? TrendingUp : delta?.dir === "down" ? TrendingDown : Minus;
  const trendTone = delta?.dir === "up" ? "text-emerald-600" : delta?.dir === "down" ? "text-rose-600" : "text-natural-text/50";
  return (
    <div className="rounded-2xl border border-natural-border bg-white p-5">
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-natural-text/60">{label}</p>
          <p className="text-lg font-bold text-natural-darkbrown">{value}</p>
          {delta && (
            <p className={`mt-0.5 flex items-center gap-1 text-[10px] font-semibold ${trendTone}`}>
              <TrendIcon className="h-3 w-3" />
              {delta.label}
            </p>
          )}
          {!delta && hint && <p className="mt-0.5 text-[10px] text-natural-text/50">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

/** "2026-11-25" -> "25/11". Sem fuso: a string já vem no dia da loja. */
function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

/**
 * Acessos à loja nos últimos 30 dias.
 *
 * Uma série só, então não há legenda: o título diz o que é. As barras são finas
 * com 2px de respiro entre elas e ficam ancoradas na base — dia sem acesso vira
 * um risco, não um buraco, pra não parecer que falta dado.
 *
 * O número que decide algo aqui é a conversão. Acesso sozinho não diz nada:
 * muita visita e nenhuma venda é problema de loja (foto, preço, frete); pouca
 * visita é problema de divulgação. São ações opostas, por isso andam juntos.
 */
function TrafficPanel({ stats }: { stats: DashboardStats }) {
  const dias = stats.visitsByDay || [];
  const pico = Math.max(1, ...dias.map((d) => d.sessions));
  const delta = trend(stats.visits30d, stats.visitsPrev30d);
  const TrendIcon = delta?.dir === "up" ? TrendingUp : delta?.dir === "down" ? TrendingDown : Minus;
  const trendTone = delta?.dir === "up" ? "text-emerald-600" : delta?.dir === "down" ? "text-rose-600" : "text-natural-text/50";

  // Conversão sobre a mesma janela dos acessos, senão compara coisas diferentes.
  const conversao = stats.visits30d > 0 ? (stats.orders30d / stats.visits30d) * 100 : null;

  return (
    <div className="rounded-2xl border border-natural-border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-bold text-natural-darkbrown inline-flex items-center gap-2">
            <Eye className="h-4 w-4 text-natural-gold" />
            Acessos à loja
          </h3>
          <p className="mt-0.5 text-[11px] text-natural-text/60">
            Últimos 30 dias · uma visita por pessoa que abre a loja
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold leading-none text-natural-darkbrown">
            {stats.visits30d.toLocaleString("pt-BR")}
          </p>
          {delta && (
            <p className={`mt-1 inline-flex items-center justify-end gap-1 text-[10px] font-semibold ${trendTone}`}>
              <TrendIcon className="h-3 w-3" />
              {delta.label}
            </p>
          )}
        </div>
      </div>

      {dias.length === 0 ? (
        <p className="mt-4 rounded-xl border border-natural-border bg-natural-card p-3 text-[11px] leading-relaxed text-natural-text/70">
          A contagem começa a partir de agora. Os acessos de hoje aparecem aqui
          conforme as pessoas entram na loja — amanhã já dá pra comparar dias.
        </p>
      ) : (
        <>
          <div className="mt-4 flex h-20 items-end gap-[2px]" role="img" aria-label={`Acessos por dia nos últimos 30 dias. Pico de ${pico} em um dia.`}>
            {dias.map((d) => {
              const altura = Math.max(2, Math.round((d.sessions / pico) * 76));
              const ehPico = d.sessions === pico && pico > 1;
              return (
                <div
                  key={d.date}
                  title={`${diaCurto(d.date)} · ${d.sessions} acesso${d.sessions === 1 ? "" : "s"}`}
                  style={{ height: `${altura}px` }}
                  className={`flex-1 rounded-t-[3px] transition-opacity hover:opacity-100 ${
                    ehPico ? "bg-natural-gold" : "bg-natural-gold/45"
                  }`}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-natural-text/50">
            <span>{diaCurto(dias[0].date)}</span>
            <span className="font-semibold text-natural-text/70">pico: {pico} num dia</span>
            <span>{diaCurto(dias[dias.length - 1].date)}</span>
          </div>
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-natural-border pt-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-natural-text/60">Hoje</p>
          <p className="text-lg font-bold text-natural-darkbrown">{stats.visitsToday}</p>
          <p className="text-[10px] text-natural-text/50">acessos até agora</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-natural-text/60">Conversão</p>
          <p className="text-lg font-bold text-natural-darkbrown">
            {conversao === null ? "—" : `${conversao.toFixed(1).replace(".", ",")}%`}
          </p>
          <p className="text-[10px] text-natural-text/50">
            {conversao === null
              ? "sem acessos no período"
              : `${stats.orders30d} pedido${stats.orders30d === 1 ? "" : "s"} pago${stats.orders30d === 1 ? "" : "s"} em ${stats.visits30d.toLocaleString("pt-BR")} acessos`}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-natural-text/50">
        Contagem própria da loja, por sessão de navegador. Não inclui seus acessos
        ao painel nem robôs de busca. Para detalhe por página e origem do tráfego,
        o Google Analytics segue instalado no site.
      </p>
    </div>
  );
}

const ALERT_STYLE: Record<DashboardAlert["level"], { icon: any; box: string; chip: string }> = {
  urgente: { icon: AlertTriangle, box: "border-rose-200 bg-rose-50", chip: "text-rose-700" },
  atencao: { icon: AlertCircle, box: "border-amber-200 bg-amber-50", chip: "text-amber-700" },
  info: { icon: Info, box: "border-sky-200 bg-sky-50", chip: "text-sky-700" }
};

function AlertList({ alerts, onNavigate }: { alerts: DashboardAlert[]; onNavigate?: (tab: string) => void }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <p className="text-xs font-bold text-emerald-800">Tudo em dia 🐝</p>
        <p className="text-[11px] text-emerald-700 mt-0.5">
          Nenhum pedido esperando envio, nenhuma mensagem sem resposta e nenhum produto sem foto.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => {
        const style = ALERT_STYLE[a.level];
        const Icon = style.icon;
        const clickable = !!(a.goTo && onNavigate);
        return (
          <button
            key={i}
            type="button"
            disabled={!clickable}
            onClick={() => a.goTo && onNavigate?.(a.goTo)}
            className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${style.box} ${
              clickable ? "cursor-pointer hover:brightness-97" : "cursor-default"
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${style.chip}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold ${style.chip}`}>{a.title}</p>
                <p className="text-[11px] text-natural-text/70 mt-0.5">{a.detail}</p>
              </div>
              {clickable && <ArrowRight className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${style.chip}`} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * O pedido guarda `date` como texto já formatado em pt-BR e `createdAt` em ISO.
 * Pedidos antigos têm só o primeiro, então a data sai de um ou de outro.
 */
function orderMoment(order: Order): { day: string; time: string; relative: string } {
  const iso = order.createdAt ? new Date(order.createdAt) : null;
  if (!iso || Number.isNaN(iso.getTime())) {
    const [day = order.date || "—", time = ""] = (order.date || "").split(", ");
    return { day, time, relative: "" };
  }
  const day = iso.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const time = iso.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const mins = Math.floor((Date.now() - iso.getTime()) / 60000);
  const relative =
    mins < 1 ? "agora" :
    mins < 60 ? `há ${mins} min` :
    mins < 1440 ? `há ${Math.floor(mins / 60)}h` :
    `há ${Math.floor(mins / 1440)} d`;

  return { day, time, relative };
}

function PaymentChip({ status }: { status: string }) {
  const tone =
    status === "Pago" ? "bg-emerald-100 text-emerald-700" :
    status?.startsWith("Pendente") ? "bg-amber-100 text-amber-700" :
    status === "Recusado" || status === "Cancelado" ? "bg-rose-100 text-rose-700" :
    "bg-gray-100 text-gray-600";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>{status}</span>;
}

const FULFILLMENT_LABEL: Record<string, { text: string; tone: string }> = {
  aguardando: { text: "Aguardando", tone: "bg-gray-100 text-gray-600" },
  separando: { text: "Separando", tone: "bg-sky-100 text-sky-700" },
  postado: { text: "Postado", tone: "bg-indigo-100 text-indigo-700" },
  entregue: { text: "Entregue", tone: "bg-emerald-100 text-emerald-700" },
  cancelado: { text: "Cancelado", tone: "bg-rose-100 text-rose-700" }
};

export default function AdminDashboard({ token, onNavigate }: AdminDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = (silent = false) => {
    if (!silent) setRefreshing(true);
    adminFetch<DashboardStats>("/api/admin/dashboard", token)
      .then((d) => { setStats(d); setUpdatedAt(new Date()); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    load();
    // Atualiza sozinho de 2 em 2 minutos: o painel costuma ficar aberto numa
    // aba o dia todo, e pedido novo precisa aparecer sem apertar F5.
    const timer = setInterval(() => load(true), 120000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (error) return <p className="text-xs text-rose-600">{error}</p>;

  if (!stats) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
      </div>
    );
  }

  const revenueTrend = trend(stats.revenue30d, stats.revenuePrev30d);
  const ordersTrend = trend(stats.orders30d, stats.ordersPrev30d);
  const visitsTrend = trend(stats.visits30d, stats.visitsPrev30d);

  return (
    <div className="space-y-6">
      {/* Barra de atualização */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-natural-text/50">
          {updatedAt
            ? `Atualizado às ${updatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · atualiza sozinho a cada 2 min`
            : "Carregando…"}
        </p>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-natural-border bg-white px-3 py-1.5 text-[11px] font-bold text-natural-darkbrown hover:bg-natural-card cursor-pointer"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* O que precisa de ação, antes dos números */}
      <div>
        <h3 className="font-display text-sm font-bold text-natural-darkbrown mb-2">Precisa de você</h3>
        <AlertList alerts={stats.alerts} onNavigate={onNavigate} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={DollarSign} label="Faturamento 30 dias" tone="bg-emerald-100 text-emerald-600"
          value={formatCurrency(stats.revenue30d)} delta={revenueTrend}
          hint={`${formatCurrency(stats.totalRevenue)} desde o início`}
        />
        <StatCard
          icon={ShoppingBag} label="Pedidos pagos 30 dias" tone="bg-natural-gold/10 text-natural-gold"
          value={stats.orders30d} delta={ordersTrend}
          hint={`${stats.totalOrders} pedidos no total`}
        />
        <StatCard
          icon={Receipt} label="Ticket médio" tone="bg-violet-100 text-violet-600"
          value={formatCurrency(stats.averageTicket)} hint="média dos pedidos pagos"
        />
        <StatCard
          icon={Eye} label="Acessos 30 dias" tone="bg-teal-100 text-teal-600"
          value={stats.visits30d.toLocaleString("pt-BR")} delta={visitsTrend}
          hint={`${stats.visitsToday} hoje`}
        />
        <StatCard
          icon={Truck} label="Esperando envio" tone="bg-rose-100 text-rose-600"
          value={stats.awaitingShipment} hint="pagos e ainda não postados"
        />
        <StatCard
          icon={Clock} label="Pagamentos pendentes" tone="bg-amber-100 text-amber-600"
          value={stats.pendingCount}
          hint={stats.stalePending > 0 ? `${stats.stalePending} parado${stats.stalePending === 1 ? "" : "s"} há +48h` : "nenhum parado"}
        />
        <StatCard icon={Users} label="Clientes" tone="bg-sky-100 text-sky-600" value={stats.totalCustomers} />
        <StatCard
          icon={Package} label="Produtos" tone="bg-purple-100 text-purple-600"
          value={stats.totalProducts}
          hint={stats.outOfStock > 0 ? `${stats.outOfStock} esgotado${stats.outOfStock === 1 ? "" : "s"}` : "todos com estoque"}
        />
        <StatCard
          icon={stats.missingPhotos > 0 ? ImageOff : Mail}
          label={stats.missingPhotos > 0 ? "Produtos sem foto" : "Mensagens não lidas"}
          tone={stats.missingPhotos > 0 ? "bg-orange-100 text-orange-600" : "bg-rose-100 text-rose-600"}
          value={stats.missingPhotos > 0 ? stats.missingPhotos : stats.unreadMessages}
          hint={stats.missingPhotos > 0 ? "mostram o placeholder na loja" : undefined}
        />
      </div>

      {/* Tráfego: quanta gente entra e quanto disso vira pedido */}
      <TrafficPanel stats={stats} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Pedidos recentes, agora com data, hora e etapa da expedição */}
        <div className="lg:col-span-2 rounded-2xl border border-natural-border bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-natural-border flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-natural-darkbrown">Pedidos recentes</h3>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("orders")}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-natural-gold hover:underline cursor-pointer"
              >
                Ver todos <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
          {stats.recentOrders.length === 0 ? (
            <p className="text-center text-xs text-natural-text py-10">Nenhum pedido ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-natural-card text-natural-text uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="text-left p-3">Pedido</th>
                    <th className="text-left p-3">Quando</th>
                    <th className="text-left p-3">Cliente</th>
                    <th className="text-left p-3">Entrega</th>
                    <th className="text-right p-3">Total</th>
                    <th className="text-left p-3">Pagamento</th>
                    <th className="text-left p-3">Expedição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-natural-border">
                  {stats.recentOrders.map((o) => {
                    const when = orderMoment(o);
                    const ful = FULFILLMENT_LABEL[o.fulfillmentStatus || "aguardando"] || FULFILLMENT_LABEL.aguardando;
                    const service =
                      o.shippingService === "RETIRADA" ? "Retirada" :
                      o.shippingService === "A_COMBINAR" ? "A combinar" :
                      o.shippingService || "—";
                    return (
                      <tr key={o.id} className="hover:bg-natural-card/50">
                        <td className="p-3 font-mono whitespace-nowrap">{o.id}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="text-natural-darkbrown">{when.day}</span>
                          {when.time && <span className="text-natural-text/60"> {when.time}</span>}
                          {when.relative && <span className="block text-[10px] text-natural-text/45">{when.relative}</span>}
                        </td>
                        <td className="p-3">{o.clientName}</td>
                        <td className="p-3 text-natural-text/70">
                          {service}
                          {o.trackingCode && (
                            <span className="block font-mono text-[10px] text-natural-text/50">{o.trackingCode}</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold whitespace-nowrap">{formatCurrency(o.total)}</td>
                        <td className="p-3"><PaymentChip status={o.paymentStatus} /></td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${ful.tone}`}>
                            {ful.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Estoque curto: o que repor antes de divulgar */}
        <div className="rounded-2xl border border-natural-border bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-natural-border">
            <h3 className="font-display text-sm font-bold text-natural-darkbrown">Acabando</h3>
            <p className="text-[10px] text-natural-text/50 mt-0.5">1 ou 2 unidades em estoque</p>
          </div>
          {stats.lowStock.length === 0 ? (
            <p className="text-center text-xs text-natural-text py-10">Nada no limite agora.</p>
          ) : (
            <ul className="divide-y divide-natural-border">
              {stats.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span className="min-w-0 truncate text-xs text-natural-darkbrown" title={p.name}>{p.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    p.stock === 1 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {p.stock} un.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
