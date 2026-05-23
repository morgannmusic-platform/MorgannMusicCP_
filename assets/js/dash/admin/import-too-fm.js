// Importation liens too.fm pour admin/release.html
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// Fonction pour extraire les liens depuis une page too.fm
async function fetchTooFmLinks(tooFmUrl) {
  // Utilise le proxy Cloudflare Worker pour contourner le CORS
  const resp = await fetch('https://patient-queen-4892.morgann-rachedi.workers.dev/?url=' + encodeURIComponent(tooFmUrl));
  if (!resp.ok) throw new Error('Proxy error: ' + resp.status);
  const html = await resp.text();
  const parser = new DOMParser();
  const docHtml = parser.parseFromString(html, 'text/html');
  const links = {};
  // Récupère les liens dont l'attribut service contient les plateformes cibles
  const anchors = [...docHtml.querySelectorAll('a[service]')];
  for (const a of anchors) {
    const service = (a.getAttribute('service') || '').toLowerCase();
    const href = a.href;
    if (!href) continue;
    if (service.includes('spotify')) links.spotify = href;
    if (service.includes('deezer')) links.deezer = href;
    if (service.includes('apple')) links.apple = href;
    if (service.includes('youtubemusic')) links.youtube = href;
  }
  return links;
}

export function injectTooFmImport(db, releaseId) {
  const container = document.createElement('div');
  container.className = 'card';
  container.innerHTML = `
    <h3>Importer liens depuis too.fm</h3>
    <input id="tooFmInput" type="text" placeholder="Colle l'URL too.fm ici" style="width:70%;padding:8px;" />
    <button id="importTooFmBtn" style="padding:8px 16px;margin-left:8px;">Importer</button>
    <div id="tooFmStatus" style="margin-top:8px;font-size:14px;"></div>
  `;
  document.querySelector('.container').prepend(container);
  document.getElementById('importTooFmBtn').onclick = async () => {
    const url = document.getElementById('tooFmInput').value.trim();
    const status = document.getElementById('tooFmStatus');
    if (!url.startsWith('http')) { status.textContent = 'URL invalide'; return; }
    status.textContent = 'Récupération des liens...';
    try {
      const links = await fetchTooFmLinks(url);
      await updateDoc(doc(db, "releases", releaseId), { platformLinks: links });
      status.textContent = 'Liens importés et enregistrés !';
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      status.textContent = 'Erreur : ' + (e.message || e);
    }
  };
}
