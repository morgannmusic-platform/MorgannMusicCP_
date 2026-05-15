/**
 * Cloudflare Pages Function - Artist notification email
 * Endpoint: POST /api/email/artist-notification
 */

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    let payload = {};
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON invalide" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const toEmail = String(payload?.toEmail || "").trim();
    const type = String(payload?.type || "notification").trim().toLowerCase();
    const title = String(payload?.title || "Tu as reçu une notification").trim();
    const message = String(payload?.message || "Il y a une notif sur ton dashboard artiste.").trim();

    if (!toEmail) {
      return new Response(JSON.stringify({ error: "toEmail est requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!["notification", "status"].includes(type)) {
      return new Response(JSON.stringify({ error: "type invalide" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const brevoApiKey = env.BREVO_API_KEY;
    const fromEmail = env.BREVO_FROM_EMAIL || "no-reply@mm-cp.uk";
    const fromName = env.BREVO_FROM_NAME || "Morgann Music CP";
    const siteUrl = env.SITE_URL || "https://mm-cp.uk";
    const logoUrl = env.BREVO_LOGO_URL || `${siteUrl}/MMCP.svg`;

    if (!brevoApiKey) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY non configurée" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const esc = (text) => String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

    const safeTitle = esc(type === "status" ? "Mise a jour de statut" : title);
    const safeMessage = esc(message).replace(/\n/g, "<br>");
    const safeLogo = esc(logoUrl);
    const ctaUrl = `${siteUrl}/dash/notifications.html`;

    const htmlContent = `<!doctype html>
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
                <img src="${safeLogo}" alt="Morgann Music CP" width="140" style="display:block;border:0;max-width:100%;height:auto;" />
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 10px;font-size:22px;line-height:1.3;font-weight:700;color:#111827;">${safeTitle}</p>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">${safeMessage}</p>
                <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;font-size:14px;">Voir la notification</a>
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

    const subject = type === "status"
      ? "Mise a jour de statut sur MMCP"
      : "Nouvelle notification disponible";

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: toEmail }],
        subject,
        htmlContent,
        textContent: `${title}\n\n${message}\n\n${ctaUrl}`
      })
    });

    const raw = await response.text();
    let brevo = {};
    try {
      brevo = raw ? JSON.parse(raw) : {};
    } catch {
      brevo = { message: raw || "Reponse Brevo invalide" };
    }

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: "Email send failed",
        details: brevo?.message || response.statusText
      }), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      provider: "brevo",
      messageId: brevo?.messageId || null
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error?.message || String(error)
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
