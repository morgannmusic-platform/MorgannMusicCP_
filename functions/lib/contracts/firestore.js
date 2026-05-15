"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractsCol = contractsCol;
exports.getContractByOrderId = getContractByOrderId;
exports.getContractByToken = getContractByToken;
exports.createContractDoc = createContractDoc;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
if (!firebase_admin_1.default.apps.length)
    firebase_admin_1.default.initializeApp();
const db = firebase_admin_1.default.firestore();
function contractsCol() {
    return db.collection("contracts");
}
async function getContractByOrderId(orderId) {
    const snap = await contractsCol().where("orderId", "==", orderId).limit(1).get();
    return snap.empty ? null : snap.docs[0];
}
async function getContractByToken(token) {
    const snap = await contractsCol().where("signatureToken", "==", token).limit(1).get();
    return snap.empty ? null : snap.docs[0];
}
async function createContractDoc(data) {
    const ref = contractsCol().doc();
    await ref.set(data);
    return ref;
}
