document.addEventListener("DOMContentLoaded", () => {
    const navbarContainer = document.getElementById("navbar");
    
    if (navbarContainer) {
        const navbarPath = "/assets/navbars/accueil/navbar.html";
        
        fetch(navbarPath)
            .then(response => {
                if (!response.ok) throw new Error(`Erreur ${response.status}: Impossible de charger le fichier ${navbarPath}`);
                return response.text();
            })
            .then(data => {
                // Injection du code HTML de la navbar
                navbarContainer.innerHTML = data;

                // --- ANIMATION GSAP D'ARRIVÉE ---
                // On vérifie que GSAP est bien chargé globalement
                if (typeof gsap !== "undefined") {
                    const tl = gsap.timeline();

                    // 1. Apparition de la barre globale (slide down + fade in)
                    tl.to(".navbar", {
                        opacity: 1,
                        y: 0,
                        duration: 0.6,
                        ease: "power2.out",
                        startAt: { y: -20, opacity: 0 }
                    });

                    // 2. Apparition du logo et du bouton menu en simultané
                    tl.to([".nav-logo", ".nav-menu"], {
                        opacity: 1,
                        duration: 0.4,
                        ease: "power1.out"
                    }, "-=0.2");

                    // 3. Apparition en cascade (stagger) des liens du menu
                    tl.to(".nav-item", {
                        opacity: 1,
                        y: 0,
                        duration: 0.4,
                        stagger: 0.08,
                        ease: "power1.out",
                        startAt: { y: -5, opacity: 0 }
                    }, "-=0.3");

                    // --- ANIMATION AU SURVOL DU LOGO ---
                    const logo = navbarContainer.querySelector(".nav-logo");
                    if (logo) {
                        logo.addEventListener("mouseenter", () => {
                            gsap.to(logo, { scale: 1.1, duration: 0.3, ease: "power2.out" });
                        });
                        logo.addEventListener("mouseleave", () => {
                            gsap.to(logo, { scale: 1, duration: 0.3, ease: "power2.inOut" });
                        });
                    }

                } else {
                    // Script de secours si GSAP est bloqué ou pas chargé
                    document.querySelector(".navbar").style.opacity = "1";
                    document.querySelectorAll(".nav-logo, .nav-menu, .nav-item").forEach(el => el.style.opacity = "1");
                    console.warn("GSAP n'est pas défini. Pense à ajouter le CDN de GSAP.");
                }
            })
            .catch(error => console.error("Erreur Navbar Assist:", error));
    } else {
        console.warn("Élément #navbar introuvable dans le DOM. Vérifiez votre fichier HTML.");
    }
});