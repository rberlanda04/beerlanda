import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Customer } from "../../types";
import { adminFetch } from "../../lib/adminApi";

interface AdminCustomersProps {
  token: string;
}

export default function AdminCustomers({ token }: AdminCustomersProps) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<Customer[]>("/api/admin/customers", token)
      .then(setCustomers)
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) return <p className="text-xs text-rose-600">{error}</p>;
  if (!customers) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-natural-gold" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-natural-border bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-natural-border">
        <h3 className="font-display text-sm font-bold text-natural-darkbrown">Clientes ({customers.length})</h3>
      </div>
      {customers.length === 0 ? (
        <p className="text-center text-xs text-natural-text py-10">Nenhum cliente ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-natural-card text-natural-text uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">E-mail</th>
                <th className="text-left p-3">Telefone</th>
                <th className="text-left p-3">Endereço</th>
                <th className="text-left p-3">Último pedido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-natural-border">
              {customers.map((c) => (
                <tr key={c.phone || c.email}>
                  <td className="p-3 font-bold">{c.name}</td>
                  <td className="p-3">{c.email}</td>
                  <td className="p-3">{c.phone}</td>
                  <td className="p-3 max-w-[260px] truncate" title={c.address}>{c.address}</td>
                  <td className="p-3 whitespace-nowrap">{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("pt-BR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
