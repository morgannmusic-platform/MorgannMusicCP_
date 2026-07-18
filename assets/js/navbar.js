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

            const desktopNavLinks = navbarContainer.querySelector("#desktop-nav-links");
            const mobileMenuOverlay = navbarContainer.querySelector("#mobile-menu-overlay");
            const mobileMenu = navbarContainer.querySelector("#mobile-menu");
            const menuToggle = navbarContainer.querySelector("#menu-toggle");
            const navAuth = navbarContainer.querySelector("#nav-auth");

            if (!navAuth) return;
            
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            const animateNavbar = () => {
                if (typeof gsap !== "undefined" && !reducedMotion) {
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

            // Préparation du contenu mobile
            const mobileNavLinksContainer = document.createElement('div');
            mobileNavLinksContainer.className = 'mobile-nav-links';
            if (desktopNavLinks) mobileNavLinksContainer.innerHTML = desktopNavLinks.innerHTML;
            mobileMenu.appendChild(mobileNavLinksContainer);

            const mobileAuthLinksDiv = document.createElement('div');
            mobileAuthLinksDiv.className = 'mobile-auth-links';
            mobileMenu.appendChild(mobileAuthLinksDiv);

            const attachMobileMenuLinkListeners = () => {
                mobileMenu.querySelectorAll('a, button').forEach(link => {
                    link.addEventListener('click', () => closeMobileMenu());
                });
            };

            const renderDisconnected = () => {
                const authHtml = `
                    <a class="auth-link" href="/login.html">Se connecter</a>
                    <a class="auth-link" href="/signin.html">S'inscrire</a>
                `;
                navAuth.innerHTML = authHtml;
                mobileAuthLinksDiv.innerHTML = authHtml;
                attachMobileMenuLinkListeners();
            };

            const renderConnected = (user, isAdmin) => {
                const photo = user.photoURL || "/assets/img/photodeprofil/default-avatar.png";
                const adminItem = isAdmin
                    ? `<a href="/admin.html">Tableau de bord admin</a>`
                    : "";

                const profileHtml = `
                    <div class="profile-wrap">
                        <button class="profile-button" id="profile-button" aria-label="Ouvrir le menu profil">
                            <img src="${photo}" alt="Photo de profil">
                        </button>
                        <div class="profile-menu" id="profile-menu">
                            <a href="/portail/index.html">Portail Utilisateur</a>
                            <a href="/account.html">Espace compte</a>
                            ${adminItem}
                            <button type="button" class="danger" id="logout-button">Se deconnecter</button>
                        </div>
                    </div>
                `;

                navAuth.innerHTML = profileHtml;
                mobileAuthLinksDiv.innerHTML = ""; // On ne l'affiche plus dans le menu toggle

                // Gestion des menus de profil (Desktop et Mobile)
                const setupProfileMenu = (container) => {
                    const profileButton = container.querySelector(".profile-button");
                    const profileMenu = container.querySelector(".profile-menu");
                    const logoutButton = container.querySelector("#logout-button");

                    profileButton?.addEventListener("click", (e) => {
                        e.stopPropagation();
                        profileMenu?.classList.toggle("open");
                    });

                    document.addEventListener("click", (event) => {
                        if (!container.contains(event.target)) {
                            profileMenu?.classList.remove("open");
                        }
                    });

                    logoutButton?.addEventListener("click", async () => {
                        await signOut(auth);
                        window.location.href = "/login.html";
                    });
                };

                setupProfileMenu(navAuth);
                attachMobileMenuLinkListeners();
            };

            // Logique du Menu Toggle Mobile
            const openMobileMenu = () => {
                if (typeof gsap === "undefined" || reducedMotion) {
                    mobileMenuOverlay.style.display = "block";
                    mobileMenuOverlay.style.opacity = "1";
                    mobileMenu.style.transform = "translateX(0)";
                } else {
                    gsap.set(mobileMenuOverlay, { display: 'block' });
                    gsap.to(mobileMenuOverlay, { opacity: 1, duration: 0.3 });
                    gsap.to(mobileMenu, { x: "0%", duration: 0.4, ease: "power2.out" });
                    
                    // Petit effet de cascade sur les liens
                    gsap.fromTo(mobileMenu.querySelectorAll('a, .profile-wrap'), 
                        { opacity: 0, x: 20 }, 
                        { opacity: 1, x: 0, duration: 0.3, stagger: 0.05, delay: 0.1 }
                    );
                }
                menuToggle?.classList.add('is-active');
            };

            const closeMobileMenu = () => {
                if (typeof gsap === "undefined" || reducedMotion) {
                    mobileMenuOverlay.style.display = "none";
                    mobileMenu.style.transform = "translateX(100%)";
                } else {
                    gsap.to(mobileMenu, { x: "100%", duration: 0.4, ease: "power2.in" });
                    gsap.to(mobileMenuOverlay, { 
                        opacity: 0, 
                        duration: 0.3, 
                        onComplete: () => gsap.set(mobileMenuOverlay, { display: 'none' }) 
                    });
                }
                menuToggle?.classList.remove('is-active');
            };

            menuToggle?.addEventListener("click", () => {
                const isOpen = menuToggle.classList.contains('is-active');
                if (isOpen) closeMobileMenu();
                else openMobileMenu();
            });

            mobileMenuOverlay?.addEventListener("click", (e) => {
                if (e.target === mobileMenuOverlay) closeMobileMenu();
            });

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
            if (logo && typeof gsap !== "undefined" && !reducedMotion) {
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
