import { CheckCircle2, ArrowLeft, Sparkles, Mail, Package } from "lucide-react";
import { motion } from "motion/react";

interface ClubeWelcomeViewProps {
  onBackToHome: () => void;
}

// Página de destino após o pagamento da assinatura ser aprovado no Mercado
// Pago (#abelhas) — diferente da confirmação do formulário de interesse em
// ClubeView, aqui a pessoa já é assinante paga, então o tom e o próximo
// passo descrito são outros.
export default function ClubeWelcomeView({ onBackToHome }: ClubeWelcomeViewProps) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-natural-border-dark bg-[#5C4033] p-8 shadow-md"
        id="clube-welcome-card"
      >
        <div className="absolute inset-0 bg-honeycomb opacity-20 pointer-events-none" />
        <div className="relative z-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-natural-gold/25 text-natural-gold">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-natural-gold/25 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
            <Sparkles className="h-3.5 w-3.5 text-natural-gold" />
            Assinatura confirmada
          </span>
          <h1 className="mt-4 font-serif text-2xl font-bold text-white sm:text-3xl">
            Bem-vinda à Colmeia! 🐝
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            Seu pagamento foi aprovado e sua vaga no Clube da Colmeia está garantida. A partir de agora,
            toda Colheita chega até você antes de mais ninguém saber o que tem dentro.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <div className="rounded-xl bg-white/10 p-4">
              <Mail className="h-4 w-4 text-natural-gold" />
              <p className="mt-2 text-xs text-white/80 leading-relaxed">
                Você vai receber a confirmação da assinatura por e-mail nos próximos minutos.
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-4">
              <Package className="h-4 w-4 text-natural-gold" />
              <p className="mt-2 text-xs text-white/80 leading-relaxed">
                A próxima Colheita é preparada e enviada assim que revelarmos o tema do mês.
              </p>
            </div>
          </div>

          <button
            onClick={onBackToHome}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-natural-gold px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-natural-gold/90 transition-all cursor-pointer"
            id="clube-welcome-back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a loja
          </button>
        </div>
      </motion.div>
    </div>
  );
}
