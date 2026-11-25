import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envio de e-mail da loja, por SMTP do Gmail.
 *
 * Fica dormente enquanto SMTP_PASS não estiver configurado: cada chamada
 * registra no log e devolve `false`, sem lançar erro. É o que permite subir
 * este código antes de existir a senha de app — nenhum fluxo de pedido quebra
 * por causa de e-mail, que é acessório ao pagamento.
 *
 * O Gmail gratuito entrega cerca de 500 destinatários por dia e não foi feito
 * para disparo em massa. Para os e-mails de pedido isso sobra; para campanha,
 * `sendBulk` respeita um intervalo entre mensagens e um teto diário, porque
 * estourar o limite derruba o envio do dia inteiro, inclusive o transacional.
 */

const FROM_NAME = "Beerlanda";
const FROM_EMAIL = process.env.SMTP_USER || process.env.CONTACT_EMAIL || "beerlandaprodutosartesanais@gmail.com";

// Intervalo entre mensagens numa campanha. Disparar em rajada é o que mais
// rápido faz o Gmail bloquear a conta por uso atípico.
const BULK_DELAY_MS = Number(process.env.EMAIL_BULK_DELAY_MS || 1500);
const BULK_DAILY_CAP = Number(process.env.EMAIL_BULK_DAILY_CAP || 400);

let transporter: Transporter | null = null;
let transporterChecked = false;

function getTransporter(): Transporter | null {
  if (transporterChecked) return transporter;
  transporterChecked = true;

  const pass = process.env.SMTP_PASS;
  if (!pass) {
    console.warn("[E-mail] SMTP_PASS não configurado — nenhum e-mail será enviado.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: FROM_EMAIL, pass },
    // Uma conexão reaproveitada para a fila da campanha, em vez de abrir e
    // fechar a cada mensagem.
    pool: true,
    maxConnections: 1,
    maxMessages: 50
  });
  return transporter;
}

export function isEmailConfigured(): boolean {
  return !!process.env.SMTP_PASS;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Alternativa em texto puro. Sem ela, filtros de spam penalizam a mensagem. */
  text?: string;
  replyTo?: string;
}

/** Remove as tags para gerar o texto puro quando o chamador não fornece um. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) return false;

  const to = (input.to || "").trim();
  if (!to || !/\S+@\S+\.\S+/.test(to)) {
    console.warn(`[E-mail] Destinatário inválido, ignorado: "${input.to}"`);
    return false;
  }

  try {
    await tx.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text || htmlToText(input.html),
      replyTo: input.replyTo || FROM_EMAIL
    });
    console.log(`[E-mail] Enviado para ${to}: "${input.subject}"`);
    return true;
  } catch (error: any) {
    // Falha de e-mail nunca derruba o fluxo que o chamou. Pedido pago continua
    // pago mesmo que a confirmação não saia.
    console.error(`[E-mail] Falha ao enviar para ${to}:`, error.message);
    return false;
  }
}

export interface BulkRecipient {
  email: string;
  /** Usado para personalizar o assunto e o corpo com o primeiro nome. */
  name?: string;
}

export interface BulkResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Envio de campanha, um a um e com intervalo.
 *
 * `render` recebe cada destinatário e devolve assunto e HTML já
 * personalizados, para que o link de descadastro e o nome saiam certos
 * por pessoa.
 */
export async function sendBulk(
  recipients: BulkRecipient[],
  render: (r: BulkRecipient) => { subject: string; html: string }
): Promise<BulkResult> {
  const result: BulkResult = { sent: 0, failed: 0, skipped: 0, errors: [] };
  if (!getTransporter()) {
    result.skipped = recipients.length;
    result.errors.push("SMTP não configurado.");
    return result;
  }

  // Duplicata na lista é comum (mesma pessoa com dois pedidos) e conta duas
  // vezes contra o limite diário do Gmail.
  const seen = new Set<string>();
  const unique = recipients.filter((r) => {
    const key = (r.email || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const batch = unique.slice(0, BULK_DAILY_CAP);
  result.skipped = unique.length - batch.length;
  if (result.skipped > 0) {
    result.errors.push(
      `${result.skipped} destinatário(s) ficaram de fora: o teto por disparo é ${BULK_DAILY_CAP}, para não estourar o limite diário do Gmail.`
    );
  }

  for (const r of batch) {
    const { subject, html } = render(r);
    const ok = await sendEmail({ to: r.email, subject, html });
    if (ok) result.sent++;
    else {
      result.failed++;
      if (result.errors.length < 10) result.errors.push(`Falhou: ${r.email}`);
    }
    if (BULK_DELAY_MS > 0) await new Promise((res) => setTimeout(res, BULK_DELAY_MS));
  }

  return result;
}

/** Testa a conexão SMTP sem enviar nada — usado pelo painel de integrações. */
export async function verifyEmailConnection(): Promise<{ ok: boolean; message: string }> {
  const tx = getTransporter();
  if (!tx) return { ok: false, message: "SMTP_PASS não configurado — nenhum e-mail sai da loja." };
  try {
    await tx.verify();
    return { ok: true, message: `Conectado ao SMTP como ${FROM_EMAIL}.` };
  } catch (error: any) {
    return { ok: false, message: `Não foi possível conectar: ${error.message}` };
  }
}
