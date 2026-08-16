import { useState } from "react";
import { ShieldCheck, Truck, RefreshCw, Heart, Leaf, Rabbit, Instagram, Mail, MessageSquare, Clock, Droplet, Flame, Waves, Package, Zap, Gift } from "lucide-react";
import logoImg from "../assets/images/logo.png";
import ContactForm from "./ContactForm";

const INSTAGRAM_HANDLE = "beerlandaprodutosartesanais";

interface FooterProps {
  appConfig?: {
    contactEmail: string;
    googleSheetId: string;
    googleDriveFolderId: string;
  };
}

export default function Footer({ appConfig }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const email = appConfig?.contactEmail || "beerlandaprodutosartesanais@gmail.com";
  const [isContactOpen, setIsContactOpen] = useState(false);

  return (
    <footer className="mt-16 border-t border-brand-200/50 bg-brand-100/50 pt-12 pb-8 text-charcoal-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Grid de Diferenciais de Compra */}
        <div className="grid grid-cols-1 gap-6 border-b border-brand-200/30 pb-10 md:grid-cols-3">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-200 text-brand-700">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-charcoal-900">Entrega Rápida e Segura</h4>
              <p className="text-xs text-charcoal-900/70 mt-1">Envios para todo o Brasil via correios ou retirada à combinar em Curitiba e região.</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-200 text-brand-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-charcoal-900">Origem Rastreável</h4>
              <p className="text-xs text-charcoal-900/70 mt-1">Nossos produtos vêm de apiários sustentáveis. Garantia de mel puro sem aditivos.</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-200 text-brand-700">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-charcoal-900">Natural e Sustentável</h4>
              <p className="text-xs text-charcoal-900/70 mt-1">Somos um pequeno ateliê que produz tudo a mão, com muito respeito e carinho em todos os processos, da escolha dos ingredientes à embalagem final.</p>
            </div>
          </div>
        </div>

        {/* Links Principais e Info */}
        <div className="grid grid-cols-1 gap-8 py-10 md:grid-cols-4">

          {/* Coluna Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="Beerlanda" className="h-7 w-7 rounded-full object-cover border border-brand-300" referrerPolicy="no-referrer" />
              <span className="font-display text-lg font-extrabold tracking-tight">
                Beer<span className="text-brand-500 font-extrabold">landa</span>
              </span>
            </div>
            <p className="text-xs text-charcoal-900/60 leading-relaxed inline-flex flex-wrap items-center gap-1">
              Produtos artesanais que têm as abelhas como inspiração: mel, própolis e presentes de forma pura em cada um de nossos produtos, feito um por um à mão
              <Heart className="h-3 w-3 text-red-500 fill-red-500" />
            </p>
            <div className="mt-2 flex gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-brand-200/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-800">
                <Leaf className="h-3 w-3" />
                Orgânico
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-brand-200/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-800">
                <Rabbit className="h-3 w-3" />
                Cruelty Free
              </span>
            </div>
          </div>

          {/* Coluna Categorias */}
          <div>
            <h5 className="font-display font-bold text-sm text-charcoal-900 uppercase tracking-wider mb-4">Nossos Produtos</h5>
            <ul className="space-y-2 text-xs text-charcoal-900/70">
              <li><span className="inline-flex items-center gap-1.5 hover:text-brand-600 cursor-pointer"><Droplet className="h-3.5 w-3.5" />Sabonetes</span></li>
              <li><span className="inline-flex items-center gap-1.5 hover:text-brand-600 cursor-pointer"><Droplet className="h-3.5 w-3.5" />Bálsamos</span></li>
              <li><span className="inline-flex items-center gap-1.5 hover:text-brand-600 cursor-pointer"><Flame className="h-3.5 w-3.5" />Velas Naturais</span></li>
              <li><span className="inline-flex items-center gap-1.5 hover:text-brand-600 cursor-pointer"><Waves className="h-3.5 w-3.5" />Sais</span></li>
              <li><span className="inline-flex items-center gap-1.5 hover:text-brand-600 cursor-pointer"><Package className="h-3.5 w-3.5" />Outros</span></li>
              <li>
                <a href="#clube" className="inline-flex items-center gap-1.5 font-bold text-brand-700 hover:text-brand-900" id="footer-clube-link">
                  <Gift className="h-3.5 w-3.5" />
                  Clube da Colmeia (em breve)
                </a>
              </li>
            </ul>
          </div>

          {/* Coluna Contato */}
          <div>
            <h5 className="font-display font-bold text-sm text-charcoal-900 uppercase tracking-wider mb-4">Atendimento</h5>
            <ul className="space-y-2 text-xs text-charcoal-900/70 leading-relaxed">
              <li>
                <a
                  href={`https://instagram.com/${INSTAGRAM_HANDLE}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-brand-600"
                >
                  <Instagram className="h-3.5 w-3.5" />
                  @{INSTAGRAM_HANDLE}
                </a>
              </li>
              <li className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{email}</li>
            </ul>

            <button
              onClick={() => setIsContactOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-200/30 px-3 py-1.5 text-[11px] font-bold text-brand-800 hover:bg-brand-200/50 transition-colors cursor-pointer"
              id="footer-open-contact-btn"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Fale com a gente
            </button>
          </div>

          {/* Coluna Área da Equipe */}
          <div>
            <h5 className="font-display font-bold text-sm text-charcoal-900 uppercase tracking-wider mb-4">Equipe Beerlanda</h5>
            <div className="flex flex-col gap-2">
              <a
                href="/admin"
                className="mt-2 w-full text-left text-[10px] text-brand-800 bg-brand-200/40 border border-brand-200 p-2.5 rounded-lg hover:bg-brand-200/60 hover:border-brand-300 transition-all font-bold flex items-center justify-between gap-2 cursor-pointer"
                id="footer-open-admin-btn"
              >
                <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" />Portal Administrativo</span>
                <span className="text-[9px] bg-brand-500 text-white px-1.5 py-0.5 rounded-full font-bold">Acessar</span>
              </a>
            </div>
          </div>
        </div>

        {/* Linha de Copyright */}
        <div className="mt-8 border-t border-brand-200/30 pt-6 text-center text-xs text-charcoal-900/50">
          <p>© {currentYear} Beerlanda Produtos Artesanais. Todos os direitos reservados.</p>
          <p className="mt-1 flex items-center justify-center gap-1">
            Feito com carinho pelas abelhas <Heart className="h-3 w-3 text-red-500 fill-red-500" /> e tecnologia sustentável.
          </p>
        </div>
      </div>

      {isContactOpen && <ContactForm onClose={() => setIsContactOpen(false)} />}
    </footer>
  );
}
