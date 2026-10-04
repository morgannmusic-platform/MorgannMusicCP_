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
        formStatus.textContent = "Enregistrement dans la base D1...";

        try {
            await api.post("/api/messages", {
                email: email,
                message: message
            });

            formStatus.style.color = "#4ade80";
            formStatus.textContent = "Message enregistré avec succès dans D1 ! Nous vous répondrons rapidement.";
            contactForm.reset();
        } catch (error) {
            console.error("Erreur lors de l'enregistrement D1 :", error);
            formStatus.style.color = "#f87171";
            formStatus.textContent = "Une erreur est survenue. Veuillez réessayer ou utiliser nos e-mails.";
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Envoyer le message";
        }
    });
}
