import admin from "firebase-admin";
import crypto from "node:crypto";

if (!admin.apps.length) admin.initializeApp();

const bucket = admin.storage().bucket();

function buildTokenUrl(path: string, token: string): string {
  const encodedPath = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

export async function readFileBuffer(path: string): Promise<Buffer> {
  const [buf] = await bucket.file(path).download();
  return buf;
}

export async function saveBuffer(path: string, data: Uint8Array | Buffer, contentType: string): Promise<void> {
  const downloadToken = crypto.randomUUID();
  await bucket.file(path).save(Buffer.from(data), {
    resumable: false,
    contentType,
    metadata: {
      cacheControl: "private, max-age=0, no-store",
      firebaseStorageDownloadTokens: downloadToken
    }
  });
}

export async function createDownloadUrl(path: string, expiresInMinutes = 20): Promise<string> {
  const file = bucket.file(path);
  const [metadata] = await file.getMetadata();
  const customMetadata = metadata?.metadata || {};
  const existing = String(customMetadata.firebaseStorageDownloadTokens || "").trim();
  const token = existing || crypto.randomUUID();

  if (!existing) {
    await file.setMetadata({
      metadata: {
        ...customMetadata,
        firebaseStorageDownloadTokens: token
      }
    });
  }

  return buildTokenUrl(path, token.split(",")[0].trim());
}
