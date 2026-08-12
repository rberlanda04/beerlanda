import { useState, useEffect } from "react";
import { 
  X, 
  RefreshCw, 
  FileSpreadsheet, 
  FolderOpen, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  ArrowRight,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { googleSignIn, initAuth, logout, getAccessToken } from "../lib/googleAuth";
import { User } from "firebase/auth";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshProducts: () => void;
  appConfig?: {
    whatsappPhone: string;
    contactEmail: string;
    googleSheetId: string;
    googleDriveFolderId: string;
  };
}

export default function AdminPanel({ isOpen, onClose, onRefreshProducts, appConfig }: AdminPanelProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [renameReport, setRenameReport] = useState<any[] | null>(null);

  // Inicializar o estado de autenticação do Firebase
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, cachedToken) => {
        setUser(user);
        setToken(cachedToken);
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
    setIsActionLoading(true);
    setActionError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setActionSuccess("Conectado com sucesso ao Google Workspace!");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setActionError("Falha na autenticação com o Google. Certifique-se de aceitar as permissões.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsActionLoading(true);
    try {
      await logout();
      setUser(null);
      setToken(null);
      setRenameReport(null);
      setActionSuccess("Desconectado com sucesso.");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRenameFiles = async () => {
    if (!token) return;
    setIsActionLoading(true);
    setActionSuccess(null);
    setActionError(null);
    setRenameReport(null);

    try {
      const res = await fetch("/api/admin/rename-files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccess(`Fotos no Google Drive organizadas! ${data.renamedCount} arquivos foram renomeados para corresponder perfeitamente aos produtos.`);
        setRenameReport(data.report);
      } else {
        setActionError(data.error || "Ocorreu um erro ao renomear arquivos no Drive.");
      }
    } catch (err) {
      setActionError("Erro de conexão ao servidor.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSyncSheets = async () => {
    if (!token) return;
    setIsActionLoading(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const res = await fetch("/api/admin/sync-sheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccess("Sincronização completa! As abas de Produtos, Cupons e Avaliações foram criadas e atualizadas no seu Google Sheets.");
        onRefreshProducts(); // Recarrega os produtos na home
      } else {
        setActionError(data.error || "Ocorreu um erro ao atualizar a planilha do Google.");
      }
    } catch (err) {
      setActionError("Erro de conexão ao servidor.");
    } finally {
      setIsActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" id="admin-panel-overlay">
      {/* Background Blur */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-natural-darkbrown/60 backdrop-blur-md"
      />

      {/* Modal Card */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-natural-border flex flex-col max-h-[90vh]"
        id="admin-panel-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-natural-border px-6 py-5 bg-natural-card">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍯</span>
            <div>
              <h2 className="font-display text-xl font-bold text-natural-darkbrown">Painel de Integração Beerlanda</h2>
              <p className="text-xs text-natural-text">Gerenciamento de Planilhas e Fotos do Drive</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-1.5 text-natural-text hover:bg-natural-border transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status de Alerta/Info */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex gap-3 text-amber-900 text-xs leading-relaxed">
            <Info className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <span className="font-bold">Como funciona a integração:</span> 
              <p className="mt-1">
                Este painel permite organizar seus arquivos de fotos no Google Drive e alimentar a sua planilha de produtos no Google Sheets de forma 100% automatizada. O sistema lerá os arquivos, associará ao catálogo e preencherá as colunas de preços, descrição e URLs das fotos.
              </p>
            </div>
          </div>

          {isLoadingAuth ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-natural-gold" />
              <p className="text-xs text-natural-text mt-3">Verificando conexão com o Google...</p>
            </div>
          ) : !user ? (
            /* Tela de Login */
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-6">
              <div className="h-16 w-16 rounded-full bg-natural-gold/10 flex items-center justify-center text-3xl">
                🔑
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="font-display text-lg font-bold text-natural-darkbrown">Autenticação Necessária</h3>
                <p className="text-sm text-natural-text">
                  Para que o site consiga ler suas fotos do Drive e gravar na sua planilha, precisamos que você entre com sua conta Google com permissões de editor.
                </p>
              </div>

              {/* Botão GSI */}
              <button 
                onClick={handleLogin}
                disabled={isActionLoading}
                className="gsi-material-button w-full max-w-xs flex items-center justify-center py-2.5 px-4 bg-white border border-gray-300 rounded-lg hover:shadow-md hover:bg-gray-50 transition-all duration-200 font-semibold text-gray-700 text-sm disabled:opacity-50"
              >
                <div className="gsi-material-button-content-wrapper flex items-center gap-3">
                  <div className="gsi-material-button-icon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5 block">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents font-sans">Entrar com o Google</span>
                </div>
              </button>
            </div>
          ) : (
            /* Tela de Ações de Administração */
            <div className="space-y-6">
              {/* Perfil do Admin Conectado */}
              <div className="flex items-center justify-between rounded-xl border border-natural-border bg-natural-card p-4">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || "Admin"} className="h-10 w-10 rounded-full border border-natural-gold" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-natural-gold text-white flex items-center justify-center font-bold">
                      {user.displayName?.charAt(0) || "A"}
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-xs text-natural-darkbrown">{user.displayName || "Administrador"}</h4>
                    <p className="text-[10px] text-natural-text">{user.email}</p>
                  </div>
                </div>
                
                <button 
                  onClick={handleLogout}
                  disabled={isActionLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair
                </button>
              </div>

              {/* Grid de Configurações das Fontes de Dados */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-natural-border p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-natural-darkbrown font-bold text-xs">
                    <FolderOpen className="h-4 w-4 text-amber-500" />
                    Google Drive Fotos
                  </div>
                  <p className="text-[10px] text-natural-text truncate" title={appConfig?.googleDriveFolderId || "Não configurado"}>
                    ID: {appConfig?.googleDriveFolderId || "Não configurado"}
                  </p>
                  <p className="text-[9px] text-green-600 font-bold flex items-center gap-1">● Pasta de Origem Ativa</p>
                </div>

                <div className="rounded-xl border border-natural-border p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-natural-darkbrown font-bold text-xs">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    Google Sheets Destino
                  </div>
                  <p className="text-[10px] text-natural-text truncate" title={appConfig?.googleSheetId || "Não configurado"}>
                    ID: {appConfig?.googleSheetId || "Não configurado"}
                  </p>
                  <p className="text-[9px] text-green-600 font-bold flex items-center gap-1">● Conexão de Escrita Pronta</p>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <button
                  onClick={handleRenameFiles}
                  disabled={isActionLoading}
                  className="flex-1 flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50/30 text-center transition-all disabled:opacity-50 group"
                >
                  <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform">
                    🖼️
                  </div>
                  <h4 className="font-bold text-xs text-natural-darkbrown mt-4">1. Organizar & Renomear Drive</h4>
                  <p className="text-[10px] text-natural-text mt-1 max-w-[200px]">
                    Renomeia e padroniza as fotos no seu Drive para bater com a lista de produtos.
                  </p>
                </button>

                <button
                  onClick={handleSyncSheets}
                  disabled={isActionLoading}
                  className="flex-1 flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-green-300 hover:border-green-500 hover:bg-green-50/30 text-center transition-all disabled:opacity-50 group"
                >
                  <div className="h-12 w-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xl font-bold group-hover:scale-110 transition-transform">
                    📊
                  </div>
                  <h4 className="font-bold text-xs text-natural-darkbrown mt-4">2. Sincronizar com Planilha</h4>
                  <p className="text-[10px] text-natural-text mt-1 max-w-[200px]">
                    Cria as abas e grava todos os 44 produtos, preços, estoque e fotos diretamente no Sheets.
                  </p>
                </button>
              </div>

              {/* Estado de carregamento das ações */}
              {isActionLoading && (
                <div className="flex items-center justify-center gap-2 text-natural-gold text-xs font-semibold py-4">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processando requisição segura... Aguarde.
                </div>
              )}

              {/* Feedback de Sucesso */}
              {actionSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-green-50 border border-green-200 p-4 flex gap-3 text-green-900 text-xs"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  <div>
                    <h5 className="font-bold">Ação concluída com sucesso!</h5>
                    <p className="mt-1">{actionSuccess}</p>
                  </div>
                </motion.div>
              )}

              {/* Relatório de Renomeação */}
              {renameReport && renameReport.length > 0 && (
                <div className="rounded-xl border border-natural-border p-4 bg-natural-card space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-xs text-natural-darkbrown">Relatório de Correspondência (Drive)</h5>
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                      {renameReport.filter(r => r.to).length} Renomeados
                    </span>
                  </div>
                  <div className="max-h-[150px] overflow-y-auto border border-natural-border rounded-lg bg-white divide-y divide-natural-border text-[10px]">
                    {renameReport.map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between gap-4">
                        <span className="font-medium text-natural-darkbrown truncate max-w-[180px]">{item.product}</span>
                        {item.to ? (
                          <span className="text-amber-600 flex items-center gap-1">
                            {item.from} <ArrowRight className="h-3 w-3" /> {item.to}
                          </span>
                        ) : item.status === "Já renomeado" ? (
                          <span className="text-green-600 font-medium">✓ Perfeito (Drive OK)</span>
                        ) : (
                          <span className="text-red-500 font-medium">⚠️ Foto não localizada</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback de Erro */}
              {actionError && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-red-50 border border-red-200 p-4 flex gap-3 text-red-900 text-xs"
                >
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <h5 className="font-bold">Erro na operação</h5>
                    <p className="mt-1">{actionError}</p>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-natural-border px-6 py-4 flex items-center justify-between text-[10px] text-natural-text bg-natural-card">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-natural-organic" />
            Conexão Criptografada SSL com Google APIs
          </span>
          <span>Versão 2.4.0</span>
        </div>
      </motion.div>
    </div>
  );
}
