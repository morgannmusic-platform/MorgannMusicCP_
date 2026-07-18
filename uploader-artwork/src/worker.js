export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                }
            });
        }

        if (request.method !== "POST") {
            return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
                status: 405,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        try {
            const contentType = request.headers.get("Content-Type") || "";
            if (!contentType.includes("image/")) {
                return new Response(JSON.stringify({ error: "Le fichier doit être une image." }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            let extension = "jpg";
            if (contentType.includes("png")) extension = "png";
            if (contentType.includes("webp")) extension = "webp";

            const url = new URL(request.url);
            const artistId = url.searchParams.get("artistId") || crypto.randomUUID();
            const filename = `profiles/${artistId}-${Date.now()}.${extension}`;

            const imageBuffer = await request.arrayBuffer();

            await env.ARTIST_IMAGES_BUCKET.put(filename, imageBuffer, {
                httpMetadata: { contentType: contentType }
            });

            const publicUrl = `https://pdp-media.mm-cp.uk/${filename}`;

            return new Response(JSON.stringify({ success: true, url: publicUrl }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });

        } catch (err) {
            return new Response(JSON.stringify({ error: `Erreur téléversement : ${err.message}` }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }
    }
};