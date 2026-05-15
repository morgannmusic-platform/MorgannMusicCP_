// --- Ajout récupération liens depuis too.fm ---
async function fetchTooFmLinks(tooFmUrl) {
  // Appel CORS possible via un Worker ou un proxy si besoin
  const resp = await fetch(tooFmUrl);
  const html = await resp.text();
  // Extraction des liens plateformes
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = {};
  // Spotify
  const spotify = [...doc.querySelectorAll('a')].find(a => a.textContent.toLowerCase().includes('spotify'));
  if (spotify) links.spotify = spotify.href;
  // Deezer
  const deezer = [...doc.querySelectorAll('a')].find(a => a.textContent.toLowerCase().includes('deezer'));
  if (deezer) links.deezer = deezer.href;
  // Apple Music
  const apple = [...doc.querySelectorAll('a')].find(a => a.textContent.toLowerCase().includes('apple'));
  if (apple) links.apple = apple.href;
  // YouTube Music
  const ytm = [...doc.querySelectorAll('a')].find(a => a.textContent.toLowerCase().includes('youtubemusic'));
  if (ytm) links.youtube = ytm.href;
  // Amazon
  const amazon = [...doc.querySelectorAll('a')].find(a => a.textContent.toLowerCase().includes('amazon'));
  if (amazon) links.amazon = amazon.href;
  // Tidal
  const tidal = [...doc.querySelectorAll('a')].find(a => a.textContent.toLowerCase().includes('tidal'));
  if (tidal) links.tidal = tidal.href;
  // Ajoute d'autres plateformes si besoin...
  return links;
}

