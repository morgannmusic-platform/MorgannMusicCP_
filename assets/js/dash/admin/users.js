import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
  authDomain: "morgann-music-cp.firebaseapp.com",
  projectId: "morgann-music-cp",
  storageBucket: "morgann-music-cp.appspot.com",
  messagingSenderId: "666812685196",
  appId: "1:666812685196:web:fe3df6749ae768d68494a9"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const usersList = document.getElementById("usersList");
const statusEl = document.getElementById("status");
const searchEl = document.getElementById("search");

let allUsers = [];
let unsubscribeUsers = null;

function clean(value) {
  return String(value || "").trim();
}

function esc(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeRole(user) {
  return clean(user.role || "user").toLowerCase() || "user";
}

function safePlan(user) {
  return clean(user.plan || user.subscriptionPlan || "starter") || "starter";
}

function userCard(user) {
  const uid = clean(user.uid);
  const displayName = esc(user.displayName || user.name || "Sans nom");
  const email = esc(user.email || "—");
  const role = esc(safeRole(user));
  const plan = esc(safePlan(user));
  const uidPreview = esc(uid ? `${uid.slice(0, 8)}…` : "—");

  return `
    <article class="card">
      <div class="head">
        <div class="name">${displayName}</div>
        <span class="badge">${role}</span>
      </div>

      <div class="line">${email}</div>

      <div class="chips">
        <span class="chip">Plan: ${plan}</span>
        <span class="chip">UID: ${uidPreview}</span>
      </div>

      <div class="actions">
        <a class="btn" href="/dash/admin/account.html?uid=${encodeURIComponent(uid)}">Voir le compte</a>
      </div>
    </article>
  `;
}

function renderUsers() {
  const query = clean(searchEl?.value).toLowerCase();

  const filtered = allUsers.filter((user) => {
    const blob = [
      user.uid,
      user.email,
      user.displayName,
      user.name,
      user.role,
      user.plan,
      user.subscriptionPlan
    ].map(clean).join(" ").toLowerCase();

    return !query || blob.includes(query);
  });

  if (!filtered.length) {
    usersList.innerHTML = `<div class="meta">Aucun compte trouvé.</div>`;
  } else {
    usersList.innerHTML = filtered.map(userCard).join("");
  }

  statusEl.textContent = `${filtered.length} compte(s) affiché(s) sur ${allUsers.length}`;
}

async function ensureAdmin(user) {
  const userSnap = await getDoc(doc(db, "users", user.uid));
  const role = userSnap.exists() ? clean(userSnap.data()?.role).toLowerCase() : "";
  return role === "admin";
}

function startUsersListener() {
  if (unsubscribeUsers) unsubscribeUsers();

  unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
    allUsers = snapshot.docs.map((d) => ({ uid: d.id, ...d.data() }));
    allUsers.sort((a, b) => {
      const ra = safeRole(a) === "admin" ? 0 : 1;
      const rb = safeRole(b) === "admin" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return clean(a.displayName || a.email).localeCompare(clean(b.displayName || b.email), "fr", { sensitivity: "base" });
    });
    renderUsers();
  }, (error) => {
    statusEl.textContent = "Erreur de chargement des comptes.";
    usersList.innerHTML = `<div class="meta">${esc(error?.message || String(error))}</div>`;
  });
}

if (searchEl) {
  searchEl.addEventListener("input", renderUsers);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html?redirect=" + encodeURIComponent(window.location.href);
    return;
  }

  try {
    const isAdmin = await ensureAdmin(user);
    if (!isAdmin) {
      window.location.href = "/dash/index.html";
      return;
    }

    startUsersListener();
  } catch (error) {
    statusEl.textContent = "Impossible de vérifier les droits admin.";
    usersList.innerHTML = `<div class="meta">${esc(error?.message || String(error))}</div>`;
  }
});
