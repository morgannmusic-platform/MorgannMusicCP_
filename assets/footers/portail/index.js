document.addEventListener('DOMContentLoaded', () => {
    const footerContainer = document.getElementById('footer-portail');
    if (!footerContainer) return;

    fetch('/assets/footers/portail/index.html')
        .then(response => response.text())
        .then(html => {
            footerContainer.innerHTML = html;
        })
        .catch(err => console.error('Erreur chargement footer portail:', err));
});