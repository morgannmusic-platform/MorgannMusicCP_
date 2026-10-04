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
          // IMPORTANT : On demande à Stripe de créer ou de réutiliser le client basé sur cet email pour le retrouver facilement ensuite
          const existingCustomers = await stripe.customers.list({ email: userEmail, limit: 1 });
          if (existingCustomers.data.length > 0) {
            sessionConfig.customer = existingCustomers.data[0].id;
            delete sessionConfig.customer_email; // Évite les conflits si customer_id est fourni directement
          }
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

    // --- CRÉATION DE SESSION DU PORTAIL CLIENT (Gérer abonnement / résiliation) ---
    if (request.method === "POST" && url.pathname === "/create-portal-session") {
      try {
        const body = await request.json();
        const { customerId, userEmail } = body;

        const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
          httpClient: Stripe.createFetchHttpClient(),
        });

        let targetCustomerId = customerId;

        // Si on a l'email mais pas le customerId, on recherche le client dans Stripe
        if (!targetCustomerId && userEmail) {
          const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
          if (customers.data.length > 0) {
            targetCustomerId = customers.data[0].id;
          }
        }

        if (!targetCustomerId) {
          return new Response(JSON.stringify({ error: "Aucun client Stripe trouvé pour cet utilisateur" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const portalSession = await stripe.billingPortal.sessions.create({
          customer: targetCustomerId,
          return_url: 'https://mm-cp.uk/account.html',
        });

        return new Response(JSON.stringify({ url: portalSession.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Portal error: " + e.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // --- VÉRIFICATION DE SESSION ET MISE À JOUR D1 ---
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
          const stripeCustomerId = session.customer; // <-- L'ID client Stripe (cus_...)
          const assignedPlan = planId || planName;

          if (userEmail && env.DB) {
            // Met à jour à la fois le plan ET l'ID client Stripe dans la table users
            await env.DB.prepare(
              `UPDATE users 
               SET plan_name = ?, stripe_customer_id = ?
               WHERE email = ?`
            ).bind(assignedPlan, stripeCustomerId, userEmail).run();

            console.log(`[D1 Success] Utilisateur ${userEmail} mis à jour : plan = ${assignedPlan}, customer = ${stripeCustomerId}`);
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
    // --- WEBHOOK STRIPE (Mise à jour D1 en cas de résiliation ou changement) ---
    // ... existing code ...
    // --- WEBHOOK STRIPE (Mise à jour D1 en cas de résiliation ou changement) ---
    if (request.method === "POST" && url.pathname === "/webhook") {
      const signature = request.headers.get("stripe-signature");
      if (!signature) {
        return new Response("Erreur : Header stripe-signature manquant", { status: 400, headers: corsHeaders });
      }

      const body = await request.text();
      let event;

      if (!env.STRIPE_WEBHOOK_SECRET) {
        return new Response("Erreur : STRIPE_WEBHOOK_SECRET manquant", { status: 500, headers: corsHeaders });
      }

      try {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
          httpClient: Stripe.createFetchHttpClient(),
        });
        event = await stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        return new Response(`Webhook Error: ${err.message}`, { status: 400, headers: corsHeaders });
      }

      // Gestion des événements de résiliation ou d'annulation d'abonnement
      if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
        const subscription = event.data.object;
        const customerId = subscription.customer; // 'cus_...'

        try {
          if (env.DB && customerId) {
            let newPlan = 'starter'; // Plan par défaut si résilié

            // Si l'abonnement est supprimé ou marqué pour annulation à la fin de la période
            if (event.type === "customer.subscription.deleted" || subscription.cancel_at_period_end) {
              newPlan = 'starter';
            }

            // On met à jour directement en cherchant par stripe_customer_id
            await env.DB.prepare(
              `UPDATE users 
               SET plan_name = ?
               WHERE stripe_customer_id = ?`
            ).bind(newPlan, customerId).run();

            console.log(`[D1 Webhook] Utilisateur avec customer_id ${customerId} mis à jour suite à l'événement ${event.type}`);
          }
        } catch (dbErr) {
          console.error("Erreur Webhook D1:", dbErr.message);
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
