import { useState, type FormEvent } from "react";
import { X, Mail, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface ContactFormProps {
  onClose: () => void;
}

export default function ContactForm({ onClose }: ContactFormProps) {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setForm({ name: "", email: "", message: "" });
    } catch {
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-natural-darkbrown/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-natural-border"
        id="contact-form-modal"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-natural-border">
          <h3 className="font-display text-base font-bold text-natural-darkbrown flex items-center gap-2">
            <Mail className="h-4.5 w-4.5 text-natural-gold" />
            Fale com a gente
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-natural-border">
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === "success" ? (
          <div className="p-6 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-natural-darkbrown">Mensagem enviada!</p>
            <p className="text-xs text-natural-text/70">Vamos responder assim que possível.</p>
            <button
              onClick={onClose}
              className="mt-2 rounded-lg bg-natural-gold px-5 py-2 text-xs font-bold text-white hover:bg-natural-gold/90"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="text-xs font-bold block mb-1 text-natural-darkbrown">Seu nome</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs focus:border-natural-gold focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1 text-natural-darkbrown">Seu e-mail</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs focus:border-natural-gold focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1 text-natural-darkbrown">Mensagem</label>
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Conte pra gente o que você precisa..."
                className="w-full rounded-lg border border-natural-border px-3 py-2 text-xs focus:border-natural-gold focus:outline-hidden"
              />
            </div>

            {status === "error" && (
              <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Não foi possível enviar agora. Tente novamente em instantes.
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-natural-gold py-3 text-xs font-bold text-white hover:bg-natural-gold/90 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              {isSubmitting ? "Enviando..." : "Enviar mensagem"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
