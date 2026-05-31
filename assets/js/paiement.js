import { auth } from "/assets/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const stripe = Stripe("pk_test_51Sqie3FhaOYWNNbbkEzm71AEisKngfDFIAB7N4a5g2gOQpGFxaGRDAK19py9fE49NNPLSXQwfLbsoCgT4MpMvGpM00TkvPHrpm");

const params = new URLSearchParams(window.location.search);
let planId = params.get("plan");

// Configuration des prix (en centimes)
const plans = {
    "under18": { name: "Future Légende", amount: 99, display: "0,99€" },
    "starter": { name: "Starter", amount: 299, display: "2,99€" },
    "pro": { name: "Pro", amount: 399, display: "3,99€" },
    "label": { name: "Label", amount: 599, display: "5,99€" }
};

let elements;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// New elements for identity verification
const IDENTITY_VERIFICATION_WORKER_URL = "https://identity.litual.morgannmusic.uk";
const identityVerificationSection = document.getElementById("identity-verification-section");
const idUploadInput = document.getElementById("id-upload-input");
const imagePreview = document.getElementById("image-preview");
const verifyIdButton = document.getElementById("verify-id-button");
const verifyButtonText = document.getElementById("verify-button-text");
const verifySpinner = document.getElementById("verify-spinner");
const imagePreviewPlaceholder = document.getElementById("image-preview-placeholder");
const idVerificationMessage = document.getElementById("id-verification-message");
const openCameraBtn = document.getElementById("open-camera-btn");
const cameraUi = document.getElementById("camera-ui");
const cameraStream = document.getElementById("camera-stream");
const capturePhotoBtn = document.getElementById("capture-photo-btn");
let activeStream = null;
let verifiedImageBlob = null;

// Denied modal elements
const deniedModal = document.getElementById("denied-modal");
const deniedModalMessage = document.getElementById("denied-modal-message");
const deniedModalCloseBtn = document.getElementById("denied-modal-close-btn");
const deniedModalViewPlansBtn = document.getElementById("denied-modal-view-plans-btn");

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login.html?redirect=paiement&plan=" + planId;
        return;
    }

    initPage(user.uid);
});

function initPage(userId) {
    const title = document.getElementById("page-title");
    const planDisplay = document.getElementById("plan-display");
    const paymentRecap = document.getElementById("payment-recap");

    if (!planId || !plans[planId]) {
        title.textContent = "Choisissez votre plan";
        planDisplay.textContent = "Sélectionnez l'offre qui vous correspond";
        if (paymentRecap) paymentRecap.classList.add("is-hidden");
        showPlanSelection(userId);
    } else {
        const current = plans[planId];
        title.textContent = "Paiement";
        planDisplay.textContent = `${current.name} — ${current.display} / mois`;
        if (paymentRecap) paymentRecap.classList.remove("is-hidden");

        if (planId === "under18") {
            startIdentityVerification(userId);
        } else {
            initializeStripe(userId);
        }
    }

    if (!reducedMotion) {
        gsap.from("#main-card", { opacity: 0, y: 30, duration: 0.8, ease: "power2.out" });
    }
}

function showPlanSelection(userId) {
    const container = document.getElementById("plan-selection");
    const list = document.getElementById("plans-list");
    container.classList.remove("is-hidden");

    Object.entries(plans).forEach(([id, data]) => {
        const div = document.createElement("div");
        div.className = "plan-choice-item";
        div.innerHTML = `<div>${data.name}</div><span>${data.display}</span>`;
        div.onclick = () => {
            planId = id;
            const paymentRecap = document.getElementById("payment-recap");
            gsap.to("#main-card", { opacity: 0, duration: 0.3, onComplete: () => {
                const current = plans[planId];
                container.classList.add("is-hidden");
                if (paymentRecap) paymentRecap.classList.remove("is-hidden");
                document.getElementById("page-title").textContent = "Paiement";
                document.getElementById("plan-display").textContent = `${current.name} — ${current.display} / mois`;

                if (planId === "under18") {
                    startIdentityVerification(userId);
                } else {
                    initializeStripe(userId);
                }
                gsap.to("#main-card", { opacity: 1, duration: 0.3 });
            }});
        };
        list.appendChild(div);
    });
}

