"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContractFromOrder = createContractFromOrder;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const firestore_1 = require("./firestore");
const utils_1 = require("./utils");
const storage_1 = require("./storage");
const TEMPLATE_PATH = "templates/contracts/exclusive-license.pdf";
async function createContractFromOrder(input) {
    const existing = await (0, firestore_1.getContractByOrderId)(input.orderId);
    if (existing)
        return { id: existing.id, ...existing.data() };
    const now = firebase_admin_1.default.firestore.Timestamp.now();
    const tokenExpiresAt = firebase_admin_1.default.firestore.Timestamp.fromMillis(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const values = {
        client_name: (0, utils_1.clampText)(input.customerName, 120),
        client_email: (0, utils_1.sanitizeEmail)(input.customerEmail),
        client_address: (0, utils_1.clampText)(input.customerAddress, 220),
        track_name: (0, utils_1.clampText)(input.trackName, 140),
        license_type: (0, utils_1.clampText)(input.licenseType || "exclusive", 50),
        price: (0, utils_1.priceLabel)(input.amount, input.currency),
        date_dmd: (0, utils_1.parisDateDDMMYYYY)(new Date()),
        order_id: (0, utils_1.clampText)(input.orderId, 120)
    };
    const localTemplatePath = node_path_1.default.resolve(__dirname, "../../templates/contracts/exclusive-license.pdf");
    const template = await promises_1.default.readFile(localTemplatePath);
    if (!template || !template.length)
        throw new https_1.HttpsError("failed-precondition", "Template PDF introuvable");
    const { fillContractPdf } = require("./pdf");
    const pdfBytes = await fillContractPdf(template, values);
    const generatedId = firebase_admin_1.default.firestore().collection("contracts").doc().id;
    const generatedPdfPath = `contracts/generated/${generatedId}.pdf`;
    await (0, storage_1.saveBuffer)(generatedPdfPath, pdfBytes, "application/pdf");
    const ref = await (0, firestore_1.createContractDoc)({
        orderId: input.orderId,
        stripeSessionId: input.stripeSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId || null,
        purchasedProdIds: Array.isArray(input.purchasedProdIds)
            ? input.purchasedProdIds.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 50)
            : [],
        customerName: values.client_name,
        customerEmail: values.client_email,
        customerAddress: values.client_address,
        trackName: values.track_name,
        licenseType: values.license_type,
        amount: input.amount,
        currency: String(input.currency || "eur").toLowerCase(),
        templatePath: TEMPLATE_PATH,
        generatedPdfPath,
        signedPdfPath: null,
        signatureImagePath: null,
        signatureToken: (0, utils_1.generateSignatureToken)(),
        signatureStatus: "pending",
        tokenExpiresAt,
        generatedAt: now,
        signedAt: null,
        createdAt: now,
        updatedAt: now
    });
    return { id: ref.id, ...(await ref.get()).data() };
}
