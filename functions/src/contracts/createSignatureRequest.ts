import admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import { getContractByOrderId } from "./firestore";
import { createDownloadUrl } from "./storage";

export async function createSignatureRequestFromOrder(orderId: string, siteUrl: string) {
  const snap = await getContractByOrderId(orderId);
  if (!snap) throw new HttpsError("not-found", "Contrat introuvable");

  const contract = snap.data() as any;
  if (contract.signatureStatus === "signed") {
    return {
      contractId: snap.id,
      status: "signed",
      signUrl: `${siteUrl}/contracts/sign-contract.html?token=${encodeURIComponent(contract.signatureToken)}`
    };
  }

  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await snap.ref.update({
    signatureStatus: "pending",
    tokenExpiresAt: expiresAt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    contractId: snap.id,
    status: "pending",
    token: contract.signatureToken,
    signUrl: `${siteUrl}/contracts/sign-contract.html?token=${encodeURIComponent(contract.signatureToken)}`,
    generatedPdfUrl: await createDownloadUrl(contract.generatedPdfPath, 30)
  };
}
