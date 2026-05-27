import Stripe from 'stripe';

export default {
  async fetch(request, env) {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const url = new URL(request.url);

    // Gestion du CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- ROUTE 1 : Création du PaymentIntent ---
    if (request.method === "POST" && url.pathname === "/") {
      try {
        const { amount, planName, planId, userId } = await request.json();

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "eur",
          automatic_payment_methods: { enabled: true },
          metadata: {
            userId: userId,
            planId: planId,
            planName: planName
          },
        });

        return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    // --- ROUTE 2 : Webhook (Appelé par Stripe après paiement) ---
    if (request.method === "POST" && url.pathname === "/webhook") {
      const signature = request.headers.get("stripe-signature");
      if (!signature) {
        return new Response("Erreur : Header stripe-signature manquant", { status: 400, headers: corsHeaders });
      }

      const body = await request.text();
      let event;

      if (!env.STRIPE_WEBHOOK_SECRET) {
        return new Response("Erreur : STRIPE_WEBHOOK_SECRET n'est pas configuré dans le Worker", { status: 500, headers: corsHeaders });
      }

      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        return new Response(`Webhook Error (Signature): ${err.message}`, { status: 400, headers: corsHeaders });
      }

      if (event.type === "payment_intent.succeeded") {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const planId = session.metadata.planId;
        const planName = session.metadata.planName;


        try {
          // On loggue en interne du worker pour le débuggage via `wrangler tail`
          console.log(`Paiement réussi pour l'utilisateur ${userId} - Plan: ${planName}`);
          await updateFirestoreUser(env, userId, planId, planName);
        } catch (dbError) {
          // Si Firestore échoue, on renvoie une erreur pour que Stripe réessaie plus tard
          console.error("Firestore Update Error:", dbError.message);
        }
      }

      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};

/**
 * Met à jour le rôle de l'utilisateur dans Firestore via l'API REST
 */
async function updateFirestoreUser(env, userId, planId, planName) {
  const projectId = env.FIREBASE_PROJECT_ID;
  // On mappe le plan payé au rôle souhaité dans Firestore
  const planToRole = {
    "under18": "artiste",
    "starter": "artiste",
    "pro": "vip",
    "label": "vip"
  };
  
  const role = planToRole[planId] || "artiste";
  
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}?updateMask.fieldPaths=role&updateMask.fieldPaths=subscriptionStatus&updateMask.fieldPaths=planName`;

  const body = {
    fields: {
      role: { stringValue: role },
      subscriptionStatus: { stringValue: "active" },
      planName: { stringValue: planName },
      updatedAt: { timestampValue: new Date().toISOString() }
    }
  };

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.text();
    // Log l'erreur complète de Firestore pour le débogage
    console.error(`Firestore REST API failed for user ${userId}: ${response.status} - ${errorData}`);
    // Relance l'erreur pour que le bloc catch du webhook puisse la gérer
    throw new Error(`Firestore update failed: ${response.status} - ${errorData}`);
  }
}