// Avisa o servidor que alguém entrou na loja, uma vez por sessão do navegador.
//
// É isso que alimenta o número de acessos no painel. O GA4 continua no site e
// dá muito mais detalhe, mas não é legível de dentro do admin — e saber se
// "vendeu pouco" foi pouca visita ou visita que não converteu é a diferença
// entre mexer na divulgação e mexer na loja.
//
// Conta sessão, não clique: navegar entre páginas não soma visita. A marca fica
// em sessionStorage, então fechar a aba e voltar amanhã conta de novo — que é o
// comportamento certo pra "quantas pessoas entraram".

const CHAVE = "bl_visita_registrada";

export function trackVisit(): void {
  try {
    if (sessionStorage.getItem(CHAVE)) return;
    // Marca ANTES de enviar: se a requisição falhar, a gente perde uma visita
    // na contagem em vez de insistir e gerar uma fila de tentativas.
    sessionStorage.setItem(CHAVE, "1");
  } catch {
    // Navegador em modo privado ou com storage bloqueado: segue sem contar,
    // porque sem a marca cada navegação viraria uma visita nova.
    return;
  }

  // keepalive para a contagem sobreviver se a pessoa sair da página na hora.
  fetch("/api/track/visit", { method: "POST", keepalive: true }).catch(() => {
    // Métrica não pode atrapalhar a loja: falha silenciosa, de propósito.
  });
}
