import { Order } from "../../src/types";

/**
 * Modelos de e-mail da Beerlanda.
 *
 * Tudo aqui é HTML de 2005 de propósito: tabelas, largura fixa, estilo inline.
 * Gmail, Outlook e os apps de celular descartam <style> no topo, não entendem
 * flex nem grid e ignoram boa parte do CSS moderno — o layout bonito do site
 * chegaria quebrado na caixa de entrada. Mudar isso para CSS atual quebra a
 * renderização em metade dos clientes de e-mail.
 */

const MARROM = "#4A3728";
const DOURADO = "#C9A227";
const CREME = "#FBF7F0";
const BORDA = "#E8DCC8";
const TEXTO = "#4A4036";
const VERDE = "#4F6F52";

const SITE = process.env.APP_URL || "https://beerlanda.com.br";
const CONTATO = process.env.CONTACT_EMAIL || "beerlandaprodutosartesanais@gmail.com";
const INSTAGRAM = "https://instagram.com/beerlandaprodutosartesanais";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const brl = (n: number) =>
  `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;

/** Só o primeiro nome: "Olá, Maria" soa melhor que o nome completo. */
export function primeiroNome(nome?: string): string {
  const first = (nome || "").trim().split(/\s+/)[0] || "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

interface LayoutOptions {
  /** Pré-cabeçalho: a linha de resumo que aparece na lista da caixa de entrada. */
  preheader: string;
  titulo: string;
  corpo: string;
  botao?: { texto: string; url: string };
  /** Link de descadastro — obrigatório em campanha, ausente em transacional. */
  unsubscribeUrl?: string;
}

function layout({ preheader, titulo, corpo, botao, unsubscribeUrl }: LayoutOptions): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(titulo)}</title>
</head>
<body style="margin:0;padding:0;background-color:${CREME};">
  <!-- Resumo da caixa de entrada: visível na lista, escondido ao abrir -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREME};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${BORDA};border-radius:12px;overflow:hidden;">

          <tr>
            <td align="center" style="background-color:${MARROM};padding:28px 24px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#ffffff;letter-spacing:.5px;">
                Beer<span style="color:${DOURADO};">landa</span>
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${DOURADO};padding-top:6px;">
                Produtos Artesanais
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <h1 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.3;color:${MARROM};font-weight:bold;">
                ${escapeHtml(titulo)}
              </h1>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${TEXTO};">
                ${corpo}
              </div>
            </td>
          </tr>

          ${botao ? `
          <tr>
            <td align="center" style="padding:12px 32px 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color:${DOURADO};border-radius:999px;">
                    <a href="${escapeHtml(botao.url)}" style="display:inline-block;padding:13px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">
                      ${escapeHtml(botao.texto)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : `<tr><td style="padding-bottom:20px;"></td></tr>`}

          <tr>
            <td style="padding:0 32px;">
              <div style="border-top:1px solid ${BORDA};"></div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:22px 32px 28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:#8C8378;">
              Sabonetes, bálsamos, velas e artesanato feitos à mão em Curitiba,<br>
              com mel, própolis e cera de abelha de verdade na composição.<br><br>
              <a href="${SITE}" style="color:${DOURADO};text-decoration:none;font-weight:bold;">beerlanda.com.br</a>
              &nbsp;·&nbsp;
              <a href="${INSTAGRAM}" style="color:${DOURADO};text-decoration:none;font-weight:bold;">Instagram</a>
              &nbsp;·&nbsp;
              <a href="mailto:${CONTATO}" style="color:${DOURADO};text-decoration:none;font-weight:bold;">Fale com a gente</a>
              ${unsubscribeUrl ? `<br><br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#A89F94;text-decoration:underline;">Não quero mais receber estes e-mails</a>` : ""}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Tabela com os itens do pedido, usada nos e-mails transacionais. */
