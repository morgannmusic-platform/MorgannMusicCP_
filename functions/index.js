// --- Scraping des liens de plateformes musicales ---
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");

exports.findReleaseLinks = onRequest(
  { memory: "1GiB", timeoutSeconds: 120 },
  async (req, res) => {
    try {
      const { artist, title, trackCount } = req.body || req.query || {};
      if (!artist || !title || !trackCount) {
        return res.status(400).json({ error: "artist, title, trackCount requis" });
      }

      async function searchSpotify() {
        const puppeteer = require("puppeteer");
        let browser;
        try {
          browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
          const page = await browser.newPage();
          const query = encodeURIComponent(`${artist} ${title}`);
          await page.goto(`https://open.spotify.com/search/${query}`, { waitUntil: 'networkidle2', timeout: 60000 });
          const albumUrl = await page.evaluate(() => {
            const link = document.querySelector('a[href^="/album/"]');
            return link ? 'https://open.spotify.com' + link.getAttribute('href') : null;
          });
          let valid = false;
          if (albumUrl) {
            await page.goto(albumUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            const count = await page.evaluate(() => document.querySelectorAll('[data-testid="tracklist-row"]').length);
            valid = (count === Number(trackCount));
          }
          await page.close();
          await browser.close();
          return valid ? albumUrl : null;
        } catch (e) {
          if (browser) await browser.close();
          return null;
        }
      }

      async function searchDeezer() {
        const puppeteer = require("puppeteer");
        let browser;
        try {
          browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
          const page = await browser.newPage();
          const query = encodeURIComponent(`${artist} ${title}`);
          await page.goto(`https://www.deezer.com/search/${query}`, { waitUntil: 'networkidle2', timeout: 60000 });
          const albumUrl = await page.evaluate(() => {
            const link = document.querySelector('a[href^="/album/"]');
            return link ? 'https://www.deezer.com' + link.getAttribute('href') : null;
          });
          let valid = false;
          if (albumUrl) {
            await page.goto(albumUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            const count = await page.evaluate(() => document.querySelectorAll('.datagrid-row-track').length);
            valid = (count === Number(trackCount));
          }
          await page.close();
          await browser.close();
          return valid ? albumUrl : null;
        } catch (e) {
          if (browser) await browser.close();
          return null;
        }
      }

      async function searchAppleMusic() {
        const puppeteer = require("puppeteer");
        let browser;
        try {
          browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
          const page = await browser.newPage();
          const query = encodeURIComponent(`${artist} ${title}`);
          await page.goto(`https://music.apple.com/fr/search?term=${query}`, { waitUntil: 'networkidle2', timeout: 60000 });
          const albumUrl = await page.evaluate(() => {
            const link = document.querySelector('a[href*="/album/"]');
            return link ? link.href : null;
          });
          let valid = false;
          if (albumUrl) {
            await page.goto(albumUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            const count = await page.evaluate(() => document.querySelectorAll('div.songs-list-row').length);
            valid = (count === Number(trackCount));
          }
          await page.close();
          await browser.close();
          return valid ? albumUrl : null;
        } catch (e) {
          if (browser) await browser.close();
          return null;
        }
      }

      const [spotify, deezer, appleMusic] = await Promise.all([
        searchSpotify(),
        searchDeezer(),
        searchAppleMusic()
      ]);

      return res.json({ spotify, deezer, appleMusic });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Erreur serveur" });
    }
  }
);
const admin = require("firebase-admin");
const crypto = require("crypto");

// Pour le TOTP (2FA)
const speakeasy = require("speakeasy");

// TOTP: obtenir le statut 2FA
exports.totpGetStatus = onCall({ region: "europe-west1" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise");
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const data = userSnap.exists ? userSnap.data() : {};
  const enabled = !!data.totpSecret;
  const pendingEnrollment = !!data.totpPendingSecret;
  return { enabled, pendingEnrollment };
});

// TOTP: début d'enrôlement (génère une clé)
exports.totpBeginEnrollment = onCall({ region: "europe-west1" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise");
  const secret = speakeasy.generateSecret({ length: 20, name: `MMCP (${uid})` });
  await db.collection("users").doc(uid).update({ totpPendingSecret: secret.base32 });
  return { manualKey: secret.base32 };
});

// TOTP: confirmation d'enrôlement (valide le code)
exports.totpConfirmEnrollmentV2 = onCall({ region: "europe-west1" }, async (request) => {
  const uid = request.auth?.uid;
  const token = String(request.data?.token || "").replace(/\s+/g, "");
  if (!uid || !token) throw new HttpsError("invalid-argument", "UID ou code manquant");
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const pendingSecret = userSnap.exists ? userSnap.data().totpPendingSecret : null;
  if (!pendingSecret) throw new HttpsError("failed-precondition", "Aucune clé en attente");
  const verified = speakeasy.totp.verify({ secret: pendingSecret, encoding: "base32", token, window: 1 });
  if (!verified) throw new HttpsError("invalid-argument", "Code invalide");
  await userRef.update({ totpSecret: pendingSecret, totpPendingSecret: admin.firestore.FieldValue.delete() });
  return { ok: true };
});

// TOTP: désactivation
exports.totpDisableV2 = onCall({ region: "europe-west1" }, async (request) => {
  const uid = request.auth?.uid;
  const token = String(request.data?.token || "").replace(/\s+/g, "");
  if (!uid || !token) throw new HttpsError("invalid-argument", "UID ou code manquant");
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const secret = userSnap.exists ? userSnap.data().totpSecret : null;
  if (!secret) throw new HttpsError("failed-precondition", "2FA non activé");
  const verified = speakeasy.totp.verify({ secret, encoding: "base32", token, window: 1 });
  if (!verified) throw new HttpsError("invalid-argument", "Code invalide");
  await userRef.update({ totpSecret: admin.firestore.FieldValue.delete() });
  return { ok: true };
});

admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();
const SITE_URL = process.env.SITE_URL || "https://morgann-music-cp.web.app";

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new HttpsError("failed-precondition", "STRIPE_SECRET_KEY manquante");
  }
  const Stripe = require("stripe");
  return new Stripe(key);
}

async function assertAdmin(auth) {
  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "Connexion requise");
  }
  const userSnap = await db.collection("users").doc(auth.uid).get();
  const role = userSnap.exists ? String(userSnap.data().role || "").toLowerCase() : "";
  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Accès admin requis");
  }
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .slice(0, 30);
}

