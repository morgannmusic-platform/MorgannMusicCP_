"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSignatureRequestFromOrder = createSignatureRequestFromOrder;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const storage_1 = require("./storage");
async function createSignatureRequestFromOrder(orderId, siteUrl) {
    const snap = await (0, firestore_1.getContractByOrderId)(orderId);
    if (!snap)
        throw new https_1.HttpsError("not-found", "Contrat introuvable");
    const contract = snap.data();
    if (contract.signatureStatus === "signed") {
        return {
            contractId: snap.id,
            status: "signed",
            signUrl: `${siteUrl}/contracts/sign-contract.html?token=${encodeURIComponent(contract.signatureToken)}`
        };
    }
    const expiresAt = firebase_admin_1.default.firestore.Timestamp.fromMillis(Date.now() + 1000 * 60 * 60 * 24 * 7);
    await snap.ref.update({
        signatureStatus: "pending",
        tokenExpiresAt: expiresAt,
        updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
    });
    return {
        contractId: snap.id,
        status: "pending",
        token: contract.signatureToken,
        signUrl: `${siteUrl}/contracts/sign-contract.html?token=${encodeURIComponent(contract.signatureToken)}`,
        generatedPdfUrl: await (0, storage_1.createDownloadUrl)(contract.generatedPdfPath, 30)
    };
}
