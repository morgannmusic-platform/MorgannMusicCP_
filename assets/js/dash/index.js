// --- Import too.fm pour release.html ---
import { injectTooFmImport } from './import-too-fm.js';
/**
 * MORGANN MUSIC - SCRIPT GLOBAL ET SYSTÈME IA
 * Version: 2.1.2 - Protection Totale contre les erreurs "null" (Dashboard compatible)
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-functions.js";

// ============================================================
// 1. CONFIGURATION ET INITIALISATION FIREBASE
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
    authDomain: "morgann-music-cp.firebaseapp.com",
    projectId: "morgann-music-cp",
    storageBucket: "morgann-music-cp.firebasestorage.app",
    messagingSenderId: "666812685196",
    appId: "1:666812685196:web:fe3df6749ae768d68494a9"
};

let app, auth, db, functions;
try {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app);
} catch (e) {
    console.error("Erreur d'initialisation Firebase:", e);
}

// ============================================================
// 2. GESTION DE L'INTERFACE (UI) ET DES ANIMATIONS
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
        // --- Gestion abonnement Solidaire après retour Stripe ---
        (async () => {
            if (window.location.search.includes("checkout=success") && localStorage.getItem("mmcpSolidarityCheckout") === "true") {
                try {
                    if (auth.currentUser) {
                        await updateDoc(
                            doc(db, "users", auth.currentUser.uid),
                            {
                                plan: "Solidaire",
                                planPriceId: "price_1TVfGoFhaOYWNNbbRuwVbtcO",
                                planUpdatedAt: new Date()
                            }
                        );
                        localStorage.removeItem("mmcpSolidarityCheckout");
                    }
                } catch (e) {
                    console.error("Erreur Firestore plan Solidaire:", e);
                }
            }
        })();
    // Injection du module d'import too.fm si on est sur release.html
    if (window.location.pathname.endsWith('/release.html')) {
        // On attend que le contenu soit chargé (releaseId dans l'URL ou dans le DOM)
        const checkReady = setInterval(() => {
            const content = document.getElementById('contentArea');
            if (content && content.style.display !== 'none') {
                clearInterval(checkReady);
                // Récupère l'ID de la release depuis l'URL (ex: ?id=xxxx)
                const params = new URLSearchParams(window.location.search);
                const id = params.get('id');
                if (id && typeof db !== 'undefined') injectTooFmImport(db, id);
            }
        }, 300);
    }
    
    // --- PROTECTION NAVBAR (Évite l'erreur TypeError: null) ---
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        // On ne fait rien si la navbar n'est pas présente (ex: sur le dashboard)
        if (!navbar) return; 

        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
            navbar.classList.remove('on-timeline');
        }
    });

    // --- Animations GSAP & ScrollTrigger (Vérification présence) ---
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // Grid covers
        if (document.querySelector(".grid-covers")) {
            gsap.to(".cover", {
                opacity: 1, y: 0, duration: 1.5, stagger: 0.2, ease: "power2.out",
                scrollTrigger: { trigger: ".grid-covers", start: "top 80%", end: "bottom 50%", scrub: 1 }
            });
        }

        // Timeline (Sécurité renforcée)
        if (navbar && document.querySelector(".timeline-section")) {
            ScrollTrigger.create({
                trigger: ".timeline-section",
                start: "top 20%", end: "bottom 80%",
                onEnter: () => navbar.classList.add('on-timeline'),
                onLeave: () => navbar.classList.remove('on-timeline'),
                onEnterBack: () => navbar.classList.add('on-timeline'),
                onLeaveBack: () => navbar.classList.remove('on-timeline')
            });
        }

        // Timeline items
        document.querySelectorAll(".timeline-item").forEach(item => {
            const side = item.getAttribute("data-side");
            gsap.to(item, {
                opacity: 1, x: 0, duration: 1,
                startAt: { x: side === "left" ? -100 : 100 },
                scrollTrigger: { trigger: item, start: "top 80%", toggleActions: "play none none reverse" }
            });
        });
    }

    // --- Thème Dynamique (Images / Logos) ---
    const platImage = document.getElementById('plateformes');
    const logoImage = document.getElementById("logo-dynamique");
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function updateVisualTheme() {
        const isDark = darkQuery.matches;
        if (platImage) platImage.src = isDark ? "/assets/img/pls.png" : "/assets/img/5.png";
        if (logoImage) logoImage.src = isDark ? "/assets/img/logo2.png" : "/assets/img/logo.svg";
    }
    updateVisualTheme();
    darkQuery.addEventListener("change", updateVisualTheme);

    // ============================================================
    // 3. SYSTÈME DE MODALE MÉDIA
    // ============================================================
    const modal = document.getElementById("pochetteModal");
    const closeModal = document.querySelector(".close-modal");

    document.querySelectorAll(".cover").forEach(cover => {
        cover.addEventListener("click", () => {
            if (!modal) return;
            
            const titleEl = document.getElementById("m-title");
            const artistEl = document.getElementById("m-artist");
            if (titleEl) titleEl.innerText = cover.getAttribute("data-title");
            if (artistEl) artistEl.innerText = cover.getAttribute("data-artist");

            const container = document.getElementById("modal-media-container");
            if (container) {
                container.innerHTML = cover.getAttribute("data-type") === "video" ?
                    `<video autoplay loop muted playsinline style="width:100%; border-radius:8px;"><source src="${cover.getAttribute("data-src")}" type="video/mp4"></video>` :
                    `<img src="${cover.getAttribute("data-src")}" style="width:100%; border-radius:8px;">`;
            }

            const tracklist = document.getElementById("m-tracks");
            if (tracklist) {
                tracklist.innerHTML = "";
                const tAttr = cover.getAttribute("data-tracks") || "";
                tAttr.split(",").forEach((t, i) => {
                    if (t.trim()) tracklist.innerHTML += `<div class="track-item">${i + 1}. ${t.trim()}</div>`;
                });
            }
            modal.style.display = "flex";
            if (typeof gsap !== 'undefined') {
                gsap.fromTo(".modal-content", { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4 });
            }
        });
    });

    if (closeModal) {
        closeModal.onclick = () => {
            if (typeof gsap !== 'undefined') {
                gsap.to(".modal-content", { scale: 0.8, opacity: 0, duration: 0.3, onComplete: () => { modal.style.display = "none"; } });
            } else {
                modal.style.display = "none";
            }
        };
    }

    // ============================================================
    // 4. AUTHENTIFICATION & ABONNEMENT
    // ============================================================
    const authLinks = document.getElementById("auth-links");
    const userLinks = document.getElementById("user-links");

    onAuthStateChanged(auth, (user) => {
        const isConnected = !!user || localStorage.getItem("userConnected") === "true";
        if (authLinks) authLinks.style.display = isConnected ? "none" : "block";
        if (userLinks) userLinks.style.display = isConnected ? "block" : "none";
    });

    // Gestion Logout Sidebar (Ton nouveau bouton Déconnexion)
    const sidebarLogout = document.getElementById('sidebarLogout');
    if (sidebarLogout) {
        sidebarLogout.addEventListener('click', () => window.logout());
    }

    const btnSubscribe = document.getElementById("btnSubscribeArtistProfile");
    const artistStatus = document.getElementById("artistProfileStatus");

    if (btnSubscribe) {
        btnSubscribe.addEventListener("click", async function () {
            btnSubscribe.disabled = true;
            btnSubscribe.textContent = "Vérification...";
            
            const user = auth.currentUser;
            if (!user) {
                if (artistStatus) artistStatus.textContent = "Erreur: Connecte-toi d'abord.";
                btnSubscribe.disabled = false;
                return;
            }

            try {
                const q = query(collection(db, "artists"), where("ownerUid", "==", user.uid), where("deleted", "!=", true));
                const snap = await getDocs(q);
                const isReady = snap.docs.some(doc => doc.data().spotify?.uriOrUrl && doc.data().appleMusic?.url);

                if (!isReady) {
                    if (artistStatus) artistStatus.textContent = "Erreur: Profils Spotify/Apple Music manquants.";
                    btnSubscribe.disabled = false;
                    btnSubscribe.textContent = "Protéger mon profil";
                    return;
                }

                const createCheckoutSession = httpsCallable(functions, "createCheckoutSession");
                const result = await createCheckoutSession({
                    items: [{ prodId: "price_1TAH3UFhaOYWNNbb25udUEh2", quantity: 1 }],
                    successUrl: window.location.origin + "/dash/?checkout=success",
                    cancelUrl: window.location.origin + "/dash/?checkout=cancel"
                });
                if (result.data?.url) window.location.href = result.data.url;
            } catch (e) {
                if (artistStatus) artistStatus.textContent = "Erreur Stripe.";
                btnSubscribe.disabled = false;
                btnSubscribe.textContent = "Réessayer";
            }
        });
    }

    // ============================================================
    // 5. POPUP DEV
    // ============================================================
    const popup = document.getElementById("dev-popup");
    const enterSite = document.getElementById("enter-site");
    if (popup && localStorage.getItem("dev_popup_seen") !== "true") {
        if (enterSite) enterSite.onclick = () => { localStorage.setItem("dev_popup_seen", "true"); popup.style.display = "none"; };
        const quitSite = document.getElementById("quit-site");
        if (quitSite) quitSite.onclick = () => { document.body.innerHTML = `<div style="height:100vh; background:#000; color:#fff; display:flex; align-items:center; justify-content:center;"><h1>À bientôt !</h1></div>`; };
    } else if (popup) {
        popup.style.display = "none";
    }

    // ============================================================
    // 6. MODULES IA
    // ============================================================
    initMorgannAI();
    // initMorgannChat(); // Désactivé temporairement car la fonction n’existe pas
});

// Logout Global
window.logout = function() {
    signOut(auth).then(() => { 
        localStorage.removeItem("userConnected"); 
        location.reload(); 
    }).catch(err => console.error("Erreur logout:", err));
};

// Fonctions d'injection IA (IA & Chat)
function initMorgannAI() {
    // On cherche un endroit où injecter le bouton (sidebar ou haut de page)
    const container = document.querySelector('.artist-sidebar__foot') || document.querySelector('.top-actions');
    // Suppression du bouton Générateur IA
        document.body.insertAdjacentHTML('beforeend', `<div id="mmcpAiModal" class="modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:10000; align-items:center; justify-content:center;">
            <div class="modal-box" style="background:#1a1a1a; padding:20px; border-radius:10px; width:90%; max-width:500px; color:#fff;">
                <h3>Morgann Music AI</h3>
                <textarea id="mmcpAiPrompt" style="width:100%; height:80px; margin:10px 0; padding:10px; color:#000;" placeholder="Écris ton prompt ici..."></textarea>
                <div style="display:flex; gap:10px;">
                    <button class="btn" id="mmcpAiGenerate">Générer</button>
                    <button class="btn secondary" id="mmcpAiClose">Fermer</button>
                </div>
                <div id="mmcpAiResult" style="margin-top:10px; white-space:pre-wrap; background:rgba(255,255,255,0.1); padding:10px; border-radius:5px; max-height:150px; overflow:auto;"></div>
            </div>
        </div>`);
    }

    const modal = document.getElementById('mmcpAiModal');
    // document.getElementById('mmcpAiOpenBtn').onclick = () => modal.style.display = 'flex'; // Désactivé car le bouton n’existe pas
    // document.getElementById('mmcpAiClose').onclick = () => modal.style.display = 'none'; // Désactivé car le bouton n’existe pas
    
    // document.getElementById('mmcpAiGenerate').onclick = async () => {
    //     const p = document.getElementById('mmcpAiPrompt').value;
    //     const r = document.getElementById('mmcpAiResult');
    //     if (!p) return;
    //     r.textContent = "Génération en cours...";
    //     try {
    //         const res = await fetch('/api/genai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: p }) });
    //         const d = await res.json();
    //         r.textContent = d.text || "Erreur de réponse.";
    //     } catch (e) { r.textContent = "Erreur de connexion à l'API IA."; }
    // };
