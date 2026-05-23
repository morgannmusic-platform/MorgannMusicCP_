import { fetchSignatureRequest, finalizeSignature } from "/assets/js/contracts/lib/api.js";
import { SignaturePad } from "/assets/js/contracts/components/SignaturePad.js";

const statusEl = document.getElementById("status");
const metaEl = document.getElementById("meta");
const draftLink = document.getElementById("draftLink");
const canvas = document.getElementById("signatureCanvas");
const clearBtn = document.getElementById("clearBtn");
const finalizeBtn = document.getElementById("finalizeBtn");

const pad = new SignaturePad(canvas);
const token = new URLSearchParams(window.location.search).get("token") || "";
let payload = null;

function renderMeta(data) {
  metaEl.innerHTML = `
    <div><strong>Client:</strong> ${data.customerName}</div>
    <div><strong>Email:</strong> ${data.customerEmail}</div>
    <div><strong>Titre:</strong> ${data.trackName}</div>
    <div><strong>Licence:</strong> ${data.licenseType}</div>
  `;
}

async function boot() {
  if (!token) {
    statusEl.textContent = "Token de signature manquant.";
    return;
  }
  try {
    payload = await fetchSignatureRequest(token);
    renderMeta(payload);
    draftLink.href = payload.generatedPdfUrl;
    statusEl.textContent = "Contrat prêt à être signé.";
  } catch (error) {
    statusEl.textContent = `Erreur: ${error.message || error}`;
  }
}

clearBtn.addEventListener("click", () => pad.clear());

finalizeBtn.addEventListener("click", async () => {
  if (!payload) return;
  if (pad.isEmpty()) {
    statusEl.textContent = "Signature vide: dessine ta signature avant de finaliser.";
    return;
  }
  try {
    finalizeBtn.disabled = true;
    statusEl.textContent = "Finalisation en cours...";
    const result = await finalizeSignature({
      token,
      signatureDataUrl: pad.toDataUrl(),
      signatoryName: payload.customerName,
      signatoryEmail: payload.customerEmail
    });
    statusEl.textContent = "Contrat signé avec succès.";
    if (result?.contractId) {
      window.location.href = `/contracts/audio-download.html?contractId=${encodeURIComponent(result.contractId)}`;
    }
  } catch (error) {
    statusEl.textContent = `Erreur signature: ${error.message || error}`;
  } finally {
    finalizeBtn.disabled = false;
  }
});

boot();
