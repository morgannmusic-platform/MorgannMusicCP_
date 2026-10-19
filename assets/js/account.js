import { onAuthStateChanged, signOut, GoogleAuthProvider, linkWithPopup } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "/assets/js/firebase.js";
import { api } from "/assets/js/api.js";

const form = document.getElementById("account-form");
const logoutBtn = document.getElementById("logout-btn");
const linkGoogleBtn = document.getElementById("link-google-btn");

const googleStatusContainer = document.getElementById("google-status-container");
const googleAvatar = document.getElementById("google-avatar");
const googleEmail = document.getElementById("google-email");

const enableTotpBtn = document.getElementById("enable-totp-btn");
const disableTotpBtn = document.getElementById("disable-totp-btn");
const verifyTotpBtn = document.getElementById("verify-totp-btn");
const totpQrSection = document.getElementById("totp-qr-section");
const totpSetupActions = document.getElementById("totp-setup-actions");
const totpDisableContainer = document.getElementById("totp-disable-container");
const totpStatusText = document.getElementById("totp-status-text");
const totpSecretText = document.getElementById("totp-secret-text");
const totpCodeInput = document.getElementById("totp-code-input");
const qrcodeContainer = document.getElementById("qrcode");

const roleBadge = document.getElementById("role-badge");
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
const avatarInput = document.getElementById("avatar-input");
const avatarPreviewImg = document.getElementById("avatar-preview-img");
const newsletterCheckbox = document.getElementById("newsletter-enabled");

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

const roleLabelMap = { admin: "Admin", testeur: "Testeur", vip: "V.I.P", artiste: "Artiste", user: "User" };
const roleClassMap = { admin: "role-admin", testeur: "role-testeur", vip: "role-vip", artiste: "role-artiste", user: "role-user" };

const planDisplayNameMap = {
    "starter": "Starter",
    "pro": "Pro",
    "label": "Label",
    "white-label": "Marque blanche",
    "future-legende": "Future-Legende"
};

