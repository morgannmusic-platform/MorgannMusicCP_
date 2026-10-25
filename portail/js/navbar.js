import { auth } from "/assets/js/firebase.js";
import { onAuthStateChanged, signOut, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { api } from "/assets/js/api.js";

function initNavbar() {
    fetch("/portail/js/navbar.html")
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

function chargerProfilEtAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            const navAvatar = document.getElementById("nav-avatar");
            if (navAvatar) navAvatar.src = "/assets/img/icons/pdp-compte.png";
            return;
        }

        // Charger les notifications de l'utilisateur connecté
        chargerNotifications(user.uid);

        let isAdmin = false;

        try {
            const userData = await api.get(`/api/users/${user.uid}`);

            if (userData && !userData.error) {
                const customPhoto = userData.photoURL;
                const navAvatar = document.getElementById("nav-avatar");
                if (customPhoto && navAvatar) {
                    navAvatar.src = api.fileUrl(customPhoto);
                }

                if (userData.role === "admin" || userData.role === "Admin") {
                    isAdmin = true;
                }
            }

            if (!isAdmin) {
                const tokenResult = await getIdTokenResult(user);
                isAdmin = tokenResult?.claims?.role === "admin" || tokenResult?.claims?.admin === true;
            }

            const dropdownProfile = document.getElementById("dropdown-profile");
            if (dropdownProfile) {
                const existingAdminLink = dropdownProfile.querySelector(".admin-link-item");

                if (isAdmin && !existingAdminLink) {
                    const adminLink = document.createElement("a");
                    adminLink.href = "admin/index.html";
                    adminLink.className = "admin-link-item";
                    adminLink.innerHTML = `<i class="fa-solid fa-user-shield"></i> Administration`;

                    const logoutBtn = dropdownProfile.querySelector("#logout-button") || dropdownProfile.querySelector("#btn-logout");
                    if (logoutBtn) {
                        dropdownProfile.insertBefore(adminLink, logoutBtn);
                    } else {
                        dropdownProfile.appendChild(adminLink);
                    }
                }
            }

        } catch (error) {
            console.error("Erreur récupération profil D1:", error);
        }
    });
}

async function chargerNotifications(uid) {
    const listEl = document.getElementById("nav-notif-list");
    const badgeEl = document.getElementById("nav-notif-badge");

    if (!listEl) return;

    try {
        const notifications = await api.get(`/api/users/${uid}/notifications`);

        if (!Array.isArray(notifications) || notifications.length === 0) {
            listEl.innerHTML = `<div class="notif-item-empty">Aucune notification</div>`;
            if (badgeEl) badgeEl.style.display = "none";
            return;
        }

        // Compter les notifications non lues
        const unreadCount = notifications.filter(n => !n.isRead && !n.read).length;

        if (badgeEl) {
            if (unreadCount > 0) {
                badgeEl.textContent = unreadCount > 99 ? "99+" : unreadCount;
                badgeEl.style.display = "inline-block";
            } else {
                badgeEl.style.display = "none";
            }
        }

        // Afficher les 5 notifications les plus récentes
        const recentNotifs = notifications.slice(0, 5);
        listEl.innerHTML = recentNotifs.map(n => {
            const isUnread = !n.isRead && !n.read;
            const targetUrl = n.link || "notification.html";
            return `
                <a href="${targetUrl}" class="notif-item ${isUnread ? 'unread' : ''}">
                    <div class="notif-title">${escapeHtml(n.title || 'Notification')}</div>
                    <div class="notif-body">${escapeHtml(n.message || '')}</div>
                </a>
            `;
        }).join("");

    } catch (error) {
        console.error("Erreur lors du chargement des notifications:", error);
        listEl.innerHTML = `<div class="notif-item-empty">Erreur de chargement</div>`;
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function configurerDeconnexion() {
    document.addEventListener("click", (e) => {
        if (e.target && (e.target.id === "btn-logout" || e.target.id === "logout-button")) {
            e.preventDefault();
            signOut(auth).then(() => {
                window.location.href = "/login.html";
            }).catch(error => {
                console.error("Erreur déconnexion:", error);
            });
        }
    });
}