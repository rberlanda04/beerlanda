import { useState, useEffect, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, AlertCircle, Sparkles, Gift, Package, Lock, Heart, Star, Users, Droplet, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { maskPhone, PRODUCT_CATEGORIES } from "../utils";

type FieldKey = "categories" | "aromas" | "name" | "phone" | "email" | "city";

const AROMAS = ["Cítrico", "Floral", "Amadeirado", "Neutro", "Infantil"];

interface StepDef {
  key: FieldKey;
  question: string;
  hint: string;
  kind: "text" | "choice";
  placeholder?: string;
  type?: string;
  options?: string[];
}

const STEPS: StepDef[] = [
  { key: "categories", question: "O que você mais costuma usar?", hint: "Pode escolher mais de um — toda preferência conta.", kind: "choice", options: PRODUCT_CATEGORIES },
  { key: "aromas", question: "Quais aromas mais te agradam?", hint: "Isso nos ajuda a escolher o mel certo pra cada Colheita.", kind: "choice", options: AROMAS },
  { key: "name", question: "Como podemos te chamar?", hint: "A primeira gota da nossa colheita.", kind: "text", placeholder: "Ex: Mariana dos Santos", type: "text" },
  { key: "phone", question: "Qual seu WhatsApp?", hint: "É por ali que a gente avisa quando a colmeia abrir.", kind: "text", placeholder: "Ex: (11) 99999-9999", type: "tel" },
  { key: "email", question: "E o seu melhor e-mail?", hint: "Seu cantinho reservado na Primeira Colmeia.", kind: "text", placeholder: "Ex: mariana@email.com", type: "email" },
  { key: "city", question: "De onde você é?", hint: "Última gota — já já sua colmeia está completa.", kind: "text", placeholder: "Ex: Curitiba - PR", type: "text" }
];

function validateField(key: FieldKey, value: string | string[]): string {
  if (key === "categories" || key === "aromas") {
    return (value as string[]).length > 0 ? "" : "Escolha pelo menos uma opção";
  }
  if (key === "name") return (value as string).trim() ? "" : "Nome é obrigatório";
  if (key === "phone") return (value as string).replace(/\D/g, "").length >= 10 ? "" : "Telefone válido é obrigatório";
  if (key === "email") return /\S+@\S+\.\S+/.test(value as string) ? "" : "E-mail válido é obrigatório";
  return (value as string).trim() ? "" : "Cidade e Estado são obrigatórios";
}

interface ClubeViewProps {
  onBackToHome: () => void;
}

type Tier = "essencial" | "premium";

interface CollectionTeaser {
  theme: string;
  story: string;
}

interface CurrentCollectionResponse {
  month: string;
  essencial: CollectionTeaser | null;
  premium: CollectionTeaser | null;
}

const TIERS: { id: Tier; name: string; blurb: string }[] = [
  { id: "essencial", name: "Colmeia Compacta", blurb: "Pequena e leve — uma seleção surpresa de 2-3 produtos, ideal pra experimentar o clube." },
  { id: "premium", name: "Colmeia Completa", blurb: "A experiência cheia — mais produtos, itens exclusivos e prioridade nos lançamentos." }
];

const PERKS = [
  { Icon: Star, title: "Prioridade garantida", text: "Quando abrirmos as primeiras vagas de verdade, quem já está na lista entra antes de todo mundo." },
  { Icon: Gift, title: "Mimo de fundadora", text: "Quem entra agora ganha um presente exclusivo de boas-vindas quando o clube for lançado." },
  { Icon: Heart, title: "Sua opinião molda o clube", text: "Vamos te ouvir antes de fechar os detalhes — o que você mais quer receber?" }
];

export default function ClubeView({ onBackToHome }: ClubeViewProps) {
  const [teaser, setTeaser] = useState<CurrentCollectionResponse | null>(null);
  const [interestedCount, setInterestedCount] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [formData, setFormData] = useState<{ name: string; phone: string; email: string; city: string; categories: string[]; aromas: string[] }>({
    name: "", phone: "", email: "", city: "", categories: [], aromas: []
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [step, setStep] = useState(0);
  const isLastStep = step === STEPS.length - 1;
  const currentStep = STEPS[step];

  useEffect(() => {
    fetch("/api/clube/current-collection").then((r) => (r.ok ? r.json() : null)).then(setTeaser).catch(() => {});
    fetch("/api/clube/interesse-count").then((r) => (r.ok ? r.json() : null)).then((d) => setInterestedCount(d?.count ?? null)).catch(() => {});
  }, []);

  const handleBack = () => {
    setSubmitError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const toggleChoice = (key: "categories" | "aromas", option: string) => {
    setFormData((prev) => {
      const current = prev[key];
      const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
      return { ...prev, [key]: next };
    });
  };

  const handleStepSubmit = (e: FormEvent) => {
    e.preventDefault();

    const value = formData[currentStep.key];
    const error = validateField(currentStep.key, value);
    if (error) {
      setFormErrors({ ...formErrors, [currentStep.key]: error });
      return;
    }
    setFormErrors({ ...formErrors, [currentStep.key]: "" });

    if (!isLastStep) {
      setStep((s) => s + 1);
      return;
    }

    if (!selectedTier) {
      setFormErrors({ ...formErrors, [currentStep.key]: "", tier: "Escolha o formato que mais combina com você, ali em cima" });
      return;
    }

    handleSubmit();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          city: formData.city,
          categories: formData.categories,
          aromas: formData.aromas,
          tier: selectedTier
        })
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setSubmitError(data.error || "Não foi possível registrar seu interesse agora.");
        setIsSubmitting(false);
        return;
      }

      setIsSubmitted(true);
      setInterestedCount((prev) => (prev !== null ? prev + 1 : prev));
    } catch {
      setSubmitError("Erro de conexão. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="rounded-2xl border border-natural-border bg-white p-8 shadow-xs"
          id="clube-success-card"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-natural-darkbrown">Seja bem-vinda à Colmeia!</h1>
          <p className="mt-3 text-sm text-natural-text/70 leading-relaxed">
            Você agora faz parte da nossa Primeira Colmeia. Assim que o Clube estiver pronto pra voar,
            você é uma das primeiras a saber — com um mimo especial de fundadora te esperando.
          </p>
          <p className="mt-3 text-xs text-natural-gold font-bold">Obrigada por acreditar nesse sonho com a gente. 🐝</p>
          <button
            onClick={onBackToHome}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-natural-gold px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-natural-gold/90 transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a loja
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-[#5C4033] py-12 px-6 sm:px-12 text-center shadow-sm border border-natural-border-dark">
        <div className="absolute inset-0 bg-honeycomb opacity-20 pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-natural-gold/25 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white mb-4">
            <Sparkles className="h-3.5 w-3.5 text-natural-gold" />
            Clube da Colmeia — em formação
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Você pode ser uma das primeiras a fazer parte.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">
            Estamos construindo um clube de assinatura com caixas surpresa mensais, curadas à mão pelo nosso ateliê.
            Ainda não abrimos as vagas — mas você pode entrar agora pra Primeira Colmeia e ajudar a moldar essa
            experiência com a gente, sem nenhum compromisso.
          </p>
          {interestedCount !== null && interestedCount > 0 && (
            <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-white/70">
              <Users className="h-3.5 w-3.5 text-natural-gold" />
              {interestedCount} {interestedCount === 1 ? "pessoa já faz" : "pessoas já fazem"} parte da Primeira Colmeia
            </p>
          )}
        </div>
      </section>

      {/* Por que entrar agora */}
      <section className="max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PERKS.map(({ Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-natural-border bg-white p-5 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-natural-gold/10 text-natural-gold">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-display text-sm font-bold text-natural-darkbrown">{title}</h3>
              <p className="mt-1.5 text-xs text-natural-text/70 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Formatos (sem preço — só preferência) */}
      <section>
        <h2 className="font-display text-2xl font-bold text-natural-darkbrown text-center sm:text-3xl">Qual formato combina mais com você?</h2>
        <p className="text-xs text-natural-text/60 text-center mt-1">Só pra a gente entender o que vocês mais querem — os detalhes finais ainda estão sendo desenhados.</p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {TIERS.map((tier) => {
            const isSelected = selectedTier === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => setSelectedTier(tier.id)}
                className={`text-left rounded-2xl border-2 p-6 transition-all cursor-pointer ${
                  isSelected ? "border-natural-gold bg-natural-gold/5 shadow-md" : "border-natural-border bg-white hover:border-natural-gold/50"
                }`}
                id={`clube-tier-${tier.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-natural-gold">
                    {tier.id === "premium" ? <Gift className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
                    {tier.name}
                  </span>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-natural-gold" />}
                </div>
                <p className="mt-3 text-xs text-natural-text/70 leading-relaxed">{tier.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Teaser do mês */}
      <section className="max-w-3xl mx-auto w-full">
        <div className="rounded-2xl border border-natural-border bg-natural-card p-6 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-natural-gold">
            <Lock className="h-3.5 w-3.5" />
            Uma prévia do que está por vir
          </span>
          {teaser?.essencial?.theme || teaser?.premium?.theme ? (
            <>
              <h3 className="mt-2 font-display text-xl font-bold text-natural-darkbrown">
                {teaser.essencial?.theme || teaser.premium?.theme}
              </h3>
              <p className="mt-1 text-xs text-natural-text/70 max-w-md mx-auto">
                {teaser.essencial?.story || teaser.premium?.story}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-natural-text/60">
              A primeira Colheita ainda é segredo — entre pra Primeira Colmeia pra ser avisada assim que revelarmos.
            </p>
          )}
        </div>
      </section>

      {/* Formulário de interesse — wizard, uma gota de mel por vez */}
      <section className="max-w-lg mx-auto w-full bg-white rounded-2xl border border-natural-border p-6 sm:p-8 shadow-xs">
        <h2 className="font-display text-xl font-bold text-natural-darkbrown text-center">
          Entrar para a Primeira Colmeia
        </h2>
        <p className="mt-2 text-xs text-natural-text/60 text-center">
          Sem custo, sem compromisso — vamos colhendo suas informações, gotinha por gotinha.
        </p>

        {/* Trilha de gotas de mel */}
        <div className="mt-6 flex items-center justify-center">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  i < step
                    ? "bg-natural-gold border-natural-gold text-white"
                    : i === step
                    ? "border-natural-gold text-natural-gold bg-natural-gold/10"
                    : "border-natural-border text-natural-border"
                }`}
                aria-label={i <= step ? "gota colhida" : "gota pendente"}
              >
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : <Droplet className={`h-4 w-4 ${i === step ? "fill-natural-gold/30" : ""}`} />}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-6 sm:w-10 transition-all duration-300 ${i < step ? "bg-natural-gold" : "bg-natural-border"}`} />
              )}
            </div>
          ))}
        </div>

        {formErrors.tier && (
          <p className="mt-5 text-xs text-rose-600 font-medium flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {formErrors.tier}
          </p>
        )}

        <AnimatePresence mode="wait">
          <motion.form
            key={currentStep.key}
            onSubmit={handleStepSubmit}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6"
          >
            <label className="block text-center font-display text-base font-bold text-natural-darkbrown mb-1">
              {currentStep.question}
            </label>
            <p className="text-center text-[11px] text-natural-text/60 mb-4">{currentStep.hint}</p>

            {currentStep.kind === "choice" ? (
              <div className="flex flex-wrap justify-center gap-2">
                {currentStep.options!.map((option) => {
                  const selected = (formData[currentStep.key] as string[]).includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleChoice(currentStep.key as "categories" | "aromas", option)}
                      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                        selected ? "border-natural-gold bg-natural-gold text-white" : "border-natural-border bg-white text-natural-text hover:border-natural-gold/50"
                      }`}
                    >
                      {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {option}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                autoFocus
                type={currentStep.type}
                value={formData[currentStep.key] as string}
                onChange={(e) => {
                  const value = currentStep.key === "phone" ? maskPhone(e.target.value) : e.target.value;
                  setFormData({ ...formData, [currentStep.key]: value });
                }}
                placeholder={currentStep.placeholder}
                className={`w-full rounded-xl border px-4 py-3 text-sm text-center focus:outline-hidden bg-natural-card/40 text-natural-darkbrown ${
                  formErrors[currentStep.key] ? "border-rose-400" : "border-natural-border focus:border-natural-gold"
                }`}
              />
            )}
            {formErrors[currentStep.key] && (
              <p className="mt-1.5 text-[11px] text-rose-600 text-center">{formErrors[currentStep.key]}</p>
            )}

            {submitError && (
              <p className="mt-3 text-[11px] text-rose-600 font-medium flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {submitError}
              </p>
            )}

            <div className="mt-5 flex items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 rounded-xl border border-natural-border px-4 py-3 text-xs font-bold text-natural-text hover:bg-natural-card transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-natural-gold py-3 text-center text-sm font-bold text-white shadow-md hover:bg-natural-gold/90 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                id="clube-subscribe-btn"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Registrando...
                  </>
                ) : isLastStep ? (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Colher minha gota final
                  </>
                ) : (
                  <>
                    <Droplet className="h-4 w-4" />
                    Próxima gota
                  </>
                )}
              </button>
            </div>
          </motion.form>
        </AnimatePresence>

        <p className="mt-5 text-[10px] text-center text-natural-text/50 leading-relaxed">
          Sem cobrança nesta etapa. Usamos seus dados só pra te avisar sobre o Clube da Colmeia.
        </p>
      </section>
    </div>
  );
}