function amountFromPriceEur(price) {
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) {
    throw new HttpsError("invalid-argument", "Prix invalide");
  }
  return Math.round(value * 100);
}

function toHttpsError(error, fallbackMessage) {
  if (error instanceof HttpsError) {
    return error;
  }
  const message = error?.raw?.message || error?.message || fallbackMessage;
  return new HttpsError("failed-precondition", message);
}

function randomToken() {
  return crypto.randomBytes(24).toString("hex");
}

async function findContractByToken(token) {
  const snap = await db.collection("contracts").where("signatureToken", "==", token).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

async function findOrCreateContractFromSession(session) {
  const orderId = String(session.client_reference_id || session.id);
  const existing = await db.collection("contracts").where("orderId", "==", orderId).limit(1).get();
  if (!existing.empty) {
    const doc = existing.docs[0];
    return { id: doc.id, data: doc.data() };
  }

  const customer = session.customer_details || {};
  const now = admin.firestore.FieldValue.serverTimestamp();
  const tokenExpiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const payload = {
    orderId,
    stripeSessionId: session.id,
    stripePaymentIntentId: String(session.payment_intent || ""),
    customerName: String(customer.name || "Client"),
    customerEmail: String(customer.email || ""),
    customerAddress: [
      customer?.address?.line1,
      customer?.address?.line2,
      customer?.address?.postal_code,
      customer?.address?.city,
      customer?.address?.country
    ].filter(Boolean).join(", "),
    trackName: String(session.metadata?.trackName || "Track"),
    licenseType: String(session.metadata?.licenseType || "exclusive"),
    amount: Number(session.amount_total || 0),
    currency: String(session.currency || "eur").toLowerCase(),
    signatureToken: randomToken(),
    signatureStatus: "pending",
    tokenExpiresAt,
    generatedPdfPath: null,
    signedPdfPath: null,
    signatureImagePath: null,
    generatedAt: now,
    signedAt: null,
    createdAt: now,
    updatedAt: now
  };

  const ref = await db.collection("contracts").add(payload);
  const created = await ref.get();
  return { id: ref.id, data: created.data() };
}

async function createSignedUrl(path, minutes = 60) {
  if (!path) return null;
  const expires = Date.now() + minutes * 60 * 1000;
  const [url] = await bucket.file(path).getSignedUrl({ action: "read", expires });
  return url;
}

exports.adminCreateProdWithStripe = onCall({ region: "europe-west1" }, async (request) => {
  try {
    console.info("[adminCreateProdWithStripe] start", {
      uid: request?.auth?.uid || null,
      hasData: !!request?.data
    });

    await assertAdmin(request.auth);

    const {
      titre,
      prix,
      audioUrl,
      imageUrl,
      stripePriceId = null,
      stripeProductId = null,
      bpm = null,
      genre = null,
      tags = [],
      audioPath = null,
      imagePath = null
    } = request.data || {};

    if (!titre || !audioUrl || !imageUrl) {
      throw new HttpsError("invalid-argument", "titre, audioUrl et imageUrl sont requis");
    }

    amountFromPriceEur(prix);

    const safeStripePriceId = String(stripePriceId || "").trim();
    const safeStripeProductId = String(stripeProductId || "").trim();
    if (!safeStripePriceId) {
      throw new HttpsError("invalid-argument", "stripePriceId requis");
    }

    console.info("[adminCreateProdWithStripe] validated", {
      titre: String(titre).trim(),
      prix: Number(prix),
      hasAudioUrl: !!audioUrl,
      hasImageUrl: !!imageUrl,
      stripePriceId: safeStripePriceId,
      stripeProductId: safeStripeProductId || null
    });

    const now = admin.firestore.FieldValue.serverTimestamp();
    const payload = {
      titre: String(titre).trim(),
      prix: Number(prix),
      audioUrl: String(audioUrl),
      imageUrl: String(imageUrl),
      stripe_product_id: safeStripeProductId || null,
      stripe_price_id: safeStripePriceId,
      stripeProductId: safeStripeProductId || null,
      stripePriceId: safeStripePriceId,
      bpm: bpm === null || bpm === "" ? null : Number(bpm),
      genre: genre ? String(genre).trim() : null,
      tags: normalizeTags(tags),
      audioPath: audioPath ? String(audioPath) : null,
      imagePath: imagePath ? String(imagePath) : null,
      createdAt: now,
      updatedAt: now,
      createdByUid: request.auth.uid
    };

    let ref;
    try {
      ref = await db.collection("prods").add(payload);
    } catch (error) {
      console.error("[adminCreateProdWithStripe] firestore add failed", error);
      throw toHttpsError(error, "Écriture Firestore impossible");
    }

    console.info("[adminCreateProdWithStripe] done", {
      prodId: ref.id,
      stripeProductId: safeStripeProductId || null,
      stripePriceId: safeStripePriceId
    });

    return {
      ok: true,
      prodId: ref.id,
      stripe_product_id: safeStripeProductId || null,
      stripe_price_id: safeStripePriceId,
      stripeProductId: safeStripeProductId || null,
      stripePriceId: safeStripePriceId
    };
  } catch (error) {
    console.error("adminCreateProdWithStripe error:", error);
    const normalized = toHttpsError(error, "Erreur Stripe lors de la création de la prod");
    return {
      ok: false,
      errorCode: normalized.code || "internal",
      errorMessage: normalized.message || "Erreur inconnue"
    };
  }
});

exports.adminUpdateProdWithStripe = onCall({ region: "europe-west1" }, async (request) => {
  try {
    await assertAdmin(request.auth);

    const {
      prodId,
      titre,
      prix,
      stripePriceId = null,
      stripeProductId = null,
      bpm = null,
      genre = null,
      tags = [],
      imageUrl = null
    } = request.data || {};
    if (!prodId) {
      throw new HttpsError("invalid-argument", "prodId requis");
    }

    const prodRef = db.collection("prods").doc(String(prodId));
    const prodSnap = await prodRef.get();
    if (!prodSnap.exists) {
      throw new HttpsError("not-found", "Prod introuvable");
    }

    const previous = prodSnap.data() || {};

    const safeTitre = String(titre || previous.titre || "").trim();
    if (!safeTitre) {
      throw new HttpsError("invalid-argument", "Titre invalide");
    }

    const updateData = {
      titre: safeTitre,
      bpm: bpm === null || bpm === "" ? null : Number(bpm),
      genre: genre ? String(genre).trim() : null,
      tags: normalizeTags(tags),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedByUid: request.auth.uid
    };

    if (imageUrl) {
      updateData.imageUrl = String(imageUrl);
    }

    const nextPrice = Number(prix);
    if (Number.isFinite(nextPrice) && nextPrice > 0) {
      updateData.prix = nextPrice;
    }

    const safeStripePriceId = String(stripePriceId || "").trim();
    if (safeStripePriceId) {
      updateData.stripe_price_id = safeStripePriceId;
      updateData.stripePriceId = safeStripePriceId;
    }

    const safeStripeProductId = String(stripeProductId || "").trim();
    if (safeStripeProductId) {
      updateData.stripe_product_id = safeStripeProductId;
      updateData.stripeProductId = safeStripeProductId;
    }

    await prodRef.update(updateData);
    return { success: true };
  } catch (error) {
    console.error("adminUpdateProdWithStripe error:", error);
    throw toHttpsError(error, "Erreur Stripe lors de la mise à jour de la prod");
  }
});

exports.adminDeleteProdWithStripe = onCall({ region: "europe-west1" }, async (request) => {
  await assertAdmin(request.auth);

  const { prodId } = request.data || {};
  if (!prodId) {
    throw new HttpsError("invalid-argument", "prodId requis");
  }

  const prodRef = db.collection("prods").doc(String(prodId));
  const prodSnap = await prodRef.get();
  if (!prodSnap.exists) {
    return { success: true };
  }

  await prodRef.delete();
  return { success: true };
});

exports.createCheckoutSession = onCall({ region: "europe-west1", secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "Connexion requise");
  }

  const { items, successUrl, cancelUrl } = request.data || {};
  if (!Array.isArray(items) || !items.length) {
    throw new HttpsError("invalid-argument", "Aucun article à payer");
  }
  if (!successUrl || !cancelUrl) {
    throw new HttpsError("invalid-argument", "URLs de redirection requises");
  }

  const stripe = stripeClient();
  const lineItems = [];

  for (const rawItem of items) {
    const prodId = String(rawItem?.prodId || "").trim();
    const qty = Math.max(1, Math.min(20, Number(rawItem?.quantity || 1)));
    if (!prodId) {
      continue;
    }

    const prodSnap = await db.collection("prods").doc(prodId).get();
    if (!prodSnap.exists) {
      throw new HttpsError("not-found", `Prod introuvable: ${prodId}`);
    }
    const prod = prodSnap.data() || {};
    const stripePriceId = prod.stripe_price_id || prod.stripePriceId;
    if (!stripePriceId) {
      throw new HttpsError("failed-precondition", `Prix Stripe manquant pour ${prodId}`);
    }

    lineItems.push({
      price: String(stripePriceId),
      quantity: qty
    });
  }

  if (!lineItems.length) {
    throw new HttpsError("invalid-argument", "Aucun article valide");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: String(successUrl),
    cancel_url: String(cancelUrl),
    client_reference_id: auth.uid,
    metadata: {
      uid: auth.uid
    }
  });

  return { url: session.url };
});

