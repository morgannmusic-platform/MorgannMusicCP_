document.addEventListener("DOMContentLoaded", () => {
    if (typeof gsap !== "undefined") {
        gsap.registerPlugin(ScrollTrigger);

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) {
            gsap.set([(".dev-hero"), (".service-card"), (".version-box")], { opacity: 1, y: 0 });
            return;
        }

        gsap.fromTo(".dev-hero",
            { opacity: 0, y: -40 },
            { opacity: 1, y: 0, duration: 1, ease: "power4.out" }
        );

        gsap.fromTo(".version-box",
            { opacity: 0, scale: 0.95, y: 30 },
            { opacity: 1, scale: 1, y: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".version-box", start: "top 85%" } }
        );

        gsap.utils.toArray(".service-card").forEach((card, index) => {
            gsap.fromTo(card,
                { opacity: 0, y: 50 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: card,
                        start: "top 85%",
                        toggleActions: "play none none reverse"
                    }
                }
            );
        });
    }
});
