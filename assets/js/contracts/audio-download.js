import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { auth } from "/assets/js/contracts/lib/firebase.js";
import { getContractAudioDownloads } from "/assets/js/contracts/lib/api.js";

const statusEl = document.getElementById("status");
const audioListEl = document.getElementById("audioList");
const signedContractLink = document.getElementById("signedContractLink");

function renderItems(items) {
  if (!items.length) {
    audioListEl.innerHTML = "<p class=\"muted\">Aucun audio trouvé pour ce contrat.</p>";
    return;
  }

  audioListEl.innerHTML = items.map((item) => `
    <div class="item">
      <div><strong>${item.title || "Audio"}</strong></div>
      <a class="btn btn-main" href="${item.audioUrl}" target="_blank" rel="noopener">Télécharger</a>
    </div>
  `).join("");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html?redirect=" + encodeURIComponent(window.location.href);
    return;
  }

  const contractId = new URLSearchParams(window.location.search).get("contractId") || "";
  if (!contractId) {
    statusEl.textContent = "contractId manquant.";
    return;
  }

  try {
    const data = await getContractAudioDownloads(contractId);
    renderItems(data?.items || []);

    if (data?.signedPdfUrl) {
      signedContractLink.href = data.signedPdfUrl;
      signedContractLink.style.display = "inline-block";
    }

    statusEl.textContent = "Téléchargement prêt.";
  } catch (error) {
    statusEl.textContent = `Erreur: ${error.message || error}`;
  }
});
