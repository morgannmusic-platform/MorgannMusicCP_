import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-functions.js";
import { functions } from "./firebase.js";

const verifyCheckoutAndBootstrapContract = httpsCallable(functions, "verifyCheckoutAndBootstrapContract");
const getSignatureRequest = httpsCallable(functions, "getSignatureRequest");
const submitSignature = httpsCallable(functions, "submitSignature");
const listContractsForAdminCallable = httpsCallable(functions, "listContractsForAdminCallable");
const getContractDownloadUrlCallable = httpsCallable(functions, "getContractDownloadUrlCallable");
const getContractAudioDownloadsCallable = httpsCallable(functions, "getContractAudioDownloadsCallable");

export async function bootstrapContract(sessionId) {
  const result = await verifyCheckoutAndBootstrapContract({ sessionId });
  return result?.data;
}

export async function fetchSignatureRequest(token) {
  const result = await getSignatureRequest({ token });
  return result?.data;
}

export async function finalizeSignature(payload) {
  const result = await submitSignature(payload);
  return result?.data;
}

export async function listAdminContracts(limit = 100) {
  const result = await listContractsForAdminCallable({ limit });
  return result?.data?.contracts || [];
}

export async function listContractsAdmin(status = null, limit = 100) {
  const result = await listContractsForAdminCallable({ limit, status });
  return result?.data?.contracts || [];
}

export async function contractDownloadUrl(contractId, variant) {
  const result = await getContractDownloadUrlCallable({ contractId, variant });
  return result?.data?.url || null;
}

export async function getContractDownloadUrl(contractId, variant) {
  const result = await getContractDownloadUrlCallable({ contractId, variant });
  return result?.data || null;
}

export async function getContractAudioDownloads(contractId) {
  const result = await getContractAudioDownloadsCallable({ contractId });
  return result?.data || null;
}