const setFeedback = (message = "", type = "") => {
    const activePanel = document.querySelector(".tab-panel.is-active");
    if (!activePanel) return;

    const feedbackEl = activePanel.querySelector(".account-feedback");
    if (!feedbackEl) return;

    feedbackEl.textContent = message;
    feedbackEl.className = "account-feedback feedback";
    if (type) feedbackEl.classList.add(type);
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

const generateRandomSecret = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let secret = "";
    for (let i = 0; i < 16; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    userUid.textContent = user.uid || "Non disponible";

    const updateGoogleUI = () => {
        const googleData = user.providerData.find(p => p.providerId === "google.com");

        if (googleData) {
            linkGoogleBtn?.classList.add("is-hidden");
            googleStatusContainer?.classList.remove("is-hidden");

            if (googleEmail) googleEmail.textContent = googleData.email || user.email;
            if (googleAvatar) googleAvatar.src = googleData.photoURL || "/assets/img/photodeprofil/default-avatar.png";
        } else {
            linkGoogleBtn?.classList.remove("is-hidden");
            googleStatusContainer?.classList.add("is-hidden");
        }
    };

    updateGoogleUI();

    try {
        const data = await api.get(`/api/users/${user.uid}`);
        if (!data || data.error) return;

        firstNameInput.value = data.firstName || "";
        lastNameInput.value = data.lastName || "";
        emailInput.value = data.email || user.email || "";
        addressInput.value = data.address || "";
        cityInput.value = data.city || "";
        postalInput.value = data.postalCode || "";
        ibanInput.value = data.iban || "";

        if (newsletterCheckbox) {
            newsletterCheckbox.checked = data.newsletterEnabled !== false;
        }

        if (data.photoURL && avatarPreviewImg) {
            avatarPreviewImg.src = api.fileUrl(data.photoURL);
        }

        userArtist.textContent = data.artistName || "Non renseigné";

        const rawPlanKey = (data.planName || "").trim().toLowerCase();
        const isActive = data.subscriptionStatus === "active";

        if (isActive && planDisplayNameMap[rawPlanKey]) {
            userPlan.textContent = planDisplayNameMap[rawPlanKey];
            subscriptionStatus.textContent = "Actif";
        } else {
            userPlan.textContent = "Aucun plan actif";
            subscriptionStatus.textContent = "Aucun abonnement actif";
        }

        let tempSecret = "";
        const updateTotpUI = (isConfigured) => {
            if (isConfigured) {
                totpStatusText.textContent = "Actif";
                totpStatusText.style.color = "#2e7d32";
                totpSetupActions.classList.add("is-hidden");
                totpQrSection.classList.add("is-hidden");
                totpDisableContainer.classList.remove("is-hidden");
            } else {
                totpStatusText.textContent = "Inactif";
                totpStatusText.style.color = "#c62828";
                totpSetupActions.classList.remove("is-hidden");
                totpDisableContainer.classList.add("is-hidden");
            }
        };

        updateTotpUI(data.totpEnabled);

        enableTotpBtn?.addEventListener("click", () => {
            tempSecret = generateRandomSecret();
            totpSecretText.textContent = tempSecret;

            const issuer = "MorgannMusicCP";
            const accountName = user.email || "user";
            const otpauthUrl = `otpauth://totp/${issuer}:${accountName}?secret=${tempSecret}&issuer=${issuer}`;

            qrcodeContainer.innerHTML = "";
            new QRCode(qrcodeContainer, {
                text: otpauthUrl,
                width: 180,
                height: 180
            });

            totpSetupActions.classList.add("is-hidden");
            totpQrSection.classList.remove("is-hidden");
            setFeedback("Scannez le QR code avec votre application.", "info");
        });

        verifyTotpBtn?.addEventListener("click", async () => {
            const code = totpCodeInput.value.trim();
            if (code.length !== 6) {
                setFeedback("Veuillez entrer un code valide à 6 chiffres.", "error");
                return;
            }

            try {
                await api.patch(`/api/users/${user.uid}`, {
                    totpEnabled: true,
                    totpSecret: tempSecret,
                });

                data.totpEnabled = true;
                totpCodeInput.value = "";
                updateTotpUI(true);
                setFeedback("Authentification à deux facteurs activée avec succès !", "success");
            } catch (err) {
                console.error("Erreur activation 2FA :", err);
                setFeedback("Erreur lors de l'activation du 2FA.", "error");
            }
        });

        disableTotpBtn?.addEventListener("click", async () => {
            if (!confirm("Voulez-vous vraiment désactiver l'authentification à deux facteurs ?")) return;

            try {
                await api.patch(`/api/users/${user.uid}`, {
                    totpEnabled: false,
                    totpSecret: null,
                });

                data.totpEnabled = false;
                updateTotpUI(false);
                setFeedback("Authentification à deux facteurs désactivée.", "info");
            } catch (err) {
                console.error("Erreur désactivation 2FA :", err);
                setFeedback("Erreur lors de la désactivation.", "error");
            }
        });

        const role = (data.role || "user").toLowerCase();
        const safe = roleClassMap[role] ? role : "user";
        roleBadge.textContent = roleLabelMap[safe];
        roleBadge.className = `role-badge ${roleClassMap[safe]}`;
        // Chargement des documents de l'utilisateur
        const userDocumentsList = document.getElementById("user-documents-list");
        async function chargerDocumentsClient() {
            if (!userDocumentsList) return;
            try {
                const res = await api.get(`/api/users/${user.uid}/documents`);
                const docs = Array.isArray(res) ? res : (res.documents || res.data || []);

                if (!docs || docs.length === 0) {
                    // Conserve le bloc SVG de l'état vide (cactus) si aucun document
                    return;
                }

                userDocumentsList.innerHTML = docs.map(doc => {
                    const title = doc.title || doc.name || "Document sans titre";
                    const desc = doc.description || "Aucune description";
                    // Utilisation de api.fileUrl pour gérer correctement le lien de téléchargement/affichage
                    const fileUrl = api.fileUrl(doc.file_url || doc.fileUrl || doc.url || doc.path);

                    return `
                        <div class="document-row" style="background-color: rgba(232, 232, 232, 0.2); border: 1px solid rgba(189, 189, 189, 0.438); border-radius: 16px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <div class="document-info" style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 200px;">
                                <span class="document-title" style="font-weight: 600; font-size: 14px; color: #000;">${title}</span>
                                <span class="document-desc" style="font-size: 12px; color: #525252;">${desc}</span>
                            </div>
                            <div class="document-actions" style="display: flex; gap: 8px; align-items: center;">
                                ${fileUrl ? `
                                    <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" style="padding: 6px 14px; border-radius: 20px; font-size: 12px; text-decoration: none; font-weight: 600; background: #d0a75a; color: #fff;">👁️ Ouvrir</a>
                                    <a href="${fileUrl}" download style="padding: 6px 14px; border-radius: 20px; font-size: 12px; text-decoration: none; font-weight: 600; background: #334155; color: #fff;">📥 Télécharger</a>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('');

            } catch (e) {
                console.error("Erreur de chargement des documents :", e);
                userDocumentsList.innerHTML = `<p style="color: #ef4444; font-size: 14px;">Erreur de chargement des documents.</p>`;
            }
        }

        // Appeler la fonction lors du chargement de la page
        chargerDocumentsClient();

        form?.addEventListener("submit", async (event) => {
            event.preventDefault();
            setFeedback("Enregistrement en cours...", "info");

            const firstName = firstNameInput.value.trim();
            const lastName = lastNameInput.value.trim();
            const email = emailInput.value.trim();

            if (!firstName || !lastName || !email) {
                setFeedback("Prénom, nom et email sont obligatoires.", "error");
                return;
            }

            try {
                let photoURL = data.photoURL || null;

                if (avatarInput && avatarInput.files[0]) {
                    const uploadResult = await api.uploadFile("avatar", avatarInput.files[0]);
                    photoURL = uploadResult.key;
                }

                await api.patch(`/api/users/${user.uid}`, {
                    firstName,
                    lastName,
                    fullName: `${firstName} ${lastName}`.trim(),
                    email,
                    address: addressInput.value.trim(),
                    city: cityInput.value.trim(),
                    postalCode: postalInput.value.trim(),
                    iban: ibanInput.value.trim() || null,
                    photoURL: photoURL,
                    newsletterEnabled: newsletterCheckbox ? newsletterCheckbox.checked : true
                });

                data.photoURL = photoURL;
                setFeedback("Modifications enregistrées avec succès !", "success");
                setTimeout(() => setFeedback("", ""), 4000);

            } catch (error) {
                console.error("Erreur lors de la sauvegarde :", error);
                setFeedback("Une erreur est survenue lors de l'enregistrement.", "error");
            }
        });

        linkGoogleBtn?.addEventListener("click", async () => {
            try {
                setFeedback("Association du compte Google en cours...", "info");
                const provider = new GoogleAuthProvider();

                await linkWithPopup(user, provider);

                updateGoogleUI();

                setFeedback("Compte Google associé avec succès ! Vous pouvez désormais l'utiliser pour vous connecter.", "success");
            } catch (err) {
                console.error("Erreur liaison Google :", err);
                if (err.code === 'auth/credential-already-in-use') {
                    setFeedback("Ce compte Google est déjà lié à un autre utilisateur.", "error");
                } else {
                    setFeedback("Échec de l'association du compte Google ou annulé.", "error");
                }
            }
        });

    } catch (error) {
        console.error("Erreur de chargement :", error);
        setFeedback("Erreur de chargement du compte.", "error");
    }
});

logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login.html";
});