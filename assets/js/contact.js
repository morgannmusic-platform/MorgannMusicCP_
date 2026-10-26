import { api } from "/assets/js/api.js";

const contactForm = document.getElementById("contact-form");
const formStatus = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-button");

if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("contact-email").value.trim();
        const message = document.getElementById("contact-message").value.trim();

        if (!email || !message) return;

        submitBtn.disabled = true;
        submitBtn.textContent = "Envoi en cours...";
        formStatus.style.color = "var(--text-secondary, #64748b)";
        formStatus.textContent = "Envoi du message...";

        try {
            await api.post("/api/messages", {
                email: email,
                message: message
            });

            formStatus.style.color = "#4ade80";
            formStatus.textContent = "Message envoyé ! Nous vous répondrons rapidement.";
            contactForm.reset();
        } catch (error) {
            console.error("Erreur lors de l'envoi :", error);
            formStatus.style.color = "#f87171";
            formStatus.textContent = "Une erreur est survenue. Veuillez réessayer.";
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Envoyer le message";
        }
    });
}