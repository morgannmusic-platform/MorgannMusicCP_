document.addEventListener("DOMContentLoaded", () => {
    if (typeof gsap !== "undefined") {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reducedMotion) {
            gsap.set(["#mockup-anim", ".zigzag-anim"], { opacity: 1, y: 0 });
            return;
        }

        // Animation du héro
        gsap.fromTo(".premiere-hero-badge", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.6, delay: 0.2 });
        gsap.fromTo(".premiere-hero h1", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.4, ease: "power3.out" });
        gsap.fromTo(".premiere-hero p", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.6 });
        gsap.fromTo(".premiere-hero .cta-button", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, delay: 0.8, ease: "back.out(1.5)" });

        // Animation d'entrée du Mockup (l'aperçu vert)
        gsap.to("#mockup-anim", {
            opacity: 1,
            y: 0,
            duration: 1,
            delay: 1,
            ease: "power3.out"
        });

        // Animation au scroll pour la section ZigZag
        const observerOptions = { threshold: 0.15 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    gsap.to(entry.target, {
                        opacity: 1,
                        y: 0,
                        duration: 0.8,
                        ease: "power3.out"
                    });

                    // Petite animation interne pour le visuel
                    const visualBox = entry.target.querySelector('.visual-box');
                    if (visualBox) {
                        gsap.fromTo(visualBox, { scale: 0.95 }, { scale: 1, duration: 1, ease: "back.out(1.2)", delay: 0.2 });
                    }

                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.zigzag-anim').forEach(sec => observer.observe(sec));

        // Observer classique pour le CTA final
        const ctaObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                gsap.fromTo(entries[0].target.querySelector(".cta-container"),
                    { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1 }
                );
                ctaObserver.disconnect();
            }
        }, { threshold: 0.2 });

        const ctaSec = document.querySelector('.cta-section');
        if (ctaSec) ctaObserver.observe(ctaSec);
    }
});