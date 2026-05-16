// --- Webhook Stripe pour abonnement ---
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_xxx');

// Pour recevoir le raw body Stripe
app.post('/webhook/stripe', bodyParser.raw({type: 'application/json'}), async (req, res) => {
    let event;
    try {
        event = req.body && req.headers['stripe-signature']
            ? stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)
            : req.body;
    } catch (err) {
        console.error('Erreur signature Stripe:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Traite uniquement les abonnements
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.client_reference_id) {
            try {
                // Inscrire l'abonnement dans Firestore
                const admin = require('firebase-admin');
                if (!admin.apps.length) admin.initializeApp();
                const db = admin.firestore();
                const userRef = db.collection('users').doc(session.client_reference_id);
                await userRef.set({
                    subscription: {
                        id: session.subscription,
                        status: 'active',
                        start: new Date().toISOString(),
                        priceId: session.display_items ? session.display_items[0]?.price?.id : null
                    }
                }, { merge: true });
                console.log('Abonnement inscrit pour', session.client_reference_id);
            } catch (e) {
                console.error('Erreur Firestore abonnement:', e);
                return res.status(500).send('Erreur Firestore');
            }
        }
    }
    res.json({received: true});
});
const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { Resend } = require("resend");
let nodemailer = null;
try {
    nodemailer = require("nodemailer");
} catch (_err) {
    nodemailer = null;
}
const app = express();
const stripeCheckout = require("./stripe-checkout");

app.use(express.json());

const mmcpDir = __dirname;
const siteRootDir = path.resolve(__dirname, "..");
const mmcpPlayDir = path.join(siteRootDir, "MMCP Play");

app.use(express.static(mmcpDir));
app.use(stripeCheckout);
const stripeReleaseCheckout = require("./stripe-release-checkout");
app.use(stripeReleaseCheckout);
app.use("/MMCP Play", express.static(mmcpPlayDir));
app.use("/MMCP%20Play", express.static(mmcpPlayDir));

const catalogueRouteMap = new Map([
    ["/catalogue", "catalogue/index.html"],
    ["/catalogue/artistes", "catalogue/artistes.html"],
    ["/catalogue/sorties", "catalogue/sorties.html"],
    ["/catalogue/artiste", "catalogue/artiste.html"],
    ["/catalogue/sortie", "catalogue/sortie.html"]
]);

for (const [routePath, filePath] of catalogueRouteMap.entries()) {
    app.get(routePath, (_req, res) => {
        res.sendFile(path.join(mmcpDir, filePath));
    });

    app.get(`${routePath}/`, (_req, res) => {
        res.redirect(301, routePath);
    });
}

const allowedOrigins = new Set([
    "http://localhost:2000",
    "http://127.0.0.1:2000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://mm-cp.uk",
    "https://www.mm-cp.uk"
]);

// Determine if service-account JSON exists and whether an env API key is present
const apiKeyEnv = process.env.GOOGLE_GENAI_API_KEY || null;
const saPath = path.join(__dirname, 'genai-service-account.json');
const serviceAccountExists = fs.existsSync(saPath);
const AUTO_ENABLE_MOCK = !apiKeyEnv && !serviceAccountExists;
if (AUTO_ENABLE_MOCK) {
    console.warn('⚠️ No GenAI credentials found; server will auto-enable mock GenAI responses.');
}

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        if (allowedOrigins.has(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Vary", "Origin");
        } else if (/localhost|127\.0\.0\.1/.test(origin)) {
            // During local development, allow any localhost origins by reflecting them.
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Vary", "Origin");
        }
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    return next();
});

const resendApiKey = process.env.RESEND_API_KEY || "re_HgA8T82a_NtjKSVci8LWLjv2LF37KEkv9";
const resendFrom = process.env.RESEND_FROM || "mmcp-production@mm-cp.uk";
const brevoApiKey = process.env.BREVO_API_KEY || "";
const brevoFromEmail = process.env.BREVO_FROM_EMAIL || "no-reply@mm-cp.uk";
const brevoFromName = process.env.BREVO_FROM_NAME || "Morgann Music CP";
const dashboardUrl = "https://mm-cp.uk/dash/";
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const { GoogleAuth } = require('google-auth-library');

const USERS_FILE = "./users.json";

