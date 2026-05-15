"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContractAudioDownloadsCallable = exports.getContractDownloadUrlCallable = exports.listContractsForAdminCallable = exports.submitSignature = exports.getSignatureRequest = exports.createSignatureRequest = exports.passwordResetCompleteV2 = exports.passwordResetVerifyTotpV2 = exports.passwordResetStartV2 = exports.email2faVerifyLoginChallenge = exports.email2faStartLoginChallenge = exports.totpVerifyLoginChallengeV2 = exports.totpDisableV2 = exports.totpConfirmEnrollmentV2 = exports.totpBeginEnrollment = exports.totpGetStatus = exports.stripeContractsWebhook = exports.verifyReleasePaymentAndCredit = exports.createReleaseCheckoutSession = exports.verifyCheckoutAndBootstrapContract = exports.createCheckoutSession = exports.adminDeleteProdWithStripe = exports.adminUpdateProdWithStripe = exports.adminCreateProdWithStripe = exports.notifyWhenReleaseDateReached = exports.notifyWhenReleaseStatusBeyondValidated = exports.emailArtistOnNotificationCreated = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const speakeasy_1 = __importDefault(require("speakeasy"));
const crypto_1 = __importDefault(require("crypto"));
const stripe_1 = require("./stripe");
const generateContract_1 = require("./contracts/generateContract");
const createSignatureRequest_1 = require("./contracts/createSignatureRequest");
const getSignatureRequest_1 = require("./contracts/getSignatureRequest");
const submitSignature_1 = require("./contracts/submitSignature");
const listContractsForAdmin_1 = require("./contracts/listContractsForAdmin");
const getContractDownloadUrl_1 = require("./contracts/getContractDownloadUrl");
const getContractAudioDownloads_1 = require("./contracts/getContractAudioDownloads");
if (!firebase_admin_1.default.apps.length)
    firebase_admin_1.default.initializeApp();
