document.addEventListener("DOMContentLoaded", () => {
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
        gsap.registerPlugin(ScrollTrigger);

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) {
            gsap.set([".contact-card-box", ".contact-hero h1", ".contact-hero p"], { opacity: 1, y: 0 });
            return;
        }

        gsap.from(".contact-hero h1", {
            opacity: 0,
            y: 40,
            duration: 1,
            ease: "power3.out",
            delay: 0.2
        });

        gsap.from(".contact-hero p", {
            opacity: 0,
            y: 30,
            duration: 1,
            ease: "power3.out",
            delay: 0.4
        });

        gsap.to("#form-box", {
            scrollTrigger: {
                trigger: "#form-box",
                start: "top 85%"
            },
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power2.out"
        });

        gsap.to("#emails-box", {
            scrollTrigger: {
                trigger: "#emails-box",
                start: "top 85%"
            },
            opacity: 1,
            y: 0,
            duration: 0.8,
            delay: 0.2,
            ease: "power2.out"
        });
    } else {
        document.querySelectorAll(".contact-card-box").forEach(el => {
            el.style.opacity = "1";
            el.style.transform = "none";
        });
    }
});
