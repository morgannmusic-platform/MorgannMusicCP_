/**
 * stripe-release-checkout.js
 * Routeur Express isolé pour le tunnel d'achat "paiement par sortie".
 * Suit le même style que stripe-checkout.js (abonnements), avec en plus
 * une garde d'authentification Firebase ID Token sur chaque route.
 *
 * Monté dans server.js via : app.use(require("./stripe-release-checkout"))
 *
 * Variables d'environnement requises :
 *   STRIPE_SECRET_KEY       — clé secrète Stripe
 *   STRIPE_RELEASE_PRICE_ID — Price ID Stripe pour le paiement par sortie
 *   GOOGLE_APPLICATION_CREDENTIALS ou service account Firebase pour firebase-admin
 */

const express = require("express");
const Stripe = require("stripe");
const admin = require("firebase-admin");
const router = express.Router();

// ─── Initialisation Firebase Admin (partagée avec server.js si déjà init) ───
if (!admin.apps.length) {
  admin.initializeApp();
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_REMPLACER");

// Origins autorisées pour les URLs de redirection (évite l'abus SSRF via successUrl)
const ALLOWED_URL_PREFIXES = [
  "https://mm-cp.uk/",
  "https://www.mm-cp.uk/",
  "http://localhost:",
  "http://127.0.0.1:",
];

function isAllowedUrl(url) {
  return (
    typeof url === "string" &&
    ALLOWED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))
  );
}

// ─── Middleware : vérification du token Firebase ─────────────────────────────
async function requireFirebaseAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non authentifié: token Bearer requis" });
  }
  const idToken = authHeader.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    return next();
  } catch (_err) {
    return res.status(401).json({ error: "Token Firebase invalide ou expiré" });
  }
}

// ─── POST /create-release-checkout-session ───────────────────────────────────
// Reçoit : { successUrl, cancelUrl, releaseId? }
// Répond  : { url }  — URL Stripe Checkout à ouvrir côté client
router.post("/create-release-checkout-session", requireFirebaseAuth, async (req, res) => {
  try {
    const { successUrl, cancelUrl, releaseId } = req.body || {};

    if (!isAllowedUrl(successUrl)) {
      return res.status(400).json({ error: "successUrl invalide ou domaine non autorisé" });
    }
    if (!isAllowedUrl(cancelUrl)) {
      return res.status(400).json({ error: "cancelUrl invalide ou domaine non autorisé" });
    }

    const releasePriceId = (process.env.STRIPE_RELEASE_PRICE_ID || "").trim();
    if (!releasePriceId) {
      return res.status(500).json({ error: "STRIPE_RELEASE_PRICE_ID non configuré" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: releasePriceId, quantity: 1 }],
      billing_address_collection: "required",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: req.uid,
      metadata: {
        uid: req.uid,
        plan: "pay-per-release",
        releaseId: String(releaseId || "").trim().slice(0, 100),
      },
    });

    return res.json({ url: session.url });
  } catch (e) {
    console.error("stripe-release-checkout create error:", e);
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /verify-release-payment ────────────────────────────────────────────
// Reçoit : { sessionId }
// Vérifie le paiement Stripe et crédite le profil Firestore de l'utilisateur.
// Idempotent : un sessionId déjà traité retourne { alreadyCredited: true }.
router.post("/verify-release-payment", requireFirebaseAuth, async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "").trim();
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId requis" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(402).json({ error: "Paiement non confirmé par Stripe" });
    }
    if (session.client_reference_id !== req.uid) {
      return res.status(403).json({ error: "Cette session de paiement n'appartient pas à cet utilisateur" });
    }
    if (session.metadata?.plan !== "pay-per-release") {
      return res.status(400).json({ error: "Type de session incompatible" });
    }

    const db = admin.firestore();
    const userRef = db.collection("users").doc(req.uid);

    const alreadyCredited = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.data() || {};
      if (data.releasePaymentSessionId === sessionId) {
        return true; // déjà traité
      }
      tx.update(userRef, {
        releasePaymentPaid: true,
        releasePaymentStatus: "paid",
        releasePaymentSessionId: sessionId,
        releasePaymentCredits: admin.firestore.FieldValue.increment(1),
        releasePaymentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return false;
    });

    return res.json({ success: true, sessionId, alreadyCredited });
  } catch (e) {
    console.error("stripe-release-checkout verify error:", e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
