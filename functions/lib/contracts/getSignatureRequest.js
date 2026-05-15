"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignatureRequestByToken = getSignatureRequestByToken;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const storage_1 = require("./storage");
async function getSignatureRequestByToken(token) {
    if (!token)
        throw new https_1.HttpsError("invalid-argument", "Token requis");
    const snap = await (0, firestore_1.getContractByToken)(token);
    if (!snap)
        throw new https_1.HttpsError("not-found", "Demande introuvable");
    const contract = snap.data();
    const expiresAtMillis = contract?.tokenExpiresAt?.toMillis?.() ?? 0;
    if (!expiresAtMillis || Date.now() > expiresAtMillis) {
        await snap.ref.update({ signatureStatus: "expired" });
        throw new https_1.HttpsError("failed-precondition", "Demande expirée");
    }
    return {
        contractId: snap.id,
        customerName: contract.customerName,
        customerEmail: contract.customerEmail,
        trackName: contract.trackName,
        licenseType: contract.licenseType,
        amount: contract.amount,
        currency: contract.currency,
        generatedPdfUrl: await (0, storage_1.createDownloadUrl)(contract.generatedPdfPath, 20),
        tokenExpiresAt: expiresAtMillis
    };
}
