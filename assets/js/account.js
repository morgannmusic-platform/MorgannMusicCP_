import {
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider,
    linkWithPopup,
    updatePassword,
    verifyBeforeUpdateEmail,
    EmailAuthProvider,
    reauthenticateWithCredential,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "/assets/js/firebase.js";
import { api } from "/assets/js/api.js";

// Formulaires et boutons
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

// Onglet Emails & Documents
const newsletterCheckbox = document.getElementById("newsletter-checkbox");
const saveEmailsBtn = document.getElementById("save-emails-btn");
const userDocumentsList = document.getElementById("user-documents-list");

// Infos utilisateur
const roleBadge = document.getElementById("role-badge");
const userUid = document.getElementById("user-uid");
const userArtist = document.getElementById("user-artist");
const userPlanEl = document.getElementById("user-plan");
const subscriptionStatusEl = document.getElementById("subscription-status");

const firstNameInput = document.getElementById("first-name");
const lastNameInput = document.getElementById("last-name");
const addressInput = document.getElementById("address");
const cityInput = document.getElementById("city");
const postalInput = document.getElementById("postal-code");
const ibanInput = document.getElementById("iban");
const avatarInput = document.getElementById("avatar-input");
const avatarPreviewImg = document.getElementById("avatar-preview-img");

// Éléments du changement d'e-mail
const securityEmailInput = document.getElementById("email");
const emailCurrentPasswordInput = document.getElementById("email-current-password");
const emailVerificationBlock = document.getElementById("email-verification-block");
const emailSubmitBtn = document.getElementById("email-submit-btn");
const emailCodeInputs = Array.from(document.querySelectorAll(".email-code-digit"));
const emailCodeHiddenInput = document.getElementById("email-code-hidden");

// Mot de passe
const currentPasswordInput = document.getElementById("current-password");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");

const isStrongPassword = (value) => Boolean(value && value.length >= 6);

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

const roleLabelMap = { admin: "Admin", testeur: "Testeur", vip: "V.I.P", artiste: "Artiste", user: "User" };
const roleClassMap = { admin: "role-admin", testeur: "role-testeur", vip: "role-vip", artiste: "role-artiste", user: "role-user" };

// Affichage des messages dans l'onglet actif
const setFeedback = (message = "", type = "") => {
    const activePanel = document.querySelector(".tab-panel.is-active");
    if (!activePanel) return;

    const feedbackEl = activePanel.querySelector(".account-feedback");
    if (!feedbackEl) return;

    feedbackEl.textContent = message;
    feedbackEl.className = "account-feedback feedback";
    if (type) feedbackEl.classList.add(type);
};

const getUserFriendlyError = (error) => {
    const code = error?.code || "";

    if (code === "auth/wrong-password") return "Votre mot de passe est erroné.";
    if (code === "auth/invalid-email") return "Adresse e-mail invalide.";
    if (code === "auth/email-already-in-use") return "Cette adresse e-mail est déjà utilisée.";
    if (code === "auth/requires-recent-login") return "Votre session a expiré. Reconnectez-vous puis réessayez.";
    if (code === "auth/weak-password") return "Votre nouveau mot de passe est trop faible.";
    if (code === "auth/too-many-requests") return "Trop de tentatives. Réessayez dans quelques minutes.";
    return error?.message || "Une erreur est survenue. Vérifiez vos informations et réessayez.";
};

// Stockage de l'état de la demande de changement d'e-mail
const emailChangeStorageKey = "mmcp_email_change_request";

const readPendingEmailChange = () => {
    try {
        const raw = sessionStorage.getItem(emailChangeStorageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && parsed.stage ? parsed : null;
    } catch {
        return null;
    }
};

const persistPendingEmailChange = (payload) => {
    sessionStorage.setItem(emailChangeStorageKey, JSON.stringify(payload));
};

const clearPendingEmailChange = () => {
    sessionStorage.removeItem(emailChangeStorageKey);
};

// -------------------------------------------------------------
// CHARGEMENT DES DOCUMENTS DE L'UTILISATEUR (RÉPARATION)
// -------------------------------------------------------------
const loadUserDocuments = async (uid) => {
    if (!userDocumentsList) return;
    try {
        const docs = await api.get(`/api/users/${uid}/documents`);

        if (Array.isArray(docs) && docs.length > 0) {
            userDocumentsList.innerHTML = docs.map(doc => `
                <div class="info-card" style="display: flex; justify-content: space-between; align-items: center; padding: 16px; margin-bottom: 10px; background: #ffffff; border-radius: 14px; border: 1px solid #eee;">
                    <div>
                        <h4 style="margin: 0 0 6px 0; color: #2c3e10; font-weight: 700;">${doc.title}</h4>
                        ${doc.description ? `<p style="margin: 0 0 6px 0; font-size: 13px; color: #555;">${doc.description}</p>` : ''}
                        <span style="font-size: 11px; color: #888;">Ajouté le ${new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <a href="${api.fileUrl(doc.file_url)}" target="_blank" rel="noopener noreferrer" class="save-btn" style="text-decoration: none; padding: 8px 18px; font-size: 13px; background: #d0a75a; color: #fff;">
                        📄 Consulter
                    </a>
                </div>
            `).join("");
        } else {
            userDocumentsList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #666;">
                    <p style="font-weight: 600; font-size: 16px; color: #2c3e10; margin: 0 0 5px 0;">Aucun document pour le moment</p>
                    <p style="font-size: 13px; color: #777; margin: 0;">Il n'y a pas de document disponible pour l'instant !</p>
                </div>
            `;
        }
    } catch (err) {
        console.error("Erreur lors de la récupération des documents :", err);
        userDocumentsList.innerHTML = `<p style="color: red; font-size: 13px;">Impossible de charger les documents.</p>`;
    }
};

// -------------------------------------------------------------
// GESTION DE L'INTERFACE UTILISATEUR POUR LE CHANGEMENT D'EMAIL
// -------------------------------------------------------------
const setEmailVerificationUI = () => {
    const pending = readPendingEmailChange();
    const stage = pending?.stage || "idle";

    let noticeEl = document.getElementById("email-awaiting-notice");
    if (!noticeEl && emailForm) {
        noticeEl = document.createElement("div");
        noticeEl.id = "email-awaiting-notice";
        noticeEl.style.cssText = "display: none; background: #e1f5be; border: 1px solid #c3e88d; padding: 18px; border-radius: 16px; margin-top: 1rem; text-align: center;";
        emailForm.appendChild(noticeEl);
    }

    if (stage === "idle") {
        if (noticeEl) noticeEl.style.display = "none";
        if (emailVerificationBlock) {
            emailVerificationBlock.classList.add("is-hidden");
            emailVerificationBlock.style.display = "none";
        }
        if (emailSubmitBtn) {
            emailSubmitBtn.textContent = "Envoyer le code";
            emailSubmitBtn.style.display = "inline-flex";
            emailSubmitBtn.disabled = false;
        }
        if (securityEmailInput) securityEmailInput.disabled = false;
        if (emailCurrentPasswordInput) emailCurrentPasswordInput.disabled = false;

        emailCodeInputs.forEach((input) => {
            input.value = "";
            input.disabled = true;
        });

    } else if (stage === "code-verification") {
        if (noticeEl) noticeEl.style.display = "none";
        if (emailVerificationBlock) {
            emailVerificationBlock.classList.remove("is-hidden");
            emailVerificationBlock.style.display = "block";
        }
        if (emailSubmitBtn) {
            emailSubmitBtn.textContent = "Valider le code";
            emailSubmitBtn.style.display = "inline-flex";
            emailSubmitBtn.disabled = false;
        }
        if (securityEmailInput) securityEmailInput.disabled = true;
        if (emailCurrentPasswordInput) emailCurrentPasswordInput.disabled = true;

        emailCodeInputs.forEach((input) => {
            input.disabled = false;
        });

    } else if (stage === "awaiting-firebase-confirmation") {
        if (emailVerificationBlock) {
            emailVerificationBlock.classList.add("is-hidden");
            emailVerificationBlock.style.display = "none";
        }
        if (emailSubmitBtn) {
            emailSubmitBtn.style.display = "none";
        }
        if (securityEmailInput) {
            securityEmailInput.value = pending.newEmail;
            securityEmailInput.disabled = true;
        }
        if (emailCurrentPasswordInput) {
            emailCurrentPasswordInput.value = "";
            emailCurrentPasswordInput.disabled = true;
        }

        if (noticeEl) {
            noticeEl.style.display = "block";
            noticeEl.innerHTML = `
                <p style="margin: 0 0 8px 0; font-weight: 800; color: #2c3e10; font-size: 16px;">📧 Validez votre nouvelle adresse e-mail</p>
                <p style="margin: 0; font-size: 14px; color: #3e2837; line-height: 1.6;">
                    Un e-mail de confirmation Firebase a été envoyé à <strong>${pending.newEmail}</strong>.<br>
                    <strong>Veuillez ouvrir cet e-mail et cliquer sur le lien de confirmation</strong> pour finaliser la modification sur votre compte.
                </p>
            `;
        }

        setFeedback("Un e-mail de confirmation a été envoyé à votre nouvelle adresse. Veuillez suivre le lien qu'il contient.", "info");
    }
};

const getEnteredEmailCode = () => emailCodeInputs.map((input) => (input.value || "").trim()).join("");

const reauthenticateCurrentUser = async (password) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
        throw new Error("Aucune session Firebase active.");
    }

    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);
    return currentUser;
};

const generateVerificationCode = () => String(Math.floor(100000 + Math.random() * 900000));

const sendVerificationCodeEmail = async (toEmail, code) => {
    const htmlContent = generateEmailTemplate("Code de vérification", `
        <p style="font-size: 15px; line-height: 1.7; color: #3e2837; margin: 0 0 18px 0;">Vous avez demandé une modification de votre adresse e-mail sur Morgann Music CP.</p>
        <p style="font-size: 15px; line-height: 1.7; color: #3e2837; margin: 0 0 14px 0;">Votre code de vérification est :</p>
        <div role="text" aria-label="Code de vérification ${code}" style="display: inline-block; padding: 18px 22px; border-radius: 16px; background: #EAFFC6; border: 1px solid #D8EFB5; margin: 8px 0 18px 0; text-align: center;">
            <span style="font-size: 34px; letter-spacing: 0.55em; font-weight: 800; color: #2c3e10; font-family: 'Segoe UI', Arial, sans-serif;">${code}</span>
        </div>
        <p style="font-size: 15px; line-height: 1.7; color: #3e2837; margin: 0 0 12px 0;">Entrez ce code dans votre espace compte pour valider le changement.</p>
    `);

    await api.post("/api/send-email", {
        toEmail,
        subject: "Code de vérification pour votre changement d'e-mail",
        htmlContent,
        senderEmail: "notifications@mm-cp.uk",
        replyToEmail: "support@mm-cp.uk"
    });
};

const sendEmailChangeConfirmationEmails = async (oldEmail, newEmail) => {
    const confirmationHtml = generateEmailTemplate("Confirmation du changement d'adresse e-mail", `
        <p style="font-size: 15px; line-height: 1.7; color: #3e2837; margin: 0 0 15px 0;">Votre adresse e-mail a bien été mise à jour pour votre compte Morgann Music CP.</p>
        <p style="font-size: 15px; line-height: 1.7; color: #3e2837; margin: 0 0 10px 0;"><strong>Ancienne adresse :</strong> ${oldEmail}</p>
        <p style="font-size: 15px; line-height: 1.7; color: #3e2837; margin: 0 0 20px 0;"><strong>Nouvelle adresse :</strong> ${newEmail}</p>
    `);

    await sendSecurityEmailViaFunctions(oldEmail, "Confirmation du changement d'adresse e-mail", confirmationHtml);
    await sendSecurityEmailViaFunctions(newEmail, "Votre adresse e-mail a été modifiée", confirmationHtml);
};

const sendSecurityEmailViaFunctions = async (toEmail, subject, htmlContent) => {
    try {
        await api.post("/api/send-email", { toEmail, subject, htmlContent });
    } catch (err) {
        console.error("Échec requête worker /api/send-email:", err);
    }
};

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

// -------------------------------------------------------------
// VALIDATION DU CODE A 6 CHIFFRES ET ENVOI MAIL FIREBASE
// -------------------------------------------------------------
const validatePendingEmailCode = async (currentUser, password, pending) => {
    const code = getEnteredEmailCode();
    if (!code || code.length !== 6) {
        setFeedback("Veuillez saisir le code complet à 6 chiffres.", "error");
        return false;
    }

    if (Date.now() > pending.expiresAt) {
        clearPendingEmailChange();
        setEmailVerificationUI();
        setFeedback("Le code de vérification a expiré. Veuillez recommencer la procédure.", "error");
        return true;
    }

    if (String(code) !== String(pending.code)) {
        setFeedback("Le code de vérification est incorrect.", "error");
        return true;
    }

    try {
        setFeedback("Validation du code en cours...", "info");
        await reauthenticateCurrentUser(password || pending.password);

        await verifyBeforeUpdateEmail(currentUser, pending.newEmail);

        const updatedPending = {
            ...pending,
            stage: "awaiting-firebase-confirmation",
            password: password || pending.password
        };

        persistPendingEmailChange(updatedPending);
        setEmailVerificationUI();
        return true;
    } catch (error) {
        console.error("Erreur validation code d'e-mail :", error);
        setFeedback(getUserFriendlyError(error), "error");
        return true;
    }
};

const attemptValidatePendingEmailCode = async () => {
    const currentUser = auth.currentUser;
    const pending = readPendingEmailChange();
    if (!currentUser || !pending || pending.stage !== "code-verification") return;

    const filled = emailCodeInputs.every((input) => input.value.trim() !== "");
    if (!filled) return;

    const password = emailCurrentPasswordInput.value.trim() || pending.password;
    await validatePendingEmailCode(currentUser, password, pending);
};

const fillCodeInputsFromPaste = (value) => {
    const digits = String(value || "").replace(/\D/g, "").slice(0, emailCodeInputs.length);
    if (!digits) return;

    emailCodeInputs.forEach((input, index) => {
        input.value = digits[index] || "";
    });

    if (emailCodeHiddenInput) {
        emailCodeHiddenInput.value = digits;
    }

    const nextIndex = Math.min(digits.length, emailCodeInputs.length - 1);
    emailCodeInputs[nextIndex]?.focus();

    const filled = emailCodeInputs.every((input) => input.value.trim() !== "");
    if (filled) {
        setTimeout(() => attemptValidatePendingEmailCode(), 0);
    }
};

emailCodeInputs.forEach((input, index) => {
    input.addEventListener("paste", (event) => {
        event.preventDefault();
        const pasted = (event.clipboardData?.getData("text") || "").replace(/\s+/g, "");
        fillCodeInputsFromPaste(pasted);
    });

    input.addEventListener("input", async (event) => {
        const value = event.target.value.replace(/\D/g, "").slice(0, 1);
        event.target.value = value;

        if (emailCodeHiddenInput) {
            emailCodeHiddenInput.value = getEnteredEmailCode();
        }

        if (value && index < emailCodeInputs.length - 1) {
            emailCodeInputs[index + 1].focus();
        }

        if (emailCodeInputs.every((digitInput) => digitInput.value.trim() !== "")) {
            await attemptValidatePendingEmailCode();
        }
    });

    input.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !input.value && index > 0) {
            emailCodeInputs[index - 1].focus();
        }
        if (event.key.length === 1 && /\d/.test(event.key) && index < emailCodeInputs.length - 1) {
            event.preventDefault();
            input.value = event.key;
            if (emailCodeHiddenInput) {
                emailCodeHiddenInput.value = getEnteredEmailCode();
            }
            emailCodeInputs[index + 1].focus();
        }
    });
});

// -------------------------------------------------------------
// NAVIGATION DANS LES ONGLETS ET SOUMISSIONS DE FORMULAIRES
// -------------------------------------------------------------
const selectTab = (tabId) => {
    tabButtons.forEach((button) => {
        const active = button.dataset.tab === tabId;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
    });
    tabPanels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === tabId));
};

tabButtons.forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.tab)));

// Sauvegarde du profil principal
profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser) {
        setFeedback("Aucune session active. Veuillez vous reconnecter.", "error");
        return;
    }

    setFeedback("Enregistrement en cours...", "info");

    try {
        let photoURL = null;

        if (avatarInput && avatarInput.files[0]) {
            const uploadResult = await api.uploadFile("avatar", avatarInput.files[0]);
            photoURL = uploadResult.key;
        }

        await api.patch(`/api/users/${currentUser.uid}`, {
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

// Enregistrement des préférences de l'onglet Emails (Newsletter)
saveEmailsBtn?.addEventListener("click", async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setFeedback("Enregistrement des préférences...", "info");

    try {
        await api.patch(`/api/users/${currentUser.uid}`, {
            newsletterEnabled: newsletterCheckbox ? newsletterCheckbox.checked : true
        });

        setFeedback("Préférences e-mails enregistrées !", "success");
        setTimeout(() => setFeedback("", ""), 4000);
    } catch (error) {
        console.error("Erreur enregistrement e-mails :", error);
        setFeedback("Erreur lors de la mise à jour des préférences.", "error");
    }
});

// Changement d'e-mail dans l'onglet Sécurité
emailForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser) {
        setFeedback("Aucune session active. Veuillez vous reconnecter.", "error");
        return;
    }

    const pending = readPendingEmailChange();

    if (pending && pending.stage === "code-verification") {
        const password = emailCurrentPasswordInput.value.trim() || pending.password;
        await validatePendingEmailCode(currentUser, password, pending);
        return;
    }

    if (pending && pending.stage === "awaiting-firebase-confirmation") {
        setFeedback("Un e-mail de confirmation a déjà été envoyé. Veuillez suivre le lien reçu par e-mail.", "info");
        return;
    }

    const newEmail = securityEmailInput.value.trim();
    const oldEmail = currentUser.email || "";
    const password = emailCurrentPasswordInput.value.trim();

    if (!newEmail || !newEmail.includes("@")) {
        setFeedback("Veuillez saisir une adresse e-mail valide.", "error");
        return;
    }

    if (newEmail.toLowerCase() === oldEmail.toLowerCase()) {
        setFeedback("L'adresse e-mail est identique à l'adresse actuelle.", "error");
        return;
    }

    if (!password) {
        setFeedback("Veuillez saisir votre mot de passe actuel pour valider la modification.", "error");
        return;
    }

    try {
        setFeedback("Vérification et envoi du code...", "info");

        await reauthenticateCurrentUser(password);
        const verificationCode = generateVerificationCode();

        persistPendingEmailChange({
            uid: currentUser.uid,
            oldEmail,
            newEmail,
            code: verificationCode,
            password,
            stage: "code-verification",
            expiresAt: Date.now() + 10 * 60 * 1000
        });

        await sendVerificationCodeEmail(newEmail, verificationCode);
        setEmailVerificationUI();

        setFeedback("Un code de vérification a été envoyé à votre nouvelle adresse e-mail. Saisissez-le ci-dessous.", "success");
    } catch (error) {
        console.error("Erreur modification e-mail :", error);
        clearPendingEmailChange();
        setEmailVerificationUI();
        setFeedback(getUserFriendlyError(error), "error");
    }
});

const passwordFeedbackEl = document.getElementById("password-feedback");

const setPasswordFeedback = (message = "", type = "") => {
    if (!passwordFeedbackEl) return;
    passwordFeedbackEl.textContent = message;
    passwordFeedbackEl.className = "account-feedback feedback";
    if (type) passwordFeedbackEl.classList.add(type);
};

passwordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
        setPasswordFeedback("Aucune session active. Veuillez vous reconnecter.", "error");
        return;
    }

    const currentPassword = currentPasswordInput.value.trim();
    const newPassword = newPasswordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordFeedback("Veuillez remplir tous les champs de mot de passe.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        setPasswordFeedback("Les nouveaux mots de passe ne correspondent pas.", "error");
        return;
    }

    if (!isStrongPassword(newPassword)) {
        setPasswordFeedback("Le mot de passe doit contenir au moins 6 caractères.", "error");
        return;
    }

    try {
        setPasswordFeedback("Modification du mot de passe en cours...", "info");

        await reauthenticateCurrentUser(currentPassword);
        await updatePassword(currentUser, newPassword);

        const passwordMessage = `Le mot de passe de ton compte Morgann Music CP (<strong>${currentUser.email}</strong>) a été modifié avec succès.<br><br>Si tu n'es pas à l'origine de ce changement, réinitialise ton mot de passe immédiatement.`;
        const htmlContent = generateEmailTemplate("Alerte de sécurité : Mot de passe modifié", passwordMessage);

        await sendSecurityEmailViaFunctions(currentUser.email, "Modification de votre mot de passe", htmlContent);

        currentPasswordInput.value = "";
        newPasswordInput.value = "";
        confirmPasswordInput.value = "";

        setPasswordFeedback("Mot de passe modifié avec succès ! Un e-mail d'alerte vous a été envoyé.", "success");
        setTimeout(() => setPasswordFeedback("", ""), 6000);
    } catch (error) {
        console.error("Erreur modification mot de passe :", error);
        setPasswordFeedback(getUserFriendlyError(error), "error");
    }
});

// -------------------------------------------------------------
// LISTENER D'AUTHENTIFICATION FIREBASE & SYNCHRO D1
// -------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    const pendingEmailChange = readPendingEmailChange();
    if (pendingEmailChange && pendingEmailChange.uid !== user.uid) {
        clearPendingEmailChange();
    }

    if (userUid) userUid.textContent = user.uid || "Non disponible";

    const currentPending = readPendingEmailChange();

    if (currentPending && currentPending.stage === "awaiting-firebase-confirmation") {
        if (user.email && user.email.toLowerCase() === currentPending.newEmail.toLowerCase()) {
            try {
                await api.patch(`/api/users/${user.uid}`, { email: currentPending.newEmail });
                await sendEmailChangeConfirmationEmails(currentPending.oldEmail, currentPending.newEmail);
                clearPendingEmailChange();

                if (securityEmailInput) securityEmailInput.value = user.email;
                setEmailVerificationUI();
                setFeedback("Votre adresse e-mail a été modifiée avec succès !", "success");
            } catch (err) {
                console.error("Erreur de synchronisation D1 après confirmation email Firebase :", err);
                setFeedback("Adresse e-mail modifiée dans Firebase, mais la synchronisation D1 a échoué.", "error");
            }
        } else {
            if (securityEmailInput) securityEmailInput.value = user.email || "";
            setEmailVerificationUI();
        }
    } else {
        if (securityEmailInput) securityEmailInput.value = user.email || "";
        setEmailVerificationUI();
    }

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

            if (userPlanEl) {
                const rawPlan = data.plan_name || data.planName || "Gratuit";
                userPlanEl.textContent = rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1);
            }

            if (subscriptionStatusEl) {
                const status = data.subscription_status || data.subscriptionStatus;
                if (status === "active") {
                    subscriptionStatusEl.textContent = "Actif 🟢";
                } else if (!status || status === "NULL" || status === "canceled") {
                    subscriptionStatusEl.textContent = "Inactif 🔴";
                } else {
                    subscriptionStatusEl.textContent = status;
                }
            }

            if (newsletterCheckbox) {
                newsletterCheckbox.checked = data.newsletterEnabled !== false && data.newsletter_enabled !== 0;
            }

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

        // Chargement automatique des documents
        await loadUserDocuments(user.uid);

    } catch (err) {
        console.error("Erreur lors de la récupération des infos D1 :", err);
    }
});

logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login.html";
});