import admin from "firebase-admin";
import { ContractRecord } from "./types";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

export function contractsCol() {
  return db.collection("contracts");
}

export async function getContractByOrderId(orderId: string) {
  const snap = await contractsCol().where("orderId", "==", orderId).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

export async function getContractByToken(token: string) {
  const snap = await contractsCol().where("signatureToken", "==", token).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

export async function createContractDoc(data: Omit<ContractRecord, "id">) {
  const ref = contractsCol().doc();
  await ref.set(data);
  return ref;
}
