const firebaseConfig = {
  apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
  authDomain: "morgann-music-cp.firebaseapp.com",
  projectId: "morgann-music-cp",
  storageBucket: "morgann-music-cp.firebasestorage.app",
  messagingSenderId: "666812685196",
  appId: "1:666812685196:web:fe3df6749ae768d68494a9",
  measurementId: "G-FKSSXYEZF0"
};

let auth = null;
let db = null;
let signOutFn = null;
let onAuthStateChangedFn = null;
let getIdTokenResultFn = null;
let docFn = null;
let getDocFn = null;
let onSnapshotFn = null;
let disabledWatcherUnsub = null;

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

function isLoginOrAccountPage() {
  const path = String(window.location.pathname || "")
    .toLowerCase()
    .replace(/\/+$/, "");
  return /\/(login|account)(\.html)?$/.test(path);
}

function applyThemeColorMetaSet() {
  const isBluePage = isLoginOrAccountPage();
  const lightColor = isBluePage ? "#ecca74" : "#d8ff97";
  const darkColor = isBluePage ? "#ad8e58" : "#70844d";

  document.querySelectorAll('meta[name="theme-color"]').forEach((node) => node.remove());

  const variants = [
    { media: "(prefers-color-scheme: light)", content: lightColor },
    { media: "(prefers-color-scheme: dark)", content: darkColor }
  ];

  variants.forEach(({ media, content }) => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("media", media);
    meta.setAttribute("content", content);
    document.head.appendChild(meta);
  });
}

function applyNavbarPaletteForPage(themeQuery, useBluePalette) {
  const rootStyle = document.documentElement.style;
  const overridenProps = ["--nb", "--nbscr", "--nav-border", "--nav-link", "--nav-link-hover"];

  if (!useBluePalette) {
    overridenProps.forEach((prop) => rootStyle.removeProperty(prop));
    return;
  }

  const isDark = themeQuery.matches;
  const navColor = isDark ? "#ad8e58" : "#ecca74";
  const navColorTop = navColor;
  const navBorder = isDark ? "rgba(255, 255, 255, 0.18)" : "rgba(15, 23, 42, 0.18)";

  rootStyle.setProperty("--nb", navColorTop);
  rootStyle.setProperty("--nbscr", navColor);
  rootStyle.setProperty("--nav-border", navBorder);
  rootStyle.setProperty("--nav-link", "rgba(255, 255, 255, 0.95)");
  rootStyle.setProperty("--nav-link-hover", "rgba(255, 255, 255, 1)");
}

function isAccueilPagesGroup() {
  return true;
}

function isAdminFromData(data){
  if (!data || typeof data !== "object") return false;
  const role = String(data.role || data.userRole || data.type || "").trim().toLowerCase();
  if (role === "admin" || role === "administrator" || role === "staff") return true;
  if (data.isAdmin === true || data.admin === true) return true;
  return false;
}

function isAccountDisabled(data) {
  if (!data || typeof data !== "object") return false;
  if (data.accountDisabled === true) return true;
  const status = String(data.status || "").trim().toLowerCase();
  return status === "disabled" || status === "desactive";
}

// NAVBAR_HTML est maintenant chargé dynamiquement depuis navbar.html
let NAVBAR_HTML = null;

function isDesktopNavbarPanelEnabled() {
  return isAccueilPagesGroup() && window.matchMedia("(min-width: 769px)").matches;
}

function setNavbarPanelView(stage, nextView) {
  if (!stage) return;
  const view = nextView === "account" ? "account" : "primary";
  stage.classList.toggle("is-account", view === "account");
  stage.classList.toggle("is-primary", view === "primary");
  stage.dataset.view = view;

  const primaryView = document.getElementById("navbar-panel-view-primary");
  const accountView = document.getElementById("navbar-panel-view-account");
  if (primaryView) primaryView.setAttribute("aria-hidden", view === "account" ? "true" : "false");
  if (accountView) accountView.setAttribute("aria-hidden", view === "account" ? "false" : "true");
}

