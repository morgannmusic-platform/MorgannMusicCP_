import {
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider,
    linkWithPopup,
    updatePassword,
    updateEmail,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "/assets/js/firebase.js";
import { api } from "/assets/js/api.js";

// Formulaires distincts dans l'interface
const profileForm = document.getElementById("account-form");
const emailForm = document.getElementById("email-change-form");
const passwordForm = document.getElementById("password-change-form");
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

const firstNameInput = document.getElementById("first-name");
const lastNameInput = document.getElementById("last-name");
const addressInput = document.getElementById("address");
const cityInput = document.getElementById("city");
const postalInput = document.getElementById("postal-code");
const ibanInput = document.getElementById("iban");
const avatarInput = document.getElementById("avatar-input");
const avatarPreviewImg = document.getElementById("avatar-preview-img");

const securityEmailInput = document.getElementById("email");
const currentPasswordInput = document.getElementById("current-password");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

const roleLabelMap = { admin: "Admin", testeur: "Testeur", vip: "V.I.P", artiste: "Artiste", user: "User" };
const roleClassMap = { admin: "role-admin", testeur: "role-testeur", vip: "role-vip", artiste: "role-artiste", user: "role-user" };

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

// Fonction qui passe UNIQUEMENT par le dossier functions via la route relative /api/send-email
const sendSecurityEmailViaFunctions = async (toEmail, subject, htmlContent) => {
    try {
        const res = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toEmail, subject, htmlContent })
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
            console.error("Erreur envoi email via functions:", result);
        }
    } catch (err) {
        console.error("Échec requête /api/send-email:", err);
    }
};

