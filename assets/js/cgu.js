document.addEventListener("DOMContentLoaded", () => {
    const pages = document.querySelectorAll(".cgu-page");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const indicatorsContainer = document.getElementById("indicators");

    let currentPage = 1;
    const totalPages = pages.length;

    // Créer les indicateurs de pages (points)
    for (let i = 1; i <= totalPages; i++) {
        const dot = document.createElement("button");
        dot.className = `indicator-dot ${i === 1 ? 'active' : ''}`;
        dot.setAttribute("aria-label", `Aller à la page ${i}`);
        dot.addEventListener("click", () => goToPage(i));
        indicatorsContainer.appendChild(dot);
    }

    const dots = indicatorsContainer.querySelectorAll(".indicator-dot");

    function updateView() {
        pages.forEach(page => {
            const pageNum = parseInt(page.getAttribute("data-page"));
            page.classList.toggle("is-active", pageNum === currentPage);
            // Compatibilité avec la classe active gérée en CSS
            if (pageNum === currentPage) {
                page.classList.add("active");
            } else {
                page.classList.remove("active");
            }
        });

        dots.forEach((dot, idx) => {
            dot.classList.toggle("active", idx + 1 === currentPage);
        });

        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        // Remonter en haut du bloc de contenu à chaque changement de page
        document.querySelector('.legal-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function goToPage(pageNum) {
        if (pageNum >= 1 && pageNum <= totalPages) {
            currentPage = pageNum;
            updateView();
        }
    }

    prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            updateView();
        }
    });

    nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
            currentPage++;
            updateView();
        }
    });

    updateView();
});