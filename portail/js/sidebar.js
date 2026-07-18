// script.js
document.addEventListener("DOMContentLoaded", () => {
    fetch("js/sidebar.html")
        .then(response => {
            if (!response.ok) {
                throw new Error("Erreur lors du chargement de la sidebar");
            }
            return response.text();
        })
        .then(data => {
            // Assurez-vous d'avoir un <div id="sidebar-container"></div> dans votre HTML
            document.getElementById("sidebar-container").innerHTML = data;
        })
        .catch(error => console.error("Détails :", error));
});