function tabelaItens(order: Order): string {
  const linhas = (order.orderItems || [])
    .map(
      (i) => `
    <tr>
      <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${TEXTO};border-bottom:1px solid ${BORDA};">
        ${escapeHtml(i.name)}<br>
        <span style="font-size:11px;color:#8C8378;">${i.quantity} × ${brl(i.unitPrice)}</span>
      </td>
      <td align="right" style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MARROM};font-weight:bold;border-bottom:1px solid ${BORDA};white-space:nowrap;">
        ${brl(i.quantity * i.unitPrice)}
      </td>
    </tr>`
    )
    .join("");

  const linha = (rotulo: string, valor: string, destaque = false) => `
    <tr>
      <td style="padding:${destaque ? "12px 0 0 0" : "6px 0 0 0"};font-family:Arial,Helvetica,sans-serif;font-size:${destaque ? "15px" : "12px"};color:${destaque ? MARROM : "#8C8378"};font-weight:${destaque ? "bold" : "normal"};">${rotulo}</td>
      <td align="right" style="padding:${destaque ? "12px 0 0 0" : "6px 0 0 0"};font-family:Arial,Helvetica,sans-serif;font-size:${destaque ? "15px" : "12px"};color:${destaque ? DOURADO : "#8C8378"};font-weight:bold;white-space:nowrap;">${valor}</td>
    </tr>`;

  const entrega =
    order.shippingService === "RETIRADA" ? "Retirada em mãos" :
    order.shippingService === "A_COMBINAR" ? "Frete a combinar" :
    order.shippingService || "";

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;background-color:${CREME};border:1px solid ${BORDA};border-radius:8px;">
    <tr><td style="padding:16px 18px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8C8378;padding-bottom:8px;">
        Pedido ${escapeHtml(order.id)}
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${linhas}
        ${order.subtotal != null ? linha("Subtotal", brl(order.subtotal)) : ""}
        ${order.discount ? linha(`Desconto${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}`, `− ${brl(order.discount)}`) : ""}
        ${linha(entrega ? `Entrega · ${escapeHtml(entrega)}` : "Entrega", order.shippingCost ? brl(order.shippingCost) : "Grátis")}
        ${linha("Total", brl(order.total), true)}
      </table>
    </td></tr>
  </table>`;
}

const p = (texto: string) =>
  `<p style="margin:0 0 14px 0;">${texto}</p>`;

// ---------------------------------------------------------------------------
// TRANSACIONAIS
// ---------------------------------------------------------------------------

export function pedidoRecebido(order: Order, paymentUrl?: string) {
  const nome = primeiroNome(order.clientName);
  return {
    subject: `Recebemos seu pedido ${order.id} 🐝`,
    html: layout({
      preheader: `Falta só o pagamento para separarmos seu pedido.`,
      titulo: `${nome ? `${escapeHtml(nome)}, s` : "S"}eu pedido está reservado`,
      corpo:
        p("Anotamos tudo aqui no ateliê. Assim que o pagamento for confirmado, começamos a separar.") +
        tabelaItens(order) +
        p("Se o pagamento não for concluído, os itens voltam para a loja em algumas horas — trabalhamos com lotes pequenos e poucas unidades de cada peça."),
      botao: paymentUrl ? { texto: "Concluir o pagamento", url: paymentUrl } : undefined
    })
  };
}

export function pagamentoAprovado(order: Order) {
  const nome = primeiroNome(order.clientName);
  const retirada = order.shippingService === "RETIRADA";
  return {
    subject: `Pagamento confirmado — pedido ${order.id}`,
    html: layout({
      preheader: retirada
        ? "Vamos combinar a retirada pelo WhatsApp."
        : "Já estamos separando e embalando seu pedido.",
      titulo: `Pagamento confirmado, ${escapeHtml(nome) || "obrigada"}! 🎉`,
      corpo:
        p("Deu tudo certo com o pagamento. Agora é com a gente.") +
        tabelaItens(order) +
        (retirada
          ? p(`Como você escolheu <strong>retirar em mãos</strong>, vamos entrar em contato pelo WhatsApp do telefone informado para combinar dia e horário.`)
          : p("Vamos separar, embalar e postar nos próximos dias úteis. Você recebe o código de rastreio por aqui assim que o pacote sair.")) +
        p("Qualquer dúvida é só responder este e-mail — ele chega direto pra gente.")
    })
  };
}

export function pagamentoNaoConcluido(order: Order, motivo: "recusado" | "cancelado" | "reembolsado") {
  const nome = primeiroNome(order.clientName);
  const titulos = {
    recusado: "O pagamento não foi aprovado",
    cancelado: "Seu pedido foi cancelado",
    reembolsado: "Seu reembolso foi processado"
  };
  const textos = {
    recusado:
      p("O Mercado Pago não aprovou o pagamento do pedido abaixo. Isso costuma ser limite, dados do cartão ou uma trava do banco — nada que não dê pra resolver.") +
      p("Os itens continuam na loja. Se ainda quiser, é só refazer o pedido ou tentar com outro meio de pagamento."),
    cancelado:
      p("O pedido abaixo foi cancelado e nada foi cobrado.") +
      p("Se foi engano ou se mudou de ideia, é só fazer um novo pedido no site — ou responder este e-mail que a gente resolve junto."),
    reembolsado:
      p("O reembolso do pedido abaixo foi processado. O valor volta pro mesmo meio de pagamento usado na compra.") +
      p("Dependendo do banco, pode levar alguns dias úteis para aparecer na fatura ou na conta.")
  };
  return {
    subject: `${titulos[motivo]} — pedido ${order.id}`,
    html: layout({
      preheader: titulos[motivo],
      titulo: `${nome ? `${escapeHtml(nome)}, ` : ""}${titulos[motivo].toLowerCase()}`,
      corpo: textos[motivo] + tabelaItens(order),
      botao: motivo !== "reembolsado" ? { texto: "Voltar para a loja", url: SITE } : undefined
    })
  };
}

export function pedidoPostado(order: Order) {
  const nome = primeiroNome(order.clientName);
  const rastreio = order.trackingCode?.trim();
  return {
    subject: `Seu pedido ${order.id} saiu para entrega 📦`,
    html: layout({
      preheader: rastreio ? `Código de rastreio: ${rastreio}` : "Seu pedido foi postado.",
      titulo: `${escapeHtml(nome) || "Olá"}, seu pedido está a caminho`,
      corpo:
        p("Embalado com cuidado e já postado. Agora é só esperar.") +
        (rastreio
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;background-color:${CREME};border:1px dashed ${DOURADO};border-radius:8px;">
               <tr><td align="center" style="padding:16px;">
                 <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8C8378;">Código de rastreio</div>
                 <div style="font-family:'Courier New',monospace;font-size:19px;font-weight:bold;color:${MARROM};padding-top:6px;letter-spacing:1px;">${escapeHtml(rastreio)}</div>
                 <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8C8378;padding-top:6px;">${escapeHtml(order.shippingService || "")}</div>
               </td></tr>
             </table>`
          : "") +
        p("O rastreio costuma levar algumas horas para aparecer no site da transportadora depois da postagem.") +
        tabelaItens(order),
      botao: rastreio
        ? { texto: "Rastrear encomenda", url: `https://www.linkcorreios.com.br/${encodeURIComponent(rastreio)}` }
        : undefined
    })
  };
}

