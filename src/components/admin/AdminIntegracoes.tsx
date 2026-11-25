import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Truck, Copy, Check } from "lucide-react";
import { adminFetch } from "../../lib/adminApi";

interface AdminIntegracoesProps {
  token: string;
}

interface ShippingDiagnostic {
  ok: boolean;
  provider: "melhor-envio";
  title: string;
  detail: string;
  action: string | null;
  raw?: string;
  checkedAt: string;
}

export default function AdminIntegracoes({ token }: AdminIntegracoesProps) {
  const [frete, setFrete] = useState<ShippingDiagnostic | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const check = () => {
    setIsChecking(true);
    setError(null);
    adminFetch<ShippingDiagnostic>("/api/admin/frete/status", token)
      .then(setFrete)
      .catch((e: Error) => setError(e.message || "Falha ao consultar o status."))
      .finally(() => setIsChecking(false));
  };

  useEffect(check, [token]);

  const copyRaw = () => {
    if (!frete?.raw) return;
    navigator.clipboard.writeText(frete.raw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-natural-border bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-natural-border">
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold text-natural-darkbrown inline-flex items-center gap-2">
              <Truck className="h-4 w-4 text-natural-gold" />
              Melhor Envio — cálculo de frete
            </h3>
            <p className="mt-0.5 text-[11px] text-natural-text/60">
              Uma cotação devolve Correios, Jadlog, Azul e outras. É daqui que sai o frete do checkout.
            </p>
          </div>
          <button
            onClick={check}
            disabled={isChecking}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-natural-gold px-4 py-2 text-xs font-bold text-white hover:bg-natural-gold/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`} />
            {isChecking ? "Testando..." : "Testar agora"}
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{error}</p>
          )}

          {isChecking && !frete ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
            </div>
          ) : frete ? (
            <>
              <div className={`rounded-xl border p-4 ${frete.ok ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                <p className={`text-sm font-bold inline-flex items-center gap-2 ${frete.ok ? "text-green-900" : "text-amber-900"}`}>
                  {frete.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {frete.title}
                </p>
                <p className={`mt-1.5 text-xs leading-relaxed ${frete.ok ? "text-green-900/80" : "text-amber-900/80"}`}>
                  {frete.detail}
                </p>
                {frete.action && (
                  <p className="mt-2.5 text-xs font-semibold text-amber-900">Próximo passo: {frete.action}</p>
                )}
              </div>

              {frete.raw && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-bold text-natural-text/70">
                      {frete.ok ? "Opções que a cotação de teste devolveu" : "Resposta do Melhor Envio"}
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
                    {frete.raw}
                  </pre>
                </div>
              )}

              <p className="text-[10px] text-natural-text/50">
                Verificado em {new Date(frete.checkedAt).toLocaleString("pt-BR")}
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-natural-border bg-natural-card p-4">
        <p className="text-[11px] font-bold text-natural-darkbrown">O que costuma quebrar o frete</p>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-natural-text/80">
          <li>
            <strong>O token do Melhor Envio vale 30 dias.</strong> Quando ele expira, a cotação
            volta 401 e o checkout cai no "frete a combinar". É a causa mais provável se o frete
            parar de funcionar de um dia para o outro.
          </li>
          <li>
            <strong>Produto sem peso cadastrado</strong> cota por um peso padrão da categoria, que
            pode ser menor que o real — aí a loja paga a diferença no envio. O painel avisa no
            resumo quando algum produto está assim.
          </li>
        </ul>
        <p className="mt-3 text-[11px] text-natural-text/60 leading-relaxed">
          Enquanto a cotação não funcionar, o checkout segue vendendo: a cliente escolhe
          "frete a combinar" e o valor do envio é acertado depois pelo WhatsApp.
        </p>
      </div>
    </div>
  );
}
