document.addEventListener("DOMContentLoaded", () => {
    if (typeof gsap !== "undefined") {
        gsap.fromTo(".version-hero", { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 1, ease: "power4.out" });
        gsap.fromTo(".current-version-card", { opacity: 0, scale: 0.95, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 1, delay: 0.2, ease: "power3.out" });
    }
});