// Ajoute un bouton pour coller une URL too.fm et remplir les liens plateformes
document.addEventListener('DOMContentLoaded', () => {
  const tooFmDiv = document.createElement('div');
  tooFmDiv.className = 'section';
  tooFmDiv.innerHTML = `
    <h2>Importer liens depuis too.fm</h2>
    <input id="tooFmInput" type="text" placeholder="Colle l'URL too.fm ici" style="width:70%;padding:8px;" />
    <button id="importTooFmBtn" style="padding:8px 16px;margin-left:8px;">Importer</button>
    <div id="tooFmStatus" style="margin-top:8px;font-size:14px;"></div>
  `;
  document.querySelector('.right-col').prepend(tooFmDiv);
  document.getElementById('importTooFmBtn').onclick = async () => {
    const url = document.getElementById('tooFmInput').value.trim();
    const status = document.getElementById('tooFmStatus');
    if (!url.startsWith('http')) { status.textContent = 'URL invalide'; return; }
    status.textContent = 'Récupération des liens...';
    try {
      const links = await fetchTooFmLinks(url);
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      await updateDoc(doc(db, "releases", id), { platformLinks: links });
      status.textContent = 'Liens importés et enregistrés !';
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      status.textContent = 'Erreur : ' + (e.message || e);
    }
  };
});
// --- Ajout bouton trouver les liens plateformes ---
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('findLinksBtn');
  if (!btn) return;
  btn.onclick = async () => {
    const status = document.getElementById('findLinksStatus');
    status.textContent = 'Recherche des liens en cours...';
    btn.disabled = true;
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      const snap = await getDoc(doc(db, "releases", id));
      if (!snap.exists()) throw new Error('Sortie introuvable');
      const data = snap.data();
      // Appel à ton backend local Node.js (à adapter selon ton IP/port)
      // Remplace ici par l'URL de ton Worker Cloudflare
      const resp = await fetch(`https://TON_WORKER.cloudflare.workers.dev/find-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: data.artistName,
          title: data.title,
          trackCount: (data.tracks||[]).length
        })
      });
      if (!resp.ok) throw new Error('Erreur backend: ' + (await resp.text()));
      const links = await resp.json();
      await updateDoc(doc(db, "releases", id), {
        platformLinks: {
          spotify: links.spotify || '',
          deezer: links.deezer || '',
          apple: links.apple || ''
        }
      });
      status.textContent = 'Liens trouvés et enregistrés !';
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      status.textContent = 'Erreur : ' + (e.message || e);
    } finally {
      btn.disabled = false;
    }
  };
});
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

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
const auth = getAuth(app);

async function loadReleaseDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { document.getElementById('loading').textContent = "ID Manquant"; return; }

  const editLink = document.getElementById('editInUploaderLink');
  if (editLink) {
    editLink.href = `/dash/upload.html?edit=${encodeURIComponent(id)}`;
  }

  try {
    // Vérification préalable du rôle admin pour éviter l'erreur de permission silencieuse
    const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (!userSnap.exists() || userSnap.data().role !== 'admin') {
      document.getElementById('loading').innerHTML = "<b style='color:red;'>Accès refusé : Droits administrateur requis.</b>";
      return;
    }

    const snap = await getDoc(doc(db, "releases", id));
    if (!snap.exists()) { document.getElementById('loading').textContent = "Sortie introuvable"; return; }
    
    const data = snap.data();
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    // Infos de base
    document.getElementById('releaseIdLabel').textContent = `ID: ${id}`;
    document.getElementById('releaseTitle').textContent = data.title || "Sans titre";
    document.getElementById('artistName').textContent = `Par ${data.artistName || "Inconnu"}`;
    document.getElementById('type').textContent = (data.type || "Album").toUpperCase();
    document.getElementById('version').textContent = data.version || "Standard";
    document.getElementById('language').textContent = data.language || "N/A";
    document.getElementById('instrumental').textContent = data.instrumental ? "OUI" : "NON";

    // Dates
    document.getElementById('dateSortie').textContent = data.schedule?.releaseDate || "Non fixée";
    document.getElementById('heureSortie').textContent = data.schedule?.releaseTime || "00:00";
    document.getElementById('dateOriginale').textContent = data.schedule?.originalDate || "—";
    document.getElementById('datePreorder').textContent = data.schedule?.preorderDate || "—";

    // Visuels
    if (data.assets?.coverUrl) {
      document.getElementById('coverImg').src = data.assets.coverUrl;
      document.getElementById('coverLink').href = data.assets.coverUrl;
    }

    // Liens plateformes
    // Supprime l'ancien bloc s'il existe
    const oldSection = document.querySelector('.right-col .section.liens-plateformes');
    if (oldSection) oldSection.remove();
    const links = data.platformLinks || {};
    const linksHtml = [];
    if (links.apple) linksHtml.push(`<a href="${links.apple}" target="_blank" class="btn-audio">Apple Music</a>`);
    if (links.spotify) linksHtml.push(`<a href="${links.spotify}" target="_blank" class="btn-audio">Spotify</a>`);
    if (links.deezer) linksHtml.push(`<a href="${links.deezer}" target="_blank" class="btn-audio">Deezer</a>`);
    if (links.youtube) linksHtml.push(`<a href="${links.youtube}" target="_blank" class="btn-audio">YouTube Music</a>`);
    if (linksHtml.length) {
      const section = document.createElement('div');
      section.className = 'section liens-plateformes';
      section.innerHTML = `<h2>Liens plateformes</h2><div class="audio-links">${linksHtml.join('')}</div>`;
      document.querySelector('.right-col').prepend(section);
    }

    // Pistes
    const tracksList = document.getElementById('tracksList');
    const tracks = data.tracks || [];
    document.getElementById('trackCount').textContent = tracks.length;

    tracksList.innerHTML = tracks.map(t => `
      <div class="track-card">
        <div class="track-header">
          <span class="track-title">${t.idx}. ${t.title}</span>
          <span class="badge badge-blue">${t.isrc || "Pas d'ISRC"}</span>
        </div>
        <div style="font-size:13px; color:#86868b; line-height:1.4;">
          <strong>Version:</strong> ${t.versionLine || "Original"}<br>
          <strong>Crédits:</strong> ${t.instrumentCredits || "Aucun spécifié"}<br>
          <strong>Explicit:</strong> ${t.explicit ? "OUI" : "NON"}
        </div>
        <div class="audio-links">
          <a href="${t.files.audioUrl}" target="_blank" class="btn-audio">Audio Principal</a>
          ${t.files.instrumentalUrl ? `<a href="${t.files.instrumentalUrl}" target="_blank" class="btn-audio">Instrumental</a>` : ''}
          ${t.files.atmosUrl ? `<a href="${t.files.atmosUrl}" target="_blank" class="btn-audio">Dolby Atmos</a>` : ''}
        </div>
      </div>
    `).join("");

  } catch (e) { 
    console.error(e);
    if (e.code === 'permission-denied') {
      document.getElementById('loading').textContent = "Erreur de permissions Firestore. Vérifiez les règles.";
    }
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) loadReleaseDetail();
  else window.location.href = "/login.html";
});