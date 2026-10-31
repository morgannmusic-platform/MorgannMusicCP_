import { auth } from "/assets/js/firebase.js";
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { api } from "/assets/js/api.js";

function initNavbar() {
    fetch("/portail/label/js/navbar.html")
        .then(response => {
            if (!response.ok) {
                throw new Error("Erreur lors du chargement de la navbar");
            }
            return response.text();
        })
        .then(data => {
            const container = document.getElementById("navbar-container");
            if (container) {
                container.innerHTML = data;
                configurerDropdowns();
                activerLienNavbar();
                chargerProfilEtAuth();
                configurerDeconnexion();
            }
        })
        .catch(error => console.error("Détails de l'erreur :", error));
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavbar);
} else {
    initNavbar();
}

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

async function chargerProfilEtAuth() {
    onAuthStateChanged(auth, async (user) => {
        const navAvatar = document.getElementById("nav-avatar");
        if (!user) {
            if (navAvatar) navAvatar.src = "/assets/img/icons/pdp-compte.png";
            return;
        }

        try {
            // 1. Récupérer d'abord l'icône du label pour l'afficher en priorité si elle existe
            const labelsRes = await api.get(`/api/users/${user.uid}/labels`);
            let label = Array.isArray(labelsRes) ? labelsRes[0] : labelsRes;

            let avatarUrl = null;
            if (label && label.icon_url) {
                avatarUrl = label.icon_url;
            } else {
                // Sinon, vérifier le profil utilisateur standard
                const userData = await api.get(`/api/users/${user.uid}`);
                if (userData && userData.photoURL) {
                    avatarUrl = userData.photoURL;
                }
            }

            if (avatarUrl && navAvatar) {
                if (!avatarUrl.startsWith('http')) {
                    const cleanPath = avatarUrl.replace(/^\/?api\/files\//, '').replace(/^\/+/, '');
                    avatarUrl = `https://api.worker.mm-cp.uk/api/files/${cleanPath}`;
                }
                navAvatar.src = avatarUrl;
            } else if (navAvatar) {
                navAvatar.src = "/assets/img/icons/pdp-compte.png";
            }

            // Gestion des droits Admin
            let isAdmin = false;
            const userDataAdmin = await api.get(`/api/users/${user.uid}`);
            if (userDataAdmin && (userDataAdmin.role === "admin" || userDataAdmin.role === "Admin")) {
                isAdmin = true;
            } else {
                const tokenResult = await getIdTokenResult(user);
                isAdmin = tokenResult?.claims?.role === "admin" || tokenResult?.claims?.admin === true;
            }

            const dropdownProfile = document.getElementById("dropdown-profile");
            if (dropdownProfile && isAdmin) {
                const existingAdminLink = dropdownProfile.querySelector(".admin-link-item");
                if (!existingAdminLink) {
                    const adminLink = document.createElement("a");
                    adminLink.href = "admin/index.html";
                    adminLink.className = "admin-link-item";
                    adminLink.style.color = "var(--primary-color, #e0aaff)";
                    adminLink.style.fontWeight = "bold";
                    adminLink.innerHTML = `<i class="fa-solid fa-user-shield"></i> Administration`;

                    const logoutBtn = dropdownProfile.querySelector("#btn-logout");
                    if (logoutBtn) {
                        dropdownProfile.insertBefore(adminLink, logoutBtn);
                    } else {
                        dropdownProfile.appendChild(adminLink);
                    }
                }
            }

        } catch (error) {
            console.error("Erreur chargement profil/label:", error);
            if (navAvatar) navAvatar.src = "/assets/img/icons/pdp-compte.png";
        }
    });
}
function configurerDeconnexion() {
    document.addEventListener("click", (e) => {
        if (e.target && e.target.id === "btn-logout") {
            e.preventDefault();
            signOut(auth).then(() => {
                window.location.href = "../login.html";
            }).catch(error => {
                console.error("Erreur déconnexion:", error);
            });
        }
    });
}