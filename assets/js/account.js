import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "/assets/js/firebase.js";

const userEmail = document.getElementById("user-email");
const userUid = document.getElementById("user-uid");
const logoutBtn = document.getElementById("logout-btn");

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    userEmail.textContent = user.email || "Non disponible";
    userUid.textContent = user.uid || "Non disponible";
});

logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login.html";
});