function setNavbarPanelOpenState({ panel, backdrop, toggle, avatarButton, open }) {
  if (!panel || !backdrop || !toggle) return;
  panel.hidden = !open;
  backdrop.hidden = !open;
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (avatarButton) avatarButton.setAttribute("aria-expanded", open ? "true" : "false");
  document.body.classList.toggle("navbar-panel-open", open);
}

function updateNavbar() {

  const navbarContainer = document.getElementById("navbar-container");
  if (!navbarContainer) return;

  // Charger dynamiquement navbar.html et injecter son contenu
  fetch("/navbar.html")
    .then(response => response.text())
    .then(html => {
      navbarContainer.innerHTML = html;
      // Tout le code d'initialisation DOIT être ici !
      const logo = document.getElementById("logo");
      const logoSvg = "/assets/logo/logo-ff8fb1.svg?v=20260309";
      const logoBlueLight = "/assets/img/logo-blue-light.svg?v=20260310";
      const logoBlueDark = "/assets/img/logo-blue-dark.svg?v=20260310";
      const themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const useBlueLogo = isLoginOrAccountPage();

      const syncLogoWithTheme = () => {
        if (!logo) return;
        if (useBlueLogo) {
          logo.src = themeQuery.matches ? logoBlueDark : logoBlueLight;
          logo.style.filter = "none";
          return;
        }
        logo.src = logoSvg;
        // En mode sombre, on passe l'icône en blanc
        if (themeQuery.matches) {
          logo.style.filter = "brightness(0) invert(1)";
        } else {
          logo.style.filter = "none";
        }
      };

      applyNavbarPaletteForPage(themeQuery, useBlueLogo);
      syncLogoWithTheme();
      if (typeof themeQuery.addEventListener === "function") {
        themeQuery.addEventListener("change", () => {
          applyNavbarPaletteForPage(themeQuery, useBlueLogo);
          syncLogoWithTheme();
        });
      } else if (typeof themeQuery.addListener === "function") {
        themeQuery.addListener(() => {
          applyNavbarPaletteForPage(themeQuery, useBlueLogo);
          syncLogoWithTheme();
        });
      }

      const navbar = document.getElementById("navbar");
      if (navbar) {
        navbar.classList.toggle("navbar-home", isAccueilPagesGroup());
        navbar.classList.add("navbar-guest");
        navbar.classList.remove("navbar-authenticated");
        window.addEventListener("scroll", () => {
          if (window.scrollY > 50) navbar.classList.add("scrolled");
          else navbar.classList.remove("scrolled");
        });
      }

      const menuToggle = document.getElementById("menu-toggle");
      const navLinks = document.getElementById("nav-links");
      const avatarContainer = document.getElementById("avatar-container");
      const dropdown = document.getElementById("user-dropdown");
      const navbarPanel = document.getElementById("navbar-panel");
      const navbarPanelBackdrop = document.getElementById("navbar-panel-backdrop");
      const navbarPanelStage = document.getElementById("navbar-panel-stage");
      const navbarPanelBack = document.getElementById("navbar-panel-back");
      const panelLogoutBtn = document.getElementById("panel-logout-btn");

      const closeDesktopPanel = () => {
        if (!navbarPanel || !navbarPanelBackdrop || !menuToggle) return;
        setNavbarPanelOpenState({
          panel: navbarPanel,
          backdrop: navbarPanelBackdrop,
          toggle: menuToggle,
          avatarButton: avatarContainer,
          open: false
        });
        setNavbarPanelView(navbarPanelStage, "primary");
      };

      const openDesktopPanel = (view = "primary") => {
        if (!navbarPanel || !navbarPanelBackdrop || !menuToggle) return;
        setNavbarPanelView(navbarPanelStage, view);
        setNavbarPanelOpenState({
          panel: navbarPanel,
          backdrop: navbarPanelBackdrop,
          toggle: menuToggle,
          avatarButton: avatarContainer,
          open: true
        });
      };

      if (menuToggle && navLinks) {
        menuToggle.addEventListener("click", (event) => {
          event.stopPropagation();
          if (isDesktopNavbarPanelEnabled()) {
            const isOpen = !navbarPanel?.hidden;
            if (isOpen) closeDesktopPanel();
            else openDesktopPanel("primary");
            return;
          }

          navLinks.classList.toggle("active");
          menuToggle.setAttribute("aria-expanded", navLinks.classList.contains("active") ? "true" : "false");
        });
      }

      navbarPanelBack?.addEventListener("click", (event) => {
        event.stopPropagation();
        setNavbarPanelView(navbarPanelStage, "primary");
      });

      navbarPanelBackdrop?.addEventListener("click", () => {
        closeDesktopPanel();
        if (navLinks) navLinks.classList.remove("active");
      });

      if (avatarContainer && dropdown) {
        avatarContainer.addEventListener("click", (event) => {
          event.stopPropagation();
          if (isDesktopNavbarPanelEnabled()) {
            openDesktopPanel("account");
            dropdown.style.display = "none";
            return;
          }

          const willOpen = dropdown.style.display !== "flex";
          dropdown.style.display = willOpen ? "flex" : "none";
          avatarContainer.setAttribute("aria-expanded", willOpen ? "true" : "false");
        });

        dropdown.addEventListener("click", (event) => {
          event.stopPropagation();
        });

        document.addEventListener("click", (event) => {
          if (isDesktopNavbarPanelEnabled() && navbarPanel && !navbarPanel.hidden) {
            if (!navbarPanel.contains(event.target) && !avatarContainer.contains(event.target) && !menuToggle?.contains(event.target)) {
              closeDesktopPanel();
            }
          }

          if (!avatarContainer.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.style.display = "none";
            avatarContainer.setAttribute("aria-expanded", "false");
          }
        });
      }

      navbarPanel?.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
          closeDesktopPanel();
          if (navLinks) navLinks.classList.remove("active");
        });
      });

      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        closeDesktopPanel();
        if (navLinks) navLinks.classList.remove("active");
        if (dropdown) dropdown.style.display = "none";
        if (avatarContainer) avatarContainer.setAttribute("aria-expanded", "false");
        if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
      });

      window.addEventListener("resize", () => {
        if (!isDesktopNavbarPanelEnabled()) {
          closeDesktopPanel();
          setNavbarPanelView(navbarPanelStage, "primary");
        }
      });

      const authLinks = document.getElementById("auth-links");
      const userMenu = document.getElementById("user-menu");
      const userAvatar = document.getElementById("user-avatar");
      const logoutBtn = document.getElementById("logout-btn");

      // --- AUTHENTIFICATION ET LOGIQUE UTILISATEUR ---
      if (onAuthStateChangedFn && auth) {
        onAuthStateChangedFn(auth, async (user) => {
          // Affiche ou masque le bouton Explorer selon l'état de connexion
          if (menuToggle) menuToggle.style.display = user ? "" : "none";
          if (disabledWatcherUnsub) {
            try { disabledWatcherUnsub(); } catch {}
            disabledWatcherUnsub = null;
          }

          if (user) {
            if (navbar) {
              navbar.classList.add("navbar-authenticated");
              navbar.classList.remove("navbar-guest");
            }
            if (db && docFn && onSnapshotFn) {
              try {
                disabledWatcherUnsub = onSnapshotFn(docFn(db, "users", user.uid), async (snap) => {
                  const data = snap?.exists?.() ? (snap.data() || {}) : null;
                  if (!isAccountDisabled(data)) return;
                  try {
                    sessionStorage.setItem("mmcp_account_disabled", "1");
                  } catch {}
                  try {
                    if (signOutFn && auth) await signOutFn(auth);
                  } finally {
                    window.location.href = "/login.html?disabled=1";
                  }
                });
              } catch {}
            }

            if (authLinks) authLinks.style.display = "none";
            if (userMenu) userMenu.style.display = "flex";
            if (userAvatar) {
              userAvatar.src = user.photoURL || "/assets/img/default-avatar.png";
            }

            try {
              let canSeeAdmin = false;

              try {
                const tokenResult = await getIdTokenResultFn(user);
                if (tokenResult?.claims?.admin === true) canSeeAdmin = true;
              } catch (_) {}

              try {
                const userSnap = await getDocFn(docFn(db, "users", user.uid));
                if (userSnap.exists()) {
                  canSeeAdmin = canSeeAdmin || isAdminFromData(userSnap.data());
                }
              } catch (_) {}

              const existingAdminLink = document.getElementById("admin-dashboard-link");
              const existingAdminPanelLink = document.getElementById("admin-dashboard-panel-link");
              if (canSeeAdmin) {
                if (!existingAdminLink && dropdown) {
                  const a = document.createElement("a");
                  a.id = "admin-dashboard-link";
                  a.href = "/dash/admin/index.html";
                  a.textContent = "Dashboard Admin";
                  const logout = document.getElementById("logout-btn");
                  if (logout?.parentElement === dropdown) dropdown.insertBefore(a, logout);
                  else dropdown.appendChild(a);
                }
                if (!existingAdminPanelLink) {
                  const panelLinks = document.getElementById("navbar-panel-account-links");
                  const panelLogout = document.getElementById("panel-logout-btn");
                  if (panelLinks && panelLogout) {
                    const panelLink = document.createElement("a");
                    panelLink.id = "admin-dashboard-panel-link";
                    panelLink.href = "/dash/admin/index.html";
                    panelLink.className = "navbar-panel-link";
                    panelLink.innerHTML = "<span>Dashboard Admin</span><small>Acces aux outils admin</small>";
                    panelLinks.insertBefore(panelLink, panelLogout);
                  }
                }
              } else if (existingAdminLink) {
                existingAdminLink.remove();
                if (existingAdminPanelLink) existingAdminPanelLink.remove();
              }
            } catch (e) {
              const existingAdminLink = document.getElementById("admin-dashboard-link");
              if (existingAdminLink) existingAdminLink.remove();
              const existingAdminPanelLink = document.getElementById("admin-dashboard-panel-link");
              if (existingAdminPanelLink) existingAdminPanelLink.remove();
            }
          } else {
            if (menuToggle) menuToggle.style.display = "none";
            if (navbar) {
              navbar.classList.add("navbar-guest");
              navbar.classList.remove("navbar-authenticated");
            }
            if (disabledWatcherUnsub) {
              try { disabledWatcherUnsub(); } catch {}
              disabledWatcherUnsub = null;
            }
            if (userMenu) userMenu.style.display = "none";
            if (authLinks) authLinks.style.display = "flex";
            const existingAdminLink = document.getElementById("admin-dashboard-link");
            if (existingAdminLink) existingAdminLink.remove();
            const existingAdminPanelLink = document.getElementById("admin-dashboard-panel-link");
            if (existingAdminPanelLink) existingAdminPanelLink.remove();
          }
        });
      }

      // Gestion des boutons logout (après injection DOM)
      logoutBtn?.addEventListener("click", async (e) => {
        e.preventDefault();
        if (signOutFn && auth) await signOutFn(auth);
        closeDesktopPanel();
        window.location.href = "/index.html";
      });

      panelLogoutBtn?.addEventListener("click", async (e) => {
        e.preventDefault();
        if (signOutFn && auth) await signOutFn(auth);
        closeDesktopPanel();
        window.location.href = "/index.html";
      });
    } // <-- FIN de updateNavbar
  )}



