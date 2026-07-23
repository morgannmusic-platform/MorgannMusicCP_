import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
    authDomain: "morgann-music-cp.firebaseapp.com",
    projectId: "morgann-music-cp",
    storageBucket: "morgann-music-cp.firebasestorage.app",
    messagingSenderId: "666812685196",
    appId: "1:666812685196:web:fe3df6749ae768d68494a9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Fonction principale d'initialisation de la navbar
function initNavbar() {
    fetch("js/navbar.html")
        .then(response => {
            if (!response.ok) {
                throw new Error("Erreur lors du chargement de la navbar");
            }
            return response.text();
        })
        .then(data => {
            const container = document.getElementById("navbar-container");
            if (container) {
                // 1. Injection du HTML
                container.innerHTML = data;

                // 2. Configuration des événements
                configurerDropdowns();
                activerLienNavbar();
                chargerNotificationsFirebase();
                configurerDeconnexion();
            }
        })
        .catch(error => console.error("Détails de l'erreur :", error));
}

// Exécution propre pour module ES6
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavbar);
} else {
    initNavbar();
}

// Gestion des clics sur les menus
function configurerDropdowns() {
    const triggers = [
        { button: '.profile-trigger', menu: '#dropdown-profile' },
        { button: '.btn-create-trigger', menu: '#dropdown-create' },
        { button: '.notification-trigger', menu: '#dropdown-notifications' }
    ];

    triggers.forEach(item => {
        const btn = document.querySelector(item.button);
        const menu = document.querySelector(item.menu);

        if (btn && menu) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();

                const isOpen = menu.style.display === 'block';
                fermerTousLesDropdowns();

                if (!isOpen) {
                    menu.style.display = 'block';
                }
            });
        }
    });

    window.addEventListener('click', () => {
        fermerTousLesDropdowns();
    });
}

function fermerTousLesDropdowns() {
    document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
        dropdown.style.display = 'none';
    });
}

// Gestion du lien actif
function activerLienNavbar() {
    const currentPage = window.location.pathname.split("/").pop();
    const pageName = currentPage === "" ? "index.html" : currentPage;
    const navLinks = document.querySelectorAll(".nav-dropdown a");

    navLinks.forEach(link => {
        const linkPage = link.getAttribute("href");
        if (pageName === linkPage) {
            link.classList.add("active");
        }
    });
}

// Écoute en temps réel des notifications Firebase
function chargerNotificationsFirebase() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const notifRef = collection(db, "users", user.uid, "notifications");
            const q = query(notifRef, orderBy("createdAt", "desc"), limit(5));

            onSnapshot(q, (snapshot) => {
                const listContainer = document.getElementById("nav-notif-list");
                const badgeContainer = document.getElementById("nav-notif-badge");

                if (!listContainer || !badgeContainer) return;

                if (snapshot.empty) {
                    listContainer.innerHTML = `<div class="notif-item-empty">Aucune nouvelle notification</div>`;
                    badgeContainer.style.display = "none";
                    return;
                }

                listContainer.innerHTML = "";
                let unreadCount = 0;

                snapshot.forEach((doc) => {
                    const data = doc.data();

                    if (data.read === false || data.read === undefined) {
                        unreadCount++;
                    }

                    const div = document.createElement("div");
                    div.className = `notif-item ${data.read === false ? 'unread' : ''}`;
                    div.innerHTML = `
                        <div class="notif-title">${data.titre || 'Notification'}</div>
                        <div class="notif-body">${data.notif || ''}</div>
                    `;
                    listContainer.appendChild(div);
                });

                if (unreadCount > 0) {
                    badgeContainer.textContent = unreadCount;
                    badgeContainer.style.display = "inline-block";
                } else {
                    badgeContainer.style.display = "none";
                }
            }, (err) => {
                console.error("Erreur d'écoute des notifications :", err);
            });
        }
    });
}

// Gestion du bouton Déconnexion
function configurerDeconnexion() {
    const btnLogout = document.querySelector(".dropdown-btn-logout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            signOut(auth).then(() => {
                window.location.href = "/login.html";
            });
        });
    }
}