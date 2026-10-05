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

        // 1. Application de la couleur de fond de la page
        if (label.bg_color) {
            document.body.style.backgroundColor = label.bg_color;
        }

        // 2. Application de la couleur d'accentuation sur les éléments (boutons, titres, cartes)
        if (label.accent_color) {
            document.documentElement.style.setProperty('--label-accent', label.accent_color);

            const customStyle = document.createElement("style");
            customStyle.innerHTML = `
                body {
                    background-color: ${label.bg_color || '#FFEFF4'} !important;
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
            document.head.appendChild(customStyle);
        }

        // 3. Changement dynamique du titre de l'onglet du navigateur
        if (label.nom) {
            document.title = `${label.nom} | Morgann Music CP`;
        }

        // Fonction utilitaire pour formater l'URL des fichiers Cloudflare Worker
        const formatFileUrl = (url) => {
            if (!url) return "";
            if (url.startsWith('http')) return url;
            const cleanPath = url.replace(/^\/?api\/files\//, '').replace(/^\/+/, '');
            return `https://api.worker.mm-cp.uk/api/files/${cleanPath}`;
        };

        // 4. Changement dynamique du Favicon
        if (label.favicon_url) {
            const faviconUrl = formatFileUrl(label.favicon_url);
            let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = faviconUrl;
            document.getElementsByTagName('head')[0].appendChild(link);
        }

        // 5. Changement dynamique de l'Apple Touch Icon (Écran d'accueil mobile)
        if (label.icon_url) {
            const iconUrl = formatFileUrl(label.icon_url);
            let appleTouchLink = document.querySelector("link[rel='apple-touch-icon']") || document.createElement('link');
            appleTouchLink.rel = 'apple-touch-icon';
            appleTouchLink.href = iconUrl;
            document.getElementsByTagName('head')[0].appendChild(appleTouchLink);
        }

    } catch (err) {
        console.error("Erreur lors de l'application du branding dynamique :", err);
    }
});