import { GoogleAuthProvider, signInWithPopup } from 
"https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";


function updateNavbar() {
  const navbarContainer = document.getElementById("navbar-container");
  if (!navbarContainer) return;

  fetch("navbar.html")
    .then((res) => res.text())
    .then((html) => {
      navbarContainer.innerHTML = html;

      const navbar = document.getElementById("navbar");
      if (navbar) {
        window.addEventListener("scroll", () => {
          if (window.scrollY > 50) navbar.classList.add("scrolled");
          else navbar.classList.remove("scrolled");
        });
      }

      const menuToggle = document.getElementById("menu-toggle");
      const navLinks = document.getElementById("nav-links");
      if (menuToggle && navLinks) {
        menuToggle.addEventListener("click", () => {
          navLinks.classList.toggle("active");
        });
      }

      const avatarContainer = document.getElementById("avatar-container");
      const dropdown = document.getElementById("user-dropdown");

      if (avatarContainer && dropdown) {
        avatarContainer.addEventListener("click", (e) => {
          e.stopPropagation();
          dropdown.style.display =
            dropdown.style.display === "flex" ? "none" : "flex";
        });

        document.addEventListener("click", () => {
          dropdown.style.display = "none";
        });
      }

      const googleBtn = document.getElementById("google-login");

if (googleBtn) {
  googleBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);

      console.log("Google login OK", result.user);

      const user = result.user;

// On prépare les données pour Brevo
const fullName = user.displayName || "";
const nameParts = fullName.split(" ");
const prenom = nameParts[0] || "";
const nom = nameParts.slice(1).join(" ") || "";

// On envoie les infos au "Pont" Make
fetch("https://hook.eu1.make.com/ipq63kzsudkmk40qt9ynzd7au17e11la", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: user.email,
    nom: nom,
    prenom: prenom,
    source: "Morgann Music CP"
  })
}).catch(err => console.error("Erreur synchro", err));


      localStorage.setItem("mmcp_logged_in", "1");

      // Si ouvert en pop-up, notifier le parent puis fermer
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage('register-success', '*');
        // Tentative de fermeture du pop-up
        window.close();
        setTimeout(() => {
          if (!window.closed) {
            alert("Vous pouvez fermer cette fenêtre manuellement et vous connecter : l'inscription est terminée.");
          }
        }, 700);
      } else {
        window.location.href = "index.html";
      }
    } catch (err) {
      console.error("Google login error", err);
      alert(err.message);
    }
  });
}

// SORTI DU BLOC GOOGLE POUR QUE ÇA FONCTIONNE :
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
      const { signInWithEmailAndPassword, getAuth } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js');
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem("mmcp_logged_in", "1");
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage('register-success', '*');
        window.close();
      } else {
        window.location.href = "index.html";
      }
    } catch (err) {
      alert("Erreur de connexion : " + err.message);
    }
  });
}

if (user && user.photoURL) {
  userAvatar.src = user.photoURL;
}


      const userMenu = document.getElementById("user-menu");
      const isLoggedIn = localStorage.getItem("mmcp_logged_in") === "1";
      if (userMenu) userMenu.style.display = isLoggedIn ? "inline" : "none";

      const logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
          e.preventDefault();
          localStorage.removeItem("mmcp_logged_in");
          window.location.href = "login.html";
        });
      }
    })
    .catch((err) => console.error(err));
}

updateNavbar();
