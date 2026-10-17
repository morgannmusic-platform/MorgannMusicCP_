document.addEventListener("DOMContentLoaded", () => {
    fetch("/portail/js/sidebar.html")
        .then(response => {
            if (!response.ok) {
                throw new Error("Erreur lors du chargement de la sidebar");
            }
            return response.text();
        })
        .then(data => {
            const container = document.getElementById("sidebar-container");
            if (container) {
                container.innerHTML = data;
            }

            checkAccompagnementAccess();
            activerLienSidebar();
            initNavbarMoreMenu();
            initCopyrightYear();
            initSiteVersion();
        })
        .catch(error => console.error("Détails de l'erreur sidebar :", error));
});

async function checkAccompagnementAccess() {
    const lienAccompagnement = document.getElementById("link-accompagnement");
    if (!lienAccompagnement) return;

    let userRole = localStorage.getItem("user_role");

    // Si le rôle est déjà connu en cache, on applique directement
    if (userRole === "admin" || userRole === "artist") {
        lienAccompagnement.style.display = "flex";
        return;
    }

    // Vérifie si un token d'authentification existe avant d'appeler l'API pour éviter le 401
    const hasToken = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (hasToken) {
        try {
            const { api } = await import("/assets/js/api.js");
            const response = await api.get("/api/me");
            const user = response.user || response;
            userRole = user ? user.role : null;

            if (userRole) {
                localStorage.setItem("user_role", userRole);
            }
        } catch (error) {
            // Silencieux pour ne pas polluer la console
        }
    }

    // Analyse de secours de la page si aucun rôle n'a pu être récupéré via l'API
    if (!userRole) {
        const pageText = document.body.innerText.toLowerCase();
        if (pageText.includes("admin") || pageText.includes("artist")) {
            userRole = pageText.includes("admin") ? "admin" : "artist";
        }
    }

    if (userRole === "admin" || userRole === "artist") {
        lienAccompagnement.style.display = "flex";
    } else {
        lienAccompagnement.style.display = "none";
    }
}

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

function initCopyrightYear() {
    const copyrightElem = document.getElementById("copyright-year");
    if (copyrightElem) {
        const currentYear = new Date().getFullYear();
        copyrightElem.textContent = `Morgann Music CP © Tout droit réserver ${currentYear}`;
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