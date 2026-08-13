import { Storage } from "@google-cloud/storage";

const BUCKET_NAME = process.env.STORAGE_BUCKET || "beerlanda-product-images";
const storage = new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT || "beerlanda" });
const bucket = storage.bucket(BUCKET_NAME);

function publicUrl(destPath: string): string {
  return `https://storage.googleapis.com/${BUCKET_NAME}/${destPath}`;
}

async function uploadImageBuffer(buffer: Buffer, destPath: string, contentType: string): Promise<string> {
  const file = bucket.file(destPath);
  await file.save(buffer, {
    contentType,
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

export { uploadImageBuffer, uploadImageFromUrl, hostProductImage, deleteImage, publicUrl, BUCKET_NAME };
