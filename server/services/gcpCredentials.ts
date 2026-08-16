// Credenciais do Google Cloud: no Cloud Run, o próprio ambiente já injeta
// credenciais (Application Default Credentials) sem precisar de nada aqui.
// Em plataformas sem metadata server do GCP (Vercel, Render etc.), não existe
// ADC — por isso aceitamos a chave da service account como variável de
// ambiente (JSON completo, colado como veio do console do GCP).
function getServiceAccountCredentials(): Record<string, any> | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("[GCP] FIREBASE_SERVICE_ACCOUNT_KEY presente mas não é um JSON válido:", error);
    return undefined;
  }
}

export { getServiceAccountCredentials };
