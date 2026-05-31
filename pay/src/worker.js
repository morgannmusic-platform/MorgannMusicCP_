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
        // Le plan est maintenant mis à jour côté client dans account.js après redirection.
        // On se contente de valider la réception du webhook pour Stripe.
        try {
          const session = event.data.object;
          console.log(`Paiement réussi pour le PaymentIntent: ${session.id}`);
        } catch (dbError) {
          console.error("Webhook Log Error:", dbError.message);
        }
      }

      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};