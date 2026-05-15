"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStripeClient = getStripeClient;
let stripeCtor = null;
function getStripeCtor() {
    if (stripeCtor)
        return stripeCtor;
    // Lazy load Stripe to keep function discovery lightweight during deploy.
    const stripeModule = require("stripe");
    stripeCtor = (stripeModule?.default || stripeModule);
    return stripeCtor;
}
function getStripeClient(secretKey) {
    const key = secretKey || process.env.STRIPE_SECRET_KEY;
    if (!key)
        throw new Error("STRIPE_SECRET_KEY manquante");
    const StripeClient = getStripeCtor();
    return new StripeClient(key, { apiVersion: "2024-06-20" });
}
