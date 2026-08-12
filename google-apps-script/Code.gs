/**
 * Beerlanda - Google Apps Script
 * Integração com Google Drive e painel de administração da planilha
 */

const FOLDER_ID = "1kcEmvc4Q6fJZkU1PCYx5n09nvJEdTSHO";

/**
 * Cria um menu customizado na interface do Google Sheets ao abrir.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🍺 Beerlanda Admin')
    .addItem('Criar Planilha Principal', 'createMainSpreadsheet')
    .addItem('Sincronizar Fotos do Drive', 'syncPhotosFromDrive')
    .addItem('Limpar Coluna de Fotos', 'clearPhotoColumn')
    .addToUi();
}

/**
 * Lista todos os arquivos da pasta do Google Drive especificada
 */
function getFilesFromFolder() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files = folder.getFiles();
  const fileList = [];
  
  while (files.hasNext()) {
    const file = files.next();
    fileList.push({
      id: file.getId(),
      name: file.getName(),
      url: `https://drive.google.com/uc?export=view&id=${file.getId()}`
    });
  }
  return fileList;
}

/**
 * Função utilitária para limpar strings (remover acentos e especiais) para correspondência
 */
function cleanString(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Encontra a URL da imagem correspondente ao nome do produto
 */
function findImageForProduct(productName, driveFiles) {
  const cleanedName = cleanString(productName);
  
  // 1. Tenta correspondência exata
  for (let file of driveFiles) {
    const cleanedFileName = cleanString(file.name.replace(/\.[^/.]+$/, ""));
    if (cleanedFileName === cleanedName) {
      return file.url;
    }
  }

  // 2. Tenta correspondência parcial
  for (let file of driveFiles) {
    const cleanedFileName = cleanString(file.name.replace(/\.[^/.]+$/, ""));
    if (cleanedName.includes(cleanedFileName) || cleanedFileName.includes(cleanedName)) {
      return file.url;
    }
  }
  
  // 3. Tenta por palavras-chave principais
  const words = productName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  for (let file of driveFiles) {
    const fileLower = file.name.toLowerCase();
    const hasWord = words.some(word => fileLower.includes(word));
    if (hasWord) {
      return file.url;
    }
  }
  
  return ""; // Não encontrou
}

/**
 * Preenche a coluna de URLs de imagens baseando-se nos nomes dos produtos
 */
function syncPhotosFromDrive() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Produtos");
  
  if (!sheet) {
    ui.alert("Erro: A aba 'Produtos' não foi encontrada. Sincronize o site primeiro.");
    return;
  }

  const driveFiles = getFilesFromFolder();
  if (driveFiles.length === 0) {
    ui.alert("Aviso: Nenhum arquivo encontrado na pasta do Drive.");
    return;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  
  const nameIndex = headers.indexOf("nome") !== -1 ? headers.indexOf("nome") : headers.indexOf("name");
  const imgIndex = headers.indexOf("imagem_url") !== -1 ? headers.indexOf("imagem_url") : headers.indexOf("image_url");

  if (nameIndex === -1 || imgIndex === -1) {
    ui.alert("Erro: Colunas 'nome' ou 'imagem_url' não foram encontradas na aba 'Produtos'.");
    return;
  }

  let count = 0;

  // Começa da linha 2 (índice 1) para pular o cabeçalho
  for (let i = 1; i < data.length; i++) {
    const productName = data[i][nameIndex];
    if (productName) {
      const matchUrl = findImageForProduct(productName, driveFiles);
      if (matchUrl) {
        // Atualiza a célula correspondente
        sheet.getRange(i + 1, imgIndex + 1).setValue(matchUrl);
        count++;
      }
    }
  }

  ui.alert(`Sincronização concluída! ${count} fotos foram associadas com sucesso.`);
}

/**
 * Limpa a coluna de fotos (útil para testar)
 */
function clearPhotoColumn() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Confirmar', 'Deseja realmente apagar todas as URLs de imagens?', ui.ButtonSet.YES_NO);
  
  if (response === ui.Button.YES) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Produtos");
    if (!sheet) return;
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().toLowerCase().trim());
    const imgIndex = headers.indexOf("imagem_url") !== -1 ? headers.indexOf("imagem_url") : headers.indexOf("image_url");
    
    if (imgIndex !== -1 && sheet.getLastRow() > 1) {
      sheet.getRange(2, imgIndex + 1, sheet.getLastRow() - 1, 1).clearContent();
      ui.alert("Urls limpas com sucesso.");
    }
  }
}

/**
 * Cria a planilha principal com todos os produtos e URLs de imagens
 */
function createMainSpreadsheet() {
  const ui = SpreadsheetApp.getUi();
  // Cria a planilha
  const ss = SpreadsheetApp.create('Beerlanda – Produtos');
  const sheet = ss.getActiveSheet();
  sheet.setName('Produtos');
  // Cabeçalhos
  const headers = ['id', 'nome', 'descricao', 'preco', 'imagem_url', 'estoque', 'categoria', 'slug_seo', 'ativo'];
  sheet.appendRow(headers);
  // Opcional: buscar dados do backend (ex.: /api/products) e preencher
  const response = UrlFetchApp.fetch('https://script.google.com/macros/s/AKfycbz9RevzMLcSdj9-KEfQsjwWC0xRXPikxitMTgs8x79Sp19PB4McyvsWShFesnlk9WRz/exec');
  // const products = JSON.parse(response.getContentText());
  // products.forEach(p => {
  //   const imgUrl = findImageForProduct(p.nome || p.name, getFilesFromFolder());
  //   sheet.appendRow([p.id, p.nome || p.name, p.descricao || p.description, p.preco || p.price, imgUrl, p.estoque || p.stock, p.categoria || p.category, p.slug_seo || p.slug, p.ativo ? 'Sim' : 'Não']);
  // });
  ui.alert('Planilha criada com sucesso em: ' + ss.getUrl());
}