const db = firebase_admin_1.default.firestore();
const SITE_URL = process.env.SITE_URL || "https://mm-cp.uk";
async function requireAuth(auth) {
    if (!auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Connexion requise");
    return auth.uid;
}
async function assertAdmin(auth) {
    if (!auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Connexion requise");
    }
    const userSnap = await db.collection("users").doc(auth.uid).get();
    const role = userSnap.exists ? String(userSnap.data()?.role || "").toLowerCase() : "";
    if (role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Accès admin requis");
    }
}
function normalizeTags(tags) {
    if (!Array.isArray(tags))
        return [];
    return tags
        .map((tag) => String(tag || "").trim())
        .filter(Boolean)
        .slice(0, 30);
}
function amountFromPriceEur(price) {
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) {
        throw new https_1.HttpsError("invalid-argument", "Prix invalide");
    }
    return Math.round(value * 100);
}
function toHttpsError(error, fallbackMessage) {
    if (error instanceof https_1.HttpsError) {
        return error;
    }
    const message = error?.raw?.message || error?.message || fallbackMessage;
    return new https_1.HttpsError("failed-precondition", message);
}
function clean(value) {
    return String(value || "").trim();
}
function escHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function normalizeIsoDate(raw) {
    const value = clean(raw);
    if (!value)
        return "";
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
}
function nowIsoDateUtc() {
    return new Date().toISOString().slice(0, 10);
}
function pickReleaseDate(data) {
    return normalizeIsoDate(data?.schedule?.releaseDate || data?.releaseDate);
}
function parseStatusCode(data) {
    const numeric = Number(data?.statusCode);
    if (Number.isFinite(numeric) && numeric > 0)
        return numeric;
    const merged = [
        data?.status,
        data?.statusUser,
        data?.statusAdmin,
        data?.statusPlatform
    ].map((v) => clean(v).toLowerCase()).join(" | ");
    if (!merged)
        return 1;
    if (merged.includes("en ligne") || merged.includes("status-4") || merged.includes("🎵"))
        return 4;
    if (merged.includes("livr") || merged.includes("plateforme") || merged.includes("status-3") || merged.includes("🚀"))
        return 3;
    if (merged.includes("valid") || merged.includes("status-2") || merged.includes("✅"))
        return 2;
    if (merged.includes("refus") || merged.includes("status-5") || merged.includes("❌"))
        return 5;
    return 1;
}
async function sendBrevoEmail(params) {
    const brevoApiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.BREVO_FROM_EMAIL || "no-reply@mm-cp.uk";
    const fromName = process.env.BREVO_FROM_NAME || "Morgann Music CP";
    if (!brevoApiKey) {
        throw new Error("BREVO_API_KEY manquant");
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
            to: [{ email: params.toEmail, name: params.toName || undefined }],
            subject: params.subject,
            htmlContent: params.htmlContent,
            textContent: params.textContent
        })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || `Brevo HTTP ${response.status}`);
    }
    return { messageId: payload?.messageId || null };
}
function buildNotificationEmailTemplate(params) {
    const safeTitle = escHtml(params.title || "Nouvelle notification");
    const safeMessage = escHtml(params.message || "Tu as reçu une nouvelle notification.").replace(/\n/g, "<br>");
    const safeCtaUrl = escHtml(params.ctaUrl);
    const safeCtaText = escHtml(params.ctaText || "Voir la notification");
    const logoUrl = escHtml(`${SITE_URL}/MMCP.svg`);
    return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Morgann Music CP</title>
  </head>
  <body style="margin:0;padding:0;background:#e2e2e2;font-family:Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:22px 24px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
                <img src="${logoUrl}" alt="Morgann Music CP" width="140" style="display:block;border:0;max-width:100%;height:auto;" />
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 10px;font-size:22px;line-height:1.3;font-weight:700;color:#111827;">${safeTitle}</p>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">${safeMessage}</p>
                <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;font-size:14px;">${safeCtaText}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:12px;line-height:1.6;color:#6b7280;">
                Morgann Music CP · Distribution, label services & accompagnement artistes.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
async function getRecipientFromNotification(data) {
    const userUid = clean(data?.userUid || data?.uid || data?.ownerUid);
    const targetEmail = clean(data?.targetEmail || data?.email);
    if (targetEmail) {
        return {
            toEmail: targetEmail,
            toName: clean(data?.artistName || data?.recipientName || "Artiste")
        };
    }
    if (!userUid)
        return null;
    const userSnap = await db.collection("users").doc(userUid).get();
    if (!userSnap.exists)
        return null;
    const user = userSnap.data() || {};
    const email = clean(user.email);
    if (!email)
        return null;
    return {
        toEmail: email,
        toName: clean(user.artistName || user.displayName || user.name || "Artiste")
    };
}
exports.emailArtistOnNotificationCreated = (0, firestore_1.onDocumentCreated)({
    region: "europe-west1",
    document: "notifications/{notificationId}"
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data() || {};
    if (data?.emailSentAt)
        return;
    const recipient = await getRecipientFromNotification(data);
    if (!recipient?.toEmail) {
        console.info("[emailArtistOnNotificationCreated] skip: no recipient", { id: snap.id });
        return;
    }
    const title = clean(data.title) || "Tu as reçu une notification";
    const message = clean(data.message) || "Il y a une notif sur ton dashboard artiste.";
    const ctaUrl = `${SITE_URL}/dash/notifications.html`;
    const htmlContent = buildNotificationEmailTemplate({
        title,
        message,
        ctaUrl,
        ctaText: "Voir la notification"
    });
    const textContent = `${title}\n\n${message}\n\n${ctaUrl}`;
    try {
        const sent = await sendBrevoEmail({
            toEmail: recipient.toEmail,
            toName: recipient.toName,
            subject: title,
            htmlContent,
            textContent
        });
        await snap.ref.set({
            emailSentAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
            emailProvider: "brevo",
            emailMessageId: sent.messageId || null,
            emailTo: recipient.toEmail
        }, { merge: true });
    }
    catch (error) {
        console.error("[emailArtistOnNotificationCreated] send failed", {
            id: snap.id,
            error: error?.message || String(error)
        });
    }
});
exports.notifyWhenReleaseStatusBeyondValidated = (0, firestore_1.onDocumentUpdated)({
    region: "europe-west1",
    document: "releases/{releaseId}"
}, async (event) => {
    const before = event.data?.before?.data() || null;
    const after = event.data?.after?.data() || null;
    if (!before || !after)
        return;
    const beforeCode = parseStatusCode(before);
    const afterCode = parseStatusCode(after);
    if (!(beforeCode <= 2 && afterCode > 2))
        return;
    const ownerUid = clean(after.ownerUid);
    if (!ownerUid)
        return;
    if (after?.emailEvents?.statusBeyondValidatedNotifiedAt)
        return;
    const releaseId = event.params.releaseId;
    const releaseTitle = clean(after.title) || "Sortie";
    const statusLabel = clean(after.statusUser || after.status || "Statut mis à jour");
    const notifRef = db.collection("notifications").doc();
    await db.runTransaction(async (tx) => {
        const fresh = await tx.get(event.data.after.ref);
        const freshData = fresh.data() || {};
        if (freshData?.emailEvents?.statusBeyondValidatedNotifiedAt)
            return;
        tx.set(notifRef, {
            userUid: ownerUid,
            releaseId,
            releaseTitle,
            type: "release_status_beyond_validated",
            statusCode: afterCode,
            statusLabel,
            message: `Le statut de ta sortie \"${releaseTitle}\" a avancé : ${statusLabel}.`,
            read: false,
            createdAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
            source: "functions.release-status-transition"
        });
        tx.set(event.data.after.ref, {
            emailEvents: {
                statusBeyondValidatedNotifiedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                statusBeyondValidatedNotificationId: notifRef.id
            }
        }, { merge: true });
    });
});
exports.notifyWhenReleaseDateReached = (0, scheduler_1.onSchedule)({
    region: "europe-west1",
    schedule: "every 60 minutes",
    timeZone: "Europe/Paris"
}, async () => {
    const today = nowIsoDateUtc();
    const [scheduleSnap, directSnap] = await Promise.all([
        db.collection("releases").where("schedule.releaseDate", "<=", today).limit(250).get(),
        db.collection("releases").where("releaseDate", "<=", today).limit(250).get()
    ]);
    const docs = new Map();
    scheduleSnap.docs.forEach((doc) => docs.set(doc.id, doc));
    directSnap.docs.forEach((doc) => docs.set(doc.id, doc));
    let created = 0;
    for (const releaseDoc of docs.values()) {
        const release = releaseDoc.data() || {};
        const releaseDate = pickReleaseDate(release);
        if (!releaseDate || releaseDate > today)
            continue;
        if (release?.emailEvents?.releaseDateReachedNotifiedAt)
            continue;
        const statusCode = parseStatusCode(release);
        if (statusCode < 2)
            continue;
        const ownerUid = clean(release.ownerUid);
        if (!ownerUid)
            continue;
        const notifRef = db.collection("notifications").doc();
        const releaseTitle = clean(release.title) || "Sortie";
        await db.runTransaction(async (tx) => {
            const fresh = await tx.get(releaseDoc.ref);
            const freshData = fresh.data() || {};
            const freshDate = pickReleaseDate(freshData);
            if (!freshDate || freshDate > today)
                return;
            if (freshData?.emailEvents?.releaseDateReachedNotifiedAt)
                return;
            if (parseStatusCode(freshData) < 2)
                return;
            tx.set(notifRef, {
                userUid: ownerUid,
                releaseId: releaseDoc.id,
                releaseTitle,
                type: "release_date_reached",
                message: `Ta sortie \"${releaseTitle}\" est maintenant disponible (date de sortie atteinte).`,
                read: false,
                createdAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                source: "functions.release-date-scheduler"
            });
            tx.set(releaseDoc.ref, {
                emailEvents: {
                    releaseDateReachedNotifiedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                    releaseDateReachedNotificationId: notifRef.id
                }
            }, { merge: true });
        });
        created += 1;
    }
    console.info("[notifyWhenReleaseDateReached] done", { scanned: docs.size, created, today });
});
function normalizeTotpToken(rawToken) {
    return String(rawToken || "").replace(/\s+/g, "").replace(/[^0-9]/g, "").slice(0, 8);
}
function buildOtpAuthUrl(secretBase32, accountLabel) {
    return speakeasy_1.default.otpauthURL({
        secret: secretBase32,
        label: `Morgann Music CP (${accountLabel})`,
        issuer: "Morgann Music CP",
        encoding: "base32"
    });
}
function verifyTotpToken(secretBase32, token) {
    return speakeasy_1.default.totp.verify({
        secret: secretBase32,
        encoding: "base32",
        token,
        window: 2
    });
}
async function getUserTotpConfig(uid) {
    const snap = await db.collection("users").doc(uid).get();
    const data = snap.exists ? (snap.data() || {}) : {};
    const totp = data?.security?.totp || {};
    return {
        enabled: totp?.enabled === true,
        secret: String(totp?.secret || "").trim(),
        tempSecret: String(totp?.tempSecret || "").trim()
    };
}
function hashEmail2faCode(value) {
    return crypto_1.default.createHash("sha256").update(String(value || "")).digest("hex");
}
function createEmail2faCode() {
    return String(crypto_1.default.randomInt(100000, 1000000));
}
function maskEmail(email) {
    const raw = clean(email).toLowerCase();
    const [local, domain] = raw.split("@");
    if (!local || !domain)
        return "ton email";
    const localMasked = local.length <= 2 ? `${local[0] || "*"}*` : `${local.slice(0, 2)}***`;
    const [domainName, tld] = domain.split(".");
    if (!domainName)
        return `${localMasked}@***`;
    const domainMasked = domainName.length <= 2 ? `${domainName[0] || "*"}*` : `${domainName.slice(0, 2)}***`;
    return `${localMasked}@${domainMasked}${tld ? `.${tld}` : ""}`;
}
function getEmail2faPreference(userData) {
    const prefs = userData?.emailPreferences && typeof userData.emailPreferences === "object" ? userData.emailPreferences : {};
    const security = prefs.security && typeof prefs.security === "object" ? prefs.security : {};
    const email2fa = security.email2fa && typeof security.email2fa === "object" ? security.email2fa : {};
    return email2fa.enabled === true;
}
function buildEmail2faTemplate(params) {
    const safeName = escHtml(params.firstName || "Artiste");
    const safeCode = escHtml(params.code || "");
    const safeExpire = Math.max(1, Number(params.expiresMinutes || 10));
    return {
        subject: "Code de connexion sécurisé",
        textContent: `Bonjour ${params.firstName || "Artiste"}, ton code de vérification est ${params.code}. Il expire dans ${safeExpire} minutes.`,
        htmlContent: `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Code de connexion</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#111827;color:#ffffff;padding:22px 24px;font-size:18px;font-weight:700;">Vérification 2FA email</td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">Bonjour ${safeName},</p>
                <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">Utilise ce code pour finaliser ta connexion :</p>
                <p style="margin:0 0 18px;font-size:30px;letter-spacing:4px;font-weight:700;color:#111827;">${safeCode}</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">Ce code expire dans ${safeExpire} minutes. Ne le partage jamais.</p>
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
function hashPasswordResetToken(value) {
    return crypto_1.default.createHash("sha256").update(String(value || "")).digest("hex");
}
function createPasswordResetToken() {
    return crypto_1.default.randomBytes(32).toString("hex");
}
function normalizePasswordResetToken(value) {
    return String(value || "").trim().replace(/[^a-f0-9]/gi, "").toLowerCase();
}
function normalizePasswordValue(value) {
    return String(value || "");
}
function assertStrongEnoughPassword(password) {
    if (password.length < 8) {
        throw new https_1.HttpsError("invalid-argument", "Le mot de passe doit contenir au moins 8 caractères.");
    }
}
function buildPasswordResetEmailTemplate(params) {
    const safeName = escHtml(params.firstName || "Artiste");
    const safeUrl = escHtml(params.resetUrl || SITE_URL);
    const safeExpire = Math.max(1, Number(params.expiresMinutes || 15));
    return {
        subject: "Réinitialisation du mot de passe",
        textContent: `Bonjour ${params.firstName || "Artiste"}, clique sur ce lien pour réinitialiser ton mot de passe: ${params.resetUrl}. Ce lien expire dans ${safeExpire} minutes.`,
        htmlContent: `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Réinitialisation du mot de passe</title>
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
                <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">Bonjour ${safeName},</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">Tu as demandé une réinitialisation de mot de passe. Vérifie ton code authentificateur sur la page suivante:</p>
                <p style="margin:0 0 18px;">
                  <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;font-size:14px;">Réinitialiser mon mot de passe</a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">Ce lien expire dans ${safeExpire} minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
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
function mapSessionToInput(session) {
    const customerDetails = session.customer_details;
    const purchasedProdIds = String(session.metadata?.purchasedProdIds || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 50);
    return {
        orderId: String(session.client_reference_id || session.id),
        stripeSessionId: session.id,
        stripePaymentIntentId: String(session.payment_intent || ""),
        purchasedProdIds,
        customerName: customerDetails?.name || "Client",
        customerEmail: customerDetails?.email || "",
        customerAddress: [
            customerDetails?.address?.line1,
            customerDetails?.address?.line2,
            customerDetails?.address?.postal_code,
            customerDetails?.address?.city,
            customerDetails?.address?.country
        ].filter(Boolean).join(", "),
        trackName: String(session.metadata?.trackName || "Track"),
        licenseType: String(session.metadata?.licenseType || "exclusive"),
        amount: Number(session.amount_total || 0),
        currency: String(session.currency || "eur")
    };
}
exports.adminCreateProdWithStripe = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    try {
        await assertAdmin(request.auth);
        const { titre, prix, audioUrl, imageUrl, stripePriceId = null, stripeProductId = null, bpm = null, genre = null, tags = [], audioPath = null, imagePath = null } = request.data || {};
        if (!titre || !audioUrl || !imageUrl) {
            throw new https_1.HttpsError("invalid-argument", "titre, audioUrl et imageUrl sont requis");
        }
        amountFromPriceEur(prix);
        const safeStripePriceId = String(stripePriceId || "").trim();
        const safeStripeProductId = String(stripeProductId || "").trim();
        if (!safeStripePriceId) {
            throw new https_1.HttpsError("invalid-argument", "stripePriceId requis");
        }
        const now = firebase_admin_1.default.firestore.FieldValue.serverTimestamp();
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
        const ref = await db.collection("prods").add(payload);
        return {
            ok: true,
            prodId: ref.id,
            stripe_product_id: safeStripeProductId || null,
            stripe_price_id: safeStripePriceId,
            stripeProductId: safeStripeProductId || null,
            stripePriceId: safeStripePriceId
        };
    }
    catch (error) {
        const normalized = toHttpsError(error, "Erreur Stripe lors de la création de la prod");
        return {
            ok: false,
            errorCode: normalized.code || "internal",
            errorMessage: normalized.message || "Erreur inconnue"
        };
    }
});
exports.adminUpdateProdWithStripe = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    try {
        await assertAdmin(request.auth);
        const { prodId, titre, prix, stripePriceId = null, stripeProductId = null, bpm = null, genre = null, tags = [], imageUrl = null } = request.data || {};
        if (!prodId) {
            throw new https_1.HttpsError("invalid-argument", "prodId requis");
        }
        const prodRef = db.collection("prods").doc(String(prodId));
        const prodSnap = await prodRef.get();
        if (!prodSnap.exists) {
            throw new https_1.HttpsError("not-found", "Prod introuvable");
        }
        const previous = prodSnap.data() || {};
        const safeTitre = String(titre || previous.titre || "").trim();
        if (!safeTitre) {
            throw new https_1.HttpsError("invalid-argument", "Titre invalide");
        }
        const updateData = {
            titre: safeTitre,
            bpm: bpm === null || bpm === "" ? null : Number(bpm),
            genre: genre ? String(genre).trim() : null,
            tags: normalizeTags(tags),
            updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
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
    }
    catch (error) {
        throw toHttpsError(error, "Erreur Stripe lors de la mise à jour de la prod");
    }
});
exports.adminDeleteProdWithStripe = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    await assertAdmin(request.auth);
    const { prodId } = request.data || {};
    if (!prodId) {
        throw new https_1.HttpsError("invalid-argument", "prodId requis");
    }
    const prodRef = db.collection("prods").doc(String(prodId));
    const prodSnap = await prodRef.get();
    if (!prodSnap.exists) {
        return { success: true };
    }
    await prodRef.delete();
    return { success: true };
});
exports.createCheckoutSession = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const auth = request.auth;
    if (!auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Connexion requise");
    }
    const { items, successUrl, cancelUrl } = request.data || {};
    if (!Array.isArray(items) || !items.length) {
        throw new https_1.HttpsError("invalid-argument", "Aucun article à payer");
    }
    if (!successUrl || !cancelUrl) {
        throw new https_1.HttpsError("invalid-argument", "URLs de redirection requises");
    }
    const stripe = (0, stripe_1.getStripeClient)(process.env.STRIPE_SECRET_KEY);
    const lineItems = [];
    const selectedTitles = [];
    const selectedProdIds = [];
    let selectedLicenseType = "exclusive";
    for (const rawItem of items) {
        const prodId = String(rawItem?.prodId || "").trim();
        const qty = Math.max(1, Math.min(20, Number(rawItem?.quantity || 1)));
        if (!prodId)
            continue;
        selectedProdIds.push(prodId);
        const prodSnap = await db.collection("prods").doc(prodId).get();
        if (!prodSnap.exists) {
            throw new https_1.HttpsError("not-found", `Prod introuvable: ${prodId}`);
        }
        const prod = prodSnap.data() || {};
        const stripePriceId = prod.stripe_price_id || prod.stripePriceId;
        if (!stripePriceId) {
            throw new https_1.HttpsError("failed-precondition", `Prix Stripe manquant pour ${prodId}`);
        }
        selectedTitles.push(String(prod.titre || "").trim());
        if (prod.licenseType) {
            selectedLicenseType = String(prod.licenseType || "exclusive").trim() || "exclusive";
        }
        lineItems.push({
            price: String(stripePriceId),
            quantity: qty
        });
    }
    if (!lineItems.length) {
        throw new https_1.HttpsError("invalid-argument", "Aucun article valide");
    }
    const compactTitles = selectedTitles.filter(Boolean);
    const trackName = compactTitles.length <= 1
        ? (compactTitles[0] || "Track")
        : `Panier (${compactTitles.length} prods)`;
    const purchasedProdIds = selectedProdIds.filter(Boolean).slice(0, 50).join(",");
    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        billing_address_collection: "required",
        phone_number_collection: { enabled: true },
        success_url: String(successUrl),
        cancel_url: String(cancelUrl),
        client_reference_id: auth.uid,
        metadata: {
            uid: auth.uid,
            trackName,
            licenseType: selectedLicenseType,
            purchasedProdIds
        }
    });
    return { url: session.url };
});
exports.verifyCheckoutAndBootstrapContract = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    await requireAuth(request.auth);
    const sessionId = String(request.data?.sessionId || "").trim();
    if (!sessionId)
        throw new https_1.HttpsError("invalid-argument", "sessionId requis");
    const stripe = (0, stripe_1.getStripeClient)(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid")
        throw new https_1.HttpsError("failed-precondition", "Paiement non confirmé");
    const contract = await (0, generateContract_1.createContractFromOrder)(mapSessionToInput(session));
    const sign = await (0, createSignatureRequest_1.createSignatureRequestFromOrder)(contract.orderId, SITE_URL);
    return { contractId: contract.id, signUrl: sign.signUrl, status: contract.signatureStatus };
});
// ─── Paiement par sortie ──────────────────────────────────────────────────────
const ALLOWED_CHECKOUT_URL_PREFIXES = [
    "https://mm-cp.uk/",
    "https://www.mm-cp.uk/",
    "http://localhost:",
    "http://127.0.0.1:",
];
function isAllowedCheckoutUrl(url) {
    return ALLOWED_CHECKOUT_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}
