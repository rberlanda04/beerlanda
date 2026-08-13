import { useState, useEffect, type FormEvent } from "react";
import {
  RefreshCw, Plus, Pencil, Trash2, X, LogOut, ImageIcon,
  FileSpreadsheet, FolderOpen, CheckCircle2, AlertCircle, ArrowLeft
} from "lucide-react";
import { User } from "firebase/auth";
import { googleSignIn, initAuth, logout } from "../lib/googleAuth";
import { Product } from "../types";
import { formatCurrency, PRODUCT_CATEGORIES } from "../utils";

interface ProductFormState {
  name: string;
  description: string;
  price: string;
  promoPrice: string;
  stock: string;
  category: string;
  active: boolean;
  imageUrl: string;
}

const EMPTY_FORM: ProductFormState = {
  name: "",
  description: "",
  price: "",
  promoPrice: "",
  stock: "",
  category: PRODUCT_CATEGORIES[0],
  active: true,
  imageUrl: ""
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminPortal() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
        setIsLoadingAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setIsLoadingAuth(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadProducts = async (authToken: string) => {
    setIsLoadingProducts(true);
    try {
      const res = await fetch("/api/admin/products", { headers: authHeader(authToken) });
      const data = await res.json();
      if (res.ok) {
        setProducts(data);
      } else {
        setMessage({ type: "error", text: data.error || "Não foi possível carregar os produtos." });
      }
    } catch {
      setMessage({ type: "error", text: "Erro de conexão ao carregar produtos." });
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (token) loadProducts(token);
  }, [token]);

  const handleLogin = async () => {
    setIsActionLoading(true);
    setMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch {
      setMessage({ type: "error", text: "Falha na autenticação com o Google. Certifique-se de aceitar as permissões." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setProducts([]);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview("");
    setIsFormOpen(true);
  };

  const openEditForm = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description,
      price: String(p.price),
      promoPrice: p.promoPrice !== undefined ? String(p.promoPrice) : "",
      stock: String(p.stock),
      category: p.category,
      active: p.active,
      imageUrl: p.imageUrl
    });
    setImageFile(null);
    setImagePreview(p.imageUrl);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadImageIfNeeded = async (productId: string, authToken: string): Promise<string | undefined> => {
    if (!imageFile) return undefined;
    const imageBase64 = await fileToBase64(imageFile);
    const res = await fetch(`/api/admin/products/${productId}/image`, {
      method: "POST",
      headers: { ...authHeader(authToken), "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, contentType: imageFile.type })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha ao enviar a imagem.");
    return data.imageUrl;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsActionLoading(true);
    setMessage(null);

    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.price,
      promoPrice: form.promoPrice,
      stock: form.stock,
      category: form.category,
      active: form.active,
      imageUrl: form.imageUrl
    };

    try {
      if (editingId) {
        let imageUrl = form.imageUrl;
        if (imageFile) {
          imageUrl = (await uploadImageIfNeeded(editingId, token)) || imageUrl;
        }
        const res = await fetch(`/api/admin/products/${editingId}`, {
          method: "PUT",
          headers: { ...authHeader(token), "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, imageUrl })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha ao atualizar produto.");
        setMessage({ type: "success", text: `"${body.name}" atualizado com sucesso.` });
      } else {
        const createRes = await fetch("/api/admin/products", {
          method: "POST",
          headers: { ...authHeader(token), "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || "Falha ao criar produto.");

        if (imageFile) {
          const imageUrl = await uploadImageIfNeeded(createData.product.id, token);
          if (imageUrl) {
            await fetch(`/api/admin/products/${createData.product.id}`, {
              method: "PUT",
              headers: { ...authHeader(token), "Content-Type": "application/json" },
              body: JSON.stringify({ ...body, imageUrl })
            });
          }
        }
        setMessage({ type: "success", text: `"${body.name}" criado com sucesso.` });
      }
      closeForm();
      await loadProducts(token);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro inesperado." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!token) return;
    if (!window.confirm(`Excluir "${p.name}" permanentemente da planilha?`)) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "DELETE",
        headers: authHeader(token)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao excluir produto.");
      setMessage({ type: "success", text: `"${p.name}" excluído.` });
      await loadProducts(token);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro inesperado." });
    } finally {
      setIsActionLoading(false);
    }
  };

  const runSyncTool = async (endpoint: string, fallbackText: string, method: "GET" | "POST" = "POST") => {
    if (!token) return;
    setIsActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(endpoint, { method, headers: authHeader(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ocorreu um erro.");
      setMessage({ type: "success", text: data.message || fallbackText });
      await loadProducts(token);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro inesperado." });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-natural-bg text-natural-darkbrown">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <a href="/" className="inline-flex items-center gap-1.5 text-xs text-natural-text hover:text-natural-gold mb-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para a loja
            </a>
            <h1 className="font-display text-2xl font-bold">Portal Administrativo Beerlanda</h1>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-semibold">{user.displayName}</p>
                <p className="text-[10px] text-natural-text">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </div>
          )}
        </div>

        {isLoadingAuth ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-natural-gold" />
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4 rounded-2xl border border-natural-border bg-white">
            <h2 className="font-display text-lg font-bold">Autenticação necessária</h2>
            <p className="text-sm text-natural-text max-w-md">
              Entre com uma conta Google autorizada para gerenciar produtos, fotos e a planilha da Beerlanda.
            </p>
            <button
              onClick={handleLogin}
              disabled={isActionLoading}
              className="rounded-lg bg-natural-gold px-6 py-2.5 text-sm font-bold text-white hover:bg-natural-gold/90 disabled:opacity-50"
            >
              Entrar com o Google
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {message && (
              <div className={`rounded-xl p-4 flex gap-3 text-xs border ${
                message.type === "success"
                  ? "bg-green-50 border-green-200 text-green-900"
                  : "bg-red-50 border-red-200 text-red-900"
              }`}>
                {message.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                {message.text}
              </div>
            )}

            {/* Ferramentas de sincronização */}
            <div className="rounded-2xl border border-natural-border bg-white p-5">
              <h3 className="font-display text-sm font-bold mb-3">Ferramentas de Sincronização</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={isActionLoading}
                  onClick={() => runSyncTool("/api/admin/rename-files", "Fotos do Drive organizadas com sucesso.")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Organizar Fotos do Drive
                </button>
                <button
                  disabled={isActionLoading}
                  onClick={() => runSyncTool("/api/admin/sync-sheets", "Fotos preenchidas com sucesso.")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 px-4 py-2 text-xs font-bold text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Preencher Fotos e IDs Faltantes
                </button>
              </div>
            </div>

            {/* Tabela de produtos */}
            <div className="rounded-2xl border border-natural-border bg-white overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-natural-border">
                <h3 className="font-display text-sm font-bold">Produtos ({products.length})</h3>
                <button
                  onClick={openCreateForm}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-natural-gold px-4 py-2 text-xs font-bold text-white hover:bg-natural-gold/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo produto
                </button>
              </div>

              {isLoadingProducts ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
                </div>
              ) : products.length === 0 ? (
                <p className="text-center text-xs text-natural-text py-12">Nenhum produto na planilha ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-natural-card text-natural-text uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="text-left p-3">Foto</th>
                        <th className="text-left p-3">Nome</th>
                        <th className="text-left p-3">Categoria</th>
                        <th className="text-left p-3">Preço</th>
                        <th className="text-left p-3">Estoque</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-right p-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border">
                      {products.map((p) => (
                        <tr key={p.id} id={`admin-product-row-${p.id}`}>
                          <td className="p-3">
                            <div className="h-10 w-10 rounded-lg overflow-hidden bg-natural-card flex items-center justify-center">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <ImageIcon className="h-4 w-4 text-natural-text/40" />
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-semibold max-w-[220px] truncate">{p.name}</td>
                          <td className="p-3">{p.category}</td>
                          <td className="p-3">
                            {formatCurrency(p.promoPrice || p.price)}
                            {p.promoPrice && <span className="ml-1 line-through text-natural-text/40">{formatCurrency(p.price)}</span>}
                          </td>
                          <td className="p-3">{p.stock}</td>
                          <td className="p-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                              {p.active ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => openEditForm(p)} className="rounded-lg p-1.5 hover:bg-natural-card" id={`edit-product-${p.id}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleDelete(p)} className="rounded-lg p-1.5 hover:bg-red-50 text-red-600" id={`delete-product-${p.id}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de criação/edição */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-natural-darkbrown/60 backdrop-blur-sm" onClick={closeForm} />
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-natural-border max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-natural-border">
              <h3 className="font-display text-base font-bold">{editingId ? "Editar produto" : "Novo produto"}</h3>
              <button type="button" onClick={closeForm} className="rounded-full p-1.5 hover:bg-natural-border">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold block mb-1">Nome *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">Preço (R$) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Preço promocional (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.promoPrice}
                    onChange={(e) => setForm({ ...form, promoPrice: e.target.value })}
                    className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">Estoque *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Categoria *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Foto</label>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-lg overflow-hidden bg-natural-card border border-natural-border flex items-center justify-center shrink-0">
                    {imagePreview ? (
                      <img src={imagePreview} alt="preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-natural-text/40" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                    className="text-xs"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Produto ativo (visível na loja)
              </label>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-natural-border">
              <button type="button" onClick={closeForm} className="rounded-lg px-4 py-2 text-xs font-bold text-natural-text hover:bg-natural-card">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isActionLoading}
                className="rounded-lg bg-natural-gold px-5 py-2 text-xs font-bold text-white hover:bg-natural-gold/90 disabled:opacity-50"
              >
                {isActionLoading ? "Salvando..." : editingId ? "Salvar alterações" : "Criar produto"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
