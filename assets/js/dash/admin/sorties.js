// Affichage détaillé de toutes les sorties Firestore dans l'admin
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
  authDomain: "morgann-music-cp.firebaseapp.com",
  projectId: "morgann-music-cp",
  storageBucket: "morgann-music-cp.firebasestorage.app",
  messagingSenderId: "666812685196",
  appId: "1:666812685196:web:fe3df6749ae768d68494a9"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

async function loadSorties() {
  const list = document.querySelector('.list');
  list.innerHTML = '<div class="muted">Chargement...</div>';
  const q = query(collection(db, 'releases'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  list.innerHTML = '';
  if (snap.empty) {
    list.innerHTML = '<div class="muted">Aucune sortie trouvée.</div>';
    return;
  }
  snap.forEach(doc => {
    const data = doc.data();
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div>
        <div class="name">${data.title || '(Sans titre)'}</div>
        <div class="meta">${data.artistName || 'Artiste inconnu'}</div>
        <div class="meta">Type : ${data.type || ''} | Sortie : ${data.schedule?.releaseDate || ''}</div>
      </div>
      <div class="actions">
        <a href="sortie.html?id=${doc.id}" style="padding: 8px 12px; background: var(--purple); color: white; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 700;">Détails</a>
        <span class="status">${data.statusAdmin || 'À vérifier'}</span>
        <span class="muted">ID: ${doc.id}</span>
      </div>
    `;
    list.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', loadSorties);