async function initFirebaseAuth() {
  try {
    const [appMod, authMod, firestoreMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js")
    ]);

    // Priorise l'app Firebase par defaut pour eviter les conflits avec les apps nommees.
    let app;
    try {
      app = appMod.getApp();
    } catch (_) {
      app = appMod.initializeApp(firebaseConfig);
    }

    auth = authMod.getAuth(app);
    db = firestoreMod.getFirestore(app);

    signOutFn = authMod.signOut;
    onAuthStateChangedFn = authMod.onAuthStateChanged;
    getIdTokenResultFn = authMod.getIdTokenResult;
    docFn = firestoreMod.doc;
    getDocFn = firestoreMod.getDoc;
    onSnapshotFn = firestoreMod.onSnapshot;
  } catch (error) {
    console.error("[navbar] Firebase init failed:", error);
    auth = null;
    db = null;
    signOutFn = null;
    onAuthStateChangedFn = null;
    getIdTokenResultFn = null;
    docFn = null;
    getDocFn = null;
    onSnapshotFn = null;
  }
}

applyFaviconSet();

function bootNavbar() {
  applyThemeColorMetaSet();
  // Affiche immédiatement la navbar, puis réhydrate l'état compte après init Firebase.
  updateNavbar();
  initFirebaseAuth()
    .then(() => updateNavbar())
    .catch(() => {});
}

