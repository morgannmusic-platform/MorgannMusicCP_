import {
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "/assets/js/firebase.js";
import { api } from "/assets/js/api.js";

const form = document.getElementById("login-form");
const feedback = document.getElementById("feedback");
const googleBtn = document.getElementById("google-login-btn");
const credentialsGroup = document.getElementById("credentials-group");
const totpGroup = document.getElementById("totp-group");
const totpInput = document.getElementById("totp-code");
const submitBtn = document.getElementById("submit-btn");

let awaitingTotp = false;
let cachedEmail = "";
let cachedPassword = "";

const getSessionSecurityKey = (uid) => `mmcp_security_login_${uid || "unknown"}`;

const sendSecurityAlertEmail = async (email, firstName = "Artiste", reason = "connexion") => {
    try {
        const securityHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerte de sécurité | Morgann Music CP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #EAFFC6; font-family: 'Segoe UI', Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #EAFFC6; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 0 0 40px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FC8FB0; text-align: center;">
          <tr>
            <td style="padding: 16px 20px;">
              <a href="https://mm-cp.uk/portail/" style="color: #EAFFC6; text-decoration: none; font-weight: 700; font-size: 15px; margin-right: 25px;">Portail</a>
              <a href="https://mm-cp.uk/" style="color: #EAFFC6; text-decoration: none; font-weight: 700; font-size: 15px;">Accueil</a>
            </td>
          </tr>
        </table>
        <table border="0" cellpadding="0" cellspacing="0" width="90%" style="max-width: 580px; margin-top: 30px; background-color: #f8ffe7; border-radius: 36px; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15); border: 1px solid #e1f5be;">
          <tr>
            <td style="padding: 35px 30px; text-align: left;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://mm-cp.uk/assets/img/icons/sombre.png" alt="Logo MMCP" width="90" height="auto" style="display: block; margin: 0 auto; border: 0; width: 90px; outline: none; text-decoration: none;">
              </div>
              <h1 style="color: #2c3e10; font-size: 24px; font-weight: 800; margin: 0 0 10px 0; text-align: center; font-family: sans-serif;">Alerte de sécurité 🔒</h1>
              <p style="color: #556b2f; font-size: 15px; margin: 0 0 25px 0; text-align: center; font-weight: 500; font-family: sans-serif;">Une nouvelle connexion a été détectée sur ton compte.</p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 24px; border: 1px solid #e0f0c0; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="color: #FC8FB0; font-size: 17px; margin: 0 0 12px 0; font-weight: 800; font-family: sans-serif;">Est-ce bien toi ?</h2>
                    <p style="color: #3e2837; font-size: 14px; margin: 0 0 15px 0; line-height: 1.6; font-family: sans-serif;">
                      Si tu es à l'origine de cette connexion, tu peux ignorer cet e-mail. Dans le cas contraire, nous te conseillons de modifier ton mot de passe immédiatement depuis ton espace personnel.
                    </p>
                    <div style="text-align: center; margin-top: 25px;">
                      <a href="https://mm-cp.uk/account.html" style="display: inline-block; background-color: #FC8FB0; color: #EAFFC6; text-decoration: none; padding: 12px 30px; border-radius: 50px; font-weight: 700; font-size: 14px; font-family: sans-serif;">Gérer mon compte</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table border="0" cellpadding="0" cellspacing="0" width="90%" style="max-width: 580px; margin-top: 20px; text-align: center;">
          <tr>
            <td style="color: #789048; font-size: 12px; line-height: 1.6; padding: 10px; font-family: sans-serif;">
              <p style="margin: 0 0 4px 0;">© Morgann Music CP — Tous droits réservés.</p>
              <p style="margin: 0;">Ceci est un message automatique de sécurité.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const result = await api.post("/api/send-email", {
            toEmail: email,
            subject: "Alerte de sécurité : Nouvelle connexion détectée",
            htmlContent: securityHtml,
            senderEmail: "notifications@mm-cp.uk",
            replyToEmail: "support@mm-cp.uk"
        });

        console.log(`Sécurité ${reason} envoyée`, { email, result });
    } catch (error) {
        console.error("Échec de l'envoi de l'e-mail d'alerte de sécurité :", error);
    }
};

const maybeSendLoginSecurityAlert = async (user, reason = "connexion") => {
    if (!user || !user.email) return;

    const key = getSessionSecurityKey(user.uid);
    if (sessionStorage.getItem(key)) {
        return;
    }

    let firstName = "Artiste";
    try {
        const userData = await api.get(`/api/users/${user.uid}`);
        if (userData?.firstName) firstName = userData.firstName;
    } catch (err) {
        console.warn("Impossible de récupérer le prénom pour l'alerte sécurité:", err);
    }

    sessionStorage.setItem(key, "1");
    await sendSecurityAlertEmail(user.email, firstName, reason);
};

onAuthStateChanged(auth, async (user) => {
    if (user && !awaitingTotp) {
        await maybeSendLoginSecurityAlert(user, "connexion");
        window.location.href = "/account.html";
    }
});

form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    feedback.textContent = "";
    feedback.className = "feedback";

    const email = form.email.value.trim();
    const password = form.password.value;
    const totpCode = totpInput?.value.trim();

    try {
        if (!awaitingTotp) {
            if (!email || !password) {
                throw new Error("Veuillez remplir tous les champs.");
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            let isTotpEnabled = false;
            let firstName = "Artiste";
            try {
                const userData = await api.get(`/api/users/${user.uid}`);
                if (userData) {
                    if (userData.authMethod === "totp" || userData.totpEnabled === true) {
                        isTotpEnabled = true;
                    }
                    if (userData.firstName) {
                        firstName = userData.firstName;
                    }
                }
            } catch (err) {
                console.error("Erreur récupération utilisateur D1:", err);
            }

            if (isTotpEnabled) {
                awaitingTotp = true;
                cachedEmail = email;
                cachedPassword = password;

                credentialsGroup.classList.add("is-hidden");
                totpGroup.classList.remove("is-hidden");
                totpInput.setAttribute("required", "required");
                submitBtn.textContent = "Vérifier le code";

                feedback.textContent = "Entrez le code de votre application d'authentification.";
                feedback.classList.add("success");
                return;
            }

            // Envoi de l'alerte de sécurité (connexion directe validée)
            await maybeSendLoginSecurityAlert(user, "connexion");

            feedback.textContent = "Connexion réussie. Redirection...";
            feedback.classList.add("success");
            window.location.href = "/account.html";

        } else {
            if (!totpCode || totpCode.length !== 6) {
                throw new Error("Veuillez entrer un code à 6 chiffres valide.");
            }

            let firstName = "Artiste";
            try {
                const currentUser = auth.currentUser;
                if (currentUser) {
                    const userData = await api.get(`/api/users/${currentUser.uid}`);
                    if (userData?.firstName) firstName = userData.firstName;
                }
            } catch (err) {
                console.error("Erreur récupération prénom:", err);
            }

            // Envoi de l'alerte de sécurité après validation TOTP
            const targetEmail = auth.currentUser?.email || cachedEmail;
            if (targetEmail) {
                const key = getSessionSecurityKey(auth.currentUser?.uid || "unknown");
                if (!sessionStorage.getItem(key)) {
                    sessionStorage.setItem(key, "1");
                    await sendSecurityAlertEmail(targetEmail, firstName, "connexion");
                }
            }

            feedback.textContent = "Connexion réussie. Redirection...";
            feedback.classList.add("success");
            window.location.href = "/account.html";
        }

    } catch (error) {
        feedback.textContent = error.message || "Email, mot de passe ou code invalide.";
        feedback.classList.add("error");
    }
});

googleBtn?.addEventListener("click", async () => {
    feedback.textContent = "";
    feedback.className = "feedback";
    const provider = new GoogleAuthProvider();

    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        let firstName = "Artiste";
        try {
            const userData = await api.get(`/api/users/${user.uid}`);
            if (userData?.firstName) {
                firstName = userData.firstName;
            } else if (user.displayName) {
                firstName = user.displayName.split(" ")[0];
            }
        } catch (err) {
            if (user.displayName) firstName = user.displayName.split(" ")[0];
        }

        if (user.email) {
            await maybeSendLoginSecurityAlert(user, "connexion-google");
        }

        feedback.textContent = "Connexion Google réussie. Redirection...";
        feedback.classList.add("success");
        window.location.href = "/account.html";
    } catch (error) {
        feedback.textContent = "Échec de la connexion Google.";
        feedback.classList.add("error");
    }
});