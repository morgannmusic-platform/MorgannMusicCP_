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

// Force le remplissage du reste du formulaire après la connexion Google
const forceProfileCompletion = (user) => {
    googleUserCredential = user;
    isGoogleRegistration = true;

    const displayName = user.displayName || "";
    const parts = displayName.split(" ");
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";

    const lastNameInput = document.getElementById("last-name");
    const firstNameInput = document.getElementById("first-name");
    const emailInput = document.getElementById("email");

    if (lastNameInput && !lastNameInput.value) lastNameInput.value = lastName;
    if (firstNameInput && !firstNameInput.value) firstNameInput.value = firstName;
    if (emailInput) {
        emailInput.value = user.email || "";
        emailInput.setAttribute("readonly", "readonly"); // On bloque l'email pour éviter qu'il soit modifié
    }

    // On cache les champs de mot de passe et on retire le "required"
    passwordAuthFields?.classList.add("is-hidden");
    const passwordInputs = passwordAuthFields?.querySelectorAll("input");
    passwordInputs?.forEach(i => i.removeAttribute("required"));

    setFeedback("Compte Google associé ! Merci de remplir les informations manquantes.", "success");

    // On garde l'utilisateur à l'étape 0 pour remplir le nom d'artiste / etc.
    currentStep = 0;
    updateStepUI();
};

// Connexion / Initialisation Google
googleSigninBtn?.addEventListener("click", async () => {
    setFeedback();
    const provider = new GoogleAuthProvider();

    try {
        isGoogleRegistration = true;
        const result = await signInWithPopup(auth, provider);
        googleUserCredential = result.user;

        // On vérifie immédiatement si le compte D1 existe déjà
        try {
            const existingProfile = await api.get(`/api/users/${googleUserCredential.uid}`);
            if (existingProfile && existingProfile.uid) {
                // Le compte D1 existe, c'est juste un login
                setFeedback("Connexion réussie, redirection...", "success");
                window.location.href = "/account.html";
                return;
            }
        } catch (err) {
            // Le profil D1 n'existe pas encore
        }

        // Le profil n'est pas dans D1, on pré-remplit les infos et on bloque l'utilisateur
        forceProfileCompletion(googleUserCredential);

    } catch (error) {
        isGoogleRegistration = false;
        console.error("Erreur Google Popup:", error);
        setFeedback("Erreur lors de la connexion Google.", "error");
    }
});

// Bloquer la redirection automatique s'il manque le profil D1
onAuthStateChanged(auth, async (user) => {
    if (user && !isCreatingAccount && !isGoogleRegistration) {
        try {
            const existingProfile = await api.get(`/api/users/${user.uid}`);
            if (existingProfile && existingProfile.uid) {
                window.location.href = "/account.html";
            } else {
                forceProfileCompletion(user);
            }
        } catch (error) {
            forceProfileCompletion(user);
        }
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

// Enregistrement final dans D1
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

    let user = googleUserCredential || auth.currentUser;

    const originalSubmitText = submitButton.textContent;
    isCreatingAccount = true;
    submitButton.disabled = true;

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

                submitButton.textContent = "Création du compte...";
                const credential = await createUserWithEmailAndPassword(auth, email, password);
                user = credential.user;
            }
        }

        let finalPhotoUrl = user?.photoURL || null;

        // IMPORT DE L'AVATAR GOOGLE DANS CLOUDFLARE R2
        if (isGoogleRegistration && user.photoURL) {
            submitButton.textContent = "Import de l'avatar...";
            try {
                const token = await user.getIdToken();
                // On passe par la route proxy du Worker pour télécharger l'image sans bloquage CORS
                const imgResponse = await fetch(`https://api.worker.mm-cp.uk/api/proxy-download?url=${encodeURIComponent(user.photoURL)}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (imgResponse.ok) {
                    const blob = await imgResponse.blob();
                    // On convertit le blob en File avec le type correct (image/jpeg)
                    const file = new File([blob], `avatar_${user.uid}.jpg`, { type: blob.type || "image/jpeg" });

                    // On l'upload sur R2 avec le service centralisé de api.js
                    const uploadResult = await api.uploadFile("avatar", file);
                    if (uploadResult && uploadResult.success) {
                        finalPhotoUrl = uploadResult.url; // L'URL retournée par R2 remplace l'URL Google
                    }
                }
            } catch (imgErr) {
                console.error("Échec de la copie de la photo Google vers R2:", imgErr);
                // En cas d'erreur de transfert, finalPhotoUrl reste égal à user.photoURL en sécurité
            }
        }

        submitButton.textContent = "Enregistrement du profil...";

        // Envoi direct vers Cloudflare D1 via le client api.js centralisé
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
            photoURL: finalPhotoUrl
        });

        // E-mail de bienvenue via la fonction Cloudflare Pages
        try {
            const welcomeHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bienvenue | Morgann Music CP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #EAFFC6; font-family: 'Segoe UI', Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #EAFFC6;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="90%" style="max-width: 580px; background-color: #f8ffe7; border-radius: 36px; padding: 35px 30px;">
          <tr>
            <td style="text-align: center;">
              <h1 style="color: #2c3e10;">Bienvenue ${firstName} ! 🎵</h1>
              <p style="color: #556b2f;">Ton compte sur Morgann Music CP a bien été créé avec succès.</p>
              <a href="https://mm-cp.uk/account.html" style="display: inline-block; background-color: #FC8FB0; color: #EAFFC6; text-decoration: none; padding: 12px 30px; border-radius: 50px; font-weight: 700;">Accéder à mon compte</a>
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
            console.error("Erreur e-mail de bienvenue:", emailError);
        }

        setFeedback("Profil enregistré dans D1 avec succès !", "success");
        setTimeout(() => {
            window.location.href = "/account.html";
        }, 1200);

    } catch (error) {
        console.error("Erreur création profil D1:", error);
        setFeedback(`Erreur : ${error?.message || "Échec de l'enregistrement."}`, "error");
        isCreatingAccount = false;
        submitButton.disabled = false;
        submitButton.textContent = originalSubmitText;
    }
});

updateStepUI();