async function initializeStripe(userId) {
    try {
        const currentPlan = plans[planId];
        document.getElementById("payment-form").classList.remove("is-hidden");
        if (identityVerificationSection) identityVerificationSection.classList.add("is-hidden"); // Ensure identity section is hidden

        // 1. Appel au Worker pour créer le PaymentIntent
        const response = await fetch("https://pay.mm-cp.uk/", { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount: currentPlan.amount,
                planName: currentPlan.name,
                planId: planId,
                userId: userId
            }),
        });

        const { clientSecret, error } = await response.json();
        if (error) throw new Error(error);

        // 2. Initialisation des éléments Stripe
        // L'apparence 'flat' s'intègre bien au design épuré
        elements = stripe.elements({ 
            clientSecret, 
            appearance: { theme: 'flat', variables: { colorPrimary: '#FC8FB0' } } 
        });
        const paymentElement = elements.create("payment");
        paymentElement.mount("#payment-element");

        if (!reducedMotion) {
            gsap.from("#payment-form", { opacity: 0, scale: 0.95, duration: 0.5 });
        }

    } catch (e) {
        console.error(e);
        showMessage("Erreur lors de l'initialisation du paiement.");
    }
}

/**
 * Met à jour visuellement une étape de vérification
 */
function updateStepUI(stepName, status) {
    const stepEl = document.querySelector(`.step[data-step="${stepName}"]`);
    if (!stepEl) return;
    stepEl.className = `step ${status}`; // status: 'loading', 'done', 'error'
}

/**
 * Affiche un message de feedback pour la vérification d'identité.
 * @param {string} message - Le message à afficher.
 * @param {'success'|'error'|'info'|''} type - Le type de message pour le style.
 */
function setIdVerificationFeedback(message = "", type = "") {
    if (idVerificationMessage) idVerificationMessage.className = type;
    if (idVerificationMessage && typeof marked !== "undefined") {
        idVerificationMessage.innerHTML = DOMPurify.sanitize(marked.parse(message));
    } else if (idVerificationMessage) {
        idVerificationMessage.textContent = message;
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function startIdentityVerification(userId) {
    document.getElementById("payment-form").classList.add("is-hidden"); // Hide payment form initially
    if (identityVerificationSection) identityVerificationSection.classList.remove("is-hidden");

    if (idUploadInput) idUploadInput.addEventListener("change", (event) => {
        if (activeStream) {
            activeStream.getTracks().forEach(track => track.stop());
            activeStream = null;
            cameraUi.classList.add("is-hidden");
            imagePreview.classList.remove("is-hidden");
        }
        handleImageUpload(event);
    });

    if (verifyIdButton) verifyIdButton.addEventListener("click", () => submitIdentityForVerification(userId));

    if (openCameraBtn) openCameraBtn.addEventListener("click", async () => {
        try {
            activeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            cameraStream.srcObject = activeStream;
            cameraUi.classList.remove("is-hidden");
            imagePreview.classList.add("is-hidden");
            setIdVerificationFeedback("Cadrez votre document et prenez la photo.", "info");
        } catch (err) {
            setIdVerificationFeedback("Accès caméra refusé ou non disponible.", "error");
        }
    });

    if (capturePhotoBtn) capturePhotoBtn.addEventListener("click", () => {
        if (!activeStream) return;
        const canvas = document.createElement('canvas');
        canvas.width = cameraStream.videoWidth;
        canvas.height = cameraStream.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(cameraStream, 0, 0);
        
        canvas.toBlob((blob) => {
            verifiedImageBlob = blob;
            if (imagePreview) {
                imagePreview.innerHTML = `<img src="${URL.createObjectURL(blob)}" style="max-width:100%; height:100%; object-fit: cover;">`;
                imagePreview.classList.remove("is-hidden");
            }
            if (imagePreviewPlaceholder) imagePreviewPlaceholder.classList.add("is-hidden");
            
            activeStream.getTracks().forEach(track => track.stop());
            activeStream = null;
            cameraUi.classList.add("is-hidden");
            
            setIdVerificationFeedback("Photo capturée. Vous pouvez lancer la vérification.", "info");
            if (verifyIdButton) verifyIdButton.disabled = false;
        }, 'image/jpeg', 0.8);
    });

    if (!reducedMotion && identityVerificationSection) {
        gsap.from(identityVerificationSection, { opacity: 0, y: 30, duration: 0.8, ease: "power2.out" });
    }
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        if (imagePreview) imagePreview.innerHTML = "";
        if (imagePreviewPlaceholder) imagePreviewPlaceholder.classList.remove("is-hidden"); // Afficher le placeholder
        if (verifyIdButton) verifyIdButton.disabled = true;
        verifiedImageBlob = null;
        return;
    }

    setIdVerificationFeedback("Traitement de l'image...", "info");
    if (verifyIdButton) verifyIdButton.disabled = true;

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const MAX_SIZE = 1024; // Max width/height for compression
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    // On stocke le blob, la conversion base64 sera faite lors du clic sur le bouton
                    verifiedImageBlob = blob;
                    if (imagePreview) imagePreview.innerHTML = `<img src="${URL.createObjectURL(blob)}" style="max-width:100%; height:100%; object-fit: cover;">`;
                    if (imagePreviewPlaceholder) imagePreviewPlaceholder.classList.add("is-hidden");
                    setIdVerificationFeedback("Document chargé. Cliquez sur 'Lancer la vérification'.", "info");
                    if (verifyIdButton) verifyIdButton.disabled = false;
                }, 'image/jpeg', 0.8); // 0.8 quality for JPEG
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error("Error processing image:", error);
        setIdVerificationFeedback("Erreur lors du traitement de l'image.", "error");
        verifiedImageBlob = null;
    }
}

