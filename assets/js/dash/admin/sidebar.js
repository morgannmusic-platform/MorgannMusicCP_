const links = [
  { label: "Accueil", href: "/dash/admin/index.html" },
  { label: "Créer une sortie", href: "/dash/admin/create-release.html" },
  { label: "Sorties", href: "/dash/admin/sorties.html" },
  { label: "Prods", href: "/dash/admin/prods.html" },
  { label: "Accompagnement", href: "/dash/admin/accompagnement.html" },
  { label: "Notes signés", href: "/dash/admin/accompagnement-notes.html" },
  { label: "Demandes feat", href: "/dash/admin/feat-requests.html" },
  { label: "Pitching éditorial", href: "/dash/admin/pitch-requests.html" },
  { label: "Artistes", href: "/dash/admin/artistes.html" },
  { label: "Comptes", href: "/dash/admin/users.html" },
  { label: "Support", href: "/dash/admin/support.html" },
  { label: "Contacts", href: "/dash/admin/contacts.html" },
  { label: "Retraits", href: "/dash/admin/retraits.html" },
  { label: "Notifications", href: "/dash/admin/notifier.html" },
  { label: "Notif navigateur", href: "/dash/admin/browser-notifications.html" },
  { label: "Email", href: "/dash/admin/emailer.html" },
  { label: "Links", href: "/dash/admin/linkrelease.html" },
  { label: "Lecteurs", href: "/dash/admin/lecteur-ap.html" },
  { label: "Visiteurs", href: "/dash/admin/visiteurs.html" },
  { label: "Documents", href: "/dash/admin/documents.html" }


];

function normalizePath(path) {
  return (path || "").replace(/\/$/, "") || "/";
}

function renderSidebar() {
  document.body.classList.add("admin-with-sidebar");

  const sidebar = document.createElement("aside");
  sidebar.className = "admin-sidebar";

  const currentPathRaw = normalizePath(window.location.pathname);
  
  // Mapper les pages de détail vers leur section principale
  const routeAliases = {
    '/dash/admin/sortie': '/dash/admin/sorties',
    '/dash/admin/release': '/dash/admin/sorties',
    '/dash/admin/artist': '/dash/admin/artistes',
    '/dash/admin/user': '/dash/admin/users'
  };
  const currentPath = routeAliases[currentPathRaw] || currentPathRaw;

  const navLinks = links
    .map(({ label, href }) => {
      const isActive = normalizePath(href) === currentPath;
      return `<a class="admin-sidebar__link${isActive ? " is-active" : ""}" ${isActive ? 'aria-current="page"' : ""} href="${href}">${label}</a>`;
    })
    .join("");

  sidebar.innerHTML = `
    <div class="admin-sidebar__head">
      <div class="admin-sidebar__title">MMCP Admin</div>
      <div class="admin-sidebar__subtitle">Tableau de bord</div>
    </div>
    <nav class="admin-sidebar__nav">${navLinks}</nav>
    <div class="admin-sidebar__foot">
      <a class="admin-sidebar__link" href="/index.html">← Accueil du site</a>
      <button class="admin-sidebar__logout" id="adminSidebarLogout">Déconnexion</button>
    </div>
  `;

  document.body.prepend(sidebar);

  const toggle = document.createElement("button");
  toggle.className = "admin-sidebar-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Ouvrir le menu admin");
  toggle.textContent = "☰";
  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
  });
  document.body.prepend(toggle);

  sidebar.querySelectorAll(".admin-sidebar__link").forEach((a) => {
    a.addEventListener("click", () => {
      if (window.innerWidth <= 960) sidebar.classList.remove("is-open");
    });
  });

  document.addEventListener("click", (event) => {
    if (window.innerWidth > 960) return;
    const inSidebar = sidebar.contains(event.target);
    const inToggle = toggle.contains(event.target);
    if (!inSidebar && !inToggle) sidebar.classList.remove("is-open");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") sidebar.classList.remove("is-open");
  });

  sidebar.querySelector("#adminSidebarLogout")?.addEventListener("click", async () => {
    try {
      const { getApps, initializeApp } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js");
      const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js");
      const firebaseConfig = {
        apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
        authDomain: "morgann-music-cp.firebaseapp.com",
        projectId: "morgann-music-cp",
        storageBucket: "morgann-music-cp.appspot.com",
        messagingSenderId: "666812685196",
        appId: "1:666812685196:web:fe3df6749ae768d68494a9"
      };

      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      await signOut(getAuth(app));
    } catch (error) {
      console.warn("Logout admin sidebar:", error);
    } finally {
      window.location.href = "/login.html";
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderSidebar, { once: true });
} else {
  renderSidebar();
}