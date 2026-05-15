"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listContractsForAdmin = listContractsForAdmin;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
async function listContractsForAdmin(uid, limit = 100, status) {
    const user = await firebase_admin_1.default.firestore().collection("users").doc(uid).get();
    const role = String(user.data()?.role || "").toLowerCase();
    if (role !== "admin")
        throw new https_1.HttpsError("permission-denied", "Admin requis");
    const safeLimit = Math.max(1, Math.min(300, Number(limit) || 100));
    const safeStatus = String(status || "").trim().toLowerCase();
    let query = firebase_admin_1.default
        .firestore()
        .collection("contracts")
        .orderBy("createdAt", "desc")
        .limit(safeLimit);
    if (safeStatus) {
        query = firebase_admin_1.default
            .firestore()
            .collection("contracts")
            .where("signatureStatus", "==", safeStatus)
            .orderBy("createdAt", "desc")
            .limit(safeLimit);
    }
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
