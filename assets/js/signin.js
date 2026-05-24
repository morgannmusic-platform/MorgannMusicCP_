import { createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "/assets/js/firebase.js";

const form = document.getElementById("signin-form");
const feedback = document.getElementById("feedback");

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "/account.html";
    }
});

form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    feedback.textContent = "";
    feedback.className = "feedback";

    const email = form.email.value.trim();
    const password = form.password.value;
    const passwordConfirm = form.password_confirm.value;

    if (password !== passwordConfirm) {
        feedback.textContent = "Les mots de passe ne correspondent pas.";
        feedback.classList.add("error");
        return;
    }

    if (password.length < 6) {
        feedback.textContent = "Le mot de passe doit contenir au moins 6 caractères.";
        feedback.classList.add("error");
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        feedback.textContent = "Compte créé. Redirection...";
        feedback.classList.add("success");
        window.location.href = "/account.html";
    } catch (error) {
        feedback.textContent = "Impossible de créer le compte (email peut-être déjà utilisé).";
        feedback.classList.add("error");
    }
});
