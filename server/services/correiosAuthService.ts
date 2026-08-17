// Renovação automática do token Bearer da API dos Correios.
//
// O token dura ~24h e não existia rotina de renovação — por isso o frete
// parava de funcionar sempre que alguém esquecia de colar um token novo no
// .env. Esta função mantém um token em cache na memória do processo e busca
// um novo na API dos Correios pouco antes dele expirar de verdade.

interface CachedToken {
  value: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

async function fetchNewToken(): Promise<CachedToken> {
  const user = process.env.CORREIOS_USER_ID;
  const accessCode = process.env.CORREIOS_ACCESS_CODE;

  if (!user || !accessCode) {
    throw new Error(
      "CORREIOS_USER_ID / CORREIOS_ACCESS_CODE não configurados — não é possível renovar o token dos Correios automaticamente."
    );
  }

  const basicAuth = Buffer.from(`${user}:${accessCode}`).toString("base64");

  let response: Response;
  try {
    response = await fetch("https://api.correios.com.br/token/v1/autentica", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json"
      }
    });
  } catch (error: any) {
    throw new Error(`Falha de conexão ao autenticar na API dos Correios: ${error.message}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Falha ao autenticar na API dos Correios (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  if (!data.token) {
    throw new Error("Resposta de autenticação dos Correios não trouxe um token.");
  }

  // Renova 5 minutos antes do prazo real pra nunca servir uma cotação de
  // frete com um token que expira no meio da chamada.
  const expiresAt = data.expiraEm ? new Date(data.expiraEm).getTime() : Date.now() + 23 * 60 * 60 * 1000;
  return { value: data.token, expiresAt: expiresAt - 5 * 60 * 1000 };
}

async function getValidCorreiosToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
  cachedToken = await fetchNewToken();
  return cachedToken.value;
}

export { getValidCorreiosToken };
