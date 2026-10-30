// responsive.js - Application instantanée depuis le cache sans écran de chargement

(function appliquerCacheInstantane() {
    const cachedLabel = localStorage.getItem('mmcp_label_cache');
    if (cachedLabel) {
        try {
            const label = JSON.parse(cachedLabel);
            if (label.bg_color) {
                document.documentElement.style.setProperty('--label-bg', label.bg_color);
                document.body.style.backgroundColor = label.bg_color;
            }
            if (label.accent_color) {
                document.documentElement.style.setProperty('--label-accent', label.accent_color);

                // Injection immédiate des styles pour éviter le flash de couleur par défaut
                const instantStyle = document.createElement("style");
                instantStyle.id = "instant-branding-style";
                instantStyle.innerHTML = `
                    body {
                        background-color: ${label.bg_color || '#ffffff'} !important;
                    }
                    .btn-primary, button[type="submit"], .popup-actions .btn-popup, .btn-create-trigger, .card a, .btn-popup {
                        background-color: ${label.accent_color} !important;
                    }
                    .card h1, .revenus-amount {
                        color: ${label.accent_color} !important;
                    }
                    .profile-trigger:hover {
                        border-color: ${label.accent_color} !important;
                    }
                    .notif-badge {
                        background-color: ${label.accent_color} !important;
                    }
                    .nav-dropdown a:hover, .nav-dropdown button:hover {
                        background: ${label.accent_color} !important;
                    }
                `;
                document.head.appendChild(instantStyle);
            }
            if (label.logo_url) {
                const logoImg = document.querySelector(".sidebar-logo .logo-img");
                if (logoImg) logoImg.src = formatFileUrlStatic(label.logo_url);
            }
            if (label.nom) {
                document.title = `${label.nom} | Portail administrateur`;
            }
        } catch (e) {
            console.error("Erreur lecture cache label", e);
        }
    }
})();

function formatFileUrlStatic(url) {
    if (!url) return "";
    if (url.startsWith('http')) return url;
    const cleanPath = url.replace(/^\/?api\/files\//, '').replace(/^\/+/, '');
    return `https://api.worker.mm-cp.uk/api/files/${cleanPath}`;
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const { auth } = await import("/assets/js/firebase.js");
        const { api } = await import("/assets/js/api.js");

        const user = await new Promise((resolve) => {
            if (auth.currentUser) {
                resolve(auth.currentUser);
            } else {
                const unsubscribe = auth.onAuthStateChanged((u) => {
                    unsubscribe();
                    resolve(u);
                });
            }
        });

        if (!user) return;

        const response = await api.get(`/api/users/${user.uid}/labels`);
        let label = Array.isArray(response) ? response[0] : response;
        if (!label) return;

        // Mise à jour du cache local pour les prochaines visites
        localStorage.setItem('mmcp_label_cache', JSON.stringify(label));

        // Actualisation propre en arrière-plan si besoin
        if (label.logo_url) {
            const logoImg = document.querySelector(".sidebar-logo .logo-img");
            if (logoImg) {
                logoImg.src = formatFileUrlStatic(label.logo_url);
            }
        }

        if (label.favicon_url) {
            const faviconUrl = formatFileUrlStatic(label.favicon_url);
            let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = faviconUrl;
            document.getElementsByTagName('head')[0].appendChild(link);
        }

        if (label.icon_url) {
            const iconUrl = formatFileUrlStatic(label.icon_url);
            let appleTouchLink = document.querySelector("link[rel='apple-touch-icon']") || document.createElement('link');
            appleTouchLink.rel = 'apple-touch-icon';
            appleTouchLink.href = iconUrl;
            document.getElementsByTagName('head')[0].appendChild(appleTouchLink);
        }

    } catch (err) {
        console.error("Erreur lors de la synchronisation du branding en arrière-plan :", err);
    }
});