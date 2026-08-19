import { useState, useEffect } from "react";
import {
  RefreshCw, LogOut, ArrowLeft, LayoutDashboard, Package,
  ShoppingBag, Users, Tag, Mail, Star, BarChart3, Gift
} from "lucide-react";
import { User } from "firebase/auth";
import { googleSignIn, initAuth, logout } from "../lib/googleAuth";
import AdminDashboard from "./admin/AdminDashboard";
import AdminAnalytics from "./admin/AdminAnalytics";
import AdminClube from "./admin/AdminClube";
import AdminProducts from "./admin/AdminProducts";
import AdminOrders from "./admin/AdminOrders";
import AdminCustomers from "./admin/AdminCustomers";
import AdminCoupons from "./admin/AdminCoupons";
import AdminReviews from "./admin/AdminReviews";
import AdminMessages from "./admin/AdminMessages";

type Section = "dashboard" | "analytics" | "clube" | "products" | "orders" | "customers" | "coupons" | "reviews" | "messages";

const NAV: { id: Section; label: string; Icon: any }[] = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "analytics", label: "Análises", Icon: BarChart3 },
  { id: "clube", label: "Clube da Colmeia", Icon: Gift },
  { id: "products", label: "Produtos", Icon: Package },
  { id: "orders", label: "Pedidos", Icon: ShoppingBag },
  { id: "customers", label: "Clientes", Icon: Users },
  { id: "coupons", label: "Cupons", Icon: Tag },
  { id: "reviews", label: "Avaliações", Icon: Star },
  { id: "messages", label: "Mensagens", Icon: Mail }
];

export default function AdminPortal() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("dashboard");

  useEffect(() => {
    const unsubscribe = initAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
        setIsLoadingAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setIsLoadingAuth(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch {
      setLoginError("Falha na autenticação com o Google. Certifique-se de aceitar as permissões.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
  };

  return (
    <div className="min-h-screen bg-natural-bg text-natural-darkbrown">
      {isLoadingAuth ? (
        <div className="flex justify-center py-24">
          <RefreshCw className="h-8 w-8 animate-spin text-natural-gold" />
        </div>
      ) : !user || !token ? (
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <a href="/" className="inline-flex items-center gap-1.5 text-xs text-natural-text hover:text-natural-gold mb-6">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para a loja
          </a>
          <div className="rounded-2xl border border-natural-border bg-white p-8">
            <h2 className="font-display text-lg font-bold">Portal Administrativo Beerlanda</h2>
            <p className="mt-2 text-sm text-natural-text">
              Entre com uma conta Google autorizada para gerenciar produtos, pedidos, clientes e avaliações da Beerlanda.
            </p>
            {loginError && <p className="mt-3 text-xs text-rose-600">{loginError}</p>}
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="mt-6 w-full rounded-lg bg-natural-gold px-6 py-2.5 text-sm font-bold text-white hover:bg-natural-gold/90 disabled:opacity-50"
            >
              {isLoggingIn ? "Entrando..." : "Entrar com o Google"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden w-56 shrink-0 border-r border-natural-border bg-white md:flex md:flex-col">
            <div className="p-5 border-b border-natural-border">
              <a href="/" className="inline-flex items-center gap-1.5 text-[11px] text-natural-text hover:text-natural-gold">
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para a loja
              </a>
              <h1 className="mt-2 font-display text-sm font-bold">Portal Beerlanda</h1>
            </div>

            <nav className="flex-1 p-3 space-y-1">
              {NAV.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                    section === id ? "bg-natural-gold text-white" : "text-natural-text hover:bg-natural-card"
                  }`}
                  id={`admin-nav-${id}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-natural-border">
              <p className="text-[11px] font-semibold truncate">{user.displayName}</p>
              <p className="text-[10px] text-natural-text truncate">{user.email}</p>
              <button
                onClick={handleLogout}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </div>
          </aside>

          {/* Conteúdo */}
          <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8">
            <div className="md:hidden mb-4 flex flex-wrap gap-2">
              {NAV.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    section === id ? "bg-natural-gold text-white" : "bg-white border border-natural-border text-natural-text"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <h2 className="font-display text-xl font-bold mb-5">{NAV.find((n) => n.id === section)?.label}</h2>

            {section === "dashboard" && <AdminDashboard token={token} />}
            {section === "analytics" && <AdminAnalytics token={token} />}
            {section === "clube" && <AdminClube token={token} />}
            {section === "products" && <AdminProducts token={token} />}
            {section === "orders" && <AdminOrders token={token} />}
            {section === "customers" && <AdminCustomers token={token} />}
            {section === "coupons" && <AdminCoupons token={token} />}
            {section === "reviews" && <AdminReviews token={token} />}
            {section === "messages" && <AdminMessages token={token} />}
          </main>
        </div>
      )}
    </div>
  );
}
