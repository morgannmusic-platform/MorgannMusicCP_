document.addEventListener('DOMContentLoaded', () => {
    const navbarContainer = document.getElementById('navbar-portail');
    if (!navbarContainer) return;

    fetch('/assets/navbars/portail/index.html')
        .then(response => response.text())
        .then(html => {
            navbarContainer.innerHTML = html;
            // Logique supplémentaire pour l'utilisateur si nécessaire
        })
        .catch(err => console.error('Erreur chargement navbar portail:', err));
});