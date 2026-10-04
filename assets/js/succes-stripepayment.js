const planMap = {
    "starter": "Starter",
    "pro": "Pro",
    "label": "Label",
    "white-label": "Marque blanche",
    "future-legende": "Future-Legende"
};

async function verifyPayment() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    const titleEl = document.getElementById('status-title');
    const descEl = document.getElementById('status-desc');
    const btnEl = document.getElementById('home-btn');

    if (!sessionId) {
        titleEl.textContent = "Erreur";
        descEl.textContent = "Aucune session de paiement détectée.";
        btnEl.style.display = 'inline-block';
        return;
    }

    try {
        const response = await fetch(`https://pay.mm-cp.uk/verify-session?session_id=${sessionId}`);
        const data = await response.json();

        if (response.ok && data.success) {
            const rawPlan = (data.planName || data.planId || "").toLowerCase().trim();
            const formattedPlan = planMap[rawPlan] || rawPlan || "votre plan";

            titleEl.textContent = "Paiement réussi ! 🎉";
            descEl.innerHTML = `Merci ! Votre abonnement <strong>${formattedPlan}</strong> est maintenant <strong>actif</strong>.`;
            btnEl.textContent = "Gérer mon abonnement";
        } else {
            titleEl.textContent = "Oups...";
            descEl.textContent = "Impossible de valider la session : " + (data.error || "Erreur inconnue");
        }
    } catch (err) {
        titleEl.textContent = "Erreur de connexion";
        descEl.textContent = "Impossible de joindre le serveur de validation.";
    } finally {
        btnEl.style.display = 'inline-block';
    }
}

verifyPayment();