export function retiradaPronta(order: Order) {
  const nome = primeiroNome(order.clientName);
  return {
    subject: `Seu pedido ${order.id} está pronto para retirada`,
    html: layout({
      preheader: "Pode vir buscar — é só combinar o horário.",
      titulo: `${escapeHtml(nome) || "Olá"}, seu pedido está pronto`,
      corpo:
        p("Separado e embalado, esperando você.") +
        tabelaItens(order) +
        p("Responda este e-mail ou chame no WhatsApp para combinarmos o melhor dia e horário.")
    })
  };
}

export function carrinhoAbandonado(order: Order, paymentUrl?: string) {
  const nome = primeiroNome(order.clientName);
  return {
    subject: `${nome ? `${nome}, s` : "S"}eu pedido ainda está esperando 🐝`,
    html: layout({
      preheader: "O pagamento não foi concluído — os itens ainda estão guardados.",
      titulo: "Guardamos seu pedido",
      corpo:
        p("Vimos que o pagamento não chegou a ser concluído. Pode ter sido o Pix que expirou, a internet que caiu ou simplesmente a vida acontecendo.") +
        tabelaItens(order) +
        p("Os itens ainda estão separados, mas trabalhamos com poucas unidades de cada peça e não dá para segurar por muito tempo.") +
        p("Se mudou de ideia, tudo bem também — e se algo deu errado no checkout, responde aqui contando o que aconteceu. Ajuda a gente a melhorar."),
      botao: paymentUrl ? { texto: "Concluir o pagamento", url: paymentUrl } : { texto: "Voltar para a loja", url: SITE }
    })
  };
}

// ---------------------------------------------------------------------------
// CAMPANHA E RESPOSTA MANUAL
// ---------------------------------------------------------------------------

export interface CampanhaInput {
  titulo: string;
  /** Texto em parágrafos separados por linha em branco; aceita **negrito**. */
  corpo: string;
  botaoTexto?: string;
  botaoUrl?: string;
  nomeDestinatario?: string;
  unsubscribeUrl?: string;
}

/** Converte o texto simples digitado no painel em parágrafos HTML. */
function textoParaHtml(texto: string, nome?: string): string {
  return texto
    .replace(/\{nome\}/g, escapeHtml(primeiroNome(nome)) || "tudo bem")
    .split(/\n{2,}/)
    .map((bloco) => {
      const comQuebras = escapeHtml(bloco.trim())
        .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${MARROM};">$1</strong>`)
        .replace(/\n/g, "<br>");
      return comQuebras ? p(comQuebras) : "";
    })
    .join("");
}

export function campanha(input: CampanhaInput) {
  return {
    subject: input.titulo,
    html: layout({
      preheader: input.titulo,
      titulo: input.titulo,
      corpo: textoParaHtml(input.corpo, input.nomeDestinatario),
      botao: input.botaoUrl && input.botaoTexto
        ? { texto: input.botaoTexto, url: input.botaoUrl }
        : undefined,
      unsubscribeUrl: input.unsubscribeUrl
    })
  };
}

/**
 * Resposta manual a uma mensagem do formulário de contato: mesmo papel de
 * carta da loja, sem botão e sem descadastro — é conversa, não campanha.
 */
export function respostaCliente(input: { nome?: string; assunto: string; mensagem: string; mensagemOriginal?: string }) {
  return {
    subject: input.assunto,
    html: layout({
      preheader: input.assunto,
      titulo: input.nome ? `Oi, ${escapeHtml(primeiroNome(input.nome))}!` : "Oi!",
      corpo:
        textoParaHtml(input.mensagem, input.nome) +
        (input.mensagemOriginal
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
               <tr><td style="padding:14px 16px;background-color:${CREME};border-left:3px solid ${VERDE};border-radius:4px;">
                 <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8C8378;padding-bottom:6px;">Sua mensagem</div>
                 <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8C8378;font-style:italic;">${escapeHtml(input.mensagemOriginal)}</div>
               </td></tr>
             </table>`
          : "")
    })
  };
}
