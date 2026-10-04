import { api } from "/assets/js/api.js";

function formerDateLisible(item) {
    if (typeof item.date === 'string' && item.date) {
        return item.date;
    }
    if (item.createdAt) {
        return new Date(item.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    return "Date non spécifiée";
}

async function chargerVersions() {
    const timelineList = document.getElementById("timeline-list");

    try {
        const versionsList = await api.get("/api/versions");

        if (!Array.isArray(versionsList) || versionsList.length === 0) {
            document.getElementById("current-v-title").textContent = "Aucune version";
            document.getElementById("current-v-date").textContent = "--";
            document.getElementById("current-v-desc").textContent = "Aucune version enregistrée dans la base de données pour le moment.";
            timelineList.innerHTML = `<div class="empty-history">Aucun historique disponible.</div>`;
            return;
        }

        // Carte principale (le premier élément est le plus récent via ORDER BY date DESC)
        const latest = versionsList[0];
        const dateLatest = formerDateLisible(latest);
        document.getElementById("current-v-title").textContent = latest.version || "v1.0.0";
        document.getElementById("current-v-date").textContent = dateLatest !== "Date non spécifiée" ? "Déployé le " + dateLatest : dateLatest;
        document.getElementById("current-v-desc").textContent = latest.description || "";

        // Génération HTML de l'historique
        let htmlTimeline = "";
        versionsList.forEach((item) => {
            const dateFormatted = formerDateLisible(item);
            htmlTimeline += `
                        <div class="timeline-item">
                            <div class="timeline-version">${item.version || "v1.0.0"}</div>
                            <div class="timeline-date">${dateFormatted}</div>
                            <div class="timeline-desc">${item.description || ""}</div>
                        </div>
                    `;
        });

        timelineList.innerHTML = htmlTimeline;

    } catch (error) {
        console.error("Erreur API D1 :", error);
        document.getElementById("current-v-title").textContent = "Erreur";
        document.getElementById("current-v-date").textContent = "--";
        document.getElementById("current-v-desc").textContent = "Impossible de récupérer les données.";
        timelineList.innerHTML = `<div class="empty-history" style="color: #ef4444;">Erreur API D1 : ${error.message}</div>`;
    }
}

chargerVersions();