// Modèle HTML aux couleurs de Morgann Music CP
const generateEmailTemplate = (title, message) => {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title} | Morgann Music CP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #EAFFC6; font-family: 'Segoe UI', Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #EAFFC6; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="90%" style="max-width: 580px; background-color: #f8ffe7; border-radius: 36px; padding: 35px 30px; box-shadow: 0 12px 28px rgba(0,0,0,0.15); border: 1px solid #e1f5be;">
          <tr>
            <td style="text-align: left;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://mm-cp.uk/assets/img/icons/sombre.png" alt="Logo MMCP" width="90" style="display: block; margin: 0 auto; border: 0;">
              </div>
              <h1 style="color: #2c3e10; font-size: 24px; font-weight: 800; text-align: center; margin: 0 0 10px 0;">${title} 🔒</h1>
              <p style="color: #556b2f; font-size: 15px; text-align: center; margin: 0 0 25px 0;">Mise à jour importante concernant ton compte.</p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 24px; border: 1px solid #e0f0c0; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 25px;">
                    <p style="color: #3e2837; font-size: 14px; line-height: 1.6; margin: 0;">${message}</p>
                    <div style="text-align: center; margin-top: 25px;">
                      <a href="https://mm-cp.uk/account.html" style="display: inline-block; background-color: #FC8FB0; color: #EAFFC6; text-decoration: none; padding: 12px 30px; border-radius: 50px; font-weight: 700; font-size: 14px;">Accéder à mon compte</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    if (userUid) userUid.textContent = user.uid || "Non disponible";
    if (securityEmailInput) securityEmailInput.value = user.email || "";

    // Chargement profil D1
    try {
        const data = await api.get(`/api/users/${user.uid}`);
        if (data && !data.error) {
            if (firstNameInput) firstNameInput.value = data.firstName || "";
            if (lastNameInput) lastNameInput.value = data.lastName || "";
            if (addressInput) addressInput.value = data.address || "";
            if (cityInput) cityInput.value = data.city || "";
            if (postalInput) postalInput.value = data.postalCode || "";
            if (ibanInput) ibanInput.value = data.iban || "";
            if (userArtist) userArtist.textContent = data.artistName || "Non renseigné";

            if (data.photoURL && avatarPreviewImg) {
                avatarPreviewImg.src = api.fileUrl(data.photoURL);
            }

            const role = (data.role || "user").toLowerCase();
            const safeRole = roleClassMap[role] ? role : "user";
            if (roleBadge) {
                roleBadge.textContent = roleLabelMap[safeRole];
                roleBadge.className = `role-badge ${roleClassMap[safeRole]}`;
            }
        }
    } catch (err) {
        console.error("Erreur lors de la récupération des infos D1 :", err);
    }

    // 1. Sauvegarde des informations du profil principal
    profileForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        setFeedback("Enregistrement en cours...", "info");

        try {
            let photoURL = null;

            if (avatarInput && avatarInput.files[0]) {
                const uploadResult = await api.uploadFile("avatar", avatarInput.files[0]);
                photoURL = uploadResult.key;
            }

            await api.patch(`/api/users/${user.uid}`, {
                firstName: firstNameInput.value.trim(),
                lastName: lastNameInput.value.trim(),
                fullName: `${firstNameInput.value.trim()} ${lastNameInput.value.trim()}`.trim(),
                address: addressInput.value.trim(),
                city: cityInput.value.trim(),
                postalCode: postalInput.value.trim(),
                iban: ibanInput.value.trim() || null,
                ...(photoURL && { photoURL })
            });

            setFeedback("Profil enregistré avec succès !", "success");
            setTimeout(() => setFeedback("", ""), 4000);
        } catch (error) {
            console.error("Erreur sauvegarde profil :", error);
            setFeedback("Erreur lors de l'enregistrement du profil.", "error");
        }
    });

    // 2. MODIFICATION EFFECTIVE DE L'ADRESSE E-MAIL
    emailForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const newEmail = securityEmailInput.value.trim();
        const oldEmail = user.email;

        if (!newEmail || !newEmail.includes("@")) {
            setFeedback("Veuillez saisir une adresse e-mail valide.", "error");
            return;
        }

        if (newEmail === oldEmail) {
            setFeedback("L'adresse e-mail est identique à l'adresse actuelle.", "error");
            return;
        }

        const password = prompt("Entre ton mot de passe actuel pour valider le changement d'adresse e-mail :");
        if (!password) {
            setFeedback("Changement annulé.", "error");
            return;
        }

        try {
            setFeedback("Mise à jour de l'adresse e-mail...", "info");

            // Ré-authentification Firebase Auth
            const credential = EmailAuthProvider.credential(oldEmail, password);
            await reauthenticateWithCredential(user, credential);

            // Modification réelle sur Firebase Auth
            await updateEmail(user, newEmail);

            // Synchronisation sur la BDD D1
            await api.patch(`/api/users/${user.uid}`, { email: newEmail });

            // Notification e-mail aux deux adresses via le dossier functions (/api/send-email)
            const emailMessage = `L'adresse e-mail de ton compte Morgann Music CP a été modifiée avec succès.<br><br><strong>Ancienne adresse :</strong> ${oldEmail}<br><strong>Nouvelle adresse :</strong> ${newEmail}<br><br>Si tu n'es pas à l'origine de ce changement, sécurise ton compte immédiatement.`;
            const htmlContent = generateEmailTemplate("Alerte de sécurité : E-mail modifié", emailMessage);

            await sendSecurityEmailViaFunctions(oldEmail, "Modification de votre adresse e-mail", htmlContent);
            await sendSecurityEmailViaFunctions(newEmail, "Modification de votre adresse e-mail", htmlContent);

            setFeedback("Adresse e-mail modifiée avec succès ! E-mails de confirmation envoyés.", "success");
            setTimeout(() => setFeedback("", ""), 4000);
        } catch (error) {
            console.error("Erreur modification e-mail :", error);
            setFeedback(`Échec : ${error.message || "Mot de passe incorrect."}`, "error");
        }
    });

    // 3. MODIFICATION EFFECTIVE DU MOT DE PASSE
    passwordForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            setFeedback("Veuillez remplir tous les champs de mot de passe.", "error");
            return;
        }

        if (newPassword !== confirmPassword) {
            setFeedback("Les nouveaux mots de passe ne correspondent pas.", "error");
            return;
        }

        if (newPassword.length < 6) {
            setFeedback("Le nouveau mot de passe doit contenir au moins 6 caractères.", "error");
            return;
        }

        try {
            setFeedback("Modification du mot de passe...", "info");

            // Ré-authentification Firebase Auth
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Modification réelle sur Firebase Auth
            await updatePassword(user, newPassword);

            // Notification e-mail à l'utilisateur via /api/send-email (functions)
            const passwordMessage = `Le mot de passe de ton compte Morgann Music CP (<strong>${user.email}</strong>) a été modifié avec succès.<br><br>Si tu n'es pas à l'origine de ce changement, réinitialise ton mot de passe immédiatement.`;
            const htmlContent = generateEmailTemplate("Alerte de sécurité : Mot de passe modifié", passwordMessage);

            await sendSecurityEmailViaFunctions(user.email, "Modification de votre mot de passe", htmlContent);

            currentPasswordInput.value = "";
            newPasswordInput.value = "";
            confirmPasswordInput.value = "";

            setFeedback("Mot de passe modifié avec succès ! E-mail de confirmation envoyé.", "success");
            setTimeout(() => setFeedback("", ""), 4000);
        } catch (error) {
            console.error("Erreur modification mot de passe :", error);
            setFeedback("Erreur : Ancien mot de passe incorrect.", "error");
        }
    });
});

logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login.html";
});