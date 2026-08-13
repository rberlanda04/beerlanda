export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function adminFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeader(token), ...(init?.headers || {}) }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ocorreu um erro.");
  return data as T;
}
