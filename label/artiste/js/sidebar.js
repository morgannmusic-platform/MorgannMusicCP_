document.addEventListener("DOMContentLoaded", () => {
    fetch("/portail/label/js/sidebar.html")
        .then(response => {
            if (!response.ok) {
                throw new Error("Erreur lors du chargement de la sidebar");
            }
            return response.text();
        })
        .then(async data => {
            const container = document.getElementById("sidebar-container");
            if (container) {
                container.innerHTML = data;
            }

            activerLienSidebar();
            initNavbarMoreMenu();
            initSiteVersion();

            // Applique les modifications du label (Logo, Couleur, Copyright)
            await applyLabelBranding();
        })
        .catch(error => console.error("Détails de l'erreur sidebar :", error));
});

function activerLienSidebar() {
    const currentPath = window.location.pathname;
    const sidebarLinks = document.querySelectorAll("#sidebar-container a, .sidebar a, .responsive-nav a");

    sidebarLinks.forEach(link => {
        link.classList.remove("active");
        const href = link.getAttribute("href");
        if (!href) return;

        const absoluteHref = new URL(href, window.location.origin).pathname;
        if (currentPath === absoluteHref) {
            link.classList.add("active");
        } else if ((href === "index.html" || href === "/") && (currentPath === "/portail/" || currentPath === "/portail")) {
            link.classList.add("active");
        }
    });
}

function initNavbarMoreMenu() {
    const moreWrapper = document.querySelector(".more-dropdown-wrapper");
    const btnMore = document.getElementById("btn-more");

    if (btnMore && moreWrapper) {
        btnMore.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            moreWrapper.classList.toggle("open");
        });

        window.addEventListener("click", () => {
            moreWrapper.classList.remove("open");
        });
    }
}

async function initSiteVersion() {
    const versionElem = document.getElementById("sidebar-site-version");
    if (!versionElem) return;

    try {
        const { api } = await import("/assets/js/api.js");
        const versions = await api.get("/api/versions");

        if (Array.isArray(versions) && versions.length > 0) {
            versionElem.textContent = versions[0].version ? `${versions[0].version}` : "";
        } else {
            versionElem.textContent = "";
        }
    } catch (error) {
        versionElem.textContent = "";
    }
}

async function applyLabelBranding() {
    try {
        const { auth } = await import("/assets/js/firebase.js");
        const { api } = await import("/assets/js/api.js");

        // Attendre que l'utilisateur soit bien détecté par Firebase
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

        if (!user) {
            console.log("Aucun utilisateur Firebase connecté pour le branding.");
            return;
        }

        console.log("Utilisateur connecté pour le label:", user.uid);

        const response = await api.get(`/api/users/${user.uid}/labels`);
        console.log("Réponse API labels dans sidebar:", response);

        let label = null;
        if (Array.isArray(response) && response.length > 0) {
            label = response[0];
        } else if (response && response.nom) {
            label = response;
        }

        if (!label) {
            console.log("Aucun label trouvé en base pour cet utilisateur.");
            return;
        }

        console.log("Label trouvé :", label);

        if (label.logo_url) {
            const logoImg = document.querySelector(".sidebar-logo .logo-img");
            if (logoImg) {
                let logoUrl = label.logo_url;
                if (!logoUrl.startsWith('http')) {
                    const cleanPath = logoUrl.replace(/^\/?api\/files\//, '').replace(/^\/+/, '');
                    logoUrl = `https://api.worker.mm-cp.uk/api/files/${cleanPath}`;
                }
                logoImg.src = logoUrl;
            }
        }

        // 2. Remplacement de la couleur d'accentuation
        if (label.accent_color) {
            document.documentElement.style.setProperty('--label-accent', label.accent_color);
        }

        // 3. Mise à jour du copyright en bas
        const copyrightElem = document.getElementById("copyright-year");
        if (copyrightElem) {
            const currentYear = new Date().getFullYear();
            if (label.nom) {
                copyrightElem.textContent = `Morgann Music CP x ${label.nom} © Tout droit réserver ${currentYear}`;
            } else {
                copyrightElem.textContent = `Morgann Music CP © Tout droit réserver ${currentYear}`;
            }
        }

    } catch (err) {
        console.error("Erreur application branding label sur sidebar :", err);
    }
}