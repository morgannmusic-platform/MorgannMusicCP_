import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
  authDomain: "morgann-music-cp.firebaseapp.com",
  projectId: "morgann-music-cp",
  storageBucket: "morgann-music-cp.appspot.com",
  messagingSenderId: "666812685196",
  appId: "1:666812685196:web:fe3df6749ae768d68494a9",
  measurementId: "G-FKSSXYEZF0"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

function applyFaviconSet() {
  const dynamicSelector = "link[data-mmcp-favicon='1']";
  document.querySelectorAll(dynamicSelector).forEach((node) => node.remove());

  const definitions = [
    { rel: "icon", type: "image/png", sizes: "16x16", href: "/assets/img/favicon-16x16clair.png", media: "(prefers-color-scheme: light)" },
    { rel: "icon", type: "image/png", sizes: "16x16", href: "/assets/img/favicon-16x16sombre.png", media: "(prefers-color-scheme: dark)" },
    { rel: "icon", type: "image/png", sizes: "32x32", href: "/assets/img/favicon-32x32clair.png", media: "(prefers-color-scheme: light)" },
    { rel: "icon", type: "image/png", sizes: "32x32", href: "/assets/img/favicon-32x32sombre.png", media: "(prefers-color-scheme: dark)" },
    { rel: "icon", type: "image/x-icon", href: "/assets/img/faviconclair.ico", media: "(prefers-color-scheme: light)" },
    { rel: "icon", type: "image/x-icon", href: "/assets/img/faviconsombre.ico", media: "(prefers-color-scheme: dark)" },
    { rel: "apple-touch-icon", sizes: "180x180", href: "/assets/img/apple-touch-icon.png" },
    { rel: "icon", type: "image/png", sizes: "192x192", href: "/assets/img/android-chrome-192x192.png" },
    { rel: "icon", type: "image/png", sizes: "512x512", href: "/assets/img/android-chrome-512x512.png" }
  ];

  definitions.forEach((def) => {
    const link = document.createElement("link");
    link.setAttribute("data-mmcp-favicon", "1");
    Object.entries(def).forEach(([key, value]) => {
      if (value) link.setAttribute(key, value);
    });
    document.head.appendChild(link);
  });
}

function updateNavbar() {
  const navbarContainer = document.getElementById("navbar-container");
  if (!navbarContainer) return;

  fetch("navbar.html")
    .then(res => res.text())
    .then(html => {
      navbarContainer.innerHTML = html;

      const logo = document.getElementById("logo");
      const themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const syncLogoWithTheme = () => {
        if (!logo) return;
        logo.src = "/assets/img/logo.svg?v=20260309";
        logo.style.filter = themeQuery.matches ? "invert(1)" : "none";
      };
      syncLogoWithTheme();
      if (typeof themeQuery.addEventListener === "function") {
        themeQuery.addEventListener("change", syncLogoWithTheme);
      } else if (typeof themeQuery.addListener === "function") {
        themeQuery.addListener(syncLogoWithTheme);
      }

      const navbar = document.getElementById("navbar");
      if (navbar) {
        window.addEventListener("scroll", () => {
          const isScrolled = window.scrollY > 50;
          if (isScrolled) navbar.classList.add("scrolled");
          else navbar.classList.remove("scrolled");
        });
      }

      const menuToggle = document.getElementById("menu-toggle");
      const navLinks = document.getElementById("nav-links");
      if (menuToggle && navLinks) {
        menuToggle.addEventListener("click", () => {
          navLinks.classList.toggle("active");
        });
      }

      const avatarContainer = document.getElementById("avatar-container");
      const dropdown = document.getElementById("user-dropdown");
      if (avatarContainer && dropdown) {
        avatarContainer.addEventListener("click", (e) => {
          e.stopPropagation();
          dropdown.style.display = (dropdown.style.display === "flex") ? "none" : "flex";
        });
        const dropdownLinks = dropdown.querySelectorAll("a");
        dropdownLinks.forEach(link => {
          link.addEventListener("click", (e) => {
          });
        });
        dropdown.addEventListener("click", (e) => {
          e.stopPropagation();
        });
        document.addEventListener("click", (e) => {
          if (!avatarContainer.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = "none";
          }
        });
      }

      const authLinks = document.getElementById("auth-links");
      const userMenu = document.getElementById("user-menu");
      const userAvatar = document.getElementById("user-avatar");
      const logoutBtn = document.getElementById("logout-btn");

      onAuthStateChanged(auth, (user) => {
        if (user) {
          if (authLinks) authLinks.style.display = "none";
          if (userMenu) userMenu.style.display = "flex";

          if (userAvatar) {
            userAvatar.src = user.photoURL || "/assets/img/default-avatar.png";
          }
        } else {
          if (userMenu) userMenu.style.display = "none";
          if (authLinks) authLinks.style.display = "flex";
        }
      });

      logoutBtn?.addEventListener("click", async (e) => {
        e.preventDefault();
        await signOut(auth);
        window.location.href = "index.html";
      });
    })
    .catch(err => console.error(err));
}

updateNavbar();
applyFaviconSet();
