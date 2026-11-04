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

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { toEmail, subject, htmlContent } = await context.request.json();

        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "api-key": context.env.BREVO_API_KEY, // Sécurisé côté Cloudflare
            },
            body: JSON.stringify({
                sender: { name: "Morgann Music CP", email: "noreply@mm-cp.uk" },
                to: [{ email: toEmail }],
                subject: subject,
                htmlContent: htmlContent,
            }),
        });

        const data = await response.json();
        return new Response(JSON.stringify({ success: true, data }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};