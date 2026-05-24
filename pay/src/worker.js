export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Gestion du Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // --- ROUTE 1 : CRÉATION DU PAIEMENT ---
    if (request.method === "POST" && url.pathname !== "/webhook") {
      try {
        const body = await request.json();
        const { amount, planName, userId } = body;

        // Sécurité anti-crash si des champs manquent dans le JSON envoyé par le client
        if (amount === undefined || amount === null) {
          return new Response(JSON.stringify({ 
            error: "Le champ 'amount' est absent de la requête.",
            receivedBody: body 
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        if (!planName || !userId) {
          return new Response(JSON.stringify({ 
            error: "Le champ 'planName' ou 'userId' est manquant.",
            receivedBody: body 
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Appel à l'API Stripe
        const stripeResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            "amount": amount.toString(),
            "currency": "eur",
            "metadata[userId]": userId,
            "metadata[planName]": planName,
            "automatic_payment_methods[enabled]": "true",
          }),
        });

        const stripeData = await stripeResponse.json();
        
        if (!stripeResponse.ok) {
          return new Response(JSON.stringify({ error: "Erreur Stripe API", details: stripeData }), {
            status: stripeResponse.status,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify({ clientSecret: stripeData.client_secret }), { 
          status: 200, 
          headers: corsHeaders 
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // --- ROUTE 2 : WEBHOOK STRIPE SÉCURISÉ ---
    if (request.method === "POST" && url.pathname === "/webhook") {
      try {
        const signature = request.headers.get("Stripe-Signature");
        const bodyText = await request.text();

        if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
          return new Response("Signature ou Secret manquant", { status: 400, headers: corsHeaders });
        }

        const parts = signature.split(",");
        let t = "";
        let v1 = "";
        for (const part of parts) {
          const [key, value] = part.split("=");
          if (key.trim() === "t") t = value.trim();
          if (key.trim() === "v1") v1 = value.trim();
        }

        if (!t || !v1) {
          return new Response("Format de signature invalide", { status: 400, headers: corsHeaders });
        }

        const signedPayload = `${t}.${bodyText}`;

        const encoder = new TextEncoder();
        const cryptoKey = await crypto.subtle.importKey(
          "raw",
          encoder.encode(env.STRIPE_WEBHOOK_SECRET),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );

        const hmacBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(signedPayload));
        const expectedV1 = Array.from(new Uint8Array(hmacBuffer))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");

        if (v1 !== expectedV1) {
          return new Response("Signature Stripe invalide !", { status: 403, headers: corsHeaders });
        }

        const payload = JSON.parse(bodyText);

        if (payload.type === "payment_intent.succeeded") {
          const paymentIntent = payload.data.object;
          const userId = paymentIntent.metadata.userId;
          const planName = paymentIntent.metadata.planName;

          if (userId && planName) {
            // Utilisation du updateMask conforme à l'API REST de Google Firestore
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}?updateMask.fieldPaths=plan`;
            
            const firebaseRes = await fetch(firestoreUrl, {
              method: "PATCH", 
              headers: { 
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                fields: {
                  plan: { stringValue: planName }
                }
              })
            });

            if (!firebaseRes.ok) {
              const errLog = await firebaseRes.text();
              return new Response(`Erreur Firebase PATCH: ${errLog}`, { status: 500, headers: corsHeaders });
            }
          }
        }

        return new Response(JSON.stringify({ received: true }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(`Erreur Webhook: ${error.message}`, { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Non trouvé", { status: 404, headers: corsHeaders });
  },
};
