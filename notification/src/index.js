function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
}

function corsJson(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
}

function buildHtmlEmail({ firstName, title, message, actionUrl }) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morgann Music CP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #EAFFC6; font-family: 'Segoe UI', Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #EAFFC6; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 0 0 40px 0;">
        
        <!-- Header / Navbar -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FC8FB0; text-align: center;">
          <tr>
            <td style="padding: 16px 20px;">
              <a href="https://mm-cp.uk/portail/" style="color: #EAFFC6; text-decoration: none; font-weight: 700; font-size: 15px; margin-right: 25px;">Portail</a>
              <a href="https://mm-cp.uk/" style="color: #EAFFC6; text-decoration: none; font-weight: 700; font-size: 15px;">Accueil</a>
            </td>
          </tr>
        </table>

        <!-- Main Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="90%" style="max-width: 580px; margin-top: 30px; background-color: #f8ffe7; border-radius: 36px; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15); border: 1px solid #e1f5be;">
          <tr>
            <td style="padding: 35px 25px; text-align: center;">
              
              <!-- Logo -->
              <div style="margin-bottom: 20px;">
                <img src="https://mm-cp.uk/assets/img/icons/sombre.png" alt="Logo MMCP" width="90" height="auto" style="display: block; margin: 0 auto; border: 0; width: 90px; outline: none; text-decoration: none;">
              </div>

              <!-- Greeting -->
              <h1 style="color: #2c3e10; font-size: 22px; font-weight: 800; margin: 0 0 8px 0; font-family: sans-serif;">Bonjour ${firstName} !</h1>
              <h2 style="color: #556b2f; font-size: 15px; margin: 0 0 25px 0; font-weight: 400; line-height: 1.4; font-family: sans-serif;">Vous avez reçu une nouvelle notification sur votre portail.</h2>

              <!-- Notification Inner Card -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 24px; border: 1px solid #e0f0c0; text-align: left; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 22px;">
                    <h3 style="color: #FC8FB0; font-size: 18px; margin: 0 0 10px 0; font-weight: 800; font-family: sans-serif;">${title}</h3>
                    <p style="color: #3e2837; font-size: 14px; margin: 0 0 20px 0; line-height: 1.5; white-space: pre-line; font-family: sans-serif;">${message}</p>
                    
                    <div style="text-align: center; margin-top: 15px;">
                      <a href="${actionUrl}" style="display: inline-block; background-color: #FC8FB0; color: #EAFFC6; text-decoration: none; padding: 12px 28px; border-radius: 50px; font-weight: 700; font-size: 14px; font-family: sans-serif;">Voir en détail</a>
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table border="0" cellpadding="0" cellspacing="0" width="90%" style="max-width: 580px; margin-top: 20px; text-align: center;">
          <tr>
            <td style="color: #789048; font-size: 12px; line-height: 1.6; padding: 10px; font-family: sans-serif;">
              <p style="margin: 0 0 4px 0;">© Morgann Music CP — Tous droits réservés.</p>
              <p style="margin: 0;">Cet e-mail automatique a été envoyé suite à une activité sur votre compte.</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendBrevoEmail(env, { toEmail, toName, subject, htmlContent }) {
    if (!env.BREVO_API_KEY) {
        console.error("Clé BREVO_API_KEY non disponible.");
        return false;
    }

    try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "api-key": env.BREVO_API_KEY,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                sender: {
                    name: env.SENDER_NAME || "Morgann Music CP",
                    email: env.SENDER_EMAIL || "notifications@mm-cp.uk"
                },
                replyTo: {
                    email: "support@mm-cp.uk",
                    name: "Support Morgann Music CP"
                },
                to: [{ email: toEmail, name: toName || toEmail }],
                subject: subject,
                htmlContent: htmlContent,
                trackingSettings: {
                    clickTracking: false
                }
            })
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`Erreur HTTP Brevo (${res.status}):`, errBody);
            return false;
        }

        return true;
    } catch (err) {
        console.error("Erreur d'exécution de la requête Brevo :", err);
        return false;
    }
}

export default {
    async fetch(request, env, ctx) {
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders() });
        }

        if (request.method !== "POST") {
            return corsJson({ error: "Méthode non autorisée" }, 405);
        }

        try {
            const data = await request.json();
            const user_uid = data.user_uid || data.userUid || data.uid;
            const title = data.title || data.titre || data.notif_title;
            const message = data.message || data.body || data.text || data.notif_message || "";
            const type = data.type || "info"; // release, support, withdrawal, greenlist, blacklist, etc.
            const link = data.link || null;

            if (!user_uid || !title) {
                return corsJson({ error: "Les champs user_uid et title sont requis." }, 400);
            }

            // --- SÉCURITÉ ANTI-DOUBLON (10 SECONDES) ---
            const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
            const existingNotif = await env.DB.prepare(`
                SELECT id FROM notifications
                WHERE user_uid = ? AND title = ? AND created_at >= ?
            `).bind(user_uid, title, tenSecondsAgo).first();

            if (existingNotif) {
                console.log("Notification en double ignorée (reçue dans les 10 dernières secondes).");
                return corsJson({
                    success: true,
                    duplicate: true,
                    id: existingNotif.id
                }, 200);
            }

            const now = new Date().toISOString();

            // 1. ÉCRITURE DANS LA TABLE D1 "notifications"
            const insertResult = await env.DB.prepare(`
                INSERT INTO notifications (user_uid, title, message, type, is_read, link, created_at)
                VALUES (?, ?, ?, ?, 0, ?, ?)
            `).bind(user_uid, title, message, type, link || null, now).run();

            // 2. RÉCUPÉRATION DU PROFIL UTILISATEUR EN BDD
            const user = await env.DB.prepare(
                "SELECT email, first_name, full_name FROM users WHERE uid = ?"
            ).bind(user_uid).first();

            // 3. ENVOI DE L'E-MAIL DE NOTIFICATION VIA BREVO
            if (user && user.email) {
                const firstName = user.first_name || user.full_name || "Artiste";
                const actionUrl = link
                    ? (link.startsWith("http") ? link : `https://mm-cp.uk${link}`)
                    : "https://mm-cp.uk/portail/notifications";

                const htmlContent = buildHtmlEmail({
                    firstName,
                    title,
                    message,
                    actionUrl
                });

                ctx.waitUntil(
                    sendBrevoEmail(env, {
                        toEmail: user.email,
                        toName: firstName,
                        subject: title,
                        htmlContent
                    })
                );
            }

            return corsJson({
                success: true,
                id: insertResult.meta.last_row_id
            }, 201);

        } catch (err) {
            console.error("Erreur Worker Notifications :", err);
            return corsJson({ error: `Erreur interne : ${err.message}` }, 500);
        }
    }
};