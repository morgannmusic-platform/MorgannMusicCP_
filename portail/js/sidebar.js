document.addEventListener("DOMContentLoaded", () => {
    fetch("js/sidebar.html") // Assure-toi que le chemin vers ton HTML est le bon
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

            // 3. IMPORTANT : On initialise le bouton "+" MAINTENANT qu'il est dans la page
            initNavbarMoreMenu();
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
            e.stopPropagation(); // Empêche le clic de fermer le menu aussitôt
            moreWrapper.classList.toggle("open");
        });

        // Ferme le menu si on clique n'importe où ailleurs dans la fenêtre
        window.addEventListener("click", () => {
            moreWrapper.classList.remove("open");
        });
    }
}