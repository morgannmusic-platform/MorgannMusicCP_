function appliquerCacheInstantane(data) {
    if (!data) return;

    // Exemple de sécurisation avec vérification if
    const bodyEl = document.body;
    if (bodyEl && data.bg_color) {
        bodyEl.style.backgroundColor = data.bg_color;
    }

    const accentEl = document.querySelector(".btn-popup, .btn-save");
    if (accentEl && data.accent_color) {
        accentEl.style.backgroundColor = data.accent_color;
    }

    const logoEl = document.getElementById("navbar-logo");
    if (logoEl && data.logo_url) {
        logoEl.src = data.logo_url;
    }
}