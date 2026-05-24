import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "/assets/js/firebase.js";

const form = document.getElementById("login-form");
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

    try {
        await signInWithEmailAndPassword(auth, email, password);
        feedback.textContent = "Connexion réussie. Redirection...";
        feedback.classList.add("success");
        window.location.href = "/account.html";
    } catch (error) {
        feedback.textContent = "Email ou mot de passe invalide.";
        feedback.classList.add("error");
    }
});
