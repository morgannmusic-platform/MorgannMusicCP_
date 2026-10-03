import Stripe from 'stripe';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (!env.STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Configuration erreur : STRIPE_SECRET_KEY manquant" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- CRÉATION DE SESSION CHECKOUT ---
    if (request.method === "POST" && url.pathname === "/") {
      try {
        const body = await request.json();
        const { amount, planName, planId, userId, userEmail, mode } = body;
        const checkoutMode = mode || 'subscription';

        const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
          httpClient: Stripe.createFetchHttpClient(),
        });

        const lineItem = {
          price_data: {
            currency: 'eur',
            product_data: { name: planName || 'Abonnement MMCP' },
            unit_amount: amount,
          },
          quantity: 1,
        };

        if (checkoutMode === 'subscription') {
          lineItem.price_data.recurring = { interval: 'month' };
        }

        const sessionConfig = {
          payment_method_types: ['card'],
          line_items: [lineItem],
          mode: checkoutMode,
          success_url: `https://mm-cp.uk/success.html?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `https://mm-cp.uk/cancel.html`,
          metadata: {
            userId: userId || '',
            planId: planId || '',
            planName: planName || ''
          },
        };

        if (userEmail) {
          sessionConfig.customer_email = userEmail;
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        return new Response(JSON.stringify({ url: session.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Stripe error: " + e.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // --- VÉRIFICATION DE SESSION ET MISE À JOUR D1 ---
    if (request.method === "GET" && url.pathname === "/verify-session") {
      const sessionId = url.searchParams.get("session_id");
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "session_id manquant" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      try {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
          httpClient: Stripe.createFetchHttpClient(),
        });

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === "paid" || session.status === "complete") {
          const planId = session.metadata?.planId;
          const planName = session.metadata?.planName;
          const userEmail = session.customer_email || session.customer_details?.email;
          const assignedPlan = planId || planName;

          if (userEmail && env.DB) {
            // Met à jour la colonne plan_name dans la table users en cherchant par email
            await env.DB.prepare(
              `UPDATE users 
               SET plan_name = ?
               WHERE email = ?`
            ).bind(assignedPlan, userEmail).run();

            console.log(`[D1 Success] Utilisateur ${userEmail} mis à jour avec plan_name = ${assignedPlan}`);
          }

          return new Response(JSON.stringify({ success: true, planName: assignedPlan }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          return new Response(JSON.stringify({ success: false, error: "Paiement non validé" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};