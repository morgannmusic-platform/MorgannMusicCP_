import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "/assets/js/firebase.js";

document.addEventListener("DOMContentLoaded", () => {
    const navbarContainer = document.getElementById("navbar");

    if (!navbarContainer) {
        console.warn("Element #navbar introuvable dans le DOM.");
        return;
    }

    const navbarPath = "/assets/navbars/accueil/navbar.html";

    fetch(navbarPath)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Erreur ${response.status}: Impossible de charger le fichier ${navbarPath}`);
            }
            return response.text();
        })
        .then((data) => {
            navbarContainer.innerHTML = data;

            const navAuth = navbarContainer.querySelector("#nav-auth");
            if (!navAuth) return;

            const animateNavbar = () => {
                if (typeof gsap !== "undefined") {
                    const tl = gsap.timeline();
                    tl.to(".navbar", {
                        opacity: 1,
                        y: 0,
                        duration: 0.6,
                        ease: "power2.out",
                        startAt: { y: -20, opacity: 0 }
                    });

                    tl.to([".nav-logo", ".nav-auth"], {
                        opacity: 1,
                        duration: 0.4,
                        ease: "power1.out"
                    }, "-=0.2");

                    tl.to(".nav-item", {
                        opacity: 1,
                        y: 0,
                        duration: 0.4,
                        stagger: 0.06,
                        ease: "power1.out",
                        startAt: { y: -5, opacity: 0 }
                    }, "-=0.25");
                } else {
                    const bar = navbarContainer.querySelector(".navbar");
                    if (bar) bar.style.opacity = "1";
                    navbarContainer.querySelectorAll(".nav-logo, .nav-auth, .nav-item").forEach((el) => {
                        el.style.opacity = "1";
                    });
                }
            };

            const renderDisconnected = () => {
                navAuth.innerHTML = `
                    <a class="auth-link" href="/login.html">Se connecter</a>
                    <a class="auth-link" href="/signin.html">S'inscrire</a>
                `;
            };

            const renderConnected = (user, isAdmin) => {
                const photo = user.photoURL || "/assets/img/photodeprofil/default-avatar.png";
                const adminItem = isAdmin
                    ? `<a href="/admin.html">Tableau de bord admin</a>`
                    : "";

                navAuth.innerHTML = `
                    <div class="profile-wrap">
                        <button class="profile-button" id="profile-button" aria-label="Ouvrir le menu profil">
                            <img src="${photo}" alt="Photo de profil">
                        </button>
                        <div class="profile-menu" id="profile-menu">
                            <a href="/dashboard.html">Tableau de bord</a>
                            <a href="/account.html">Espace compte</a>
                            ${adminItem}
                            <button type="button" class="danger" id="logout-button">Se deconnecter</button>
                        </div>
                    </div>
                `;

                const profileButton = navAuth.querySelector("#profile-button");
                const profileMenu = navAuth.querySelector("#profile-menu");
                const logoutButton = navAuth.querySelector("#logout-button");

                profileButton?.addEventListener("click", () => {
                    profileMenu?.classList.toggle("open");
                });

                document.addEventListener("click", (event) => {
                    const target = event.target;
                    if (!(target instanceof Node)) return;
                    if (!navAuth.contains(target)) {
                        profileMenu?.classList.remove("open");
                    }
                });

                logoutButton?.addEventListener("click", async () => {
                    await signOut(auth);
                    window.location.href = "/login.html";
                });
            };

            onAuthStateChanged(auth, async (user) => {
                if (!user) {
                    renderDisconnected();
                    return;
                }

                let isAdmin = false;
                try {
                    const tokenResult = await getIdTokenResult(user);
                    isAdmin = tokenResult?.claims?.role === "admin" || tokenResult?.claims?.admin === true;
                } catch (error) {
                    isAdmin = false;
                }

                renderConnected(user, isAdmin);
            });

            animateNavbar();

            const logo = navbarContainer.querySelector(".nav-logo");
            if (logo && typeof gsap !== "undefined") {
                logo.addEventListener("mouseenter", () => {
                    gsap.to(logo, { scale: 1.1, duration: 0.3, ease: "power2.out" });
                });
                logo.addEventListener("mouseleave", () => {
                    gsap.to(logo, { scale: 1, duration: 0.3, ease: "power2.inOut" });
                });
            }
        })
        .catch((error) => console.error("Erreur Navbar:", error));
});
