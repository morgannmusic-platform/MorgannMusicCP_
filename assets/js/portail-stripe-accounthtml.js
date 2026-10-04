document.addEventListener("DOMContentLoaded", () => {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanels = document.querySelectorAll(".tab-panel");
    function switchTab(tabName) {
        tabBtns.forEach(btn => {
            const isActive = btn.getAttribute("data-tab") === tabName;
            btn.classList.toggle("is-active", isActive);
            btn.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        tabPanels.forEach(panel => {
            const isActive = panel.getAttribute("data-panel") === tabName;
            panel.classList.toggle("is-active", isActive);
        });
        const url = new URL(window.location);
        url.searchParams.set("tab", tabName);
        window.history.replaceState({}, "", url);
    }
    const params = new URLSearchParams(window.location.search);
    const activeTabParam = params.get("tab") || "profile";
    switchTab(activeTabParam);
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            switchTab(btn.getAttribute("data-tab"));
        });
    });
    const avatarInput = document.getElementById("avatar-input");
    const avatarPreview = document.getElementById("avatar-preview-img");
    if (avatarInput) {
        avatarInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    avatarPreview.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    const manageBillingBtn = document.getElementById("manage-billing-btn");
    if (manageBillingBtn) {
        manageBillingBtn.addEventListener("click", async () => {
            manageBillingBtn.disabled = true;
            manageBillingBtn.textContent = "Redirection vers Stripe...";
            try {
                const userEmailInput = document.getElementById("email");
                const userEmail = userEmailInput ? userEmailInput.value : null;
                if (!userEmail) {
                    throw new Error("Email utilisateur introuvable sur la page.");
                }
                const response = await fetch('https://pay.mm-cp.uk/create-portal-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userEmail: userEmail })
                });
                const data = await response.json();
                if (data.url) {
                    window.location.href = data.url;
                } else {
                    throw new Error(data.error || "Impossible d'ouvrir le portail de facturation.");
                }
            } catch (err) {
                alert("Erreur : " + err.message);
                manageBillingBtn.disabled = false;
                manageBillingBtn.textContent = "💳 Gérer / Résilier mon abonnement";
            }
        });
    }
});