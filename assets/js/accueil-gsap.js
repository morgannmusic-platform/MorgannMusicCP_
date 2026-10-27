document.addEventListener("DOMContentLoaded", () => {
    if (typeof gsap !== "undefined") {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) {
            return;
        }

        const tl = gsap.timeline({ delay: 0.2 });

        tl.from(".hero-pill", { y: -15, opacity: 0, duration: 0.5 })
            .from(".banner-title .word", { y: 25, opacity: 0, duration: 0.6, stagger: 0.12, ease: "power3.out" }, "-=0.3")
            .from(".banner-logo", { scale: 0.8, opacity: 0, duration: 0.4 }, "-=0.4")
            .from(".banner-subtitle", { y: 15, opacity: 0, duration: 0.5 }, "-=0.4")
            .from(".hero-description", { y: 15, opacity: 0, duration: 0.5 }, "-=0.4")
            .from(".hero-actions a", { y: 15, opacity: 0, duration: 0.4, stagger: 0.1 }, "-=0.3")
            .from(".hero-stat-card", { y: 20, opacity: 0, duration: 0.5, stagger: 0.1 }, "-=0.3")
            .from(".hero-panel", { x: 40, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.8");

        const observerOptions = { threshold: 0.12 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = entry.target;
                    gsap.fromTo(target.children,
                        { opacity: 0, y: 30 },
                        { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "power2.out" }
                    );
                    observer.unobserve(target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('section').forEach(sec => observer.observe(sec));
    }
});