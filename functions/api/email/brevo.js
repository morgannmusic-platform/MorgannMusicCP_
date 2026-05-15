/**
 * Cloudflare Pages Function - Send email via Brevo API
 * Endpoint: POST /api/email/brevo
 */

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify Firebase token (optional but recommended)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing or invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let parsed = {};
    try {
      parsed = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Corps de requête JSON invalide' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const {
      toEmail,
      toEmails,
      artistName,
      subject,
      body,
      transactionType,
      mailCategory,
      useButton,
      buttonText,
      buttonUrl,
      customHtml,
      attachments
    } = parsed;

    const uniqueEmails = Array.from(new Set(
      (Array.isArray(toEmails) ? toEmails : [])
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean)
    ));

    const fallbackToEmail = String(toEmail || '').trim().toLowerCase();
    if (fallbackToEmail && !uniqueEmails.includes(fallbackToEmail)) {
      uniqueEmails.push(fallbackToEmail);
    }

    // Validation
    if (!uniqueEmails.length || !subject) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: toEmail/toEmails, subject' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const hasCustomHtml = typeof customHtml === 'string' && customHtml.trim().length > 0;
    if (hasCustomHtml && customHtml.length > 900000) {
      return new Response(
        JSON.stringify({ error: 'Le HTML personnalisé dépasse la limite (900 Ko)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!hasCustomHtml && !String(body || '').trim()) {
      return new Response(
        JSON.stringify({ error: 'Body is required when no custom HTML is uploaded' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const requestedCategory = String(mailCategory || 'transactional').trim().toLowerCase();
    const normalizedCategory = ['marketing', 'newsletter', 'campaign', 'promotional', 'promo'].includes(requestedCategory)
      ? 'marketing'
      : 'transactional';

    if (normalizedCategory === 'transactional' && uniqueEmails.length > 1) {
      return new Response(
        JSON.stringify({ error: 'Un email transactionnel ne peut cibler qu\'un seul destinataire' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (normalizedCategory === 'marketing' && uniqueEmails.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Trop de destinataires pour un envoi marketing (max 500)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedTransactionType = String(transactionType || 'admin_notification')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 60) || 'admin_notification';

    const wantsButton = !!useButton;
    const ctaText = String(buttonText || '').trim();
    const ctaUrl = String(buttonUrl || '').trim();
    if (wantsButton && (!ctaText || !ctaUrl)) {
      return new Response(
        JSON.stringify({ error: 'buttonText and buttonUrl are required when useButton is true' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get Brevo credentials from environment
    const brevoApiKey = env.BREVO_API_KEY;
    const brevoFromEmail = env.BREVO_FROM_EMAIL || 'no-reply@mm-cp.uk';
    const brevoFromName = env.BREVO_FROM_NAME || 'Morgann Music CP';

    if (!brevoApiKey) {
      return new Response(
        JSON.stringify({ error: 'Brevo API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const siteUrl = env.SITE_URL || 'https://mm-cp.uk';
    const logoUrl = env.BREVO_LOGO_URL || `${siteUrl}/MMCP.svg`;
    const templateUrl = env.BREVO_TEMPLATE_URL || `${siteUrl}/assets/email/base-email-template.html`;

    const escapeHtml = (value) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const safeBody = escapeHtml(body || '').replace(/\n/g, '<br />');
    const safeArtistName = escapeHtml(artistName || 'Artiste');
    const ctaBlock = wantsButton
      ? `<div class="cta-wrap"><a class="cta" href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ctaText)}</a></div>`
      : '';

    function applyTemplateVariables(template) {
      return String(template || '')
        .replaceAll('{{LOGO_URL}}', logoUrl)
        .replaceAll('{{ARTIST_NAME}}', safeArtistName)
        .replaceAll('{{BODY_HTML}}', safeBody)
        .replaceAll('{{CTA_BLOCK}}', ctaBlock)
        .replaceAll('{{SITE_URL}}', siteUrl);
    }

    // Keep the email subject only in SMTP payload (not rendered in the HTML body).
    const templateHtml = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Morgann Music CP</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { margin:0; padding:0; background:#e2e2e2; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; color:#101114; }
      .shell { width:100%; padding:24px 10px; }
      .card { max-width:680px; margin:0 auto; background:#ffffff; border:1px solid rgba(0,0,0,.08); border-radius:20px; overflow:hidden; box-shadow:0 18px 40px rgba(0,0,0,.08); }
      .head { padding:26px 26px 18px; border-bottom:1px solid rgba(0,0,0,.07); background:linear-gradient(180deg,#f6f6f6 0%,#ffffff 100%); }
      .logo { display:block; width:140px; max-width:100%; height:auto; }
      .chip { display:inline-block; margin-top:14px; font-size:11px; letter-spacing:.08em; text-transform:uppercase; font-weight:700; color:#4a5568; background:#eef2f7; border-radius:999px; padding:6px 10px; }
      .content { padding:26px; font-size:15px; line-height:1.72; color:#1f2937; }
      .hello { margin:0 0 12px; font-size:16px; font-weight:700; }
      .message { margin:0; }
      .cta-wrap { margin:22px 0 6px; }
      .cta { display:inline-block; background:#2f63ff; color:#ffffff !important; text-decoration:none; font-weight:800; border-radius:999px; padding:12px 20px; }
      .foot { border-top:1px solid rgba(0,0,0,.07); padding:18px 26px 22px; color:#6b7280; font-size:12px; line-height:1.6; background:#fafafa; }
      .foot a { color:#374151; }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="card">
        <div class="head">
          <img class="logo" src="${logoUrl}" alt="Morgann Music CP" />
          <span class="chip">Morgann Music CP</span>
        </div>
        <div class="content">
          <p class="hello">Bonjour ${safeArtistName},</p>
          <p class="message">${safeBody}</p>
          ${ctaBlock}
        </div>
        <div class="foot">
          <div>Morgann Music CP</div>
          <div>Distribution, label services & accompagnement artistes.</div>
          <div style="margin-top:6px;"><a href="${siteUrl}" target="_blank" rel="noopener noreferrer">${siteUrl}</a></div>
        </div>
      </div>
    </div>
  </body>
</html>`;

    let managedTemplateHtml = templateHtml;
    try {
      const templateResponse = await fetch(templateUrl, { method: 'GET' });
      if (templateResponse.ok) {
        const rawTemplate = await templateResponse.text();
        if (rawTemplate && rawTemplate.includes('{{BODY_HTML}}')) {
          managedTemplateHtml = applyTemplateVariables(rawTemplate);
        } else {
          managedTemplateHtml = applyTemplateVariables(templateHtml);
        }
      } else {
        managedTemplateHtml = applyTemplateVariables(templateHtml);
      }
    } catch {
      managedTemplateHtml = applyTemplateVariables(templateHtml);
    }

    const htmlContent = hasCustomHtml ? String(customHtml) : managedTemplateHtml;

    const emailAttachments = Array.isArray(attachments)
      ? attachments
          .filter((item) => item && typeof item.name === 'string' && typeof item.content === 'string')
          .slice(0, 10)
          .map((item) => ({
            name: item.name.slice(0, 140),
            content: item.content
          }))
      : [];

    const textContent = hasCustomHtml
      ? 'Message HTML personnalisé envoyé depuis Morgann Music CP.'
      : `${String(body || '').trim()}${wantsButton ? `\n\n${ctaText}: ${ctaUrl}` : ''}`;

    // Call Brevo API v3
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: brevoFromName, email: brevoFromEmail },
        to: uniqueEmails.map((email) => ({ email, name: artistName || email })),
        subject,
        htmlContent,
        textContent,
        tags: [normalizedCategory, normalizedTransactionType],
        ...(emailAttachments.length ? { attachment: emailAttachments } : {})
      })
    });

    const brevoRaw = await brevoResponse.text();
    let brevoData = {};
    try {
      brevoData = brevoRaw ? JSON.parse(brevoRaw) : {};
    } catch {
      brevoData = { message: brevoRaw || 'Réponse Brevo invalide' };
    }

    if (!brevoResponse.ok) {
      console.error('Brevo API error:', brevoData);
      return new Response(
        JSON.stringify({
          error: 'Email send failed',
          details: brevoData.message || brevoResponse.statusText
        }),
        { status: brevoResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent to ${uniqueEmails.length} recipient(s)`,
        messageId: brevoData.messageId,
        mailCategory: normalizedCategory,
        recipientCount: uniqueEmails.length,
        transactionType: normalizedTransactionType
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Worker error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
