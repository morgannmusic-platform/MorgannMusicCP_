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
      const { image_base64, customer_email } = await request.json();

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

      // 2. Appel à Litual Identity (Modèle Vision)
      const visionResponse = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
        prompt: "Check attentivement la DATE DE NAISSANCE sur cette carte d'identité française. Regarde bien l'année. Réponds UNIQUEMENT sous ce format : JJ/MM/AAAA. Exemple : 13/01/2013.",
        image: Array.from(bytes),
      });

      const aiText = visionResponse.description || "";

      // 3. Extraction de la date avec un Regex
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

      // 4. Calcul de l'âge exact
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // 5. Logique d'accès
      if (age < 18) {
        // ✅ Mineur confirmé — la page appelante doit :
        //    sessionStorage.setItem('age_verified', 'true')
        //    window.location.href = '/buy.html?plan=under18'
        return new Response(JSON.stringify({
          status: "success",
          verified: true,
          age: age,
          years_until_major: 18 - age,
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