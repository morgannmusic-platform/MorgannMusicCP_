import { HttpsError } from "firebase-functions/v2/https";
import { getContractByToken } from "./firestore";
import { createDownloadUrl } from "./storage";

export async function getSignatureRequestByToken(token: string) {
  if (!token) throw new HttpsError("invalid-argument", "Token requis");

  const snap = await getContractByToken(token);
  if (!snap) throw new HttpsError("not-found", "Demande introuvable");

  const contract = snap.data() as any;
  const expiresAtMillis = contract?.tokenExpiresAt?.toMillis?.() ?? 0;
  if (!expiresAtMillis || Date.now() > expiresAtMillis) {
    await snap.ref.update({ signatureStatus: "expired" });
    throw new HttpsError("failed-precondition", "Demande expirée");
  }

  return {
    contractId: snap.id,
    customerName: contract.customerName,
    customerEmail: contract.customerEmail,
    trackName: contract.trackName,
    licenseType: contract.licenseType,
    amount: contract.amount,
    currency: contract.currency,
    generatedPdfUrl: await createDownloadUrl(contract.generatedPdfPath, 20),
    tokenExpiresAt: expiresAtMillis
  };
}
