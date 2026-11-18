// Recherche dans l'historique des versions (nom, numéro, date, contenu de la description).
const input = document.getElementById("version-search");
const liste = document.getElementById("timeline-list");
const compteur = document.getElementById("version-search-count");
const vide = document.getElementById("version-search-empty");
const effacer = document.getElementById("version-search-clear");

// Minuscules + sans accents, pour que "ete" trouve "été" et "V1.3" trouve "v1.3.0"
const normaliser = (s) =>
    String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function filtrer() {
    if (!input || !liste) return;
    const termes = normaliser(input.value).split(/\s+/).filter(Boolean);
    const cartes = Array.from(liste.children).filter(c => !c.classList.contains("empty-history"));

    let visibles = 0;
    cartes.forEach(carte => {
        const texte = normaliser(carte.textContent);
        const ok = termes.every(t => texte.includes(t)); // tous les mots doivent être présents
        if (ok) { carte.removeAttribute("data-search-hidden"); visibles++; }
        else carte.setAttribute("data-search-hidden", "");
    });

    const recherche = termes.length > 0;
    effacer.hidden = !recherche;
    compteur.textContent = recherche && cartes.length
        ? `${visibles} résultat${visibles > 1 ? "s" : ""} sur ${cartes.length}`
        : "";
    vide.hidden = !(recherche && cartes.length && visibles === 0);
}

if (input && liste) {
    let minuteur;
    input.addEventListener("input", () => { clearTimeout(minuteur); minuteur = setTimeout(filtrer, 120); });
    effacer.addEventListener("click", () => { input.value = ""; filtrer(); input.focus(); });
    input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.value = ""; filtrer(); } });

    // L'historique est chargé / re-rendu par version.js : on réapplique le filtre à chaque changement
    let planifie = false;
    new MutationObserver(() => {
        if (planifie) return;
        planifie = true;
        requestAnimationFrame(() => { planifie = false; filtrer(); });
    }).observe(liste, { childList: true, subtree: true, characterData: true });
}
