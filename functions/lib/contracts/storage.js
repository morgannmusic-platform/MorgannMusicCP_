"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFileBuffer = readFileBuffer;
exports.saveBuffer = saveBuffer;
exports.createDownloadUrl = createDownloadUrl;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const node_crypto_1 = __importDefault(require("node:crypto"));
if (!firebase_admin_1.default.apps.length)
    firebase_admin_1.default.initializeApp();
const bucket = firebase_admin_1.default.storage().bucket();
function buildTokenUrl(path, token) {
    const encodedPath = encodeURIComponent(path);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}
async function readFileBuffer(path) {
    const [buf] = await bucket.file(path).download();
    return buf;
}
async function saveBuffer(path, data, contentType) {
    const downloadToken = node_crypto_1.default.randomUUID();
    await bucket.file(path).save(Buffer.from(data), {
        resumable: false,
        contentType,
        metadata: {
            cacheControl: "private, max-age=0, no-store",
            firebaseStorageDownloadTokens: downloadToken
        }
    });
}
async function createDownloadUrl(path, expiresInMinutes = 20) {
    const file = bucket.file(path);
    const [metadata] = await file.getMetadata();
    const customMetadata = metadata?.metadata || {};
    const existing = String(customMetadata.firebaseStorageDownloadTokens || "").trim();
    const token = existing || node_crypto_1.default.randomUUID();
    if (!existing) {
        await file.setMetadata({
            metadata: {
                ...customMetadata,
                firebaseStorageDownloadTokens: token
            }
        });
    }
    return buildTokenUrl(path, token.split(",")[0].trim());
}
