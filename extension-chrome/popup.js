const API_BASE = "https://api.worker.mm-cp.uk";
const FIREBASE_API_KEY = "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc";

console.log("[popup] Script initialisé. API_BASE =", API_BASE);

document.addEventListener("DOMContentLoaded", () => {
    console.log("[popup] DOM chargé. Lancement de checkSession() et setupEvents().");
    checkSession();
    setupEvents();
});

function setupEvents() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            console.log(`[popup] Onglet cliqué : ${btn.dataset.tab}`);
            document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
        });
    });

    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("[popup] Formulaire de connexion soumis.");
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const errorEl = document.getElementById("auth-error");
        errorEl.style.display = "none";

        try {
            console.log(`[popup] Envoi de la requête d'auth à Firebase pour ${email}...`);
            const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, returnSecureToken: true })
            });

            const data = await res.json();
            console.log("[popup] Réponse Firebase Auth :", data);

            if (!res.ok) throw new Error(data.error?.message || "Identifiants incorrects");

            const session = {
                uid: data.localId,
                email: data.email,
                displayName: data.displayName || email.split("@")[0],
                token: data.idToken
            };

            console.log("[popup] Sauvegarde de la session dans chrome.storage :", session);
            chrome.storage.local.set({ userSession: session }, () => {
                showAppScreen(session);
            });
        } catch (err) {
            console.error("[popup] Erreur de connexion :", err);
            errorEl.textContent = err.message.includes("INVALID_PASSWORD") || err.message.includes("EMAIL_NOT_FOUND")
                ? "E-mail ou mdp incorrect."
                : err.message;
            errorEl.style.display = "block";
        }
    });

    document.getElementById("btn-google").addEventListener("click", () => {
        console.log("[popup] Clic sur connexion Google. Ouverture de l'onglet.");
        chrome.tabs.create({ url: "https://mm-cp.uk/login" });
    });

    document.getElementById("btn-logout").addEventListener("click", () => {
        console.log("[popup] Clic sur Déconnexion. Suppression de chrome.storage.");
        chrome.storage.local.remove(["userSession"], () => {
            showAuthScreen();
        });
    });

    document.getElementById("btn-read-all").addEventListener("click", async () => {
        console.log("[popup] Clic sur Tout lire (Notifs).");
        chrome.storage.local.get(["userSession"], async (res) => {
            const session = res.userSession;
            if (!session) return;
            console.log("[popup] Envoi requête read-all à l'API...");
            await fetch(`${API_BASE}/api/users/${session.uid}/notifications/read-all`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${session.token}` }
            });
            loadNotifications(session);
        });
    });
}

function checkSession() {
    console.log("[popup] Vérification de la session en cours...");
    chrome.storage.local.get(["userSession"], (res) => {
        console.log("[popup] Résultat chrome.storage :", res);
        if (res.userSession && res.userSession.uid) {
            console.log("[popup] Utilisateur connecté détecté :", res.userSession.uid);
            showAppScreen(res.userSession);
        } else {
            console.log("[popup] Aucun utilisateur connecté trouvé.");
            showAuthScreen();
        }
    });
}

function showAuthScreen() {
    console.log("[popup] Affichage de l'écran de connexion.");
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("app-screen").style.display = "none";
}

function showAppScreen(session) {
    console.log("[popup] Affichage de l'écran de l'application principale.");
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("app-screen").style.display = "flex";

    const name = session.displayName || session.email.split("@")[0];
    document.getElementById("user-display-name").textContent = name;
    document.getElementById("user-display-email").textContent = session.email;
    document.getElementById("user-avatar-initial").textContent = name.charAt(0).toUpperCase();

    console.log("[popup] Lancement du chargement des données (Releases & Notifs)...");
    loadReleases(session);
    loadNotifications(session);
}

const DEFAULT_COVER = "https://mm-cp.uk/assets/img/icons/brouillon.png";

function getFileUrl(key) {
    if (!key || typeof key !== "string") return DEFAULT_COVER;
    const value = key.trim();
    if (!value) return DEFAULT_COVER;

    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
        return value;
    }

    const normalized = value.replace(/^\/+/, "");
    if (normalized.startsWith("api/files/")) {
        return `${API_BASE}/${normalized}`;
    }
    return `${API_BASE}/api/files/${encodeURIComponent(normalized)}`;
}

async function loadReleases(session) {
    const listEl = document.getElementById("releases-list");
    const url = `${API_BASE}/api/users/${session.uid}/releases`;
    console.log(`[popup] loadReleases - Fetching URL: ${url}`);

    try {
        const res = await fetch(url, {
            headers: { "Authorization": `Bearer ${session.token}` }
        });
        console.log(`[popup] loadReleases - Statut HTTP: ${res.status}`);

        const data = await res.json();
        console.log("[popup] loadReleases - Données brutes reçues:", data);

        if (!res.ok) throw new Error(data.error || `Erreur HTTP ${res.status}`);

        let releasesArray = Array.isArray(data) ? data : (data.releases || []);
        console.log(`[popup] loadReleases - Tableau extrait (longueur: ${releasesArray.length}):`, releasesArray);

        const releases = releasesArray.slice(0, 5);

        if (!releases.length) {
            console.log("[popup] loadReleases - Le tableau est vide après slice.");
            listEl.innerHTML = `<p class="empty-text">Aucune sortie dispo.</p>`;
            return;
        }

        console.log("[popup] loadReleases - Génération du HTML...");
        listEl.innerHTML = releases.map((r) => {
            const cover = getFileUrl(r.coverUrl);
            return `
<a class="release-card-item" href="https://mm-cp.uk/portail/sortie.html?id=${r.id}" target="_blank">
  <img class="release-cover-img" src="${cover}" alt="Cover" onerror="this.onerror=null; this.src='${DEFAULT_COVER}';">
  <p class="release-card-title">${escapeHtml(r.title || 'Sans titre')}</p>
  <p class="release-card-artist">${escapeHtml(r.artistName || 'Artiste')}</p>
</a>
`;
        }).join("");
        console.log("[popup] loadReleases - Terminé avec succès.");
    } catch (err) {
        console.error("[popup] Erreur critique dans loadReleases :", err);
        listEl.innerHTML = `<p class="empty-text">Erreur : ${escapeHtml(err.message)}</p>`;
    }
}

async function loadNotifications(session) {
    const listEl = document.getElementById("notifs-list");
    const url = `${API_BASE}/api/users/${session.uid}/notifications`;
    console.log(`[popup] loadNotifications - Fetching URL: ${url}`);

    try {
        const res = await fetch(url, {
            headers: { "Authorization": `Bearer ${session.token}` }
        });
        console.log(`[popup] loadNotifications - Statut HTTP: ${res.status}`);

        const data = await res.json();
        console.log("[popup] loadNotifications - Données brutes reçues:", data);

        if (!res.ok) throw new Error(data.error || `Erreur HTTP ${res.status}`);

        let notifsArray = Array.isArray(data) ? data : (data.notifications || []);
        console.log(`[popup] loadNotifications - Tableau extrait (longueur: ${notifsArray.length}):`, notifsArray);

        if (!notifsArray.length) {
            console.log("[popup] loadNotifications - Le tableau est vide.");
            listEl.innerHTML = `<p class="empty-text">Aucune notif.</p>`;
            return;
        }

        const unread = notifsArray.filter((n) => !n.isRead && !n.read).length;
        console.log(`[popup] loadNotifications - Nombre de notifs non lues: ${unread}`);

        const badge = document.getElementById("notif-badge");
        if (unread > 0) {
            badge.textContent = unread;
            badge.style.display = "inline";
        } else {
            badge.style.display = "none";
        }

        console.log("[popup] loadNotifications - Génération du HTML...");
        listEl.innerHTML = notifsArray.slice(0, 6).map((n) => `
      <div class="notif-item">
        <div>
          <p class="notif-title">${escapeHtml(n.title || 'Notification')}</p>
          <p class="notif-sub">${escapeHtml(n.message || '')}</p>
        </div>
      </div>
    `).join("");
        console.log("[popup] loadNotifications - Terminé avec succès.");
    } catch (err) {
        console.error("[popup] Erreur critique dans loadNotifications :", err);
        listEl.innerHTML = `<p class="empty-text">Erreur : ${escapeHtml(err.message)}</p>`;
    }
}

function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (m) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
}