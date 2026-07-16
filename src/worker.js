export default {
  async fetch(request, env) {
    // 1. Gestion du CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
      });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/liaison-artiste") {
      return new Response(JSON.stringify({ error: "Route non trouvée" }), { 
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
      });
    }

    // 2. Validation de l'authentification Firebase Auth
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentification requise" }), { 
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
      });
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
      // Décodage du Token Firebase
      const tokenParts = idToken.split('.');
      if (tokenParts.length !== 3) {
        throw new Error("Format de token invalide");
      }
      const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')));
      const userId = payload.sub;

      if (!userId) {
        return new Response(JSON.stringify({ error: "Utilisateur introuvable dans le token" }), { 
          status: 401,
          headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
        });
      }

      if (request.method === "POST") {
        const { name, genre, feat, spotifyId, appleMusicId } = await request.json();

        if (!name) {
          return new Response(JSON.stringify({ error: "Le nom de l'artiste est obligatoire" }), { 
            status: 400,
            headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
          });
        }

        // A. Authentification auprès de Too Lost (Logique ultra-robuste)
        let tooLostToken;
        try {
          tooLostToken = await getTooLostAccessToken(env);
        } catch (authError) {
          return new Response(JSON.stringify({ error: `Connexion à Too Lost échouée: ${authError.message}` }), {
            status: 502,
            headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
          });
        }

        // B. Envoi à l'API Too Lost
        const tooLostResponse = await fetch("https://api.toolost.com/v1/distributor/artists", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${tooLostToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: name,
            spotify_id: spotifyId || null,
            apple_music_id: appleMusicId || null
          })
        });

        if (!tooLostResponse.ok) {
          const errText = await tooLostResponse.text();
          return new Response(JSON.stringify({ error: `Erreur retournée par Too Lost: ${errText}` }), { 
            status: tooLostResponse.status,
            headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
          });
        }

        const tooLostArtist = await tooLostResponse.json();
        const tooLostArtistId = tooLostArtist.id; 

        // C. Enregistrement Firestore
        try {
          await saveArtistToFirestore(env, userId, {
            name,
            primaryGenre: genre || "Non défini",
            feat: feat || "",
            toolost_artist_id: tooLostArtistId,
            spotify_id: spotifyId || "",
            apple_music_id: appleMusicId || "",
            createdAt: new Date().toISOString()
          });
        } catch (firestoreError) {
          return new Response(JSON.stringify({ error: `Artiste créé sur Too Lost (${tooLostArtistId}) mais échec de l'enregistrement dans ta base de données: ${firestoreError.message}` }), {
            status: 500,
            headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          toolost_artist_id: tooLostArtistId, 
          name 
        }), {
          status: 201,
          headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { 
        status: 405,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: `Crash interne du Worker: ${err.message}` }), { 
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
      });
    }
  }
};

async function getTooLostAccessToken(env) {
  // Option OAuth standard : Envoi des credentials en Basic Auth dans les headers (méthode recommandée par l'OAuth standard de Too Lost)
  const credentials = btoa(`${env.TOOLOST_CLIENT_ID}:${env.TOOLOST_CLIENT_SECRET}`);
  
  const res = await fetch("https://toolost.com/oauth/token", {
    method: "POST",
    headers: { 
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded" 
    },
    body: new URLSearchParams({
      grant_type: "client_credentials"
    })
  });

  if (!res.ok) {
    const errPayload = await res.text();
    throw new Error(`Code ${res.status} - Détails: ${errPayload}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function saveArtistToFirestore(env, userId, artistData) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}/artists`;

  const payload = {
    fields: {
      name: { stringValue: artistData.name },
      primaryGenre: { stringValue: artistData.primaryGenre },
      feat: { stringValue: artistData.feat },
      toolost_artist_id: { stringValue: artistData.toolost_artist_id },
      spotify_id: { stringValue: artistData.spotify_id },
      apple_music_id: { stringValue: artistData.apple_music_id },
      createdAt: { stringValue: artistData.createdAt }
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText);
  }
}