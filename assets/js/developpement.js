import { api } from "/assets/js/api.js";

document.addEventListener("DOMContentLoaded", async () => {
    const versionDisplay = document.getElementById('current-version-display');
    const descDisplay = document.getElementById('current-version-desc');

    try {
        const versions = await api.get("/api/versions");

        if (Array.isArray(versions) && versions.length > 0) {
            const latest = versions[0];
            versionDisplay.textContent = latest.version || "Inconnue";
            descDisplay.textContent = latest.description ? `« ${latest.description} »` : "";
        } else {
            versionDisplay.textContent = "Aucune version";
            descDisplay.textContent = "Aucune version enregistrée dans la base de données pour le moment.";
        }
    } catch (error) {
        console.error("Erreur API D1 :", error);
        versionDisplay.textContent = "Erreur";
        descDisplay.textContent = "Impossible de récupérer les données depuis la base de données.";
    }
});