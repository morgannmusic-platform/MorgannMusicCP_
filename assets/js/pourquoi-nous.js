document.addEventListener("DOMContentLoaded", () => {
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
        gsap.registerPlugin(ScrollTrigger);

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) {
            gsap.set(".story-block", { opacity: 1, y: 0 });
            return;
        }

        gsap.from(".why-hero h1", {
            opacity: 0,
            y: 40,
            duration: 1,
            ease: "power3.out",
            delay: 0.3
        });

        gsap.from(".why-hero p", {
            opacity: 0,
            y: 30,
            duration: 1,
            ease: "power3.out",
            delay: 0.5
        });

        const blocks = document.querySelectorAll(".story-block");
        blocks.forEach((block) => {
            gsap.to(block, {
                scrollTrigger: {
                    trigger: block,
                    start: "top 85%",
                    end: "top 50%",
                    scrub: true,
                    toggleActions: "play none none reverse"
                },
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: "power2.out"
            });
        });

        gsap.from(".cta-container", {
            scrollTrigger: {
                trigger: ".cta-container",
                start: "top 90%"
            },
            opacity: 0,
            scale: 0.95,
            y: 30,
            duration: 1,
            ease: "power3.out"
        });

    } else {
        document.querySelectorAll(".story-block, .cta-container").forEach(el => {
            el.style.opacity = "1";
            el.style.transform = "none";
        });
    }
});
