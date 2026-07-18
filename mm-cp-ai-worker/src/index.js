export default {
    async fetch(request, env) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== "POST") {
            return new Response("Méthode non autorisée", { status: 405, headers: corsHeaders });
        }

        try {
            const body = await request.json();
            const prompt = body.prompt;

            if (!prompt) {
                return new Response(JSON.stringify({ error: "Le paramètre 'prompt' est requis." }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
                messages: [
                    { role: "system", content: "Tu es l'assistant d'administration expert du système de distribution musicale MM-CP. Tu réponds de manière concise, sous forme de liste d'actions concrètes, en français." },
                    { role: "user", content: prompt }
                ]
            });

            return new Response(JSON.stringify({ result: aiResponse.response }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });

        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
    }
};