"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContractDownloadUrl = getContractDownloadUrl;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const storage_1 = require("./storage");
async function getContractDownloadUrl(params) {
    const contractSnap = await firebase_admin_1.default.firestore().collection("contracts").doc(params.contractId).get();
    if (!contractSnap.exists)
        throw new https_1.HttpsError("not-found", "Contrat introuvable");
    const userSnap = await firebase_admin_1.default.firestore().collection("users").doc(params.uid).get();
    const role = String(userSnap.data()?.role || "").toLowerCase();
    const contract = contractSnap.data();
    const isOwner = String(contract.customerEmail || "").toLowerCase() === String(userSnap.data()?.email || "").toLowerCase();
    const isAdmin = role === "admin";
    if (!isAdmin && !isOwner)
        throw new https_1.HttpsError("permission-denied", "Accès refusé");
    const path = params.variant === "signed" ? contract.signedPdfPath : contract.generatedPdfPath;
    if (!path)
        throw new https_1.HttpsError("failed-precondition", "PDF indisponible");
    return (0, storage_1.createDownloadUrl)(path, 20);
}
