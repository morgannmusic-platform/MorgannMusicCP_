export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
      let imageBuffer;
      const contentType = request.headers.get("content-type") || "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file) throw new Error("Aucun fichier image trouvé.");
        imageBuffer = new Uint8Array(await file.arrayBuffer());
      } else {
        throw new Error("Content-Type non supporté.");
      }

      // Prompt ultra-guidé pour forcer l'attention de LLaVA sur la bonne zone
      const prompt = `You are a highly precise OCR system. Read the provided French ID card carefully.
1. Locate the section on the right side.
2. Find the exact label "DATE DE NAISS. / Date of birth".
3. The birth date is printed right below it in the format "DD MM YYYY" (e.g., 13 01 2013).
4. Extract ONLY the 4-digit year (YYYY).
Output ONLY a valid JSON object in this exact format: {"birthYear": 2013}. Do not include any markdown or extra text.`;


      // Utilisation du modèle autorisé en Europe
      const aiResponse = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
        prompt: prompt,
        image: Array.from(imageBuffer),
      });

      let rawText = aiResponse.description || aiResponse.response || "";

      // Nettoyage au cas où l'IA ajoute des balises
      rawText = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Format JSON non respecté. Brut : " + rawText);

      const result = JSON.parse(jsonMatch[0]);
      const birthYear = parseInt(result.birthYear, 10);

      if (!birthYear || isNaN(birthYear)) throw new Error("Année non trouvée.");

      // Calcul de l'âge (Nous sommes en 2026)
      const currentYear = new Date().getFullYear();
      const calculatedAge = currentYear - birthYear;
      const isMinorFinal = calculatedAge < 18;

      return new Response(
        JSON.stringify({
          success: true,
          birthYear: birthYear,
          estimatedAge: calculatedAge,
          isMinor: isMinorFinal
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  },
};