import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "/assets/js/firebase.js";

const form = document.getElementById("account-form");
const logoutBtn = document.getElementById("logout-btn");
const roleBadge = document.getElementById("role-badge");
const accountFeedback = document.getElementById("account-feedback");
const userUid = document.getElementById("user-uid");
const userArtist = document.getElementById("user-artist");
const userPlan = document.getElementById("user-plan");
const subscriptionStatus = document.getElementById("subscription-status");

const firstNameInput = document.getElementById("first-name");
const lastNameInput = document.getElementById("last-name");
const emailInput = document.getElementById("email");
const addressInput = document.getElementById("address");
const cityInput = document.getElementById("city");
const postalInput = document.getElementById("postal-code");
const ibanInput = document.getElementById("iban");

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

const roleLabelMap = { admin: "Admin", testeur: "Testeur", vip: "V.I.P", artiste: "Artiste", user: "User" };
const roleClassMap = { admin: "role-admin", testeur: "role-testeur", vip: "role-vip", artiste: "role-artiste", user: "role-user" };

const setFeedback = (message = "", type = "") => {
    accountFeedback.textContent = message;
    accountFeedback.className = "feedback";
    if (type) accountFeedback.classList.add(type);
};

const selectTab = (tabId) => {
    tabButtons.forEach((button) => {
        const active = button.dataset.tab === tabId;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
    });
    tabPanels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === tabId));
};

tabButtons.forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.tab)));

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    userUid.textContent = user.uid || "Non disponible";

    const userRef = doc(db, "users", user.uid);

    try {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;

        const data = userSnap.data();
        firstNameInput.value = data.firstName || "";
        lastNameInput.value = data.lastName || "";
        emailInput.value = data.email || user.email || "";
        addressInput.value = data.address || "";
        cityInput.value = data.city || "";
        postalInput.value = data.postalCode || "";
        ibanInput.value = data.iban || "";

        userArtist.textContent = data.artistName || "Non renseigne";

        // Affichage des infos d'abonnement
        userPlan.textContent = data.planName || "Utilisateur Standard (Gratuit)";
        subscriptionStatus.textContent = data.subscriptionStatus === "active" ? "Actif" : "Aucun abonnement actif";

        // Gestion de la popup de succès après paiement Stripe
        const params = new URLSearchParams(window.location.search);
        if (params.get('status') === 'success' && params.get('redirect_status') === 'succeeded') {
            const modal = document.getElementById("success-modal");
            const message = document.getElementById("modal-message");
            const closeBtn = document.getElementById("modal-close-btn");
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            if (data.planName) {
                message.textContent = `Merci pour votre confiance ! Votre abonnement "${data.planName}" est désormais actif. Profitez dès maintenant de toutes vos fonctionnalités.`;
            }
            
            modal.classList.remove("is-hidden");
            if (!reducedMotion && window.gsap) {
                gsap.to(modal, { opacity: 1, duration: 0.3 });
            }

            // Lancement des confettis
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FC8FB0', '#EAFFC6', '#FFFFFF']
            });

            // Animation GSAP pour l'apparition
            if (!reducedMotion && window.gsap) {
                gsap.from("#success-card", {
                    scale: 0.8,
                    opacity: 0,
                    duration: 0.6,
                    ease: "back.out(1.7)"
                });
            }

            // Fermeture du modal
            const closeModal = () => {
                if (!reducedMotion && window.gsap) {
                    gsap.to(modal, { opacity: 0, duration: 0.3, onComplete: () => modal.classList.add("is-hidden") });
                } else {
                    modal.classList.add("is-hidden");
                }
            };
            // Ajout de l'écouteur d'événement pour le bouton de fermeture
            closeBtn.addEventListener('click', closeModal);
            // Nettoyage de l'URL pour éviter que la popup ne réapparaisse au refresh
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const role = (data.role || "user").toLowerCase();
        const safe = roleClassMap[role] ? role : "user";
        roleBadge.textContent = roleLabelMap[safe];
        roleBadge.className = `role-badge ${roleClassMap[safe]}`;

        form?.addEventListener("submit", async (event) => {
            event.preventDefault();
            setFeedback();

            const firstName = firstNameInput.value.trim();
            const lastName = lastNameInput.value.trim();
            const email = emailInput.value.trim();

            if (!firstName || !lastName || !email) {
                setFeedback("Prenom, nom et email sont obligatoires.", "error");
                return;
            }

            try {
                await updateDoc(userRef, {
                    firstName,
                    lastName,
                    fullName: `${firstName} ${lastName}`.trim(),
                    email,
                    address: addressInput.value.trim(),
                    city: cityInput.value.trim(),
                    postalCode: postalInput.value.trim(),
                    iban: ibanInput.value.trim() || null,
                    updatedAt: serverTimestamp()
                });
                setFeedback("Informations mises a jour.", "success");
            } catch (error) {
                setFeedback("Impossible de mettre a jour les informations.", "error");
            }
        });
    } catch (error) {
        setFeedback("Erreur de chargement du compte.", "error");
    }
});

logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login.html";
});
