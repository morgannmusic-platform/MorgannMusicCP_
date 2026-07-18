document.addEventListener("DOMContentLoaded", () => {
    if (typeof gsap === "undefined") return;

    const card = document.querySelector(".auth-card");
    const items = document.querySelectorAll(".brand, h1, .subtitle, form > div, button, .helper");

    gsap.fromTo(card,
        { opacity: 0, y: 28, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: "power3.out" }
    );

    gsap.fromTo(items,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.55, stagger: 0.07, ease: "power2.out", delay: 0.15 }
    );

    const fields = document.querySelectorAll("input");
    fields.forEach((field) => {
        field.addEventListener("focus", () => {
            gsap.to(field, { duration: 0.2, scale: 1.005, ease: "power2.out" });
        });
        field.addEventListener("blur", () => {
            gsap.to(field, { duration: 0.2, scale: 1, ease: "power2.inOut" });
        });
    });

    const submitBtn = document.querySelector("button[type='submit']");
    if (submitBtn) {
        submitBtn.addEventListener("mouseenter", () => {
            gsap.to(submitBtn, { y: -2, duration: 0.2, ease: "power2.out" });
        });
        submitBtn.addEventListener("mouseleave", () => {
            gsap.to(submitBtn, { y: 0, duration: 0.2, ease: "power2.inOut" });
        });
    }
});
