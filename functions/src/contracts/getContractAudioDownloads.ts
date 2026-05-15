import admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import { createDownloadUrl } from "./storage";

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 50);
}

export async function getContractAudioDownloads(params: { uid: string; contractId: string; }) {
  const contractSnap = await admin.firestore().collection("contracts").doc(params.contractId).get();
  if (!contractSnap.exists) throw new HttpsError("not-found", "Contrat introuvable");

  const userSnap = await admin.firestore().collection("users").doc(params.uid).get();
  const role = String(userSnap.data()?.role || "").toLowerCase();
  const userEmail = String(userSnap.data()?.email || "").toLowerCase();
  const contract = contractSnap.data() as any;

  const isOwner = String(contract.customerEmail || "").toLowerCase() === userEmail;
  const isAdmin = role === "admin";
  if (!isAdmin && !isOwner) throw new HttpsError("permission-denied", "Accès refusé");

  const prodIds = normalizeIds(contract.purchasedProdIds);
  const items: Array<{ prodId: string; title: string; audioUrl: string; }> = [];

  if (prodIds.length) {
    const docs = await Promise.all(prodIds.map((prodId) => admin.firestore().collection("prods").doc(prodId).get()));
    for (const doc of docs) {
      if (!doc.exists) continue;
      const data = doc.data() as any;
      const audioUrl = String(data?.audioUrl || "").trim();
      if (!audioUrl) continue;
      items.push({
        prodId: doc.id,
        title: String(data?.titre || "Audio").trim() || "Audio",
        audioUrl
      });
    }
  }

  if (!items.length && contract.trackName) {
    const byTitle = await admin
      .firestore()
      .collection("prods")
      .where("titre", "==", String(contract.trackName))
      .limit(3)
      .get();

    byTitle.forEach((doc) => {
      const data = doc.data() as any;
      const audioUrl = String(data?.audioUrl || "").trim();
      if (!audioUrl) return;
      items.push({
        prodId: doc.id,
        title: String(data?.titre || contract.trackName || "Audio").trim() || "Audio",
        audioUrl
      });
    });
  }

  const signedPdfUrl = contract.signedPdfPath
    ? await createDownloadUrl(String(contract.signedPdfPath), 120)
    : null;

  return {
    contractId: contractSnap.id,
    signatureStatus: String(contract.signatureStatus || "pending"),
    trackName: String(contract.trackName || ""),
    items,
    signedPdfUrl
  };
}
