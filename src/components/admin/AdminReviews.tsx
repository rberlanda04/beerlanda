import { useEffect, useState, type FormEvent } from "react";
import { RefreshCw, Plus, Trash2, Pencil, X, Star } from "lucide-react";
import { Review } from "../../types";
import { adminFetch } from "../../lib/adminApi";

interface AdminReviewsProps {
  token: string;
}

const EMPTY_FORM = { name: "", rating: "5", comment: "", active: true };

export default function AdminReviews({ token }: AdminReviewsProps) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const load = () => {
    adminFetch<Review[]>("/api/admin/reviews", token)
      .then(setReviews)
      .catch((e) => setError(e.message));
  };

  useEffect(load, [token]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (r: Review) => {
    setEditingId(r.id);
    setForm({ name: r.name, rating: String(r.rating), comment: r.comment, active: r.active });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const body = { ...form, rating: Number(form.rating) };
      if (editingId) {
        await adminFetch(`/api/admin/reviews/${editingId}`, token, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      } else {
        await adminFetch("/api/admin/reviews", token, {
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

  const handleDelete = async (r: Review) => {
    if (!window.confirm(`Excluir a avaliação de "${r.name}"?`)) return;
    try {
      await adminFetch(`/api/admin/reviews/${r.id}`, token, { method: "DELETE" });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!reviews) {
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
          <h3 className="font-display text-sm font-bold text-natural-darkbrown">Avaliações ({reviews.length})</h3>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-natural-gold px-4 py-2 text-xs font-bold text-white hover:bg-natural-gold/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova avaliação
          </button>
        </div>
        {reviews.length === 0 ? (
          <p className="text-center text-xs text-natural-text py-10">Nenhuma avaliação cadastrada ainda.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-natural-card text-natural-text uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Nota</th>
                <th className="text-left p-3">Comentário</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-natural-border">
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 font-semibold whitespace-nowrap">{r.name}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-natural-gold font-bold">
                      <Star className="h-3.5 w-3.5 fill-natural-gold" />
                      {r.rating}
                    </span>
                  </td>
                  <td className="p-3 max-w-[320px] truncate" title={r.comment}>{r.comment}</td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${r.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {r.active ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(r)} className="rounded-lg p-1.5 hover:bg-natural-card">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(r)} className="rounded-lg p-1.5 hover:bg-red-50 text-red-600">
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
              <h3 className="font-display text-base font-bold">{editingId ? "Editar avaliação" : "Nova avaliação"}</h3>
              <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-full p-1.5 hover:bg-natural-border">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold block mb-1">Nome do cliente</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
                  placeholder="Ex: Mariana Silva"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Nota</label>
                <select
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                  className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{n} estrela{n > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Comentário</label>
                <textarea
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Avaliação ativa (visível na loja)
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
                {isSaving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar avaliação"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
