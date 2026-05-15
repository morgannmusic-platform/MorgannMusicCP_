const SIDEBAR_URL = '/sidebar.html';
const SIDEBAR_CSS_URL = '/assets/css/dash/artist-sidebar.css';

const SIDEBAR_FALLBACK_HTML = `
<aside class="sidebar">
  <div class="sidebar__profile" id="sidebarProfile">
    <div class="sidebar__profile-click" id="sidebarProfileBtn" tabindex="0" aria-haspopup="true" aria-expanded="false" style="display:flex;align-items:center;gap:14px;width:100%;background:none;border:none;cursor:pointer;padding:0;outline:none;">
      <img src="/assets/img/dash/default-avatar.png" alt="Avatar" class="sidebar__avatar" id="sidebarAvatar">
      <div class="sidebar__user">
        <div class="sidebar__name" id="sidebarName">Utilisateur</div>
        <div class="sidebar__role" id="sidebarRole">Artiste</div>
      </div>
    </div>
    <div class="sidebar__profile-menu" id="sidebarProfileMenu">
      <a href="/account.html" class="sidebar__profile-link"><img class="sidebar__icon" src="/assets/icon/User-Full-Body--Streamline-Flex.svg" alt="">Compte</a>
      <a href="/index.html" class="sidebar__profile-link"><img class="sidebar__icon" src="/assets/icon/Home-2--Streamline-Flex.svg" alt="">Accueil</a>
      <a href="/dash/admin/index.html" class="sidebar__profile-link" id="sidebarAdminLink" style="display:none;"><img class="sidebar__icon" src="/assets/icon/Code-Monitor-1--Streamline-Flex.svg" alt="">Dashboard admin</a>
      <a href="/login.html" class="sidebar__profile-link" id="sidebarLogout"><img class="sidebar__icon" src="/assets/icon/Logout-1--Streamline-Flex.svg" alt="">Déconnexion</a>
    </div>
  </div>
  <nav class="sidebar__nav">
    <a class="sidebar__link" href="/dash/index.html" data-path="/dash/index.html"><img class="sidebar__icon" src="/assets/icon/Home-2--Streamline-Flex.svg" alt="">Dashboard</a>
    <a class="sidebar__link" href="/dash/artistes.html" data-path="/dash/artistes.html"><img class="sidebar__icon" src="/assets/icon/Artist-Song--Streamline-Flex.svg" alt="">Mes artistes</a>
    <a class="sidebar__link" href="/dash/sorties.html" data-path="/dash/sorties.html"><img class="sidebar__icon" src="/assets/icon/Music-Note-Circle--Streamline-Flex.svg" alt="">Mes sorties</a>
    <a class="sidebar__link" href="/dash/promotion.html" data-path="/dash/promotion.html"><img class="sidebar__icon" src="/assets/icon/Megaphone-1--Streamline-Flex.svg" alt="">Promotion <span class="sidebar__badge">bêta</span></a>
    <a class="sidebar__link" href="/dash/upload.html" data-path="/dash/upload.html"><img class="sidebar__icon" src="/assets/icon/Add-To-Playlist--Streamline-Flex.svg" alt="">Nouvelle sortie</a>
    <a class="sidebar__link" href="/dash/accompagnement.html" data-path="/dash/accompagnement.html"><img class="sidebar__icon" src="/assets/icon/Hand-Held-Tablet-Writing--Streamline-Flex.svg" alt="">Accompagnement</a>
    <a class="sidebar__link" href="/dash/convert.html" data-path="/dash/convert.html"><img class="sidebar__icon" src="/assets/icon/Investing-And-Banking--Streamline-Flex.svg" alt="">Convertisseur <span class="sidebar__badge">bêta</span></a>
    <a class="sidebar__link" href="/dash/litualai.html" data-path="/dash/litualai.html"><img class="sidebar__icon" src="/assets/Litual/o!§ititititt.png" alt="">Litual AI</a>
    <a class="sidebar__link" href="/dash/support/index.html" data-path="/dash/support/index.html"><img class="sidebar__icon" src="/assets/icon/Information-Circle--Streamline-Flex.svg" alt="">Support</a>
  </nav>
  <div class="sidebar__footer">© 2026 Morgann Music CP</div>
</aside>
`;

function normalizePath(rawPath) {
  if (!rawPath) return '/';
  let path = String(rawPath).split('?')[0].split('#')[0];
  path = path.replace(/\/+$/, '');
  if (!path) path = '/';
  if (path.endsWith('/index')) path = path.slice(0, -6);
  if (path.endsWith('.html')) path = path.slice(0, -5);
  return path || '/';
}

function setActiveSidebarLink(sidebarRoot) {
  const links = Array.from(sidebarRoot.querySelectorAll('.sidebar__link'));
  if (!links.length) return;

  const currentPathRaw = normalizePath(window.location.pathname);
  const routeAliases = {
    '/dash/artist': '/dash/artistes',
    '/dash/release': '/dash/sorties',
    '/dash/edit-release': '/dash/sorties',
    '/dash/next-release': '/dash/sorties'
  };
  const currentPath = routeAliases[currentPathRaw] || currentPathRaw;
  let bestMatch = null;
  let bestScore = -1;

  links.forEach((link) => {
    link.classList.remove('active');

    const targetRaw = link.dataset.path || link.getAttribute('href') || '';
    const targetPath = normalizePath(targetRaw);
    if (!targetPath) return;

    const isExact = currentPath === targetPath;
    const isSection = currentPath.startsWith(`${targetPath}/`);
    if (!isExact && !isSection) return;

    const score = (isExact ? 1000 : 0) + targetPath.length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = link;
    }
  });

  if (bestMatch) bestMatch.classList.add('active');
}

