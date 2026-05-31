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

    if (!planId || !plans[planId]) {
        title.textContent = "Choisissez votre plan";
        planDisplay.textContent = "Sélectionnez l'offre qui vous correspond";
        showPlanSelection(userId);
    } else {
        const current = plans[planId];
        title.textContent = "Paiement";
        planDisplay.textContent = `${current.name} — ${current.display} / mois`;
        initialize(userId);
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
            gsap.to("#plan-selection", { opacity: 0, duration: 0.3, onComplete: () => {
                container.classList.add("is-hidden");
                const current = plans[planId];
                document.getElementById("page-title").textContent = "Paiement";
                document.getElementById("plan-display").textContent = `${current.name} — ${current.display} / mois`;
                initialize(userId);
            }});
        };
        list.appendChild(div);
    });
}

async function initialize(userId) {
    try {
        const currentPlan = plans[planId];
        document.getElementById("payment-form").classList.remove("is-hidden");

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
        messageText.textContent = "";
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