async function submitIdentityForVerification(userId) {
    try {
        if (!verifiedImageBlob) return;
        
        setIdVerificationFeedback("Démarrage du processus...", "info");
        if (verifyIdButton) verifyIdButton.disabled = true;
        if (verifySpinner) verifySpinner.classList.remove("is-hidden");

        // --- ÉTAPE 1 : CONVERSION ---
        updateStepUI('conversion', 'loading');
        const base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(verifiedImageBlob);
        });
        await sleep(1000);
        updateStepUI('conversion', 'done');

        // --- ÉTAPE 2 : COMPRESSION ---
        updateStepUI('compression', 'loading');
        await sleep(1000); // Déjà fait lors de handleImageUpload mais on montre l'étape
        updateStepUI('compression', 'done');

        // --- ÉTAPE 3 : ENVOI ---
        updateStepUI('upload', 'loading');
        const payload = { image_base64: base64Data, customer_email: userId };
        const startTime = Date.now();
        
        const response = await fetch(IDENTITY_VERIFICATION_WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        
        // On s'assure que l'étape "Envoi" dure au moins 1s
        const elapsed = Date.now() - startTime;
        if (elapsed < 1000) await sleep(1000 - elapsed);
        updateStepUI('upload', 'done');

        // --- ÉTAPE 4 : VÉRIFICATION (Analyse IA) ---
        updateStepUI('verification', 'loading');
        const result = await response.json();
        await sleep(1200); // On laisse le temps de voir l'analyse

        if (response.ok && result.status === "success") {
            updateStepUI('verification', 'done');
            
            // --- ÉTAPE 5 : SUPPRESSION ---
            updateStepUI('deletion', 'loading');
            await sleep(1000);
            updateStepUI('deletion', 'done');

            setIdVerificationFeedback(result.message || "Identité confirmée.", "success");
            
            await sleep(1500); // Pause finale pour lire le message de succès
            
            gsap.to(identityVerificationSection, { opacity: 0, y: -20, duration: 0.5, onComplete: () => {
                identityVerificationSection.classList.add("is-hidden");
                document.getElementById("payment-form").classList.remove("is-hidden");
                initializeStripe(userId);
            }});
        } else {
            updateStepUI('verification', 'error');
            setIdVerificationFeedback(result.message, "error");
            if (verifyIdButton) verifyIdButton.disabled = false;
            if (verifySpinner) verifySpinner.classList.add("is-hidden");
        }
    } catch (error) {
        console.error("Error during identity verification:", error);
        updateStepUI('upload', 'error');
        setIdVerificationFeedback("Erreur de communication avec le service de vérification.", "error");
        if (verifyIdButton) verifyIdButton.disabled = false;
        if (verifySpinner) verifySpinner.classList.add("is-hidden");
    }
}

const form = document.getElementById("payment-form");
form.addEventListener("submit", handleSubmit);

async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
            // Page de retour après validation 3DSecure
            return_url: `${window.location.origin}/account.html?status=success&plan=${planId}`,
        },
    });

    // Ce code ne s'exécutera que s'il y a une erreur immédiate (ex: carte refusée)
    if (error.type === "card_error" || error.type === "validation_error") {
        showMessage(error.message);
    } else {
        showMessage("Une erreur inattendue est survenue.");
    }

    setLoading(false);
}

function showMessage(messageText) {
    const messageContainer = document.querySelector("#payment-message");
    messageContainer.classList.remove("is-hidden");
    messageContainer.textContent = messageText;

    setTimeout(() => {
        messageContainer.classList.add("is-hidden");
        messageContainer.textContent = ""; // Correction: vider le contenu du conteneur
    }, 4000);
}

function setLoading(isLoading) {
    if (isLoading) {
        document.querySelector("#submit").disabled = true;
        document.querySelector("#button-text").textContent = "Traitement...";
    } else {
        document.querySelector("#submit").disabled = false;
        document.querySelector("#button-text").textContent = "Payer maintenant";
    }
}