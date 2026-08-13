import { useEffect, useState } from "react";
import { RefreshCw, Mail, MailOpen } from "lucide-react";
import { ContactMessage } from "../../types";
import { adminFetch } from "../../lib/adminApi";

interface AdminMessagesProps {
  token: string;
}

export default function AdminMessages({ token }: AdminMessagesProps) {
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    adminFetch<ContactMessage[]>("/api/admin/messages", token)
      .then(setMessages)
      .catch((e) => setError(e.message));
  };

  useEffect(load, [token]);

  const handleMarkRead = async (id: string) => {
    try {
      await adminFetch(`/api/admin/messages/${id}/read`, token, { method: "PUT" });
      setMessages((prev) => prev?.map((m) => (m.id === id ? { ...m, read: true } : m)) || null);
    } catch {
      // silencioso — não é crítico se falhar
    }
  };

  if (error) return <p className="text-xs text-rose-600">{error}</p>;
  if (!messages) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-natural-border bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-natural-border">
        <h3 className="font-display text-sm font-bold text-natural-darkbrown">Mensagens ({messages.length})</h3>
      </div>
      {messages.length === 0 ? (
        <p className="text-center text-xs text-natural-text py-10">Nenhuma mensagem ainda.</p>
      ) : (
        <div className="divide-y divide-natural-border">
          {messages.map((m) => (
            <div
              key={m.id}
              onClick={() => !m.read && handleMarkRead(m.id)}
              className={`p-4 flex gap-3 cursor-pointer ${m.read ? "" : "bg-natural-gold/5"}`}
              id={`admin-message-${m.id}`}
            >
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.read ? "bg-gray-100 text-gray-400" : "bg-natural-gold/10 text-natural-gold"}`}>
                {m.read ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-natural-darkbrown">{m.name}</span>
                  <span className="text-[10px] text-natural-text/50 whitespace-nowrap">
                    {m.createdAt ? new Date(m.createdAt).toLocaleString("pt-BR") : ""}
                  </span>
                </div>
                <p className="text-[10px] text-natural-text/60">{m.email}</p>
                <p className="mt-1.5 text-xs text-natural-text/90 leading-relaxed">{m.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