bootNavbar();

function _ensureMmcpLoaderStyles() {
  if (document.getElementById('mmcp-loader-styles')) return;
  const css = `
  @keyframes mmcp-blink { 0%{opacity:1}50%{opacity:0.15}100%{opacity:1} }
  .mmcp-loader{display:inline-block;vertical-align:middle;color:currentColor}
  .mmcp-loader svg{display:block;height:1.6em;width:auto}
  .mmcp-loader--small svg{height:1em}
  .mmcp-loader--medium svg{height:2.2em}
  .mmcp-loader-part{animation: mmcp-blink 1s infinite ease-in-out}
  .mmcp-loader-part.p1{animation-delay:0s}
  .mmcp-loader-part.p2{animation-delay:0.12s}
  .mmcp-loader-part.p3{animation-delay:0.24s}
  `;
  const style = document.createElement('style');
  style.id = 'mmcp-loader-styles';
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
}

function _chooseContrastColor(bgColor) {
  if (!bgColor) return '#000';
  const m = bgColor.match(/rgba?\(([^)]+)\)/i);
  if (!m) return '#000';
  const parts = m[1].split(',').map(p=>Number(p.trim()));
  const r = parts[0]||0, g = parts[1]||0, b = parts[2]||0;
  const l = 0.2126*(r/255)**2.2 + 0.7152*(g/255)**2.2 + 0.0722*(b/255)**2.2;
  return l > 0.5 ? '#000' : '#fff';
}

