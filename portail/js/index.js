import { auth } from "/assets/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { api } from "/assets/js/api.js";

const DEFAULT_COVER = "/assets/img/icons/brouillon.png";
const DEFAULT_AVATAR = "/assets/img/icons/default-avatar.png";

let chartInstance = null;

function getCoverUrl(release) {
    let rawCover = release.coverUrl || release.cover || release.cover_url || release.pochetteUrl;
    if (!rawCover && release.data) {
        rawCover = release.data.coverUrl || release.data.cover || release.data.cover_url || release.data.pochetteUrl;
    }
    if (!rawCover) return DEFAULT_COVER;

    try {
        if (typeof api.fileUrl === 'function') {
            return api.fileUrl(rawCover);
        }
    } catch (e) {
        console.warn("Erreur résolution pochette via api.fileUrl :", e);
    }

    if (rawCover.startsWith("http://") || rawCover.startsWith("https://") || rawCover.startsWith("data:")) {
        return rawCover;
    }
    return rawCover;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    // GESTION DU PRÉNOM
    try {
        const userData = await api.get(`/api/users/${user.uid}`);
        const firstName = userData.firstName || userData.name || user.displayName || "Utilisateur";
        const firstNameSpan = document.getElementById("user-firstname");
        if (firstNameSpan) {
            firstNameSpan.innerText = firstName;
        }
    } catch (e) {
        console.warn("Impossible de récupérer le profil utilisateur pour le prénom :", e);
        const firstNameSpan = document.getElementById("user-firstname");
        if (firstNameSpan) {
            firstNameSpan.innerText = user.displayName || "Utilisateur";
        }
    }

    // LOGIQUE DE RECHERCHE COMPLÈTE AVEC LISTE EN DESSOUS
    const searchInput = document.getElementById("portal-search-input");
    const searchResults = document.getElementById("portal-search-results");

    if (searchInput && searchResults) {
        const portalPages = [
            { name: "Accueil", keywords: ["accueil", "home", "tableau de bord"], url: "index.html" },
            { name: "Mes Revenus / Portefeuille", keywords: ["revenu", "argent", "finance", "gain", "portefeuille"], url: "mes-revenus.html" },
            { name: "Mes Artistes", keywords: ["artiste", "groupe", "interprete"], url: "artistes.html" },
            { name: "Mes Sorties", keywords: ["sortie", "album", "single", "ep", "musique"], url: "sorties.html" },
            { name: "Créer une sortie", keywords: ["créer", "nouvelle", "sortir", "projet", "sortie"], url: "nouvelle.html" },
            { name: "Retraits", keywords: ["retrait", "virement", "payer"], url: "retraits.html" },
            { name: "Liens de sorties", keywords: ["lien", "smartlink", "partage"], url: "liens-sorties.html" },
            { name: "Notifications", keywords: ["notification", "alerte", "message"], url: "notifications.html" },
            { name: "Profil", keywords: ["profil", "compte", "paramètre"], url: "profil.html" },
            { name: "Litual AI", keywords: ["litual", "ia", "intelligence"], url: "litual.html" },
            { name: "Support", keywords: ["support", "aide", "contact"], url: "support/index.html" }
        ];

        searchInput.addEventListener("input", () => {
            const query = searchInput.value.toLowerCase().trim();
            searchResults.innerHTML = "";

            if (!query) {
                searchResults.style.display = "none";
                return;
            }

            const filteredPages = portalPages.filter(page =>
                page.name.toLowerCase().includes(query) ||
                page.keywords.some(kw => kw.includes(query))
            );

            if (filteredPages.length > 0) {
                filteredPages.forEach(page => {
                    const item = document.createElement("a");
                    item.href = page.url;
                    item.className = "search-result-item";
                    item.innerText = page.name;
                    searchResults.appendChild(item);
                });
                searchResults.style.display = "block";
            } else {
                const item = document.createElement("div");
                item.className = "search-result-item";
                item.style.color = "#888";
                item.innerText = "Aucun résultat trouvé";
                searchResults.appendChild(item);
                searchResults.style.display = "block";
            }
        });

        // Fermer la liste si on clique en dehors
        document.addEventListener("click", (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = "none";
            }
        });

        // Validation par Entrée (redirige vers le premier résultat s'il existe)
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                const query = searchInput.value.toLowerCase().trim();
                const found = portalPages.find(page =>
                    page.name.toLowerCase().includes(query) ||
                    page.keywords.some(kw => kw.includes(query))
                );
                if (found) {
                    window.location.href = found.url;
                }
            }
        });
    }

    // 1. FINANCES ET GRAPHIQUE COMPACT
    try {
        const finances = await api.get(`/api/users/${user.uid}/finances`);
        const financesList = Array.isArray(finances) ? finances : [];

        const total = financesList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        document.getElementById("user-revenus-total").innerText = total.toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        });

        const monthlyData = {};
        financesList.forEach(item => {
            const period = item.period || "Inconnu";
            monthlyData[period] = (monthlyData[period] || 0) + (Number(item.amount) || 0);
        });

        const labels = Object.keys(monthlyData);
        const dataValues = Object.values(monthlyData);

        genererMiniGraphique(labels, dataValues);

    } catch (err) {
        console.error("Erreur finances :", err);
        document.getElementById("user-revenus-total").innerText = "0,00 €";
        genererMiniGraphique([], []);
    }

    // 2. ARTISTES (MAX 5)
    try {
        const artistsList = await api.get(`/api/users/${user.uid}/artists`);
        const listContainer = document.getElementById("artists-horizontal-list");
        listContainer.innerHTML = "";

        if (!Array.isArray(artistsList) || artistsList.length === 0) {
            document.getElementById("artist-popup-overlay").classList.add("show");
            listContainer.innerHTML = `<p class="empty-text">Aucun artiste disponible.</p>`;
        } else {
            const maxDisplay = 5;
            const itemsToDisplay = artistsList.slice(0, maxDisplay);

            itemsToDisplay.forEach(artist => {
                const avatar = artist.imageUrl || artist.photo || DEFAULT_AVATAR;
                const name = artist.name || "Sans nom";
                const html = `
                            <a href="artistes.html" class="artist-card-item">
                                <img src="${avatar}" alt="${name}" class="artist-avatar" onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';">
                                <span class="artist-name">${name}</span>
                            </a>
                        `;
                listContainer.insertAdjacentHTML("beforeend", html);
            });

            if (artistsList.length > maxDisplay) {
                const btnMore = `<a href="artistes.html" class="btn-more-horizontal" title="Voir tous les artistes"><img src="/assets/img/icon/plus.png" alt="plus" style="width: 18px; filter: invert(1)"></a>`;
                listContainer.insertAdjacentHTML("beforeend", btnMore);
            }
        }
    } catch (error) {
        console.error("Erreur artistes :", error);
        document.getElementById("artists-horizontal-list").innerHTML = `<p class="empty-text">Erreur de chargement.</p>`;
    }

    // 3. SORTIES (MAX 5)
    try {
        const allReleases = await api.get(`/api/users/${user.uid}/releases`);
        const releasesList = Array.isArray(allReleases) ? allReleases : [];
        const listContainer = document.getElementById("releases-horizontal-list");
        listContainer.innerHTML = "";

        if (releasesList.length === 0) {
            listContainer.innerHTML = `<p class="empty-text">Aucune sortie enregistrée.</p>`;
        } else {
            const latestReleases = [...releasesList]
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            const maxDisplay = 5;
            const itemsToDisplay = latestReleases.slice(0, maxDisplay);

            itemsToDisplay.forEach(release => {
                const title = release.title || "Sans titre";
                const artist = release.artistName || "Artiste inconnu";
                const cover = getCoverUrl(release);

                const html = `
                            <a href="sortie.html?id=${release.id}" class="release-card-item">
                                <img src="${cover}" alt="${title}" class="release-cover-img" onerror="this.onerror=null; this.src='${DEFAULT_COVER}';">
                                <h3 class="release-card-title">${title}</h3>
                                <p class="release-card-artist">${artist}</p>
                            </a>
                        `;
                listContainer.insertAdjacentHTML("beforeend", html);
            });

            if (latestReleases.length > maxDisplay) {
                const btnMore = `<a href="sorties.html" class="btn-more-horizontal" title="Voir toutes les sorties"><img src="/assets/img/icon/plus.png" alt="plus" style="width: 18px; filter: invert(1)"></a>`;
                listContainer.insertAdjacentHTML("beforeend", btnMore);
            }
        }
    } catch (error) {
        console.error("Erreur releases :", error);
        document.getElementById("releases-horizontal-list").innerHTML = `<p class="empty-text">Erreur de chargement.</p>`;
    }

    // 4. NOTIFICATIONS (5 DERNIÈRES)
    try {
        const notifs = await api.get(`/api/users/${user.uid}/notifications`);
        const notifsList = Array.isArray(notifs) ? notifs : [];
        const notifsContainer = document.getElementById("notifications-list");
        notifsContainer.innerHTML = "";

        if (notifsList.length === 0) {
            notifsContainer.innerHTML = `<p class="empty-text">Aucune notification pour le moment.</p>`;
        } else {
            const top5Notifs = notifsList
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 5);

            top5Notifs.forEach(n => {
                const title = n.title || n.message || "Notification";
                const date = n.createdAt ? new Date(n.createdAt).toLocaleDateString('fr-FR') : "";

                const html = `
                            <div class="notif-item">
                                <span class="notif-icon">🔔</span>
                                <div class="notif-content">
                                    <span class="notif-title">${title}</span>
                                    <span class="notif-date">${date}</span>
                                </div>
                            </div>
                        `;
                notifsContainer.insertAdjacentHTML("beforeend", html);
            });
        }
    } catch (error) {
        console.error("Erreur notifications :", error);
        document.getElementById("notifications-list").innerHTML = `<p class="empty-text">Erreur de chargement.</p>`;
    }
});

function genererMiniGraphique(labels, data) {
    const ctx = document.getElementById('miniRevenueChart').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['Jan', 'Fév', 'Mar', 'Avr', 'Mai'],
            datasets: [{
                data: data.length ? data : [0, 0, 0, 0, 0],
                borderColor: '#FC8FB0',
                backgroundColor: 'rgba(252, 143, 176, 0.2)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            scales: {
                y: { display: false },
                x: { display: false }
            }
        }
    });
}