import { useEffect, useState } from "react";
import {
  Mail, Send, Eye, RefreshCw, CheckCircle2, AlertTriangle, Users, History, FlaskConical
} from "lucide-react";
import { adminFetch } from "../../lib/adminApi";

interface AdminCampanhasProps {
  token: string;
}

interface EmailStatus {
  configured: boolean;
  from: string;
  ok: boolean;
  message: string;
}

interface CampaignRecord {
  id: string;
  titulo: string;
  audience: string;
  sent: number;
  failed: number;
  skipped: number;
  sentAt: string;
}

const PUBLICOS = [
  { id: "clientes", label: "Todos os clientes", hint: "quem já deixou e-mail em algum pedido" },
  { id: "compradores", label: "Só quem já comprou", hint: "pedidos com pagamento aprovado" },
  { id: "assinantes", label: "Clube da Colmeia", hint: "assinaturas ativas" }
];

export default function AdminCampanhas({ token }: AdminCampanhasProps) {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [historico, setHistorico] = useState<CampaignRecord[]>([]);

  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [botaoTexto, setBotaoTexto] = useState("Ver na loja");
  const [botaoUrl, setBotaoUrl] = useState("https://beerlanda.com.br");
  const [audience, setAudience] = useState("clientes");

  const [total, setTotal] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const carregar = () => {
    adminFetch<EmailStatus>("/api/admin/email/status", token).then(setStatus).catch(() => {});
    adminFetch<CampaignRecord[]>("/api/admin/campaigns", token).then(setHistorico).catch(() => {});
  };

  useEffect(carregar, [token]);

  useEffect(() => {
    setTotal(null);
    adminFetch<{ total: number }>(`/api/admin/campaigns/audience?audience=${audience}`, token)
      .then((d) => setTotal(d.total))
      .catch(() => setTotal(null));
  }, [audience, token]);

  const verPreview = async () => {
    setErro(null);
    try {
      const d = await adminFetch<{ html: string }>("/api/admin/campaigns/preview", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, corpo, botaoTexto, botaoUrl })
      });
      setPreview(d.html);
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const enviarTeste = async () => {
    setErro(null);
    setResultado(null);
    try {
      const d = await adminFetch<{ success: boolean; to: string }>("/api/admin/email/test", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      setResultado(d.success ? `E-mail de teste enviado para ${d.to}.` : "Não foi possível enviar o teste.");
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    setResultado(null);
    setConfirmando(false);
    try {
      const d = await adminFetch<{ sent: number; failed: number; skipped: number; errors: string[] }>(
        "/api/admin/campaigns/send",
        token,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titulo, corpo, botaoTexto, botaoUrl, audience }) }
      );
      setResultado(
        `${d.sent} enviado(s)` +
          (d.failed ? `, ${d.failed} falharam` : "") +
          (d.skipped ? `, ${d.skipped} ficaram de fora` : "") +
          (d.errors?.length ? ` — ${d.errors[0]}` : "")
      );
      carregar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const podeEnviar = titulo.trim().length > 2 && corpo.trim().length > 10 && !!status?.configured;

  return (
    <div className="space-y-5">
      {/* Estado da conexão */}
      {status && (
        <div
          className={`rounded-2xl border px-5 py-4 ${
            status.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
          }`}
        >
          <p className={`flex items-center gap-2 text-xs font-bold ${status.ok ? "text-emerald-800" : "text-amber-800"}`}>
            {status.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {status.ok ? "Envio de e-mail ativo" : "Envio de e-mail desligado"}
          </p>
          <p className="text-[11px] text-natural-text/70 mt-1">{status.message}</p>
          {!status.configured && (
            <p className="text-[11px] text-amber-800 mt-1.5">
              Falta a senha de app do Gmail na variável <code className="font-mono">SMTP_PASS</code>.
              Enquanto isso, nenhum e-mail sai — nem os de pedido.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Redação */}
        <div className="lg:col-span-3 rounded-2xl border border-natural-border bg-white p-5 space-y-4">
          <h3 className="font-display text-sm font-bold text-natural-darkbrown flex items-center gap-2">
            <Mail className="h-4 w-4 text-natural-gold" />
            Nova campanha
          </h3>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-text/60 mb-1">
              Assunto do e-mail
            </label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Black Friday Beerlanda — 15% em tudo"
              className="w-full rounded-xl border border-natural-border px-3 py-2.5 text-xs text-natural-darkbrown focus:border-natural-gold focus:outline-hidden"
            />
            <p className="mt-1 text-[10px] text-natural-text/50">
              É a primeira coisa que a pessoa lê na caixa de entrada. Curto e concreto funciona melhor.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-text/60 mb-1">
              Mensagem
            </label>
            <textarea
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={9}
              placeholder={"Oi, {nome}!\n\nEscreva aqui como se estivesse falando com uma cliente.\n\nLinha em branco separa parágrafo. Use **asteriscos duplos** para negrito."}
              className="w-full rounded-xl border border-natural-border px-3 py-2.5 text-xs text-natural-darkbrown focus:border-natural-gold focus:outline-hidden font-mono leading-relaxed"
            />
            <p className="mt-1 text-[10px] text-natural-text/50">
              <code className="font-mono">{"{nome}"}</code> vira o primeiro nome de cada pessoa ·
              linha em branco separa parágrafo · <code className="font-mono">**negrito**</code>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-text/60 mb-1">
                Texto do botão
              </label>
              <input
                value={botaoTexto}
                onChange={(e) => setBotaoTexto(e.target.value)}
                className="w-full rounded-xl border border-natural-border px-3 py-2.5 text-xs focus:border-natural-gold focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-text/60 mb-1">
                Link do botão
              </label>
              <input
                value={botaoUrl}
                onChange={(e) => setBotaoUrl(e.target.value)}
                className="w-full rounded-xl border border-natural-border px-3 py-2.5 text-xs focus:border-natural-gold focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-natural-text/60 mb-1.5">
              Para quem
            </label>
            <div className="space-y-1.5">
              {PUBLICOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAudience(p.id)}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs cursor-pointer transition-colors ${
                    audience === p.id ? "border-natural-gold bg-natural-gold/10" : "border-natural-border hover:bg-natural-card"
                  }`}
                >
                  <span>
                    <span className="font-bold text-natural-darkbrown">{p.label}</span>
                    <span className="block text-[10px] text-natural-text/55">{p.hint}</span>
                  </span>
                  {audience === p.id && total !== null && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-natural-gold/15 px-2 py-0.5 text-[10px] font-bold text-natural-darkbrown">
                      <Users className="h-3 w-3" />
                      {total}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={verPreview}
              disabled={!titulo || !corpo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-natural-border bg-white px-3 py-2 text-[11px] font-bold text-natural-darkbrown hover:bg-natural-card disabled:opacity-40 cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
              Pré-visualizar
            </button>
            <button
              type="button"
              onClick={enviarTeste}
              disabled={!status?.configured}
              className="inline-flex items-center gap-1.5 rounded-lg border border-natural-border bg-white px-3 py-2 text-[11px] font-bold text-natural-darkbrown hover:bg-natural-card disabled:opacity-40 cursor-pointer"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Enviar teste pra loja
            </button>
            {!confirmando ? (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                disabled={!podeEnviar}
                className="inline-flex items-center gap-1.5 rounded-lg bg-natural-gold px-4 py-2 text-[11px] font-bold text-white hover:brightness-95 disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                Enviar campanha
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <span className="text-[11px] font-bold text-rose-800">
                  Enviar para {total ?? "?"} pessoa(s)? Não dá pra desfazer.
                </span>
                <button
                  type="button"
                  onClick={enviar}
                  disabled={enviando}
                  className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                >
                  {enviando ? "Enviando…" : "Confirmar"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="text-[11px] font-bold text-natural-text underline cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {enviando && (
            <p className="flex items-center gap-1.5 text-[11px] text-natural-text/60">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Enviando com pausa entre as mensagens para o Gmail não bloquear — pode levar alguns minutos.
            </p>
          )}
          {resultado && <p className="text-[11px] font-bold text-emerald-700">{resultado}</p>}
          {erro && <p className="text-[11px] font-bold text-rose-600">{erro}</p>}
        </div>

        {/* Pré-visualização e histórico */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-natural-border bg-white p-5">
            <h3 className="font-display text-sm font-bold text-natural-darkbrown flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-natural-gold" />
              Como vai chegar
            </h3>
            {preview ? (
              <iframe
                title="Pré-visualização do e-mail"
                srcDoc={preview}
                className="h-[520px] w-full rounded-lg border border-natural-border bg-white"
              />
            ) : (
              <p className="py-16 text-center text-xs text-natural-text/60">
                Escreva o assunto e a mensagem e clique em "Pré-visualizar".
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-natural-border bg-white p-5">
            <h3 className="font-display text-sm font-bold text-natural-darkbrown flex items-center gap-2 mb-1">
              <History className="h-4 w-4 text-natural-gold" />
              Campanhas enviadas
            </h3>
            {historico.length === 0 ? (
              <p className="py-8 text-center text-xs text-natural-text/60">Nenhuma campanha ainda.</p>
            ) : (
              <ul className="divide-y divide-natural-border">
                {historico.map((c) => (
                  <li key={c.id} className="py-2.5">
                    <p className="text-xs font-bold text-natural-darkbrown">{c.titulo}</p>
                    <p className="text-[10px] text-natural-text/55">
                      {new Date(c.sentAt).toLocaleString("pt-BR")} · {c.audience} · {c.sent} enviado(s)
                      {c.failed ? ` · ${c.failed} falha(s)` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
