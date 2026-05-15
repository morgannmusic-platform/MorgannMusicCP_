import {
  signIn,
  getSession,
  clearSession,
  ensureFreshSession,
  loadReleases,
  loadNotifications
} from "./firebase-rest.js";

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const userEmail = document.getElementById("userEmail");
const releasesList = document.getElementById("releasesList");
const notificationsList = document.getElementById("notificationsList");
const releaseCount = document.getElementById("releaseCount");
const notifCount = document.getElementById("notifCount");

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
  logoutBtn.hidden = true;
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  logoutBtn.hidden = false;
}

function itemHtml(title, metaA, metaB) {
  return `
    <li class="item">
      <p class="title">${title}</p>
      <p class="meta">${metaA}</p>
      <p class="meta">${metaB}</p>
    </li>
  `;
}

function safeText(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderReleases(items) {
  releaseCount.textContent = String(items.length);
  if (!items.length) {
    releasesList.innerHTML = '<li class="empty">Aucune sortie pour ce compte.</li>';
    return;
  }

  releasesList.innerHTML = items
    .slice(0, 12)
    .map((item) => itemHtml(
      safeText(item.title),
      `Statut: ${safeText(item.statusUser)}`,
      `${safeText(item.artistName)} - ${safeText(item.releaseDate)}`
    ))
    .join("");
}

function renderNotifications(items) {
  notifCount.textContent = String(items.length);
  if (!items.length) {
    notificationsList.innerHTML = '<li class="empty">Aucune notification.</li>';
    return;
  }

  notificationsList.innerHTML = items
    .slice(0, 12)
    .map((item) => itemHtml(
      safeText(item.title),
      safeText(item.message),
      item.read ? "Lu" : "Non lu"
    ))
    .join("");
}

async function loadDashboardData(session) {
  userEmail.textContent = session.email || "-";
  releasesList.innerHTML = '<li class="empty">Chargement...</li>';
  notificationsList.innerHTML = '<li class="empty">Chargement...</li>';

  const [releases, notifications] = await Promise.all([
    loadReleases(session),
    loadNotifications(session)
  ]);

  renderReleases(releases);
  renderNotifications(notifications);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const session = await signIn(email, password);
    showDashboard();
    await loadDashboardData(session);
  } catch (error) {
    loginError.textContent = `Connexion refusee: ${error.message || error}`;
  }
});

logoutBtn.addEventListener("click", async () => {
  await clearSession();
  showLogin();
});

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  try {
    const session = await ensureFreshSession();
    if (!session) {
      showLogin();
      return;
    }
    await loadDashboardData(session);
  } catch (error) {
    loginError.textContent = `Erreur session: ${error.message || error}`;
    showLogin();
  } finally {
    refreshBtn.disabled = false;
  }
});

async function init() {
  showLogin();
  try {
    const existing = await getSession();
    if (!existing) return;

    const session = await ensureFreshSession();
    if (!session) return;

    showDashboard();
    await loadDashboardData(session);
  } catch (_) {
    showLogin();
  }
}

init();
