/**
 * Cloudflare Worker — Vérification d'âge pour l'offre -18
 *
 * Bindings requis dans le dashboard Cloudflare :
 *   - AI           : Workers AI (binding name "AI")
 *   - STRIPE_SECRET_KEY : Secret (wrangler secret put STRIPE_SECRET_KEY)
 *
 * Flow :
 *   1. Reçoit { image_base64, customer_email, userId }
 *   2. Analyse la CNI/passeport via Llava (Workers AI)
 *   3. Extrait la date de naissance, calcule l'âge
 *   4. Si < 18 → crée un PaymentIntent Stripe (99 ct) et renvoie { clientSecret }
 *   5. Si >= 18 → renvoie 403 { status: "denied" }
 */

export default {
  async fetch(request, env) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers });
    }

    try {
      const { image_base64, customer_email, userId } = await request.json();

      if (!image_base64) {
        return new Response(JSON.stringify({ error: "Image manquante" }), { status: 400, headers });
      }

      // 1. Décoder l'image base64
      const cleanBase64 = image_base64.replace(/^data:image\/[^;]+;base64,/, "");
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 2. Analyser la pièce d'identité avec Litual Identity (Workers AI Vision)
      const visionResponse = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
        prompt:
          "Check attentivement la DATE DE NAISSANCE sur cette carte d'identité française. Regarde bien l'année. Réponds UNIQUEMENT sous ce format : JJ/MM/AAAA. Exemple : 13/01/2013.",
        image: Array.from(bytes),
      });

      const aiText = visionResponse.description || "";

      // 3. Extraire la date via regex
      const dateMatch = aiText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!dateMatch) {
        return new Response(
          JSON.stringify({ error: "Impossible de lire la date de naissance sur l'image." }),
          { status: 422, headers }
        );
      }

      const [, day, month, year] = dateMatch;
      const birthDate = new Date(Number(year), Number(month) - 1, Number(day));
      const today = new Date();

      // 4. Calculer l'âge exact
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // 5. Logique d'accès
      if (age < 18) {
        const yearsLeft = 18 - age;

        // Vérification réussie — la page appelante stocke le résultat et redirige
        // vers buy.html?plan=under18 avec sessionStorage['age_verified'] = 'true'
        return new Response(JSON.stringify({
          status: "success",
          verified: true,
          age: age,
          years_until_major: yearsLeft,
        }), { headers });

      } else {
        return new Response(JSON.stringify({
          status: "denied",
          verified: false,
          message: "Désolé, cette offre est réservée aux mineurs. Tu as " + age + " ans.",
        }), { status: 403, headers });
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Erreur serveur: " + e.message }),
        { status: 500, headers }
      );
    }
  },
};
