import admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import { getContractByToken } from "./firestore";
import { parisDateDDMMYYYY } from "./utils";
import { createDownloadUrl, readFileBuffer, saveBuffer } from "./storage";
import { sendContractEmail } from "./sendContractEmail";

function parsePngBase64(dataUrl: string): Buffer {
  const raw = String(dataUrl || "");
  const prefix = "data:image/png;base64,";
  const base64 = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  if (!base64) throw new HttpsError("invalid-argument", "Signature vide");
  return Buffer.from(base64, "base64");
}

export async function submitContractSignature(params: { token: string; signatureDataUrl: string; signatoryName?: string; signatoryEmail?: string; }) {
  const snap = await getContractByToken(params.token);
  if (!snap) throw new HttpsError("not-found", "Token invalide");

  const contract = snap.data() as any;

  const expiresAt = contract?.tokenExpiresAt?.toMillis?.() ?? 0;
  if (!expiresAt || Date.now() > expiresAt) {
    await snap.ref.update({ signatureStatus: "expired" });
    throw new HttpsError("failed-precondition", "Demande expirée");
  }

  const signaturePng = parsePngBase64(params.signatureDataUrl);
  const generatedPdf = await readFileBuffer(contract.generatedPdfPath);

  const { signContractPdf } = require("./pdf") as typeof import("./pdf");
  const signedPdf = await signContractPdf(generatedPdf, signaturePng, {
    name: params.signatoryName || contract.customerName,
    email: params.signatoryEmail || contract.customerEmail,
    date: parisDateDDMMYYYY(new Date())
  });

  const signatureImagePath = `contracts/signatures/${snap.id}.png`;
  const signedPdfPath = `contracts/signed/${snap.id}.pdf`;

  await Promise.all([
    saveBuffer(signatureImagePath, signaturePng, "image/png"),
    saveBuffer(signedPdfPath, signedPdf, "application/pdf")
  ]);

  await snap.ref.update({
    signatureStatus: "signed",
    signedPdfPath,
    signatureImagePath,
    signedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const signedPdfUrl = await createDownloadUrl(signedPdfPath, 120);

  await sendContractEmail({
    to: contract.customerEmail,
    customerName: contract.customerName,
    trackName: contract.trackName,
    contractId: snap.id,
    signedPdfUrl
  });

  return { success: true, contractId: snap.id, signedPdfUrl };
}