function escapeHtml(text) {
        return String(text || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\"/g, "&quot;")
                .replace(/'/g, "&#39;");
}

function buildEmailHtml({ headline }) {
        const safeHeadline = escapeHtml(headline);
        const safeUrl = escapeHtml(dashboardUrl);

        return `
<!doctype html>
<html lang="fr">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>MMCP Notification</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
            <tr>
                <td align="center">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
                        <tr>
                            <td style="background:#111827;color:#ffffff;padding:22px 24px;font-size:18px;font-weight:700;">Morgann Music CP</td>
                        </tr>
                        <tr>
                            <td style="padding:24px;">
                                <p style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:700;">${safeHeadline}</p>
                                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">Il y a une notif sur ton dashboard artiste.</p>
                                <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;font-size:14px;">Voir la notification</a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>`;
}

function buildAdminArtistEmailHtml({ artistName, subject, body }) {
        const safeArtist = escapeHtml(artistName || "Artiste");
        const safeSubject = escapeHtml(subject || "Message MMCP");
        const safeBody = escapeHtml(body || "").replace(/\n/g, "<br>");
        const safeDashUrl = escapeHtml(dashboardUrl);

        return `
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
}

function createSesSmtpTransporter() {
    if (!nodemailer) {
        throw new Error("Le package nodemailer est requis. Installe-le avec: npm install nodemailer");
    }

    const host = process.env.SES_SMTP_HOST || "email-smtp.eu-north-1.amazonaws.com";
    const port = Number(process.env.SES_SMTP_PORT || 587);
    const user = process.env.SES_SMTP_USER;
    const pass = process.env.SES_SMTP_PASS;

    if (!user || !pass) {
        throw new Error("SES_SMTP_USER et SES_SMTP_PASS sont requis");
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: false,
        requireTLS: true,
        auth: { user, pass }
    });
}

async function sendSesEmail({ to, subject, text, html, mode = "notification" }) {
    const from = process.env.SES_FROM_EMAIL;
    if (!from) {
        throw new Error("SES_FROM_EMAIL est requis (adresse expediteur verifiee Amazon SES)");
    }

    if (!to) {
        throw new Error("Le destinataire est requis");
    }

    const transporter = createSesSmtpTransporter();
    const isNewsletter = String(mode).toLowerCase() === "newsletter";

    const mailOptions = {
        from,
        to,
        subject: subject || (isNewsletter ? "Newsletter Morgann Music" : "Notification Morgann Music"),
        text: text || "",
        html: isNewsletter
            ? (html || "<p>Newsletter Morgann Music</p>")
            : (html || `<p>${escapeHtml(text || "Vous avez une nouvelle notification.")}</p>`)
    };

    return transporter.sendMail(mailOptions);
}

app.post("/api/email/artist-notification", async (req, res) => {
        const { toEmail, type, variables } = req.body || {};
        const email = String(toEmail || "").trim();
        const eventType = String(type || "notification").trim().toLowerCase();

        if (!email) {
            return res.status(400).json({ error: "toEmail est requis" });
        }

        if (!["notification", "status"].includes(eventType)) {
            return res.status(400).json({ error: "type invalide" });
        }

        if (!resend) {
            return res.status(500).json({ error: "RESEND_API_KEY manquant" });
        }

        try {
            const result = await resend.emails.send({
                from: 'Morgann Music CP <notifiction-noreply@mm-cp.uk>',
                to: email,
                subject: 'Nouvelle notification disponible',
                html: '<h1>Bonjour</h1><p>Vous avez une nouvelle notification sur votre espace Morgann Music CP.</p>'
            });
            return res.json({ success: true, id: result?.data?.id || null });
        } catch (error) {
            console.error("Erreur Resend:", error);
            return res.status(500).json({
                error: "Envoi email impossible",
                details: error?.message || null,
                resendError: error?.response?.data || null
            });
        }
});

app.post("/api/email/ses/send", async (req, res) => {
    const { to, subject, text, html, mode } = req.body || {};
    try {
        const result = await sendSesEmail({ to, subject, text, html, mode });
        return res.json({
            success: true,
            provider: "amazon-ses-smtp",
            messageId: result?.messageId || null,
            accepted: result?.accepted || []
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error?.message || "Erreur envoi SES SMTP"
        });
    }
});

app.post("/api/email/brevo/send", async (req, res) => {
    const { toEmail, artistName, subject, body } = req.body || {};
    const to = String(toEmail || "").trim();
    const artist = String(artistName || "").trim();
    const mailSubject = String(subject || "").trim();
    const mailBody = String(body || "").trim();

    if (!to) {
        return res.status(400).json({ success: false, error: "toEmail est requis" });
    }
    if (!mailSubject) {
        return res.status(400).json({ success: false, error: "subject est requis" });
    }
    if (!mailBody) {
        return res.status(400).json({ success: false, error: "body est requis" });
    }
    if (!brevoApiKey) {
        return res.status(500).json({ success: false, error: "BREVO_API_KEY manquant côté serveur" });
    }

    try {
        const htmlContent = buildAdminArtistEmailHtml({
            artistName: artist || "Artiste",
            subject: mailSubject,
            body: mailBody
        });

        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "api-key": brevoApiKey
            },
            body: JSON.stringify({
                sender: {
                    name: brevoFromName,
                    email: brevoFromEmail
                },
                to: [{ email: to, name: artist || undefined }],
                subject: mailSubject,
                htmlContent,
                textContent: mailBody
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: payload?.message || "Erreur Brevo",
                details: payload
            });
        }

        return res.json({
            success: true,
            provider: "brevo",
            messageId: payload?.messageId || null
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error?.message || "Erreur lors de l'envoi Brevo"
        });
    }
});

    app.get("/api/email/health", (_req, res) => {
        res.json({
            ok: true,
            resendConfigured: !!resend,
            from: resendFrom
        });
    });

    app.post("/api/genai/generate", async (req, res) => {
        try {
            const { prompt, model = "text-bison-001", maxTokens = 256, temperature = 0.2 } = req.body || {};
            if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: "prompt est requis" });

                // Development mock mode: MOCK_GENAI=1 or AUTO_ENABLE_MOCK when no credentials present
                const mockEnv = process.env.MOCK_GENAI === '1' || AUTO_ENABLE_MOCK;
                if (mockEnv) {
                    const simulated = `Réponse de démonstration pour le prompt: ${String(prompt).slice(0,200)}`;
                    console.info('/api/genai/generate - returning simulated response (mock mode)');
                    return res.json({ ok: true, status: 200, usedAuth: 'mock', text: simulated, rawText: simulated });
                }

            const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generate`;
            const payload = {
                prompt: { text: String(prompt) },
                temperature: Number(temperature) || 0.2,
                maxOutputTokens: Number(maxTokens) || 256
            };

            const headers = { 'Content-Type': 'application/json' };

            let usedAuth = 'none';
            try {
                const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
                const client = await auth.getClient();
                const accessToken = await client.getAccessToken();
                const token = accessToken?.token || accessToken;
                if (token) {
                    headers.Authorization = `Bearer ${token}`;
                    usedAuth = 'service-account';
                }
            } catch (e) {
                const apiKey = process.env.GOOGLE_GENAI_API_KEY;
                if (apiKey) {
                    headers.Authorization = `Bearer ${apiKey}`;
                    usedAuth = 'api-key-fallback';
                }
            }

            if (!headers.Authorization) {
                return res.status(500).json({ error: 'Aucune méthode d\'authentification GenAI disponible. Configure GOOGLE_APPLICATION_CREDENTIALS ou GOOGLE_GENAI_API_KEY.' });
            }

            // If falling back to API key auth, append the key as a query param (required by GenAI REST API)
            let fetchUrl = url;
            if (usedAuth === 'api-key-fallback' && headers.Authorization && headers.Authorization.startsWith('Bearer ')) {
                // headers.Authorization currently holds the apiKey in older code paths — move it to query param
                const apiKey = headers.Authorization.replace(/^Bearer\s+/, '');
                delete headers.Authorization;
                fetchUrl = `${url}?key=${encodeURIComponent(apiKey)}`;
            }

            const response = await fetch(fetchUrl, {
                method: "POST",
                headers,
                body: JSON.stringify(payload)
            });

            const status = response.status;
            const rawText = await response.text();
            // If Google reports a leaked API key, return a clear error to the client
            if (status === 403 && rawText && rawText.indexOf('reported as leaked') !== -1) {
                console.error('Generative API key rejected: reported as leaked');
                return res.status(403).json({ ok: false, status, usedAuth, error: 'La clé API Google Generative a été signalée comme compromise (leaked). Remplacez la clé ou utilisez un compte de service.' });
            }
            // Diagnostic logs for debugging GenAI failures
            try {
                console.error('/api/genai/generate - request URL:', fetchUrl || url);
                console.error('/api/genai/generate - status:', response.status);
                console.error('/api/genai/generate - rawText (first 2000 chars):', rawText && rawText.slice ? rawText.slice(0, 2000) : rawText);
            } catch (e) { console.error('Error logging GenAI response', e); }
            let data = null;
            try { data = rawText ? JSON.parse(rawText) : null; } catch (e) { console.warn('/api/genai/generate: non-JSON response', { status, rawText }); }

            const text = data && Array.isArray(data?.candidates) && data.candidates[0]?.content
                ? data.candidates[0].content
                : (data && Array.isArray(data?.candidates) && data.candidates[0]?.output ? data.candidates[0].output : null);

            return res.status(status).json({ ok: status >= 200 && status < 300, status, usedAuth, text: text || null, rawText, rawJson: data });
        } catch (error) {
            console.error("/api/genai/generate error:", error);
            return res.status(500).json({ error: "Erreur lors de l'appel GenAI", details: error?.message || String(error) });
        }
    });

