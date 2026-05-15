import admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import { createDownloadUrl } from "./storage";

export async function getContractDownloadUrl(params: { uid: string; contractId: string; variant: "generated" | "signed"; }) {
  const contractSnap = await admin.firestore().collection("contracts").doc(params.contractId).get();
  if (!contractSnap.exists) throw new HttpsError("not-found", "Contrat introuvable");

  const userSnap = await admin.firestore().collection("users").doc(params.uid).get();
  const role = String(userSnap.data()?.role || "").toLowerCase();
  const contract = contractSnap.data() as any;

  const isOwner = String(contract.customerEmail || "").toLowerCase() === String(userSnap.data()?.email || "").toLowerCase();
  const isAdmin = role === "admin";
  if (!isAdmin && !isOwner) throw new HttpsError("permission-denied", "Accès refusé");

  const path = params.variant === "signed" ? contract.signedPdfPath : contract.generatedPdfPath;
  if (!path) throw new HttpsError("failed-precondition", "PDF indisponible");

  return createDownloadUrl(path, 20);
}
