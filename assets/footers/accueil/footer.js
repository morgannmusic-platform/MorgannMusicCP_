document.addEventListener("DOMContentLoaded", () => {
    const footerContainer = document.getElementById("footer");

    if (!footerContainer) {
        console.warn("Element #footer introuvable dans le DOM.");
        return;
    }

    const footerPath = "/assets/footers/accueil/footer.html";

    fetch(footerPath)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Erreur ${response.status}: Impossible de charger ${footerPath}`);
            }
            return response.text();
        })
        .then((data) => {
            footerContainer.innerHTML = data;

            if (typeof gsap !== "undefined") {
                gsap.fromTo(
                    ".main-footer",
                    { opacity: 0, y: 24 },
                    { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }
                );
            } else {
                const footer = footerContainer.querySelector(".main-footer");
                if (footer) footer.style.opacity = "1";
            }
        })
        .catch((error) => console.error("Erreur Footer:", error));
});
