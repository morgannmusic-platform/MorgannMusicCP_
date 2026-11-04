import {
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "/assets/js/firebase.js";
import { api } from "/assets/js/api.js";

const form = document.getElementById("signin-form");
const feedback = document.getElementById("feedback");
const steps = Array.from(document.querySelectorAll(".form-step"));
const stepIndicator = document.getElementById("step-indicator");
const prevButton = document.getElementById("prev-step");
const nextButton = document.getElementById("next-step");
const submitButton = document.getElementById("submit-step");
const googleSigninBtn = document.getElementById("google-signin-btn");

const addressInput = document.getElementById("address");
const cityInput = document.getElementById("city");
const postalCodeInput = document.getElementById("postal-code");
const addressSuggestions = document.getElementById("address-suggestions");

const authMethodSelect = document.getElementById("auth-method");
const passwordAuthFields = document.getElementById("password-auth-fields");
const totpAuthFields = document.getElementById("totp-auth-fields");

let currentStep = 0;
let addressFeatures = [];
let addressSearchTimer = null;
let addressAbortController = null;
const addressCache = new Map();
let isCreatingAccount = false;
let isGoogleRegistration = false;
let googleUserCredential = null;

const roleCodeMap = {
    "1301": "admin",
    "0120": "testeur",
    "6421": "vip",
    "1758": "artiste"
};

const setFeedback = (message = "", type = "") => {
    feedback.textContent = message;
    feedback.className = "feedback";
    if (type) feedback.classList.add(type);
};

const updateStepUI = () => {
    steps.forEach((step, index) => {
        step.classList.toggle("is-hidden", index !== currentStep);
    });

    stepIndicator.textContent = `Étape ${currentStep + 1} sur ${steps.length}`;
    prevButton.disabled = currentStep === 0;

    const lastStep = currentStep === steps.length - 1;
    nextButton.classList.toggle("is-hidden", lastStep);
    submitButton.classList.toggle("is-hidden", !lastStep);

    if (typeof gsap !== "undefined") {
        gsap.fromTo(steps[currentStep], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" });
    }
};

// Gestion dynamique des champs selon la méthode choisie à l'Étape 3
authMethodSelect?.addEventListener("change", (e) => {
    const val = e.target.value;

    passwordAuthFields?.classList.toggle("is-hidden", val !== "password");
    totpAuthFields?.classList.toggle("is-hidden", val !== "totp");

    const passwordInputs = passwordAuthFields?.querySelectorAll("input");
    passwordInputs?.forEach(input => {
        if (val === "password" && !isGoogleRegistration) {
            input.setAttribute("required", "required");
        } else {
            input.removeAttribute("required");
        }
    });
});

const validateCurrentStep = () => {
    const activeStep = steps[currentStep];
    const inputs = Array.from(activeStep.querySelectorAll("input"));
    for (const input of inputs) {
        if (input.hasAttribute("required") && !input.checkValidity()) {
            input.reportValidity();
            return false;
        }
    }
    return true;
};

// Autocomplétion Adresse
const clearAddressSuggestions = () => {
    if (!addressSuggestions) return;
    addressSuggestions.innerHTML = "";
    addressSuggestions.classList.add("is-hidden");
};

const getStreetOnly = (props) => {
    if (!props) return "";
    if (props.name) return props.name;
    if (props.label) return props.label.split(",")[0].trim();
    return "";
};

const selectAddressFeature = (feature) => {
    const props = feature?.properties || {};
    const street = getStreetOnly(props);
    if (addressInput && street) addressInput.value = street;
    if (cityInput && props.city) cityInput.value = props.city;
    if (postalCodeInput && props.postcode) postalCodeInput.value = props.postcode;
    clearAddressSuggestions();
};

const renderAddressSuggestions = (features) => {
    if (!addressSuggestions) return;
    addressSuggestions.innerHTML = "";

    const limited = features.slice(0, 6);
    if (limited.length === 0) {
        addressSuggestions.classList.add("is-hidden");
        return;
    }

    limited.forEach((feature, index) => {
        const props = feature.properties || {};
        const item = document.createElement("li");
        item.className = "address-item";
        item.setAttribute("role", "option");
        item.dataset.index = String(index);
        const street = getStreetOnly(props);
        const cityLine = [props.postcode, props.city].filter(Boolean).join(" ");
        item.textContent = cityLine ? `${street} — ${cityLine}` : (street || props.label || "Adresse");
        item.addEventListener("mousedown", (event) => {
            event.preventDefault();
            selectAddressFeature(feature);
        });
        addressSuggestions.appendChild(item);
    });

    addressSuggestions.classList.remove("is-hidden");
};

const fetchAddressSuggestions = async (query) => {
    if (currentStep !== 1) return;

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery || normalizedQuery.length < 3) {
        addressFeatures = [];
        clearAddressSuggestions();
        return;
    }

    if (addressCache.has(normalizedQuery)) {
        addressFeatures = addressCache.get(normalizedQuery);
        renderAddressSuggestions(addressFeatures);
        return;
    }

    if (addressAbortController) {
        addressAbortController.abort();
    }
    addressAbortController = new AbortController();

    try {
        const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(normalizedQuery)}&limit=6`;
        const response = await fetch(url, { signal: addressAbortController.signal });
        if (!response.ok) return;

        const data = await response.json();
        addressFeatures = Array.isArray(data.features) ? data.features : [];
        addressCache.set(normalizedQuery, addressFeatures);
        renderAddressSuggestions(addressFeatures);
    } catch (error) {
        if (error.name === "AbortError") return;
        addressFeatures = [];
        clearAddressSuggestions();
    }
};

addressInput?.addEventListener("input", () => {
    const value = addressInput.value.trim();
    clearTimeout(addressSearchTimer);
    addressSearchTimer = setTimeout(() => {
        fetchAddressSuggestions(value);
    }, 300);
});

addressInput?.addEventListener("blur", () => {
    setTimeout(() => clearAddressSuggestions(), 120);
});

addressInput?.addEventListener("focus", () => {
    if (addressFeatures.length > 0 && addressInput.value.trim().length >= 3) {
        renderAddressSuggestions(addressFeatures);
    }
});

// Authentification / Inscription via Google
googleSigninBtn?.addEventListener("click", async () => {
    setFeedback();
    const provider = new GoogleAuthProvider();

    try {
        isGoogleRegistration = true;
        // 1. Inscription / Authentification uniquement dans Firebase Auth
        const result = await signInWithPopup(auth, provider);
        googleUserCredential = result.user;

        const displayName = googleUserCredential.displayName || "";
        const parts = displayName.split(" ");
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(" ") || "";

        const lastNameInput = document.getElementById("last-name");
        const firstNameInput = document.getElementById("first-name");
        const emailInput = document.getElementById("email");

        // Préremplissage automatique des données récupérées depuis Google
        if (lastNameInput) lastNameInput.value = lastName;
        if (firstNameInput) firstNameInput.value = firstName;
        if (emailInput) emailInput.value = googleUserCredential.email || "";

        passwordAuthFields?.classList.add("is-hidden");
        const passwordInputs = passwordAuthFields?.querySelectorAll("input");
        passwordInputs?.forEach(i => i.removeAttribute("required"));

        setFeedback("Compte Google associé ! Remplis maintenant tes informations d'artiste.", "success");

        // 2. Redirection vers les étapes suivantes du formulaire pour demander TOUTES les infos restantes
        currentStep = 1;
        updateStepUI();
    } catch (error) {
        isGoogleRegistration = false;
        setFeedback("Erreur lors de la connexion Google.", "error");
    }
});

onAuthStateChanged(auth, (user) => {
    if (user && !isCreatingAccount && !isGoogleRegistration) {
        window.location.href = "/account.html";
    }
});

nextButton?.addEventListener("click", () => {
    setFeedback();
    if (!validateCurrentStep()) return;
    if (currentStep < steps.length - 1) {
        currentStep += 1;
        updateStepUI();
    }
});

prevButton?.addEventListener("click", () => {
    setFeedback();
    if (currentStep > 0) {
        currentStep -= 1;
        updateStepUI();
    }
});

// Soumission finale du formulaire
form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback();

    if (!validateCurrentStep()) return;

    const authMethod = isGoogleRegistration ? "google" : (authMethodSelect?.value || "password");
    const email = document.getElementById("email").value.trim();
    const firstName = document.getElementById("first-name").value.trim();
    const lastName = document.getElementById("last-name").value.trim();
    const artistName = document.getElementById("artist-name").value.trim();
    const address = document.getElementById("address").value.trim();
    const city = document.getElementById("city").value.trim();
    const postalCode = document.getElementById("postal-code").value.trim();
    const iban = document.getElementById("iban").value.trim() || null;
    const roleCode = document.getElementById("role-code").value.trim();
    const role = roleCodeMap[roleCode] || "user";

    let user = googleUserCredential;

    const originalSubmitText = submitButton.textContent;
    isCreatingAccount = true;
    submitButton.disabled = true;
    submitButton.textContent = "Création...";

    try {
        if (!user) {
            if (authMethod === "password" || authMethod === "totp") {
                const password = document.getElementById("password").value;
                const passwordConfirm = document.getElementById("password-confirm").value;

                if (password !== passwordConfirm) {
                    throw new Error("Les mots de passe ne correspondent pas.");
                }
                if (password.length < 6) {
                    throw new Error("Le mot de passe doit faire au moins 6 caractères.");
                }

                const credential = await createUserWithEmailAndPassword(auth, email, password);
                user = credential.user;
            }
        }

        // 3. Enregistrement de TOUTES les informations saisies dans la base de données D1
        await api.put(`/api/users/${user.uid}`, {
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
            artistName,
            email,
            address,
            city,
            postalCode,
            iban,
            role,
            authMethod,
            photoURL: user.photoURL || null
        });

        // Envoi de l'e-mail de bienvenue avec le template HTML stylisé MMCP
        try {
            const welcomeHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue | Morgann Music CP</title>
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
              <h1 style="color: #2c3e10; font-size: 24px; font-weight: 800; margin: 0 0 10px 0; text-align: center; font-family: sans-serif;">Bienvenue ${firstName} ! 🎵</h1>
              <p style="color: #556b2f; font-size: 15px; margin: 0 0 25px 0; text-align: center; font-weight: 500; font-family: sans-serif;">Ton compte sur Morgann Music CP a bien été créé avec succès.</p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 24px; border: 1px solid #e0f0c0; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="color: #FC8FB0; font-size: 17px; margin: 0 0 12px 0; font-weight: 800; font-family: sans-serif;">Ton espace est prêt</h2>
                    <p style="color: #3e2837; font-size: 14px; margin: 0 0 15px 0; line-height: 1.6; font-family: sans-serif;">
                      Tu peux dès à présent te connecter à ton tableau de bord pour accéder à toutes les fonctionnalités de ton profil.
                    </p>
                    <div style="text-align: center; margin-top: 25px;">
                      <a href="https://mm-cp.uk/account.html" style="display: inline-block; background-color: #FC8FB0; color: #EAFFC6; text-decoration: none; padding: 12px 30px; border-radius: 50px; font-weight: 700; font-size: 14px; font-family: sans-serif;">Accéder à mon compte</a>
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
              <p style="margin: 0;">Cet e-mail a été envoyé suite à la création de ton compte.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

            await api.post("/api/send-email", {
                toEmail: email,
                subject: "Bienvenue chez Morgann Music CP !",
                htmlContent: welcomeHtml
            });
        } catch (emailError) {
            console.error("Échec de l'envoi de l'e-mail de bienvenue :", emailError);
        }

        setFeedback("Compte créé avec succès ! Redirection...", "success");
        window.location.href = "/account.html";
    } catch (error) {
        setFeedback(`Erreur : ${error?.message || "Vérifie tes informations."}`, "error");
        isCreatingAccount = false;
        submitButton.disabled = false;
        submitButton.textContent = originalSubmitText;
    }
});

updateStepUI();