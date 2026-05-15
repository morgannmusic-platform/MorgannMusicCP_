import type Stripe from "stripe";

let stripeCtor: typeof import("stripe").default | null = null;

function getStripeCtor() {
  if (stripeCtor) return stripeCtor;

  // Lazy load Stripe to keep function discovery lightweight during deploy.
  const stripeModule = require("stripe");
  stripeCtor = (stripeModule?.default || stripeModule) as typeof import("stripe").default;
  return stripeCtor;
}

export function getStripeClient(secretKey?: string) {
  const key = secretKey || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquante");
  const StripeClient = getStripeCtor();
  return new StripeClient(key, { apiVersion: "2024-06-20" });
}
