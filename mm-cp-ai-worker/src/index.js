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
            const { messages, instruction, prompt, image, context, accountContext } = body;

            const accountData = context || accountContext || null;
            let contextInstruction = "";

            if (accountData && typeof accountData === "object") {
                contextInstruction = `[CONTEXT COMPTE UTILISATEUR]\n${JSON.stringify(accountData, null, 2)}`;
            }

            let formattedMessages = [];

            if (messages && Array.isArray(messages)) {
                formattedMessages = messages.map(msg => ({
                    role: msg.role,
                    content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
                }));

                const mergedInstruction = [instruction, contextInstruction].filter(Boolean).join("\n\n");

                if (mergedInstruction) {
                    if (formattedMessages.length > 0 && formattedMessages[0].role === "user") {
                        formattedMessages[0].content = `[INSTRUCTIONS SYSTEME]\n${mergedInstruction}\n\n[MESSAGE UTILISATEUR]\n${formattedMessages[0].content}`;
                    } else {
                        formattedMessages.unshift({ role: "user", content: mergedInstruction });
                    }
                }
            }
            else if (prompt) {
                const combinedPrompt = [instruction, contextInstruction, prompt].filter(Boolean).join("\n\n");
                if (image) {
                    formattedMessages.push({
                        role: "user",
                        content: [{ type: "text", text: combinedPrompt }, { type: "image", image: image }]
                    });
                } else {
                    formattedMessages.push({ role: "user", content: combinedPrompt });
                }
            } else {
                return new Response(JSON.stringify({ error: "Requête invalide." }), { status: 400, headers: corsHeaders });
            }

            const modelCandidates = [
                "@cf/meta/llama-3.2-3b-instruct",
                "@cf/meta/llama-3.1-8b-instruct",
                "@cf/meta/llama-3.2-11b-vision-instruct"
            ];

            let lastError = null;
            for (const model of modelCandidates) {
                try {
                    const aiResponse = await env.AI.run(model, {
                        messages: formattedMessages,
                        stream: true,
                        max_tokens: 1500
                    });

                    return new Response(aiResponse, {
                        status: 200,
                        headers: {
                            ...corsHeaders,
                            "Content-Type": "text/event-stream"
                        }
                    });
                } catch (err) {
                    lastError = err;
                }
            }

            throw lastError || new Error("Aucun modèle IA disponible pour ce chat.");

        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
    }
};