function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
}

function corsJson(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
}

function getAbsoluteImageUrl(url) {
    if (!url) return "";
    const cleanUrl = String(url).trim();
    if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
        return cleanUrl;
    }
    if (cleanUrl.startsWith("/")) {
        return `https://api.worker.mm-cp.uk${cleanUrl}`;
    }
    return `https://api.worker.mm-cp.uk/api/files/${encodeURIComponent(cleanUrl)}`;
}

export default {
    async fetch(request, env, ctx) {
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders() });
        }

        const url = new URL(request.url);

        if (url.pathname === "/run-migration" || url.pathname === "/") {
            try {
                const report = {
                    remainingToConvert: 0,
                    convertedToWebp: 0,
                    errors: []
                };

                // 1. S'assurer que la colonne pochette_haute_definition existe
                try {
                    await env.DB.prepare(
                        "ALTER TABLE releases ADD COLUMN pochette_haute_definition TEXT"
                    ).run();
                } catch (e) { }

                // 2. Copier cover_url vers pochette_haute_definition si pas encore fait
                await env.DB.prepare(`
          UPDATE releases 
          SET pochette_haute_definition = cover_url 
          WHERE (pochette_haute_definition IS NULL OR pochette_haute_definition = '') 
            AND cover_url IS NOT NULL 
            AND cover_url != ''
        `).run();

                // 3. Récupérer un lot de releases à convertir
                const { results: releases } = await env.DB.prepare(`
          SELECT id, user_uid, pochette_haute_definition, cover_url 
          FROM releases 
          WHERE pochette_haute_definition IS NOT NULL 
            AND pochette_haute_definition != ''
            AND cover_url NOT LIKE '%.webp'
          LIMIT 5
        `).all();

                // Compter combien il en reste
                const countRow = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM releases 
          WHERE pochette_haute_definition IS NOT NULL 
            AND pochette_haute_definition != ''
            AND cover_url NOT LIKE '%.webp'
        `).first();

                report.remainingToConvert = countRow ? countRow.count : 0;

                if (!releases || releases.length === 0) {
                    return corsJson({
                        success: true,
                        message: "Toutes les pochettes ont déjà été converties en WebP !",
                        report
                    });
                }

                const bucket = env.STORAGE || env.BUCKET || env.MEDIA_BUCKET || env.R2;
                if (!bucket) {
                    return corsJson({ error: "Bucket R2 introuvable dans env.STORAGE" }, 500);
                }

                // 4. Conversion et traitement
                for (const release of releases) {
                    try {
                        const hdUrl = getAbsoluteImageUrl(release.pochette_haute_definition);
                        if (!hdUrl) continue;

                        // Utilisation des transformations d'image réseau Cloudflare
                        const transformedReq = await fetch(hdUrl, {
                            cf: {
                                image: {
                                    width: 800,
                                    height: 800,
                                    fit: "scale-down",
                                    format: "webp",
                                    quality: 80
                                }
                            }
                        });

                        let imageBuffer;
                        let contentType = "image/webp";

                        if (transformedReq.ok) {
                            imageBuffer = await transformedReq.arrayBuffer();
                        } else {
                            // Si les transformations Cloudflare 'cf.image' ne sont pas activées sur la zone,
                            // on récupère l'image originale
                            const fallbackResp = await fetch(hdUrl);
                            if (!fallbackResp.ok) {
                                report.errors.push(`Release #${release.id}: Téléchargement impossible (${fallbackResp.status})`);
                                continue;
                            }
                            imageBuffer = await fallbackResp.arrayBuffer();
                            contentType = fallbackResp.headers.get("content-type") || "image/jpeg";
                        }

                        const ext = contentType.includes("webp") ? "webp" : "jpg";
                        const r2Key = `cover/${release.user_uid || 'system'}_${release.id}_light_${Date.now()}.${ext}`;

                        await bucket.put(r2Key, imageBuffer, {
                            httpMetadata: { contentType }
                        });

                        const newCoverUrl = `/api/files/${encodeURIComponent(r2Key)}`;

                        await env.DB.prepare(`
              UPDATE releases 
              SET cover_url = ?, updated_at = ? 
              WHERE id = ?
            `).bind(newCoverUrl, new Date().toISOString(), release.id).run();

                        report.convertedToWebp++;
                    } catch (err) {
                        report.errors.push(`Release #${release.id}: ${err.message}`);
                    }
                }

                return corsJson({
                    success: true,
                    message: `Lot traité. Rafraîchis la page pour continuer la suite.`,
                    report
                });

            } catch (err) {
                return corsJson({ error: err.message }, 500);
            }
        }

        return corsJson({ error: "Route non trouvée. Utilisez GET /run-migration" }, 404);
    }
};