/**
 * Crée une session Stripe Checkout en mode paiement unique (pay-per-release).
 * Requiert une authentification Firebase. Le prix Stripe doit être configuré via
 * la variable d'environnement STRIPE_RELEASE_PRICE_ID (non sensible, sans secret).
 */
exports.createReleaseCheckoutSession = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = await requireAuth(request.auth);
    const { successUrl, cancelUrl, releaseId } = request.data || {};
    if (typeof successUrl !== "string" || !isAllowedCheckoutUrl(successUrl)) {
        throw new https_1.HttpsError("invalid-argument", "successUrl invalide ou domaine non autorisé");
    }
    if (typeof cancelUrl !== "string" || !isAllowedCheckoutUrl(cancelUrl)) {
        throw new https_1.HttpsError("invalid-argument", "cancelUrl invalide ou domaine non autorisé");
    }
    const releasePriceId = (process.env.STRIPE_RELEASE_PRICE_ID || "").trim();
    if (!releasePriceId) {
        throw new https_1.HttpsError("failed-precondition", "Prix Stripe non configuré — définir STRIPE_RELEASE_PRICE_ID dans les variables d'env Firebase");
    }
    const stripe = (0, stripe_1.getStripeClient)(process.env.STRIPE_SECRET_KEY);
    const safeReleaseId = String(releaseId || "").trim().slice(0, 100);
    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: releasePriceId, quantity: 1 }],
        billing_address_collection: "required",
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: uid,
        metadata: {
            uid,
            plan: "pay-per-release",
            releaseId: safeReleaseId,
        },
    });
    return { url: session.url };
});
/**
 * Vérifie une session Stripe Checkout pay-per-release et crédite l'utilisateur.
 * Idempotent : un rappel multiple avec le même sessionId ne crédite pas deux fois.
 */
