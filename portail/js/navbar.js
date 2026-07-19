document.addEventListener("DOMContentLoaded", () => {
    fetch("js/navbar.html")
        .then(response => {
            if (!response.ok) {
                throw new Error("Erreur lors du chargement de la navbar");
            }
            return response.text();
        })
        .then(data => {
            // 1. On injecte le HTML de la navbar
            document.getElementById("navbar-container").innerHTML = data;

            // 2. On configure la gestion des menus déroulants (dropdowns)
            configurerDropdowns();

            // 3. On active le lien de la page actuelle
            activerLienNavbar();
        })
        .catch(error => console.error("Détails de l'erreur :", error));
});

// Gestion des clics sur les menus
function configurerDropdowns() {
    // Liste des déclencheurs et de leurs menus associés
    const triggers = [
        { button: '.profile-trigger', menu: '#dropdown-profile' },
        { button: '.btn-create-trigger', menu: '#dropdown-create' },
        { button: '.notification-trigger', menu: '#dropdown-notifications' }
    ];

    triggers.forEach(item => {
        const btn = document.querySelector(item.button);
        const menu = document.querySelector(item.menu);

        if (btn && menu) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Empêche la fermeture immédiate via le clic global

                // On vérifie si ce menu précis est déjà ouvert
                const isOpen = menu.style.display === 'block';

                // On ferme d'abord tous les menus ouverts
                fermerTousLesDropdowns();

                // Si le menu cliqué était fermé, on l'ouvre
                if (!isOpen) {
                    menu.style.display = 'block';
                }
            });
        }
    });

    // Clic n'importe où sur la page pour fermer les menus ouverts
    window.addEventListener('click', () => {
        fermerTousLesDropdowns();
    });
}

function fermerTousLesDropdowns() {
    document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
        dropdown.style.display = 'none';
    });
}

// Gestion du lien actif
function activerLienNavbar() {
    const currentPage = window.location.pathname.split("/").pop();
    const pageName = currentPage === "" ? "index.html" : currentPage;
    const navLinks = document.querySelectorAll(".nav-dropdown a");

    navLinks.forEach(link => {
        const linkPage = link.getAttribute("href");
        if (pageName === linkPage) {
            link.classList.add("active");
        }
    });
}