function ensureSidebarCss() {
  if (document.getElementById('sidebar-css')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = SIDEBAR_CSS_URL;
  link.id = 'sidebar-css';
  document.head.appendChild(link);
}

function parseSidebarFromHtml(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.querySelector('.sidebar');
}

function bindProfileMenu(sidebar) {
  const profileBtn = sidebar.querySelector('#sidebarProfileBtn');
  const profileMenu = sidebar.querySelector('#sidebarProfileMenu');
  if (!profileBtn || !profileMenu) return;

  const toggleMenu = (e) => {
    e.stopPropagation();
    const isOpen = profileMenu.classList.toggle('open');
    profileBtn.setAttribute('aria-expanded', String(isOpen));
  };

  profileBtn.addEventListener('click', toggleMenu);
  profileBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') toggleMenu(e);
  });

  document.addEventListener('click', (e) => {
    if (!profileMenu.classList.contains('open')) return;
    if (!profileMenu.contains(e.target) && !profileBtn.contains(e.target)) {
      profileMenu.classList.remove('open');
      profileBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

function mountSidebar(html) {
  const parsed = parseSidebarFromHtml(html);
  if (!parsed) return null;

  const current = document.querySelector('.sidebar');
  if (current) {
    current.replaceWith(parsed);
  } else {
    document.body.prepend(parsed);
  }

  document.body.classList.add('with-artist-sidebar');
  setActiveSidebarLink(parsed);
  bindProfileMenu(parsed);
  return parsed;
}

function applyUserDataToSidebar(sidebar, user, userDoc) {
  if (!sidebar || !user || !userDoc) return;

  const name = user.displayName || userDoc.displayName || userDoc.name || userDoc.fullName || user.email || 'Utilisateur';
  const sidebarName = sidebar.querySelector('#sidebarName');
  if (sidebarName) sidebarName.textContent = name;

  const role = (userDoc.role || '').toLowerCase();
  const sidebarRole = sidebar.querySelector('#sidebarRole');
  if (sidebarRole) sidebarRole.textContent = role === 'admin' ? 'Admin' : (role.charAt(0).toUpperCase() + role.slice(1) || 'Artiste');

  const avatarUrl = user.photoURL || userDoc.photoURL || userDoc.avatarUrl || userDoc.avatarURL;
  const sidebarAvatar = sidebar.querySelector('#sidebarAvatar');
  if (sidebarAvatar && avatarUrl) sidebarAvatar.src = avatarUrl;

  if (role === 'admin') {
    sidebar.querySelectorAll('#sidebarAdminLink').forEach((link) => { link.style.display = 'block'; });
    document.querySelectorAll('.admin-only-link').forEach((link) => { link.style.display = 'block'; });
  }
}

async function hydrateCurrentUser() {
  if (window.currentUser !== undefined) {
    return { user: window.currentUser, userDoc: window.currentUserDoc || null };
  }

  const { initializeApp, getApp } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js');
  const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js');
  const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js');

  const firebaseConfig = {
    apiKey: 'AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc',
    authDomain: 'morgann-music-cp.firebaseapp.com',
    projectId: 'morgann-music-cp',
    storageBucket: 'morgann-music-cp.firebasestorage.app',
    messagingSenderId: '666812685196',
    appId: '1:666812685196:web:fe3df6749ae768d68494a9'
  };

  let app;
  try {
    app = getApp();
  } catch {
    app = initializeApp(firebaseConfig);
  }

  const auth = getAuth(app);
  const db = getFirestore(app);

  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      window.currentUser = user;
      if (!user) {
        window.currentUserDoc = null;
        resolve({ user: null, userDoc: null });
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const firestoreProfile = userSnap.exists() ? (userSnap.data() || {}) : {};
        window.currentUserDoc = {
          ...firestoreProfile,
          email: firestoreProfile.email || user.email || null,
          displayName: firestoreProfile.displayName || firestoreProfile.name || user.displayName || null,
          photoURL: firestoreProfile.photoURL || firestoreProfile.avatarUrl || user.photoURL || null
        };
      } catch {
        window.currentUserDoc = {
          email: user.email || null,
          displayName: user.displayName || null,
          photoURL: user.photoURL || null,
          role: null
        };
      }

      resolve({ user, userDoc: window.currentUserDoc });
    });
  });
}

async function buildSidebar() {
  try {
    ensureSidebarCss();

    // Affiche immédiatement une sidebar locale, puis remplace silencieusement par la version distante.
    let sidebar = mountSidebar(SIDEBAR_FALLBACK_HTML);

    fetch(SIDEBAR_URL, { cache: 'force-cache' })
      .then((r) => (r.ok ? r.text() : null))
      .then((html) => {
        if (!html) return;
        const mounted = mountSidebar(html);
        if (mounted) {
          sidebar = mounted;
          applyUserDataToSidebar(sidebar, window.currentUser, window.currentUserDoc);
        }
      })
      .catch(() => {});

    hydrateCurrentUser()
      .then(({ user, userDoc }) => {
        applyUserDataToSidebar(sidebar, user, userDoc);
      })
      .catch((e) => {
        console.warn('Firebase init/user fetch failed', e);
      });
  } catch (e) {
    console.warn('Sidebar injection failed', e);
  }
}

if (document.body) {
  buildSidebar();
} else {
  document.addEventListener('DOMContentLoaded', buildSidebar, { once: true });
}

