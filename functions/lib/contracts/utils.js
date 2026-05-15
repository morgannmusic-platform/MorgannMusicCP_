"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parisDateDDMMYYYY = parisDateDDMMYYYY;
exports.generateSignatureToken = generateSignatureToken;
exports.clampText = clampText;
exports.sanitizeEmail = sanitizeEmail;
exports.priceLabel = priceLabel;
const crypto_1 = __importDefault(require("crypto"));
const date_fns_tz_1 = require("date-fns-tz");
function parisDateDDMMYYYY(date = new Date()) {
    return (0, date_fns_tz_1.formatInTimeZone)(date, "Europe/Paris", "dd/MM/yyyy");
}
function generateSignatureToken() {
    return crypto_1.default.randomBytes(24).toString("hex");
}
function clampText(value, max = 120) {
    return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}
function sanitizeEmail(value) {
    return String(value ?? "").trim().toLowerCase();
}
function priceLabel(amount, currency = "eur") {
    const value = Number(amount || 0);
    const c = String(currency || "eur").toUpperCase();
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: c }).format(value / 100);
}
