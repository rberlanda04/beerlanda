import { ShieldCheck, Truck, RefreshCw, Heart, Leaf, Rabbit, Instagram, Mail, Clock, Droplet, Flame, Waves, Package, Zap } from "lucide-react";
import logoImg from "../assets/images/logo.png";

const INSTAGRAM_HANDLE = "beerlandaprodutosartesanais";

interface FooterProps {
  appConfig?: {
    whatsappPhone: string;
    contactEmail: string;
    googleSheetId: string;
    googleDriveFolderId: string;
  };
}

export default function Footer({ appConfig }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const email = appConfig?.contactEmail || "beerlandaprodutosartesanais@gmail.com";

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
              <p className="text-xs text-charcoal-900/70 mt-1">Envios para todo o Brasil com embalagem térmica e protetora especial para potes de vidro.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-200 text-brand-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-charcoal-900">Origem 100% Rastreável</h4>
              <p className="text-xs text-charcoal-900/70 mt-1">Nossos produtos vêm de apiários sustentáveis certificados. Garantia de mel puro sem aditivos.</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-200 text-brand-700">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-charcoal-900">Garantia de Satisfação</h4>
              <p className="text-xs text-charcoal-900/70 mt-1">Se você não amar seu mel ou cosmético, devolvemos seu dinheiro em até 7 dias após o recebimento.</p>
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
            <p className="text-xs text-charcoal-900/60 leading-relaxed">
              Cosmética e artesanato natural nascidos da apicultura consciente: mel, própolis e cera de abelha como insumos puros em cada sabonete, bálsamo, vela e peça feita à mão.
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
              <li className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Seg a Sex: 08:00h às 18:00h</li>
              <li className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Sábados: 09:00h às 13:00h</li>
            </ul>
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
    </footer>
  );
}
