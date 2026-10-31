export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const origin = request.headers.get("Origin") || "*";

        const corsHeaders = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true"
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // 1. UPLOAD DE FICHIER VERS R2
            if (url.pathname === "/api/upload" && request.method === "POST") {
                const formData = await request.formData();
                const file = formData.get("file");

                if (!file) {
                    return new Response(JSON.stringify({ error: "Aucun fichier fourni" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }

                const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
                await env.BUCKET.put(fileName, file.stream(), {
                    httpMetadata: { contentType: file.type }
                });

                return new Response(JSON.stringify({ url: fileName, key: fileName }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 2. RÉCUPÉRATION DE FICHIER DEPUIS R2
            if (url.pathname.startsWith("/api/files/") && request.method === "GET") {
                const key = url.pathname.replace("/api/files/", "");
                const object = await env.BUCKET.get(key);

                if (!object) {
                    return new Response("Fichier introuvable", { status: 404, headers: corsHeaders });
                }

                const headers = new Headers(corsHeaders);
                object.writeHttpMetadata(headers);
                headers.set("etag", object.httpEtag);

                return new Response(object.body, { headers });
            }

            // 3. ROUTE LABELS
            const userLabelMatch = url.pathname.match(/^\/api\/users\/([^\/]+)\/labels$/);

            if (userLabelMatch) {
                const uid = userLabelMatch[1];

                // GET : Récupérer le label
                if (request.method === "GET") {
                    const { results } = await env.DB.prepare("SELECT * FROM labels WHERE uid = ?").bind(uid).all();
                    return new Response(JSON.stringify(results || []), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }

                // POST : Créer ou mettre à jour
                if (request.method === "POST") {
                    const body = await request.json();

                    // Table D1 si absente
                    await env.DB.prepare(`
                        CREATE TABLE IF NOT EXISTS labels (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            uid TEXT UNIQUE,
                            nom TEXT, url TEXT, line_c TEXT, line_p TEXT, cgu_url TEXT,
                            address TEXT, siret TEXT, city TEXT, zip_code TEXT, state TEXT, country TEXT,
                            support_email TEXT, mmcp_support INTEGER, commission INTEGER,
                            accent_color TEXT, bg_color TEXT, font_family TEXT,
                            icon_url TEXT, favicon_url TEXT, logo_url TEXT
                        )
                    `).run();

                    const existing = await env.DB.prepare("SELECT * FROM labels WHERE uid = ?").bind(uid).first();

                    const nom = body.nom || "";
                    const urlVal = body.url || "";
                    const lineC = body.lineC || "label";
                    const lineP = body.lineP || "";
                    const cguUrl = body.cguUrl || "";
                    const address = body.address || "";
                    const siret = body.siret || "";
                    const city = body.city || "";
                    const zipCode = body.zipCode || "";
                    const state = body.state || "";
                    const country = body.country || "";
                    const supportEmail = body.supportEmail || "";
                    const mmcpSupport = body.mmcpSupport ? 1 : 0;
                    const commission = parseInt(body.commission, 10) || 0;
                    const accentColor = body.accentColor || "#FC8FB0";
                    const bgColor = body.bgColor || "#ffffff";
                    const fontFamily = body.fontFamily || "Poppins";

                    const logoUrl = body.logoUrl !== undefined ? body.logoUrl : (existing ? existing.logo_url : "");
                    const faviconUrl = body.faviconUrl !== undefined ? body.faviconUrl : (existing ? existing.favicon_url : "");
                    const iconUrl = body.iconUrl !== undefined ? body.iconUrl : (existing ? existing.icon_url : "");

                    if (existing) {
                        await env.DB.prepare(`
                            UPDATE labels SET 
                                nom = ?, url = ?, line_c = ?, line_p = ?, cgu_url = ?, address = ?,
                                siret = ?, city = ?, zip_code = ?, state = ?, country = ?, support_email = ?,
                                mmcp_support = ?, commission = ?, accent_color = ?, bg_color = ?, font_family = ?,
                                icon_url = ?, favicon_url = ?, logo_url = ?
                            WHERE uid = ?
                        `).bind(
                            nom, urlVal, lineC, lineP, cguUrl, address,
                            siret, city, zipCode, state, country, supportEmail,
                            mmcpSupport, commission, accentColor, bgColor, fontFamily,
                            iconUrl, faviconUrl, logoUrl, uid
                        ).run();
                    } else {
                        await env.DB.prepare(`
                            INSERT INTO labels (
                                uid, nom, url, line_c, line_p, cgu_url, address,
                                siret, city, zip_code, state, country, support_email,
                                mmcp_support, commission, accent_color, bg_color, font_family,
                                icon_url, favicon_url, logo_url
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `).bind(
                            uid, nom, urlVal, lineC, lineP, cguUrl, address,
                            siret, city, zipCode, state, country, supportEmail,
                            mmcpSupport, commission, accentColor, bgColor, fontFamily,
                            iconUrl, faviconUrl, logoUrl
                        ).run();
                    }

                    return new Response(JSON.stringify({ success: true }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }
            }

            return new Response(JSON.stringify({ error: "Route introuvable" }), {
                status: 404,
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