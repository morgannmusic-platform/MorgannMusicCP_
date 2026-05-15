"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendContractEmail = sendContractEmail;
const firebase_functions_1 = require("firebase-functions");
async function sendContractEmail(params) {
    firebase_functions_1.logger.info("Envoi email externe désactivé", {
        contractId: params.contractId,
        to: params.to,
        trackName: params.trackName,
        signedPdfUrl: params.signedPdfUrl
    });
}
