import { useEffect, useState, type FormEvent } from "react";
import { RefreshCw, Plus, Trash2, Pencil, X, Tag } from "lucide-react";
import { Coupon } from "../../types";
import { adminFetch } from "../../lib/adminApi";

interface AdminCouponsProps {
  token: string;
}

const EMPTY_FORM = { code: "", type: "percentage" as "percentage" | "fixed", value: "", active: true, useLimit: "" };

export default function AdminCoupons({ token }: AdminCouponsProps) {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const load = () => {
    adminFetch<Coupon[]>("/api/admin/coupons", token)
      .then(setCoupons)
      .catch((e) => setError(e.message));
  };

  useEffect(load, [token]);

  const openCreate = () => {
    setEditingCode(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditingCode(c.code);
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      active: c.active,
      useLimit: c.useLimit !== undefined ? String(c.useLimit) : ""
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const body = { ...form };
      if (editingCode) {
        await adminFetch(`/api/admin/coupons/${editingCode}`, token, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      } else {
        await adminFetch("/api/admin/coupons", token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      }
      setIsFormOpen(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (code: string) => {
    if (!window.confirm(`Excluir o cupom "${code}"?`)) return;
    try {
      await adminFetch(`/api/admin/coupons/${code}`, token, { method: "DELETE" });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!coupons) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{error}</p>}

      <div className="rounded-2xl border border-natural-border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-natural-border flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-natural-darkbrown">Cupons ({coupons.length})</h3>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-natural-gold px-4 py-2 text-xs font-bold text-white hover:bg-natural-gold/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo cupom
          </button>
        </div>
        {coupons.length === 0 ? (
          <p className="text-center text-xs text-natural-text py-10">Nenhum cupom cadastrado ainda.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-natural-card text-natural-text uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left p-3">Código</th>
                <th className="text-left p-3">Desconto</th>
                <th className="text-left p-3">Limite de uso</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-natural-border">
              {coupons.map((c) => (
                <tr key={c.code}>
                  <td className="p-3 font-mono font-bold flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-natural-gold" />
                    {c.code}
                  </td>
                  <td className="p-3">{c.type === "percentage" ? `${c.value}%` : `R$ ${c.value.toFixed(2)}`}</td>
                  <td className="p-3">{c.useLimit ?? "Ilimitado"}</td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 hover:bg-natural-card">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(c.code)} className="rounded-lg p-1.5 hover:bg-red-50 text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-natural-darkbrown/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <form onSubmit={handleSubmit} className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-natural-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-natural-border">
              <h3 className="font-display text-base font-bold">{editingCode ? "Editar cupom" : "Novo cupom"}</h3>
              <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-full p-1.5 hover:bg-natural-border">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold block mb-1">Código</label>
                <input
                  required
                  disabled={!!editingCode}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs uppercase disabled:bg-natural-card disabled:text-natural-text/60"
                  placeholder="Ex: MEL10"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "percentage" | "fixed" })}
                    className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
                  >
                    <option value="percentage">Porcentagem</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Valor</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Limite de uso (opcional)</label>
                <input
                  type="number"
                  min="0"
                  value={form.useLimit}
                  onChange={(e) => setForm({ ...form, useLimit: e.target.value })}
                  className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
                  placeholder="Deixe em branco para ilimitado"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Cupom ativo
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-natural-border">
              <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg px-4 py-2 text-xs font-bold text-natural-text hover:bg-natural-card">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-natural-gold px-5 py-2 text-xs font-bold text-white hover:bg-natural-gold/90 disabled:opacity-50"
              >
                {isSaving ? "Salvando..." : editingCode ? "Salvar alterações" : "Criar cupom"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
