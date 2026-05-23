import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { auth } from "/assets/js/contracts/lib/firebase.js";
import { bootstrapContract } from "/assets/js/contracts/lib/api.js";

const statusEl = document.getElementById("status");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html?redirect=" + encodeURIComponent(window.location.href);
    return;
  }

  const sessionId = new URLSearchParams(window.location.search).get("session_id");
  if (!sessionId) {
    statusEl.textContent = "Session Stripe introuvable.";
    return;
  }

  try {
    const data = await bootstrapContract(sessionId);
    if (!data?.signUrl) {
      statusEl.textContent = "Impossible de démarrer la signature.";
      return;
    }
    statusEl.textContent = "Contrat prêt. Redirection...";
    window.location.href = data.signUrl;
  } catch (error) {
    statusEl.textContent = `Erreur: ${error.message || error}`;
  }
});
