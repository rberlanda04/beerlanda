/**
 * Consulta de CEP para o auto-preenchimento do endereço no checkout.
 *
 * Passa pelo nosso servidor em vez de o navegador chamar o ViaCEP direto por
 * dois motivos: o IP da cliente não vai para um terceiro, e dá para tentar um
 * segundo provedor quando o primeiro cai — o ViaCEP é gratuito e sem SLA, e
 * uma consulta falhando no meio do checkout custa venda.
 */

export interface CepLookup {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

// Endereço de CEP não muda. Guardar em memória evita bater no provedor a cada
// tecla corrigida e deixa a segunda tentativa da mesma cliente instantânea.
const cache = new Map<string, CepLookup>();
const CACHE_MAX = 500;

const TIMEOUT_MS = 4000;

async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": `Beerlanda (${process.env.CONTACT_EMAIL || "contato@beerlanda.com.br"})` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function viaCep(cep: string): Promise<CepLookup | null> {
  const data = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`);
  // O ViaCEP responde 200 com { erro: true } quando o CEP não existe.
  if (!data || data.erro || !data.uf) return null;
  return {
    cep,
    street: data.logradouro || "",
    neighborhood: data.bairro || "",
    city: data.localidade || "",
    state: data.uf || ""
  };
}

async function brasilApi(cep: string): Promise<CepLookup | null> {
  const data = await fetchJson(`https://brasilapi.com.br/api/cep/v1/${cep}`);
  if (!data || !data.state) return null;
  return {
    cep,
    street: data.street || "",
    neighborhood: data.neighborhood || "",
    city: data.city || "",
    state: data.state || ""
  };
}

export async function lookupCep(rawCep: string): Promise<CepLookup | null> {
  const cep = String(rawCep || "").replace(/\D/g, "");
  if (cep.length !== 8) return null;

  const cached = cache.get(cep);
  if (cached) return cached;

  const found = (await viaCep(cep)) || (await brasilApi(cep));
  if (!found) return null;

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(cep, found);
  return found;
}
