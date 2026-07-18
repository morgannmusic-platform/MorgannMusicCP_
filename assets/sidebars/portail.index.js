document.addEventListener('DOMContentLoaded', () => {
    const sidebarContainer = document.getElementById('sidebar-portail');
    if (!sidebarContainer) return;

    fetch('/assets/sidebars/portail.index.html')
        .then(response => response.text())
        .then(html => {
            sidebarContainer.innerHTML = html;
        })
        .catch(err => console.error('Erreur chargement sidebar portail:', err));
});