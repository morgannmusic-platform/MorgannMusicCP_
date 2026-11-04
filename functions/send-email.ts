type PagesFunction<Env = Record<string, unknown>> = (
    context: {
        request: Request;
        env: Env;
        params: Record<string, string>;
        waitUntil?: (promise: Promise<unknown>) => void;
        next?: () => Promise<Response>;
    }
) => Promise<Response> | Response;

interface Env {
    BREVO_API_KEY: string;
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Gestion des requêtes OPTIONS (CORS preflight)
export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        if (!context.env.BREVO_API_KEY) {
            return new Response(
                JSON.stringify({ success: false, error: "BREVO_API_KEY manquante dans les variables Cloudflare Pages" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { toEmail, subject, htmlContent } = await context.request.json();

        if (!toEmail || !subject || !htmlContent) {
            return new Response(
                JSON.stringify({ success: false, error: "Champs toEmail, subject ou htmlContent manquants" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "api-key": context.env.BREVO_API_KEY,
            },
            body: JSON.stringify({
                sender: { name: "Morgann Music CP", email: "notifications@mm-cp.uk" },
                to: [{ email: toEmail }],
                subject: subject,
                htmlContent: htmlContent,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            return new Response(
                JSON.stringify({ success: false, brevoError: data }),
                { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, data }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
};