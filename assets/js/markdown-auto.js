// Convertit automatiquement en Markdown les descriptions de version affichées
// par developpement.js / version.js, sans avoir à modifier ces scripts.
import { renderMarkdown, normaliserTexte } from "/assets/js/markdown.js";

// 1) Éléments explicitement identifiés (carte "actuelle" ou attribut manuel)
const SELECTOR = "#current-version-desc, #current-v-desc, [data-markdown]";
// 2) Historique : on détecte la description dans chaque carte de #timeline-list
const TIMELINE = "#timeline-list";

const rendered = new WeakMap();

function texteBrut(el) {
    // <br> -> \n, puis décodage des entités HTML pour retrouver le texte saisi
    const tmp = document.createElement("div");
    tmp.innerHTML = el.innerHTML.replace(/<br\s*\/?>/gi, "\n");
    return normaliserTexte(tmp.textContent).trim();
}

function convertir(el) {
    if (rendered.get(el) === el.innerHTML) return; // déjà converti
    const brut = texteBrut(el);
    if (!brut) return;
    el.classList.add("md-content");
    el.innerHTML = renderMarkdown(brut);
    rendered.set(el, el.innerHTML);
}

// ---- Détection de la description dans une carte de l'historique ----
const RE_CLASSE_EXCLUE = /date|time|badge|tag|title|titre|name|num|label|pill|dot|marker|icon|version-?v/i;
const RE_VERSION = /^v?\d+(\.\d+){1,3}$/i;
const RE_DATE = /^\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+\p{L}+\s+\d{4}).{0,25}$/iu;

function estFeuille(el) {
    return Array.from(el.children).every(c => c.tagName === "BR");
}

function trouverDescription(carte) {
    // Déjà converti auparavant ? On le retrouve par sa classe.
    const deja = carte.querySelector(".md-content");
    if (deja) return deja;

    // Sinon : l'élément "feuille" au texte le plus long qui n'est ni titre, ni date, ni numéro de version.
    let meilleur = null;
    let longueur = 0;
    carte.querySelectorAll("*").forEach(el => {
        if (!estFeuille(el)) return;
        if (/^(H[1-6]|TIME|BUTTON|SVG|SCRIPT|STYLE|A)$/i.test(el.tagName)) return;
        if (RE_CLASSE_EXCLUE.test(el.className?.toString?.() || "") &&
            !/desc|note|content|body|text/i.test(el.className.toString())) return;
        const txt = texteBrut(el);
        if (!txt || RE_VERSION.test(txt) || RE_DATE.test(txt)) return;
        if (txt.length > longueur) { meilleur = el; longueur = txt.length; }
    });
    return meilleur;
}

function scanner() {
    document.querySelectorAll(SELECTOR).forEach(convertir);

    const liste = document.querySelector(TIMELINE);
    if (!liste) return;
    Array.from(liste.children).forEach(carte => {
        if (carte.classList.contains("empty-history")) return;
        // Cas simple : la description porte déjà un marqueur évident
        let cible = carte.querySelector("[data-markdown], .version-desc, [class*='desc'], [class*='note']");
        // Un conteneur qui a des sous-éléments (titre, date...) n'est pas la description elle-même
        if (cible && !estFeuille(cible) && !cible.classList.contains("md-content")) cible = null;
        cible = cible || trouverDescription(carte);
        if (cible) convertir(cible);
    });
}

let planifie = false;
const observer = new MutationObserver(() => {
    if (planifie) return;
    planifie = true;
    requestAnimationFrame(() => { planifie = false; scanner(); });
});

observer.observe(document.body, { childList: true, subtree: true, characterData: true });
scanner();
