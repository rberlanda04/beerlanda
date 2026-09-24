import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Truck, Copy, Check } from "lucide-react";
import { adminFetch } from "../../lib/adminApi";

interface AdminIntegracoesProps {
  token: string;
}

type Stage = "credenciais" | "autenticacao" | "autorizacao" | "cotacao";

interface CorreiosDiagnostic {
  ok: boolean;
  stage: Stage;
  title: string;
  detail: string;
  action: string | null;
  raw?: string;
  checkedAt: string;
}

// A ordem em que os Correios validam a integração — mostrar a cadeia deixa
// claro que "não calcula o frete" pode parar em degraus bem diferentes, e o
// que cada um significa na prática.
const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: "credenciais", label: "Credenciais", hint: "As variáveis estão configuradas no servidor" },
  { id: "autenticacao", label: "Autenticação", hint: "O CNPJ + código de acesso são aceitos" },
  { id: "autorizacao", label: "Autorização", hint: "O contrato tem a API de preço habilitada" },
  { id: "cotacao", label: "Cotação", hint: "Uma cotação real de teste volta com valor" }
];

export default function AdminIntegracoes({ token }: AdminIntegracoesProps) {
  const [status, setStatus] = useState<CorreiosDiagnostic | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const check = () => {
    setIsChecking(true);
    setError(null);
    adminFetch<CorreiosDiagnostic>("/api/admin/correios/status", token)
      .then(setStatus)
      .catch((e) => setError(e.message))
      .finally(() => setIsChecking(false));
  };

  useEffect(check, [token]);

  const copyRaw = () => {
    if (!status?.raw) return;
    navigator.clipboard.writeText(status.raw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  // O degrau que falhou é o primeiro que não passou; todos antes dele passaram.
  const failedIndex = status && !status.ok ? STAGES.findIndex((s) => s.id === status.stage) : -1;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-natural-border bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-natural-border">
          <h3 className="font-display text-sm font-bold text-natural-darkbrown inline-flex items-center gap-2">
            <Truck className="h-4 w-4 text-natural-gold" />
            Correios — cálculo de frete
          </h3>
          <button
            onClick={check}
            disabled={isChecking}
            className="inline-flex items-center gap-1.5 rounded-lg bg-natural-gold px-4 py-2 text-xs font-bold text-white hover:bg-natural-gold/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`} />
            {isChecking ? "Testando..." : "Testar agora"}
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{error}</p>
          )}

          {isChecking && !status ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
            </div>
          ) : status ? (
            <>
              <div
                className={`rounded-xl border p-4 ${status.ok
                  ? "bg-green-50 border-green-200"
                  : "bg-amber-50 border-amber-200"
                  }`}
              >
                <p className={`text-sm font-bold inline-flex items-center gap-2 ${status.ok ? "text-green-900" : "text-amber-900"}`}>
                  {status.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {status.title}
                </p>
                <p className={`mt-1.5 text-xs leading-relaxed ${status.ok ? "text-green-900/80" : "text-amber-900/80"}`}>
                  {status.detail}
                </p>
                {status.action && (
                  <p className="mt-2.5 text-xs font-semibold text-amber-900">
                    Próximo passo: {status.action}
                  </p>
                )}
              </div>

              {/* Cadeia de validação */}
              <ol className="space-y-2">
                {STAGES.map((stage, index) => {
                  const passed = status.ok || (failedIndex >= 0 && index < failedIndex);
                  const failed = failedIndex === index;
                  return (
                    <li key={stage.id} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${passed
                          ? "bg-green-600 text-white"
                          : failed
                            ? "bg-amber-500 text-white"
                            : "bg-natural-border text-natural-text/60"
                          }`}
                      >
                        {passed ? "✓" : failed ? "!" : index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold ${failed ? "text-amber-900" : "text-natural-darkbrown"}`}>
                          {stage.label}
                        </p>
                        <p className="text-[11px] text-natural-text/70">{stage.hint}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {status.raw && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-bold text-natural-text/70">
                      Resposta dos Correios (anexe num chamado com eles)
                    </p>
                    <button
                      onClick={copyRaw}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-natural-darkbrown hover:text-natural-gold"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-natural-card border border-natural-border p-3 text-[10px] leading-relaxed text-natural-text whitespace-pre-wrap break-all">
                    {status.raw}
                  </pre>
                </div>
              )}

              <p className="text-[10px] text-natural-text/50">
                Verificado em {new Date(status.checkedAt).toLocaleString("pt-BR")}
              </p>
            </>
          ) : null}
        </div>
      </div>

      <p className="text-[11px] text-natural-text/60 leading-relaxed">
        Enquanto a cotação não funcionar, o checkout segue vendendo: o cliente escolhe
        "frete a combinar" e o valor do envio é acertado depois.
      </p>
    </div>
  );
}