/* REGISTER */
app.post("/register", async (req, res) => {
    const { username, email, password } = req.body;

    const users = JSON.parse(fs.readFileSync(USERS_FILE));

    const exists = users.find(u => u.email === email);
    if (exists) return res.status(400).json({ error: "Email déjà utilisé" });

    const hash = await bcrypt.hash(password, 10);

    users.push({
        id: Date.now(),
        username,
        email,
        password: hash,
        createdAt: new Date().toISOString(),
        stripeCustomerId: null
    });

    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
});

app.post('/admin/upload-genai-sa', express.json({ limit: '1mb' }), async (req, res) => {
    try {
        const uploadSecret = process.env.UPLOAD_SECRET;
        if (!uploadSecret) return res.status(500).json({ error: 'UPLOAD_SECRET non configuré sur le serveur' });
        const { secret, serviceAccount } = req.body || {};
        if (!secret || secret !== uploadSecret) return res.status(401).json({ error: 'secret invalide' });
        if (!serviceAccount) return res.status(400).json({ error: 'serviceAccount JSON requis' });

        const outPath = path.join(__dirname, 'genai-service-account.json');
        try {
            fs.writeFileSync(outPath, JSON.stringify(serviceAccount, null, 2), { mode: 0o600 });
        } catch (e) {
            console.error('Erreur écriture service account:', e);
            return res.status(500).json({ error: 'Impossible d\'écrire le fichier de clé' });
        }

        process.env.GOOGLE_APPLICATION_CREDENTIALS = outPath;

        return res.json({ ok: true, path: outPath });
    } catch (e) {
        console.error('/admin/upload-genai-sa error', e);
        return res.status(500).json({ error: 'Erreur interne' });
    }
});

