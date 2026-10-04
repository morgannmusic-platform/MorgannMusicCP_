document.addEventListener("DOMContentLoaded", () => {
    if (typeof gsap !== "undefined") {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) {
            gsap.set([".hero-pill", ".banner-title .word", ".banner-logo", ".banner-subtitle", ".hero-description", ".hero-actions", ".hero-stat-card", ".hero-panel"], { opacity: 1, y: 0, x: 0 });
            document.querySelectorAll('.platforms-section, .why-us-section, .future-legende-section, .pricing-preview-section, .timeline-section, .litual-section, .extra-features-section, .cta-section').forEach(sec => {
                gsap.set(sec.querySelectorAll("h2, p, .marquee, .feature-card, .why-us-card, .pricing-card, .timeline-item, .litual-container, .cta-container, .future-legende-container"), { opacity: 1, y: 0, x: 0, scale: 1 });
            });
            return;
        }

        const tl = gsap.timeline({ delay: 0.4 });

        tl.to(".hero-pill", { opacity: 1, y: 0, duration: 0.6, startAt: { y: -20, opacity: 0 } })
            .to([".banner-title .word", ".banner-logo"], {
                opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: "power4.out", startAt: { y: 30, opacity: 0 }
            }, "-=0.4")
            .to(".banner-subtitle", {
                opacity: 1, y: 0, duration: 1, ease: "expo.out", startAt: { y: 15, opacity: 0 }
            }, "-=0.6")
            .to(".hero-description", {
                opacity: 1, y: 0, duration: 0.8, startAt: { y: 20, opacity: 0 }
            }, "-=0.7")
            .to(".hero-actions", {
                opacity: 1, y: 0, duration: 0.8, startAt: { y: 20, opacity: 0 }
            }, "-=0.7")
            .to(".hero-stat-card", {
                opacity: 1, y: 0, duration: 0.6, stagger: 0.1, startAt: { y: 20, opacity: 0 }
            }, "-=0.5")
            .to(".hero-panel", {
                opacity: 1, x: 0, duration: 1, ease: "power3.out", startAt: { x: 50, opacity: 0 }
            }, "-=1");

        const observerOptions = { threshold: 0.1 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = entry.target;

                    if (target.classList.contains('platforms-section')) {
                        gsap.fromTo(target.querySelectorAll("h2, p, .marquee"),
                            { opacity: 0, y: 25 },
                            { opacity: 1, y: 0, duration: 0.8, stagger: 0.15 }
                        );
                    }
                    else if (target.classList.contains('why-us-section')) {
                        gsap.fromTo(target.querySelectorAll(".why-us-card"),
                            { opacity: 0, y: 30 },
                            { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 }
                        );
                    }
                    else if (target.classList.contains('feature-cards-section')) {
                        gsap.fromTo(target.querySelectorAll(".feature-card"),
                            { opacity: 0, y: 30 },
                            { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: "power3.out" }
                        );
                    }
                    else if (target.classList.contains('future-legende-section')) {
                        gsap.fromTo(target.querySelector(".future-legende-container"),
                            { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8 }
                        );
                    }
                    else if (target.classList.contains('pricing-preview-section')) {
                        gsap.fromTo(target.querySelectorAll(".pricing-card"),
                            { opacity: 0, y: 30 },
                            { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 }
                        );
                    }
                    else if (target.classList.contains('timeline-section')) {
                        gsap.fromTo(target.querySelectorAll(".timeline-item"),
                            { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.8, stagger: 0.2 }
                        );
                    }
                    else if (target.classList.contains('litual-section')) {
                        gsap.fromTo(target.querySelector(".litual-container"),
                            { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 1 }
                        );
                    }
                    else if (target.classList.contains('extra-features-section')) {
                        gsap.fromTo(target.querySelectorAll(".feature-card"),
                            { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 }
                        );
                    }
                    else if (target.classList.contains('cta-section')) {
                        gsap.fromTo(target.querySelector(".cta-container"),
                            { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1 }
                        );
                    }
                    observer.unobserve(target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.platforms-section, .why-us-section, .feature-cards-section, .future-legende-section, .pricing-preview-section, .timeline-section, .litual-section, .extra-features-section, .cta-section')
            .forEach(sec => observer.observe(sec));
    } else {
        document.querySelectorAll(".banner-title .word, .banner-logo, .banner-subtitle, .hero-pill, .hero-description, .hero-actions, .hero-stat-card, .hero-panel, .platforms-section h2, .platforms-section p, .platforms-section .marquee, .feature-card, .why-us-card, .pricing-card, .future-legende-container, .timeline-item, .litual-container, .cta-container").forEach(el => el.style.opacity = "1");
    }
});
