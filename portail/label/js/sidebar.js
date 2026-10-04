document.addEventListener("DOMContentLoaded", () => {
    fetch("/portail/label/js/sidebar.html") // Assure-toi que le chemin vers ton HTML est le bon
        .then(response => {
            if (!response.ok) {
                throw new Error("Erreur lors du chargement de la sidebar");
            }
            return response.text();
        })
        .then(data => {
            // 1. On injecte le HTML de la sidebar
            const container = document.getElementById("sidebar-container");
            if (container) {
                container.innerHTML = data;
            }

            // 2. On applique la classe active sur le lien de la page courante
            activerLienSidebar();


            // 3. On initialise le bouton "+" MAINTENANT qu'il est dans la page
            initNavbarMoreMenu();

            // 4. Mise à jour automatique de l'année pour le Copyright
            initCopyrightYear();

            // 5. Récupération de la version du site
            initSiteVersion();
        })
        .catch(error => console.error("Détails de l'erreur sidebar :", error));
});

// Gère la classe active sur les liens
function activerLienSidebar() {
    const currentPath = window.location.pathname;
    const sidebarLinks = document.querySelectorAll("#sidebar-container a, .sidebar a, .responsive-nav a");

    sidebarLinks.forEach(link => {
        // Retire la classe active par défaut sur tous les liens
        link.classList.remove("active");

        const href = link.getAttribute("href");
        if (!href) return;

        // Convertit le href relatif ou absolu en URL complète pour comparer proprement
        const absoluteHref = new URL(href, window.location.origin).pathname;

        // Vérification stricte : le chemin actuel doit correspondre exactement au lien, 
        // ou si on est à la racine de l'accueil (/portail/ ou /portail/index.html)
        if (currentPath === absoluteHref) {
            link.classList.add("active");
        }
        // Cas particulier pour l'accueil si on est sur /portail/ sans index.html explicite
        else if ((href === "index.html" || href === "/") && (currentPath === "/portail/" || currentPath === "/portail")) {
            link.classList.add("active");
        }
    });
}

// Gère l'ouverture, la fermeture et l'animation du bouton "+"
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

// Génère automatiquement l'année en cours
function initCopyrightYear() {
    const copyrightElem = document.getElementById("copyright-year");
    if (copyrightElem) {
        const currentYear = new Date().getFullYear();
        copyrightElem.textContent = `Morgann Music CP © Tout droit réserver ${currentYear}`;
    }
}

// Charge la version actuelle du site depuis Cloudflare D1 via l'API Worker
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
        console.error("Erreur lors de la récupération de la version :", error);
        versionElem.textContent = "";
    }
}