/**
 * Cloudflare Worker — pay.mm-cp.uk
 *
 * Secrets à configurer dans le dashboard Cloudflare (Settings > Variables > Secrets) :
 *   STRIPE_SECRET_KEY  = sk_live_xxxx
 *   FIREBASE_API_KEY   = AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc
 *
 * Corps attendu (JSON) :
 *   { amount, planName, userId, couponCode? }
 *
 * Le couponCode est optionnel. Si fourni, le worker vérifie dans Firestore
 * et applique la réduction CÔTÉ SERVEUR avant de créer le PaymentIntent.
 */

const PLAN_PRICES = {
  'starter-monthly':  299,
  'starter-annual':  3229,
  'pro-monthly':      399,
  'pro-annual':      4309,
  'label-monthly':    599,
  'label-annual':    6469,
  'under18-monthly':   99,
  'under18-annual':    99,
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {

    /* Preflight CORS */
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    /* 1 — Lire le corps */
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Corps JSON invalide.' }, 400);
    }

    const { amount, planName, userId, couponCode } = body;

    if (!amount || !planName || !userId) {
      return json({ error: 'Paramètres manquants (amount, planName, userId).' }, 400);
    }

    /* 2 — Valider le plan et le montant de base */
    const basePrice = PLAN_PRICES[planName];
    if (!basePrice) {
      return json({ error: `Plan inconnu : ${planName}` }, 400);
    }
    if (Number(amount) !== basePrice) {
      return json({ error: 'Montant incompatible avec le plan sélectionné.' }, 400);
    }

    /* 3 — Appliquer le coupon si fourni (validation Firestore) */
    let finalAmount = basePrice;
    let discountApplied = 0;

    if (couponCode && typeof couponCode === 'string') {
      try {
        const code = couponCode.trim().toUpperCase();
        const fsUrl = `https://firestore.googleapis.com/v1/projects/morgann-music-cp/databases/(default)/documents/coupons/${encodeURIComponent(code)}?key=${env.FIREBASE_API_KEY}`;
        const fsRes = await fetch(fsUrl);

        if (fsRes.ok) {
          const fsData = await fsRes.json();
          const fields = fsData.fields || {};
          const active   = fields.active?.booleanValue;
          const discount = Number(
            fields.discount?.integerValue ??
            fields.discount?.doubleValue  ??
            0
          );

          if (active && discount >= 1 && discount <= 100) {
            discountApplied = discount;
            finalAmount = Math.round(basePrice * (1 - discount / 100));
          }
        }
        // Si le coupon n'existe pas ou est inactif → on ignore silencieusement
      } catch {
        // Erreur réseau Firestore → on facture le plein tarif (safe fallback)
        finalAmount = basePrice;
        discountApplied = 0;
      }
    }

    /* 4 — Créer le PaymentIntent Stripe */
    const params = new URLSearchParams({
      amount:   String(finalAmount),
      currency: 'eur',
      'metadata[userId]':   userId,
      'metadata[planName]': planName,
    });
    if (couponCode)        params.set('metadata[couponCode]',     couponCode);
    if (discountApplied)   params.set('metadata[discountApplied]', String(discountApplied));

    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type':   'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const stripeData = await stripeRes.json();

    if (!stripeRes.ok || !stripeData.client_secret) {
      return json({ error: stripeData.error?.message || 'Erreur Stripe.' }, 500);
    }

    return json({
      clientSecret:    stripeData.client_secret,
      finalAmount,
      discountApplied,
    });
  },
};
