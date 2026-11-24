import { Storage } from "@google-cloud/storage";
import sharp from "sharp";
import { getServiceAccountCredentials } from "./gcpCredentials";

const BUCKET_NAME = process.env.STORAGE_BUCKET || "beerlanda-product-images";
const serviceAccount = getServiceAccountCredentials();
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "beerlanda",
  ...(serviceAccount ? { credentials: serviceAccount as any } : {})
});
const bucket = storage.bucket(BUCKET_NAME);

function publicUrl(destPath: string): string {
  return `https://storage.googleapis.com/${BUCKET_NAME}/${destPath}`;
}

// Maior lado da imagem depois de redimensionar. O card do catálogo mostra
// cerca de 400 px e a página de produto cerca de 600 px; 1200 cobre os dois
// com folga em telas de alta densidade, sem guardar foto de câmera inteira.
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 82;

/**
 * Reduz a foto para tamanho de web antes de guardar.
 *
 * As fotos chegam direto da câmera ou do celular, com 3 a 4 MB cada. Servidas
 * assim num card de 400 px, a Home passava de 50 MB — minutos de espera no
 * 4G e nota baixa de velocidade no Google, que é fator de ranqueamento.
 * Redimensionar e recomprimir corta cerca de 95% do peso sem diferença
 * visível no tamanho em que a imagem aparece.
 *
 * Se o processamento falhar por algum motivo (formato exótico, arquivo
 * corrompido), devolve o buffer original: é melhor publicar uma foto pesada
 * do que perder a imagem do produto.
 */
async function optimizeImage(buffer: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const optimized = await sharp(buffer)
      .rotate() // respeita a orientação EXIF antes de descartar os metadados
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true })
      .toBuffer();

    return { buffer: optimized, contentType: "image/jpeg" };
  } catch (error: any) {
    console.error("[Storage] Não foi possível otimizar a imagem, guardando o original:", error.message);
    return { buffer, contentType: "" };
  }
}

async function uploadImageBuffer(buffer: Buffer, destPath: string, contentType: string): Promise<string> {
  const optimized = await optimizeImage(buffer);
  const file = bucket.file(destPath);
  await file.save(optimized.buffer, {
    contentType: optimized.contentType || contentType,
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  return publicUrl(destPath);
}

async function uploadImageFromUrl(sourceUrl: string, destPath: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return await uploadImageBuffer(buffer, destPath, contentType);
  } catch (error) {
    console.error(`[Storage] Falha ao baixar/subir imagem de "${sourceUrl}":`, error);
    return null;
  }
}

// Drive hotlinks (drive.google.com/uc?...) are rate-limited and unreliable
// as an image CDN — this mirrors the file into our own bucket exactly once
// per sync, so the site always serves a stable URL from then on.
async function hostProductImage(slug: string, sourceUrl: string): Promise<string> {
  if (!sourceUrl || !sourceUrl.includes("drive.google.com")) {
    return sourceUrl;
  }
  const hosted = await uploadImageFromUrl(sourceUrl, `products/${slug}.jpg`);
  return hosted || sourceUrl;
}

async function deleteImage(destPath: string): Promise<void> {
  try {
    await bucket.file(destPath).delete({ ignoreNotFound: true } as any);
  } catch (error) {
    console.error(`[Storage] Falha ao remover imagem "${destPath}":`, error);
  }
}

export { uploadImageBuffer, uploadImageFromUrl, hostProductImage, deleteImage, publicUrl, optimizeImage, bucket, BUCKET_NAME };
