export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, X-File-Type",
                }
            });
        }

        if (request.method !== "POST") {
            return new Response("Méthode non autorisée", { status: 405 });
        }

        try {
            const url = new URL(request.url);
            const releaseId = url.searchParams.get("releaseId") || "unknown";
            const fileType = request.headers.get("X-File-Type") || "cover"; // 'cover', 'motion11' ou 'motion34'

            const contentType = request.headers.get("Content-Type") || "";
            let extension = "jpg";
            if (contentType.includes("png")) extension = "png";
            if (contentType.includes("quicktime") || contentType.includes("video/mp4")) extension = "mov";

            const filename = `releases/${releaseId}/${fileType}-${Date.now()}.${extension}`;
            const buffer = await request.arrayBuffer();

            // Sauvegarde dans le Bucket R2 des Pochettes
            await env.POCHETTES_BUCKET.put(filename, buffer, {
                httpMetadata: { contentType: contentType }
            });

            const publicUrl = `https://pochette.mm-cp.uk/${filename}`;

            return new Response(JSON.stringify({ success: true, url: publicUrl }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }
    }
};