exports.verifyCheckoutAndBootstrapContract = onCall({ region: "europe-west1", secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "Connexion requise");
  }

  const sessionId = String(request.data?.sessionId || "").trim();
  if (!sessionId) {
    throw new HttpsError("invalid-argument", "sessionId requis");
  }

  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session || session.payment_status !== "paid") {
    throw new HttpsError("failed-precondition", "Paiement non confirmé");
  }

  const contract = await findOrCreateContractFromSession(session);
  const signUrl = `${SITE_URL}/contracts/sign-contract.html?token=${encodeURIComponent(contract.data.signatureToken)}`;

  return {
    contractId: contract.id,
    signUrl,
    status: contract.data.signatureStatus || "pending"
  };
});

exports.getSignatureRequest = onCall({ region: "europe-west1" }, async (request) => {
  const token = String(request.data?.token || "").trim();
  if (!token) {
    throw new HttpsError("invalid-argument", "token requis");
  }

  const snap = await findContractByToken(token);
  if (!snap) {
    throw new HttpsError("not-found", "Demande introuvable");
  }

  const data = snap.data() || {};
  if (data.signatureStatus !== "pending") {
    throw new HttpsError("failed-precondition", "Signature non disponible");
  }

  const expiresAt = data?.tokenExpiresAt?.toMillis?.() || 0;
  if (expiresAt && Date.now() > expiresAt) {
    await snap.ref.update({ signatureStatus: "expired", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    throw new HttpsError("deadline-exceeded", "Demande expirée");
  }

  return {
    contractId: snap.id,
    customerName: data.customerName || "",
    customerEmail: data.customerEmail || "",
    trackName: data.trackName || "",
    licenseType: data.licenseType || "",
    generatedPdfUrl: data.generatedPdfPath ? await createSignedUrl(data.generatedPdfPath, 20) : null
  };
});

exports.submitSignature = onCall({ region: "europe-west1" }, async (request) => {
  const token = String(request.data?.token || "").trim();
  const signatureDataUrl = String(request.data?.signatureDataUrl || "").trim();
  const signatoryName = String(request.data?.signatoryName || "").trim();
  const signatoryEmail = String(request.data?.signatoryEmail || "").trim();

  if (!token || !signatureDataUrl) {
    throw new HttpsError("invalid-argument", "token et signature requis");
  }

  const snap = await findContractByToken(token);
  if (!snap) {
    throw new HttpsError("not-found", "Demande introuvable");
  }

  const data = snap.data() || {};
  if (data.signatureStatus === "signed") {
    return {
      success: true,
      contractId: snap.id,
      signedPdfUrl: data.signedPdfPath ? await createSignedUrl(data.signedPdfPath, 120) : null
    };
  }

  const expiresAt = data?.tokenExpiresAt?.toMillis?.() || 0;
  if (expiresAt && Date.now() > expiresAt) {
    await snap.ref.update({ signatureStatus: "expired", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    throw new HttpsError("deadline-exceeded", "Demande expirée");
  }

  const base64 = signatureDataUrl.replace(/^data:image\/png;base64,/, "");
  if (!base64) {
    throw new HttpsError("invalid-argument", "Signature vide");
  }

  const signatureBuffer = Buffer.from(base64, "base64");
  const signatureImagePath = `contracts/signatures/${snap.id}.png`;

  await bucket.file(signatureImagePath).save(signatureBuffer, {
    resumable: false,
    contentType: "image/png",
    metadata: { cacheControl: "private, max-age=0, no-store" }
  });

  await snap.ref.update({
    signatureStatus: "signed",
    signatureImagePath,
    signedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    signatoryName: signatoryName || data.customerName || null,
    signatoryEmail: signatoryEmail || data.customerEmail || null
  });

  return { success: true, contractId: snap.id, signedPdfUrl: null };
});

exports.listContractsForAdminCallable = onCall({ region: "europe-west1" }, async (request) => {
  await assertAdmin(request.auth);

  const rawLimit = Number(request.data?.limit || 100);
  const limit = Math.min(Math.max(rawLimit, 1), 200);
  const status = String(request.data?.status || "").trim().toLowerCase();

  let query = db.collection("contracts").orderBy("createdAt", "desc").limit(limit);
  if (status) {
    query = db.collection("contracts").where("signatureStatus", "==", status).orderBy("createdAt", "desc").limit(limit);
  }

  const snap = await query.get();
  const contracts = snap.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      orderId: data.orderId || null,
      customerName: data.customerName || null,
      customerEmail: data.customerEmail || null,
      trackName: data.trackName || null,
      licenseType: data.licenseType || null,
      status: data.signatureStatus || "pending",
      createdAt: data?.createdAt?.toDate?.()?.toISOString?.() || null,
      signedAt: data?.signedAt?.toDate?.()?.toISOString?.() || null
    };
  });

  return { contracts };
});

exports.getContractDownloadUrlCallable = onCall({ region: "europe-west1" }, async (request) => {
  await assertAdmin(request.auth);

  const contractId = String(request.data?.contractId || "").trim();
  const variant = String(request.data?.variant || "generated").trim();
  if (!contractId) {
    throw new HttpsError("invalid-argument", "contractId requis");
  }

  const snap = await db.collection("contracts").doc(contractId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Contrat introuvable");
  }

  const data = snap.data() || {};
  const path = variant === "signed" ? data.signedPdfPath : data.generatedPdfPath;
  if (!path) {
    return { url: null };
  }

  const url = await createSignedUrl(String(path), 120);
  return { url };
});

exports.adminSendBrevoEmail = onCall(
  { region: "europe-west1", secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL", "BREVO_FROM_NAME"] },
  async (request) => {
    await assertAdmin(request.auth);

    const toEmail = String(request?.data?.toEmail || "").trim();
    const artistName = String(request?.data?.artistName || "Artiste").trim();
    const subject = String(request?.data?.subject || "").trim();
    const body = String(request?.data?.body || "").trim();

    if (!toEmail) throw new HttpsError("invalid-argument", "toEmail est requis");
    if (!subject) throw new HttpsError("invalid-argument", "subject est requis");
    if (!body) throw new HttpsError("invalid-argument", "body est requis");

    const brevoApiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.BREVO_FROM_EMAIL || "no-reply@mm-cp.uk";
    const fromName = process.env.BREVO_FROM_NAME || "Morgann Music CP";

    if (!brevoApiKey) {
      throw new HttpsError("failed-precondition", "BREVO_API_KEY manquant dans les secrets Functions");
    }

    const esc = (text) => String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

    const safeArtist = esc(artistName);
    const safeSubject = esc(subject);
    const safeBody = esc(body).replace(/\n/g, "<br>");
    const safeDashUrl = esc(`${SITE_URL}/dash/`);

    const htmlContent = `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#111827;color:#ffffff;padding:22px 24px;font-size:18px;font-weight:700;">Morgann Music CP</td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Message pour ${safeArtist}</p>
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#111827;">${safeSubject}</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${safeBody}</p>
                <p style="margin:24px 0 0;">
                  <a href="${safeDashUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:11px 16px;border-radius:999px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Ouvrir le dashboard</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": brevoApiKey
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: toEmail, name: artistName || undefined }],
        subject,
        htmlContent,
        textContent: body
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.message || `Brevo HTTP ${response.status}`;
      throw new HttpsError("internal", message);
    }

    return {
      success: true,
      provider: "brevo",
      messageId: payload?.messageId || null
    };
  }
);

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeUserEmailPreferences(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const security = source.security && typeof source.security === "object" ? source.security : {};
  const loginEmail = security.loginEmail && typeof security.loginEmail === "object" ? security.loginEmail : {};

  return {
    loginEmailEnabled: loginEmail.enabled !== false
  };
}

async function sendBrevoSmtpEmail({ toEmail, toName, subject, htmlContent, textContent }) {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL || "no-reply@mm-cp.uk";
  const fromName = process.env.BREVO_FROM_NAME || "Morgann Music CP";

  if (!brevoApiKey) {
    throw new HttpsError("failed-precondition", "BREVO_API_KEY manquant dans les secrets Functions");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": brevoApiKey
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: toEmail, name: toName || undefined }],
      subject,
      htmlContent,
      textContent
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || `Brevo HTTP ${response.status}`;
    throw new HttpsError("internal", message);
  }

  return payload?.messageId || null;
}

function buildAuthEmailContent({ type, firstName, dashboardUrl, loginAtIso }) {
  const safeFirstName = escapeHtml(firstName || "Artiste");
  const safeDashboardUrl = escapeHtml(dashboardUrl);

  if (type === "welcome") {
    return {
      subject: "Bienvenue chez Morgann Music CP",
      text: `Bienvenue ${firstName || "Artiste"}, ton compte est actif. Accede au dashboard: ${dashboardUrl}`,
      html: `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bienvenue</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#111827;color:#ffffff;padding:22px 24px;font-size:18px;font-weight:700;">Morgann Music CP</td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#111827;">Bienvenue ${safeFirstName}</h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">Ton compte est maintenant actif. Tu peux publier ta musique et gerer tes sorties depuis ton dashboard.</p>
                <p style="margin:24px 0 0;">
                  <a href="${safeDashboardUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:11px 16px;border-radius:999px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Ouvrir le dashboard</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
    };
  }

  const safeDate = escapeHtml(loginAtIso || new Date().toISOString());
  return {
    subject: "Nouvelle connexion a ton compte",
    text: `Bonjour ${firstName || "Artiste"}, une connexion a ete detectee sur ton compte le ${loginAtIso || new Date().toISOString()}.`,
    html: `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nouvelle connexion</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#111827;color:#ffffff;padding:22px 24px;font-size:18px;font-weight:700;">Alerte de connexion</td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">Bonjour ${safeFirstName},</p>
                <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">Une connexion a ete detectee sur ton compte le <strong>${safeDate}</strong>.</p>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#6b7280;">Si ce n'etait pas toi, change ton mot de passe immediatement dans les reglages du compte.</p>
                <p style="margin:0;">
                  <a href="${safeDashboardUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:11px 16px;border-radius:999px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Ouvrir mon compte</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
  };
}

exports.sendAuthEmailNotification = onCall(
  { region: "europe-west1", secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL", "BREVO_FROM_NAME"] },
  async (request) => {
    const auth = request.auth;
    if (!auth?.uid) {
      throw new HttpsError("unauthenticated", "Connexion requise");
    }

    const type = String(request?.data?.type || "").trim().toLowerCase();
    if (type !== "welcome" && type !== "login") {
      throw new HttpsError("invalid-argument", "type invalide (welcome|login)");
    }

    const userRecord = await admin.auth().getUser(auth.uid);
    const toEmail = String(userRecord.email || "").trim();
    if (!toEmail) {
      throw new HttpsError("failed-precondition", "Email utilisateur introuvable");
    }

    const userRef = db.collection("users").doc(auth.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const prefs = normalizeUserEmailPreferences(userData.emailPreferences);

    if (type === "login" && !prefs.loginEmailEnabled) {
      return { success: true, skipped: true, reason: "preference-disabled" };
    }

    const authMeta = userData.authEmailMeta && typeof userData.authEmailMeta === "object" ? userData.authEmailMeta : {};
    if (type === "welcome" && authMeta.welcomeSentAt) {
      return { success: true, skipped: true, reason: "welcome-already-sent" };
    }

    const firstName = String(request?.data?.firstName || userData.firstName || userRecord.displayName || "Artiste").trim();
    const dashboardUrl = `${SITE_URL}/dash/index.html`;
    const loginAtIso = new Date().toISOString();
    const content = buildAuthEmailContent({ type, firstName, dashboardUrl, loginAtIso });

    const messageId = await sendBrevoSmtpEmail({
      toEmail,
      toName: firstName,
      subject: content.subject,
      htmlContent: content.html,
      textContent: content.text
    });

    const updatePayload = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (type === "welcome") {
      updatePayload["authEmailMeta.welcomeSentAt"] = admin.firestore.FieldValue.serverTimestamp();
    }
    if (type === "login") {
      updatePayload["authEmailMeta.lastLoginEmailAt"] = admin.firestore.FieldValue.serverTimestamp();
    }

    await userRef.set(updatePayload, { merge: true });

    return {
      success: true,
      skipped: false,
      type,
      messageId
    };
  }
);

// --- Liste des utilisateurs Firebase pour l'admin ---

// --- Webhook Stripe : mise à jour du plan après paiement ---
exports.stripeWebhookPlan = onRequest(
  { region: "europe-west1", secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).send("Signature ou secret manquant");
    }

    let event;
    try {
      const Stripe = require("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("[stripeWebhookPlan] Signature invalide:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const userId = paymentIntent.metadata?.userId;
      const planName = paymentIntent.metadata?.planName;

      if (userId && planName) {
        try {
          await db.collection("users").doc(userId).update({
            plan: planName,
            planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.info(`[stripeWebhookPlan] Plan mis à jour : ${userId} → ${planName}`);
        } catch (err) {
          console.error("[stripeWebhookPlan] Erreur Firestore:", err);
          return res.status(500).send("Erreur Firestore");
        }
      }
    }

    return res.json({ received: true });
  }
);

exports.listUsers = onRequest(async (req, res) => {
  // Sécurité : vérifier que l'utilisateur est admin
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
    if (!idToken) return res.status(401).json({ error: "Token manquant" });
    const decoded = await admin.auth().verifyIdToken(idToken);
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    const role = userSnap.exists ? String(userSnap.data().role || "").toLowerCase() : "";
    if (role !== "admin") return res.status(403).json({ error: "Accès admin requis" });

    let users = [];
    let nextPageToken;
    do {
      const result = await admin.auth().listUsers(1000, nextPageToken);
      users = users.concat(result.users.map(u => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName
      })));
      nextPageToken = result.pageToken;
    } while (nextPageToken);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});