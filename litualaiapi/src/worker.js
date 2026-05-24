export default {
  async fetch(request, env) {
    // Gestion du CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    try {
      const { messages, instruction } = await request.json();
      const systemPrompt = instruction || "Tu es Litual AI, une IA utile.";

      // On active le mode 'stream' pour recevoir les morceaux de texte en direct
      const stream = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        stream: true, // LA CLÉ EST ICI
      });

      // On renvoie directement le flux de données (stream) au navigateur
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Access-Control-Allow-Origin": "*",
        },
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
  },
};