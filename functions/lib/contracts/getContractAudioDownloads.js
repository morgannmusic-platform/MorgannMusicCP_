"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContractAudioDownloads = getContractAudioDownloads;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const storage_1 = require("./storage");
function normalizeIds(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 50);
}
async function getContractAudioDownloads(params) {
    const contractSnap = await firebase_admin_1.default.firestore().collection("contracts").doc(params.contractId).get();
    if (!contractSnap.exists)
        throw new https_1.HttpsError("not-found", "Contrat introuvable");
    const userSnap = await firebase_admin_1.default.firestore().collection("users").doc(params.uid).get();
    const role = String(userSnap.data()?.role || "").toLowerCase();
    const userEmail = String(userSnap.data()?.email || "").toLowerCase();
    const contract = contractSnap.data();
    const isOwner = String(contract.customerEmail || "").toLowerCase() === userEmail;
    const isAdmin = role === "admin";
    if (!isAdmin && !isOwner)
        throw new https_1.HttpsError("permission-denied", "Accès refusé");
    const prodIds = normalizeIds(contract.purchasedProdIds);
    const items = [];
    if (prodIds.length) {
        const docs = await Promise.all(prodIds.map((prodId) => firebase_admin_1.default.firestore().collection("prods").doc(prodId).get()));
        for (const doc of docs) {
            if (!doc.exists)
                continue;
            const data = doc.data();
            const audioUrl = String(data?.audioUrl || "").trim();
            if (!audioUrl)
                continue;
            items.push({
                prodId: doc.id,
                title: String(data?.titre || "Audio").trim() || "Audio",
                audioUrl
            });
        }
    }
    if (!items.length && contract.trackName) {
        const byTitle = await firebase_admin_1.default
            .firestore()
            .collection("prods")
            .where("titre", "==", String(contract.trackName))
            .limit(3)
            .get();
        byTitle.forEach((doc) => {
            const data = doc.data();
            const audioUrl = String(data?.audioUrl || "").trim();
            if (!audioUrl)
                return;
            items.push({
                prodId: doc.id,
                title: String(data?.titre || contract.trackName || "Audio").trim() || "Audio",
                audioUrl
            });
        });
    }
    const signedPdfUrl = contract.signedPdfPath
        ? await (0, storage_1.createDownloadUrl)(String(contract.signedPdfPath), 120)
        : null;
    return {
        contractId: contractSnap.id,
        signatureStatus: String(contract.signatureStatus || "pending"),
        trackName: String(contract.trackName || ""),
        items,
        signedPdfUrl
    };
}
