import admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

export async function listContractsForAdmin(uid: string, limit = 100, status?: string | null) {
  const user = await admin.firestore().collection("users").doc(uid).get();
  const role = String(user.data()?.role || "").toLowerCase();
  if (role !== "admin") throw new HttpsError("permission-denied", "Admin requis");

  const safeLimit = Math.max(1, Math.min(300, Number(limit) || 100));
  const safeStatus = String(status || "").trim().toLowerCase();

  let query: FirebaseFirestore.Query = admin
    .firestore()
    .collection("contracts")
    .orderBy("createdAt", "desc")
    .limit(safeLimit);

  if (safeStatus) {
    query = admin
      .firestore()
      .collection("contracts")
      .where("signatureStatus", "==", safeStatus)
      .orderBy("createdAt", "desc")
      .limit(safeLimit);
  }

  const snap = await query.get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
