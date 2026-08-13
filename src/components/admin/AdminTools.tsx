import { useState } from "react";
import { FileSpreadsheet, FolderOpen, CheckCircle2, AlertCircle, Database } from "lucide-react";
import { adminFetch } from "../../lib/adminApi";

interface AdminToolsProps {
  token: string;
}

export default function AdminTools({ token }: AdminToolsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const run = async (endpoint: string, fallbackText: string) => {
    setIsLoading(true);
    setMessage(null);
    try {
      const data = await adminFetch<{ message?: string }>(endpoint, token, { method: "POST" });
      setMessage({ type: "success", text: data.message || fallbackText });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro inesperado." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <div className={`rounded-xl p-4 flex gap-3 text-xs border ${
          message.type === "success" ? "bg-green-50 border-green-200 text-green-900" : "bg-red-50 border-red-200 text-red-900"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="rounded-2xl border border-natural-border bg-white p-5">
        <h3 className="font-display text-sm font-bold mb-1">Ferramentas de Sincronização</h3>
        <p className="text-xs text-natural-text/60 mb-4">
          A planilha continua sendo a fonte editável dos produtos — essas ferramentas só completam o que está faltando (fotos, IDs) e atualizam o espelho rápido que a loja usa.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={isLoading}
            onClick={() => run("/api/admin/rename-files", "Fotos do Drive organizadas com sucesso.")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Organizar Fotos do Drive
          </button>
          <button
            disabled={isLoading}
            onClick={() => run("/api/admin/sync-sheets", "Fotos preenchidas com sucesso.")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 px-4 py-2 text-xs font-bold text-green-700 hover:bg-green-50 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Preencher Fotos e IDs Faltantes
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-natural-border bg-white p-5">
        <h3 className="font-display text-sm font-bold mb-1">Espelhar na Planilha</h3>
        <p className="text-xs text-natural-text/60 mb-4">
          Replica pedidos, clientes e mensagens novos (registrados aqui no site) para as abas <span className="font-mono">vendas</span>, <span className="font-mono">clientes</span> e <span className="font-mono">mensagens</span> da sua planilha — sem duplicar o que já foi sincronizado antes.
        </p>
        <button
          disabled={isLoading}
          onClick={() => run("/api/admin/sync-firestore-to-sheet", "Sincronizado com a planilha.")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 px-4 py-2 text-xs font-bold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
        >
          <Database className="h-3.5 w-3.5" />
          Sincronizar Pedidos/Clientes/Mensagens
        </button>
      </div>
    </div>
  );
}
