// -------------------------------------------------------------
// AUTENTICAÇÃO ADMIN (via Google OAuth)
// -------------------------------------------------------------
// Read lazily (not as a module-level constant): server.ts's static imports
// resolve this module before its own dotenv.config() call runs, so
// process.env.ADMIN_EMAILS would otherwise still be undefined here.
function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Resolves the Google account email behind an OAuth access token by asking
// Google directly, so the server never has to trust a client-supplied identity.
async function getVerifiedEmailFromToken(token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const data = await res.json();
    // Google's tokeninfo endpoint names this field "verified_email" for OAuth
    // access tokens (what we get from Firebase's GoogleAuthProvider credential)
    // vs. "email_verified" for ID tokens — accept either so we don't silently
    // reject a legitimately verified account.
    const verified = data.verified_email ?? data.email_verified;
    const isVerified = verified === true || verified === "true";
    if (!data.email || !isVerified) return null;
    return String(data.email).toLowerCase();
  } catch (error) {
    console.error("[Auth] Erro ao verificar token junto ao Google:", error);
    return null;
  }
}

async function isAuthorizedAdmin(token: string): Promise<boolean> {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    console.warn("[Auth] ADMIN_EMAILS não configurado — nenhum admin autorizado.");
    return false;
  }
  const email = await getVerifiedEmailFromToken(token);
  return !!email && adminEmails.includes(email);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export { isAuthorizedAdmin, slugify };
