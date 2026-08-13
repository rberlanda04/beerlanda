import { CheckCircle2, Clock, XCircle, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

interface PaymentStatusViewProps {
  status: "success" | "failure" | "pending";
  onBackToHome: () => void;
}

const CONTENT = {
  success: {
    Icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-100",
    title: "Pagamento aprovado!",
    text: "Seu pedido foi confirmado e já está sendo preparado com todo carinho. Você vai receber os detalhes por e-mail."
  },
  pending: {
    Icon: Clock,
    color: "text-amber-600 bg-amber-100",
    title: "Pagamento em análise",
    text: "Recebemos seu pedido e estamos aguardando a confirmação do pagamento (comum no Pix e boleto). Assim que for aprovado, avisamos por e-mail."
  },
  failure: {
    Icon: XCircle,
    color: "text-rose-600 bg-rose-100",
    title: "Pagamento não concluído",
    text: "Não foi possível concluir o pagamento dessa vez. Nenhum valor foi cobrado — você pode tentar novamente quando quiser."
  }
};

export default function PaymentStatusView({ status, onBackToHome }: PaymentStatusViewProps) {
  const { Icon, color, title, text } = CONTENT[status];

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="rounded-2xl border border-natural-border bg-white p-8 shadow-xs"
        id="payment-status-card"
      >
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${color}`}>
          <Icon className="h-9 w-9" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-natural-darkbrown">{title}</h1>
        <p className="mt-3 text-sm text-natural-text/70 leading-relaxed">{text}</p>

        <button
          onClick={onBackToHome}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-natural-gold px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-natural-gold/90 transition-all cursor-pointer"
          id="payment-status-back-btn"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a loja
        </button>
      </motion.div>
    </div>
  );
}
