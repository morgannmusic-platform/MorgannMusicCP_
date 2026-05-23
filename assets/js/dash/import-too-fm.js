// Importation liens too.fm pour release.html
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// Fonction pour extraire les liens depuis une page too.fm
async function fetchTooFmLinks(tooFmUrl) {
  const resp = await fetch(tooFmUrl);
  const html = await resp.text();
  const parser = new DOMParser();
  const docHtml = parser.parseFromString(html, 'text/html');
  const links = {};
  const getLink = (name) => [...docHtml.querySelectorAll('a')].find(a => a.textContent.toLowerCase().includes(name));
  const spotify = getLink('spotify');
  if (spotify) links.spotify = spotify.href;
  const deezer = getLink('deezer');
  if (deezer) links.deezer = deezer.href;
  const apple = getLink('apple');
  if (apple) links.apple = apple.href;
  const ytm = getLink('youtubemusic');
  if (ytm) links.youtube = ytm.href;
  const amazon = getLink('amazon');
  if (amazon) links.amazon = amazon.href;
  const tidal = getLink('tidal');
  if (tidal) links.tidal = tidal.href;
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