function insertMmcpLoader(target, opts={}){
  try{
    _ensureMmcpLoaderStyles();
    if (!target) return null;
    const size = opts.size || 'medium';
    const container = document.createElement('span');
    container.className = `mmcp-loader mmcp-loader--${size}`;
    container.innerHTML = `
      <svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
        <g>
          <path class="mmcp-loader-part p1" d="M10 45 L40 10 L70 45 Z" fill="currentColor"></path>
          <path class="mmcp-loader-part p2" d="M80 45 L110 10 L140 45 Z" fill="currentColor"></path>
          <circle class="mmcp-loader-part p3" cx="170" cy="27" r="12" fill="currentColor"></circle>
        </g>
      </svg>`;

    let el = target;
    let bg = '';
    while(el && el !== document.documentElement){
      const s = getComputedStyle(el).backgroundColor;
      if (s && s !== 'rgba(0, 0, 0, 0)' && s !== 'transparent') { bg = s; break; }
      el = el.parentElement;
    }
    if (!bg) {
      bg = getComputedStyle(document.body).backgroundColor || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'rgb(12,12,14)' : 'rgb(250,250,252)');
    }
    const color = _chooseContrastColor(bg);
    container.style.color = color;

    if (target.children.length === 0 && String(target.textContent||'').trim() === '') {
      target.appendChild(container);
    } else {
      target.insertBefore(container, target.firstChild);
    }
    return container;
  }catch(e){ console.error('mmcp loader insert error', e); return null; }
}

function _initMmcpLoadersAuto(){
  const run = () => {
    document.querySelectorAll('[data-mmcp-loader]').forEach((node)=>{
      if (!node.__mmcp_loader_inited) {
        const size = node.getAttribute('data-mmcp-loader-size') || 'medium';
        insertMmcpLoader(node, {size});
        node.__mmcp_loader_inited = true;
      }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
}

_initMmcpLoadersAuto();
