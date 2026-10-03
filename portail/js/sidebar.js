document.addEventListener("DOMContentLoaded", () => {
    fetch("/portail/js/sidebar.html") // Assure-toi que le chemin vers ton HTML est le bon
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
    const currentPage = window.location.pathname.split("/").pop();
    const pageName = currentPage === "" ? "index.html" : currentPage;

    const sidebarLinks = document.querySelectorAll("#sidebar-container a, .sidebar a, .responsive-nav a");

    sidebarLinks.forEach(link => {
        const linkPage = link.getAttribute("href");
        if (pageName === linkPage) {
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