import { useEffect, useState } from "react";
import { RefreshCw, Save, Eye, EyeOff } from "lucide-react";
import { MonthlyCollection, Product, Subscriber, SubscriptionTier } from "../../types";
import { adminFetch } from "../../lib/adminApi";

interface AdminClubeProps {
  token: string;
}

const TIER_LABELS: Record<SubscriptionTier, string> = {
  essencial: "Colmeia Compacta",
  premium: "Colmeia Completa"
};

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function statusTone(status: Subscriber["status"]) {
  if (status === "ativo") return "bg-emerald-100 text-emerald-700";
  if (status === "interessado") return "bg-sky-100 text-sky-700";
  if (status === "pendente") return "bg-amber-100 text-amber-700";
  if (status === "pausado") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

interface TierDraft {
  theme: string;
  story: string;
  productIds: string[];
  revealed: boolean;
}

const EMPTY_DRAFT: TierDraft = { theme: "", story: "", productIds: [], revealed: false };

function TierEditor({
  tier, draft, onChange, products, onSave, isSaving
}: {
  tier: SubscriptionTier;
  draft: TierDraft;
  onChange: (draft: TierDraft) => void;
  products: Product[];
  onSave: () => void;
  isSaving: boolean;
}) {
  const toggleProduct = (id: string) => {
    const has = draft.productIds.includes(id);
    onChange({ ...draft, productIds: has ? draft.productIds.filter((p) => p !== id) : [...draft.productIds, id] });
  };

  return (
    <div className="rounded-2xl border border-natural-border bg-white p-5 space-y-4">
      <h4 className="font-display text-sm font-bold text-natural-darkbrown">{TIER_LABELS[tier]}</h4>

      <div>
        <label className="text-xs font-bold block mb-1">Tema da Colheita</label>
        <input
          value={draft.theme}
          onChange={(e) => onChange({ ...draft, theme: e.target.value })}
          placeholder="Ex: Colheita de Lavanda"
          className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
        />
      </div>

      <div>
        <label className="text-xs font-bold block mb-1">História (mostrada como prévia, sem produtos)</label>
        <textarea
          value={draft.story}
          onChange={(e) => onChange({ ...draft, story: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
        />
      </div>

      <div>
        <label className="text-xs font-bold block mb-1">Produtos desta Colheita ({draft.productIds.length} selecionados)</label>
        <div className="max-h-48 overflow-y-auto rounded-lg border border-natural-border divide-y divide-natural-border">
          {products.map((p) => (
            <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-natural-card">
              <input type="checkbox" checked={draft.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-natural-text/50">{p.category}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
        <input type="checkbox" checked={draft.revealed} onChange={(e) => onChange({ ...draft, revealed: e.target.checked })} />
        {draft.revealed ? <Eye className="h-3.5 w-3.5 text-emerald-600" /> : <EyeOff className="h-3.5 w-3.5 text-natural-text/50" />}
        Revelar tema publicamente (nunca revela os produtos)
      </label>

      <button
        onClick={onSave}
        disabled={isSaving}
        className="inline-flex items-center gap-1.5 rounded-lg bg-natural-gold px-4 py-2 text-xs font-bold text-white hover:bg-natural-gold/90 disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" />
        {isSaving ? "Salvando..." : "Salvar Colheita"}
      </button>
    </div>
  );
}

export default function AdminClube({ token }: AdminClubeProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[] | null>(null);
  const [month, setMonth] = useState(currentMonthKey());
  const [drafts, setDrafts] = useState<Record<SubscriptionTier, TierDraft>>({ essencial: EMPTY_DRAFT, premium: EMPTY_DRAFT });
  const [savingTier, setSavingTier] = useState<SubscriptionTier | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    adminFetch<Product[]>("/api/admin/products", token).then(setProducts).catch(() => {});
    adminFetch<Subscriber[]>("/api/admin/subscribers", token).then(setSubscribers).catch(() => {});
  }, [token]);

  useEffect(() => {
    adminFetch<{ month: string; essencial: MonthlyCollection | null; premium: MonthlyCollection | null }>(
      `/api/admin/monthly-collection?month=${month}`,
      token
    )
      .then((data) => {
        setDrafts({
          essencial: data.essencial ? { ...data.essencial } : EMPTY_DRAFT,
          premium: data.premium ? { ...data.premium } : EMPTY_DRAFT
        });
      })
      .catch((e) => setMessage({ type: "error", text: e.message }));
  }, [month, token]);

  const handleSaveTier = async (tier: SubscriptionTier) => {
    setSavingTier(tier);
    setMessage(null);
    try {
      await adminFetch("/api/admin/monthly-collection", token, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, tier, ...drafts[tier] })
      });
      setMessage({ type: "success", text: `Colheita de ${TIER_LABELS[tier]} salva.` });
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setSavingTier(null);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-xl p-4 text-xs border ${message.type === "success" ? "bg-green-50 border-green-200 text-green-900" : "bg-red-50 border-red-200 text-red-900"}`}>
          {message.text}
        </div>
      )}

      <div className="rounded-2xl border border-natural-border bg-natural-card p-5">
        <h3 className="font-display text-sm font-bold text-natural-darkbrown">Fase atual: captação de interesse</h3>
        <p className="text-[11px] text-natural-text mt-1">
          O clube ainda não cobra nada — estamos só formando a Primeira Colmeia e ouvindo o que as pessoas preferem.
          A cobrança recorrente via Mercado Pago já está pronta no sistema pra quando vocês decidirem abrir as vagas de verdade.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs font-bold text-natural-darkbrown">Colheita do mês:</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-natural-border px-3 py-1.5 text-xs"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TierEditor
          tier="essencial"
          draft={drafts.essencial}
          onChange={(d) => setDrafts({ ...drafts, essencial: d })}
          products={products}
          onSave={() => handleSaveTier("essencial")}
          isSaving={savingTier === "essencial"}
        />
        <TierEditor
          tier="premium"
          draft={drafts.premium}
          onChange={(d) => setDrafts({ ...drafts, premium: d })}
          products={products}
          onSave={() => handleSaveTier("premium")}
          isSaving={savingTier === "premium"}
        />
      </div>

      <div className="rounded-2xl border border-natural-border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-natural-border">
          <h3 className="font-display text-sm font-bold text-natural-darkbrown">Primeira Colmeia — Interessados ({subscribers?.length ?? "…"})</h3>
        </div>
        {!subscribers ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
          </div>
        ) : subscribers.length === 0 ? (
          <p className="text-center text-xs text-natural-text py-10">Ninguém se cadastrou ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-natural-card text-natural-text uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Contato</th>
                  <th className="text-left p-3">Cidade</th>
                  <th className="text-left p-3">Formato preferido</th>
                  <th className="text-left p-3">Costuma usar</th>
                  <th className="text-left p-3">Aromas preferidos</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-natural-border">
                {subscribers.map((s) => (
                  <tr key={s.id} id={`admin-subscriber-row-${s.id}`}>
                    <td className="p-3 font-semibold">{s.name}</td>
                    <td className="p-3">
                      <div>{s.email}</div>
                      <div className="text-natural-text/50">{s.phone}</div>
                    </td>
                    <td className="p-3">{s.city}</td>
                    <td className="p-3">{TIER_LABELS[s.tier]}</td>
                    <td className="p-3 max-w-[160px]">{s.categories?.join(", ") || "—"}</td>
                    <td className="p-3 max-w-[160px]">{s.aromas?.join(", ") || "—"}</td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(s.status)}`}>{s.status}</span>
                    </td>
                    <td className="p-3 whitespace-nowrap">{s.createdAt ? new Date(s.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
