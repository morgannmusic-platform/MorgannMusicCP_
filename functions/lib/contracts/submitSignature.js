"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitContractSignature = submitContractSignature;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("./firestore");
const utils_1 = require("./utils");
const storage_1 = require("./storage");
const sendContractEmail_1 = require("./sendContractEmail");
function parsePngBase64(dataUrl) {
    const raw = String(dataUrl || "");
    const prefix = "data:image/png;base64,";
    const base64 = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
    if (!base64)
        throw new https_1.HttpsError("invalid-argument", "Signature vide");
    return Buffer.from(base64, "base64");
}
async function submitContractSignature(params) {
    const snap = await (0, firestore_1.getContractByToken)(params.token);
    if (!snap)
        throw new https_1.HttpsError("not-found", "Token invalide");
    const contract = snap.data();
    const expiresAt = contract?.tokenExpiresAt?.toMillis?.() ?? 0;
    if (!expiresAt || Date.now() > expiresAt) {
        await snap.ref.update({ signatureStatus: "expired" });
        throw new https_1.HttpsError("failed-precondition", "Demande expirée");
    }
    const signaturePng = parsePngBase64(params.signatureDataUrl);
    const generatedPdf = await (0, storage_1.readFileBuffer)(contract.generatedPdfPath);
    const { signContractPdf } = require("./pdf");
    const signedPdf = await signContractPdf(generatedPdf, signaturePng, {
        name: params.signatoryName || contract.customerName,
        email: params.signatoryEmail || contract.customerEmail,
        date: (0, utils_1.parisDateDDMMYYYY)(new Date())
    });
    const signatureImagePath = `contracts/signatures/${snap.id}.png`;
    const signedPdfPath = `contracts/signed/${snap.id}.pdf`;
    await Promise.all([
        (0, storage_1.saveBuffer)(signatureImagePath, signaturePng, "image/png"),
        (0, storage_1.saveBuffer)(signedPdfPath, signedPdf, "application/pdf")
    ]);
    await snap.ref.update({
        signatureStatus: "signed",
        signedPdfPath,
        signatureImagePath,
        signedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
    });
    const signedPdfUrl = await (0, storage_1.createDownloadUrl)(signedPdfPath, 120);
    await (0, sendContractEmail_1.sendContractEmail)({
        to: contract.customerEmail,
        customerName: contract.customerName,
        trackName: contract.trackName,
        contractId: snap.id,
        signedPdfUrl
    });
    return { success: true, contractId: snap.id, signedPdfUrl };
}