// Health endpoint for GenAI status (useful for client-side diagnostic)
app.get('/api/genai/health', (req, res) => {
    try {
        const mock = process.env.MOCK_GENAI === '1' || false;
        const apiKeyEnv = process.env.GOOGLE_GENAI_API_KEY || null;
        const saPath = path.join(__dirname, 'genai-service-account.json');
        const saExists = fs.existsSync(saPath);
        return res.json({ ok: true, mock, apiKeyEnv: !!apiKeyEnv, serviceAccountConfigured: saExists });
    } catch (e) {
        return res.status(500).json({ ok: false, error: String(e) });
    }
});

/* LOGIN */
app.post("/login", (req, res) => {
    const { email, password } = req.body;
    const users = JSON.parse(fs.readFileSync(USERS_FILE));

    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: "Compte introuvable" });

    const ok = require("bcrypt").compareSync(password, user.password);
    if (!ok) return res.status(401).json({ error: "Mot de passe incorrect" });

    res.json({ success: true, userId: user.id });
});

app.listen(3000, () => {
    console.log("✅ Serveur lancé : http://localhost:3000");
});

// SPA fallback pour /dash/*.html
app.get(/^\/dash\/(.+)\.html$/, (req, res) => {
  res.sendFile(path.join(mmcpDir, 'dash/index.html'));
});