exports.verifyReleasePaymentAndCredit = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = await requireAuth(request.auth);
    const sessionId = String(request.data?.sessionId || "").trim();
    if (!sessionId)
        throw new https_1.HttpsError("invalid-argument", "sessionId requis");
    const stripe = (0, stripe_1.getStripeClient)(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
        throw new https_1.HttpsError("failed-precondition", "Paiement non confirmé par Stripe");
    }
    if (session.client_reference_id !== uid) {
        throw new https_1.HttpsError("permission-denied", "Cette session de paiement n'appartient pas à cet utilisateur");
    }
    if (session.metadata?.plan !== "pay-per-release") {
        throw new https_1.HttpsError("failed-precondition", "Type de session incompatible avec ce endpoint");
    }
    const userRef = db.collection("users").doc(uid);
    const alreadyCredited = await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.data() || {};
        if (data.releasePaymentSessionId === sessionId) {
            return true; // déjà crédité
        }
        tx.update(userRef, {
            releasePaymentPaid: true,
            releasePaymentStatus: "paid",
            releasePaymentSessionId: sessionId,
            releasePaymentCredits: firebase_admin_1.default.firestore.FieldValue.increment(1),
            releasePaymentAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
        });
        return false;
    });
    return { success: true, sessionId, alreadyCredited };
});
exports.stripeContractsWebhook = (0, https_1.onRequest)({ region: "europe-west1" }, async (req, res) => {
    try {
        const stripe = (0, stripe_1.getStripeClient)(process.env.STRIPE_SECRET_KEY);
        const sig = req.header("stripe-signature") || "";
        const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
        if (!secret)
            throw new Error("STRIPE_WEBHOOK_SECRET manquante");
        const event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            if (session.payment_status === "paid") {
                await (0, generateContract_1.createContractFromOrder)(mapSessionToInput(session));
            }
        }
        res.status(200).send("ok");
    }
    catch (error) {
        res.status(400).send(error?.message || "webhook error");
    }
});
exports.totpGetStatus = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = await requireAuth(request.auth);
    const config = await getUserTotpConfig(uid);
    return {
        enabled: config.enabled,
        pendingEnrollment: !!config.tempSecret
    };
});
exports.totpBeginEnrollment = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = await requireAuth(request.auth);
    const config = await getUserTotpConfig(uid);
    if (config.enabled) {
        throw new https_1.HttpsError("failed-precondition", "Le 2FA est déjà activé.");
    }
    const email = String(request.auth?.token?.email || "").trim();
    const accountLabel = email || uid;
    if (config.tempSecret) {
        return {
            manualKey: config.tempSecret,
            otpauthUrl: buildOtpAuthUrl(config.tempSecret, accountLabel)
        };
    }
    const secret = speakeasy_1.default.generateSecret({
        issuer: "Morgann Music CP",
        name: `Morgann Music CP (${accountLabel})`,
        length: 20
    });
    await db.collection("users").doc(uid).set({
        security: {
            totp: {
                enabled: false,
                tempSecret: secret.base32,
                updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
            }
        }
    }, { merge: true });
    return {
        manualKey: secret.base32,
        otpauthUrl: secret.otpauth_url
    };
});
exports.totpConfirmEnrollmentV2 = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = await requireAuth(request.auth);
    const token = normalizeTotpToken(request.data?.token);
    if (token.length < 6) {
        throw new https_1.HttpsError("invalid-argument", "Code 2FA invalide.");
    }
    const config = await getUserTotpConfig(uid);
    if (!config.tempSecret) {
        throw new https_1.HttpsError("failed-precondition", "Aucune activation 2FA en cours.");
    }
    const valid = verifyTotpToken(config.tempSecret, token);
    if (!valid) {
        throw new https_1.HttpsError("permission-denied", "Code 2FA incorrect.");
    }
    await db.collection("users").doc(uid).set({
        security: {
            totp: {
                enabled: true,
                secret: config.tempSecret,
                tempSecret: firebase_admin_1.default.firestore.FieldValue.delete(),
                enrolledAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
            }
        }
    }, { merge: true });
    return { success: true };
});
exports.totpDisableV2 = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = await requireAuth(request.auth);
    const token = normalizeTotpToken(request.data?.token);
    if (token.length < 6) {
        throw new https_1.HttpsError("invalid-argument", "Code 2FA invalide.");
    }
    const config = await getUserTotpConfig(uid);
    if (!config.enabled || !config.secret) {
        return { success: true };
    }
    const valid = verifyTotpToken(config.secret, token);
    if (!valid) {
        throw new https_1.HttpsError("permission-denied", "Code 2FA incorrect.");
    }
    await db.collection("users").doc(uid).set({
        security: {
            totp: {
                enabled: false,
                secret: firebase_admin_1.default.firestore.FieldValue.delete(),
                tempSecret: firebase_admin_1.default.firestore.FieldValue.delete(),
                disabledAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
            }
        }
    }, { merge: true });
    return { success: true };
});
exports.totpVerifyLoginChallengeV2 = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = await requireAuth(request.auth);
    const config = await getUserTotpConfig(uid);
    if (!config.enabled || !config.secret) {
        return { required: false, valid: true };
    }
    const token = normalizeTotpToken(request.data?.token);
    if (token.length < 6) {
        return { required: true, valid: false };
    }
    const valid = verifyTotpToken(config.secret, token);
    return { required: true, valid };
});
exports.email2faStartLoginChallenge = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = await requireAuth(request.auth);
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    if (!getEmail2faPreference(userData)) {
        return { required: false, sent: false };
    }
    const userRecord = await firebase_admin_1.default.auth().getUser(uid);
    const toEmail = clean(userRecord.email);
    if (!toEmail) {
        throw new https_1.HttpsError("failed-precondition", "Aucun email vérifié disponible pour ce compte.");
    }
    const nowMs = Date.now();
    const resend = request.data?.resend === true;
    const challenge = userData?.security?.email2faChallenge || {};
    const lastSentAtMs = Number(challenge?.sentAtMs || 0);
    if (resend && lastSentAtMs && nowMs - lastSentAtMs < 30000) {
        throw new https_1.HttpsError("resource-exhausted", "Attends 30 secondes avant de renvoyer un code.");
    }
    const code = createEmail2faCode();
    const codeHash = hashEmail2faCode(code);
    const expiresInMs = 10 * 60 * 1000;
    const expiresAtMs = nowMs + expiresInMs;
    const firstName = clean(userData.firstName || userRecord.displayName || "Artiste");
    const template = buildEmail2faTemplate({ firstName, code, expiresMinutes: 10 });
    try {
        await sendBrevoEmail({
            toEmail,
            toName: firstName,
            subject: template.subject,
            htmlContent: template.htmlContent,
            textContent: template.textContent
        });
    }
    catch (error) {
        console.error("email2faStartLoginChallenge sendBrevoEmail failed", {
            uid,
            message: error?.message || String(error)
        });
        const message = String(error?.message || "service email indisponible");
        const lower = message.toLowerCase();
        if (lower.includes("brevo_api_key manquant") || lower.includes("missing_parameter") || lower.includes("sender")) {
            throw new https_1.HttpsError("failed-precondition", "Configuration Brevo invalide côté serveur", {
                message
            });
        }
        throw new https_1.HttpsError("internal", "Envoi du code email impossible", {
            message
        });
    }
    await userRef.set({
        security: {
            email2faChallenge: {
                codeHash,
                createdAtMs: nowMs,
                sentAtMs: nowMs,
                expiresAtMs,
                attempts: 0
            }
        },
        updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return {
        required: true,
        sent: true,
        maskedEmail: maskEmail(toEmail),
        expiresInSec: Math.floor(expiresInMs / 1000)
    };
});
exports.email2faVerifyLoginChallenge = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = await requireAuth(request.auth);
    const token = String(request.data?.token || "").replace(/\s+/g, "").replace(/[^0-9]/g, "");
    if (!/^\d{6}$/.test(token)) {
        throw new https_1.HttpsError("invalid-argument", "Code invalide (6 chiffres). ");
    }
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    if (!getEmail2faPreference(userData)) {
        return { required: false, valid: true };
    }
    const challenge = userData?.security?.email2faChallenge || {};
    const codeHash = clean(challenge?.codeHash);
    const expiresAtMs = Number(challenge?.expiresAtMs || 0);
    const attempts = Number(challenge?.attempts || 0);
    if (!codeHash || !expiresAtMs) {
        throw new https_1.HttpsError("failed-precondition", "Aucun challenge email en cours.");
    }
    if (Date.now() > expiresAtMs) {
        await userRef.set({
            security: {
                email2faChallenge: firebase_admin_1.default.firestore.FieldValue.delete()
            }
        }, { merge: true });
        throw new https_1.HttpsError("deadline-exceeded", "Code expiré. Demande un nouveau code.");
    }
    if (attempts >= 5) {
        await userRef.set({
            security: {
                email2faChallenge: firebase_admin_1.default.firestore.FieldValue.delete()
            }
        }, { merge: true });
        throw new https_1.HttpsError("resource-exhausted", "Trop d'essais. Demande un nouveau code.");
    }
    const valid = hashEmail2faCode(token) === codeHash;
    if (!valid) {
        await userRef.set({
            security: {
                email2faChallenge: {
                    ...challenge,
                    attempts: attempts + 1,
                    updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
                }
            }
        }, { merge: true });
        return { required: true, valid: false };
    }
    await userRef.set({
        security: {
            email2faChallenge: firebase_admin_1.default.firestore.FieldValue.delete(),
            email2fa: {
                lastVerifiedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
            }
        },
        updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { required: true, valid: true };
});
exports.passwordResetStartV2 = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const email = clean(request.data?.email).toLowerCase();
    if (!email || !email.includes("@")) {
        throw new https_1.HttpsError("invalid-argument", "Email invalide.");
    }
    const genericResponse = { sent: true };
    let userRecord = null;
    try {
        userRecord = await firebase_admin_1.default.auth().getUserByEmail(email);
    }
    catch (_error) {
        return genericResponse;
    }
    const uid = String(userRecord.uid || "").trim();
    if (!uid)
        return genericResponse;
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const firstName = clean(userData.firstName || userRecord.displayName || "Artiste");
    const rawToken = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(rawToken);
    const nowMs = Date.now();
    const expiresInMs = 15 * 60 * 1000;
    const expiresAtMs = nowMs + expiresInMs;
    const resetUrl = `${SITE_URL}/reset-password.html?token=${encodeURIComponent(rawToken)}`;
    await db.collection("passwordResetSessions").doc(tokenHash).set({
        uid,
        email,
        createdAtMs: nowMs,
        expiresAtMs,
        consumedAtMs: null,
        totpVerifiedAtMs: null,
        attempts: 0,
        updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    const template = buildPasswordResetEmailTemplate({
        firstName,
        resetUrl,
        expiresMinutes: 15
    });
    try {
        await sendBrevoEmail({
            toEmail: email,
            toName: firstName,
            subject: template.subject,
            htmlContent: template.htmlContent,
            textContent: template.textContent
        });
    }
    catch (error) {
        console.error("passwordResetStartV2 sendBrevoEmail failed", {
            uid,
            message: error?.message || String(error)
        });
        const message = String(error?.message || "service email indisponible");
        const lower = message.toLowerCase();
        if (lower.includes("brevo_api_key manquant") || lower.includes("missing_parameter") || lower.includes("sender")) {
            throw new https_1.HttpsError("failed-precondition", "Configuration Brevo invalide côté serveur", {
                message
            });
        }
        throw new https_1.HttpsError("internal", "Envoi de l'email de réinitialisation impossible", {
            message
        });
    }
    return genericResponse;
});
exports.passwordResetVerifyTotpV2 = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const token = normalizePasswordResetToken(request.data?.token);
    const totpCode = normalizeTotpToken(request.data?.totpCode);
    if (token.length < 40) {
        throw new https_1.HttpsError("invalid-argument", "Lien de réinitialisation invalide.");
    }
    if (totpCode.length < 6) {
        throw new https_1.HttpsError("invalid-argument", "Code authentificateur invalide.");
    }
    const tokenHash = hashPasswordResetToken(token);
    const sessionRef = db.collection("passwordResetSessions").doc(tokenHash);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
        throw new https_1.HttpsError("not-found", "Session de réinitialisation introuvable.");
    }
    const session = sessionSnap.data() || {};
    const expiresAtMs = Number(session.expiresAtMs || 0);
    const consumedAtMs = Number(session.consumedAtMs || 0);
    const attempts = Number(session.attempts || 0);
    if (consumedAtMs > 0) {
        throw new https_1.HttpsError("failed-precondition", "Ce lien a déjà été utilisé.");
    }
    if (!expiresAtMs || Date.now() > expiresAtMs) {
        throw new https_1.HttpsError("deadline-exceeded", "Ce lien de réinitialisation a expiré.");
    }
    if (attempts >= 5) {
        throw new https_1.HttpsError("resource-exhausted", "Trop d'essais. Demande un nouveau lien.");
    }
    const uid = clean(session.uid);
    if (!uid) {
        throw new https_1.HttpsError("failed-precondition", "Session invalide.");
    }
    const config = await getUserTotpConfig(uid);
    if (!config.enabled || !config.secret) {
        throw new https_1.HttpsError("failed-precondition", "Le 2FA n'est pas activé sur ce compte.");
    }
    const valid = verifyTotpToken(config.secret, totpCode);
    if (!valid) {
        await sessionRef.set({
            attempts: attempts + 1,
            updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        throw new https_1.HttpsError("permission-denied", "Code authentificateur incorrect.");
    }
    await sessionRef.set({
        totpVerifiedAtMs: Date.now(),
        updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { valid: true };
});
exports.passwordResetCompleteV2 = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const token = normalizePasswordResetToken(request.data?.token);
    const newPassword = normalizePasswordValue(request.data?.newPassword);
    const confirmPassword = normalizePasswordValue(request.data?.confirmPassword);
    if (token.length < 40) {
        throw new https_1.HttpsError("invalid-argument", "Lien de réinitialisation invalide.");
    }
    if (!newPassword || !confirmPassword) {
        throw new https_1.HttpsError("invalid-argument", "Renseigne et confirme le nouveau mot de passe.");
    }
    if (newPassword !== confirmPassword) {
        throw new https_1.HttpsError("invalid-argument", "Les mots de passe ne correspondent pas.");
    }
    assertStrongEnoughPassword(newPassword);
    const tokenHash = hashPasswordResetToken(token);
    const sessionRef = db.collection("passwordResetSessions").doc(tokenHash);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
        throw new https_1.HttpsError("not-found", "Session de réinitialisation introuvable.");
    }
    const session = sessionSnap.data() || {};
    const uid = clean(session.uid);
    const expiresAtMs = Number(session.expiresAtMs || 0);
    const consumedAtMs = Number(session.consumedAtMs || 0);
    const totpVerifiedAtMs = Number(session.totpVerifiedAtMs || 0);
    if (!uid) {
        throw new https_1.HttpsError("failed-precondition", "Session invalide.");
    }
    if (consumedAtMs > 0) {
        throw new https_1.HttpsError("failed-precondition", "Ce lien a déjà été utilisé.");
    }
    if (!expiresAtMs || Date.now() > expiresAtMs) {
        throw new https_1.HttpsError("deadline-exceeded", "Ce lien de réinitialisation a expiré.");
    }
    if (!totpVerifiedAtMs || Date.now() - totpVerifiedAtMs > 10 * 60 * 1000) {
        throw new https_1.HttpsError("failed-precondition", "Vérifie d'abord le code authentificateur.");
    }
    await firebase_admin_1.default.auth().updateUser(uid, { password: newPassword });
    await firebase_admin_1.default.auth().revokeRefreshTokens(uid);
    await sessionRef.set({
        consumedAtMs: Date.now(),
        updatedAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { success: true };
});
exports.createSignatureRequest = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    await requireAuth(request.auth);
    const orderId = String(request.data?.orderId || "").trim();
    if (!orderId)
        throw new https_1.HttpsError("invalid-argument", "orderId requis");
    return (0, createSignatureRequest_1.createSignatureRequestFromOrder)(orderId, SITE_URL);
});
exports.getSignatureRequest = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const token = String(request.data?.token || "").trim();
    return (0, getSignatureRequest_1.getSignatureRequestByToken)(token);
});
exports.submitSignature = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const token = String(request.data?.token || "").trim();
    const signatureDataUrl = String(request.data?.signatureDataUrl || "");
    const signatoryName = String(request.data?.signatoryName || "");
    const signatoryEmail = String(request.data?.signatoryEmail || "");
    return (0, submitSignature_1.submitContractSignature)({ token, signatureDataUrl, signatoryName, signatoryEmail });
});
exports.listContractsForAdminCallable = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = await requireAuth(request.auth);
    const limit = Number(request.data?.limit || 100);
    const status = String(request.data?.status || "").trim().toLowerCase();
    return { contracts: await (0, listContractsForAdmin_1.listContractsForAdmin)(uid, limit, status || null) };
});
exports.getContractDownloadUrlCallable = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = await requireAuth(request.auth);
    const contractId = String(request.data?.contractId || "").trim();
    const variant = String(request.data?.variant || "generated");
    if (!contractId)
        throw new https_1.HttpsError("invalid-argument", "contractId requis");
    const url = await (0, getContractDownloadUrl_1.getContractDownloadUrl)({ uid, contractId, variant });
    return { url };
});
exports.getContractAudioDownloadsCallable = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const uid = await requireAuth(request.auth);
    const contractId = String(request.data?.contractId || "").trim();
    if (!contractId)
        throw new https_1.HttpsError("invalid-argument", "contractId requis");
    return (0, getContractAudioDownloads_1.getContractAudioDownloads)({ uid, contractId });
});
