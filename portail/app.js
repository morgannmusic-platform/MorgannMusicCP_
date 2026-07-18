import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// Remplacement de getFirestore par initializeFirestore pour désactiver les WebSockets défaillants en local
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ----------------------------------------------------
// 1. CONFIGURATION FIREBASE 
// ----------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
    authDomain: "morgann-music-cp.firebaseapp.com",
    projectId: "morgann-music-cp",
    storageBucket: "morgann-music-cp.firebasestorage.app",
    messagingSenderId: "666812685196",
    appId: "1:666812685196:web:fe3df6749ae768d68494a9",
    measurementId: "G-FKSSXYEZF0"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

// On force l'utilisation du Long Polling HTTP classique à la place des requêtes WebChannel/WebSocket en local
const db = initializeFirestore(firebaseApp, {
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

// Données partagées de session d'état (State)
let currentUserData = null;
let userArtists = [];

// ----------------------------------------------------
// 2. LE ROUTEUR DE LA SPA (Gère les Urls et l'historique)
// ----------------------------------------------------
const routes = {
    '/portail/': viewDashboard,
    '/portail/artistes': viewArtists,
};

async function router() {
    const path = window.location.pathname;
    const viewFn = routes[path] || viewDashboard; // Tombe sur l'accueil par défaut

    // Attendre l'auth Firebase avant de charger
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadSessionData(user);
            document.getElementById('app').innerHTML = await viewFn();
            await postRenderActions(path);
        } else {
            document.getElementById('app').innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-[50vh]">
          <h2 class="text-2xl font-bold text-red-400 mb-2">Accès refusé</h2>
          <p class="text-slate-400">Veuillez vous authentifier sur Morgann Music CP pour continuer.</p>
        </div>
      `;
        }
    });
}

// Permet de naviguer proprement sans recharger la page
window.navigate = (path) => {
    window.history.pushState({}, "", path);
    router();
};

window.onpopstate = router;

// ----------------------------------------------------
// 3. CHARGEMENT DES DONNÉES UTILISATEUR & QUOTAS
// ----------------------------------------------------
async function loadSessionData(user) {
    // A. Récupérer le profil utilisateur
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
        currentUserData = userDoc.data();
        document.getElementById('user-plan-badge').textContent = `Plan : ${currentUserData.planName || 'Starter'}`;
    }

    // B. Récupérer les artistes dans sa sous-collection Firestore : /users/{uid}/artists/
    const artistsColRef = collection(db, "users", user.uid, "artists");
    const snapshot = await getDocs(artistsColRef);
    userArtists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // C. Si aucun artiste n'est créé en arrivant à la racine : Ouvrir la popup d'obligation
    if (window.location.pathname === '/portail/' && userArtists.length === 0) {
        openModal(`
      <div class="text-center p-4">
        <div class="w-16 h-16 bg-teal-500/10 text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">Bienvenue sur Morgann Music CP !</h3>
        <p class="text-slate-400 text-sm mb-6">Pour commencer à distribuer vos morceaux, vous devez d'abord configurer votre profil d'artiste principal.</p>
        <button onclick="closeModal(); navigate('/portail/artistes');" class="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold px-6 py-2.5 rounded-lg w-full transition">Créer mon premier artiste</button>
      </div>
    `);
    }
}

// ----------------------------------------------------
// 4. LES "PAGES" (VUES DE LA SPA)
// ----------------------------------------------------

// PAGE A : DASHBOARD ACCUEIL
function viewDashboard() {
    return `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-2xl border border-slate-800">
        <h1 class="text-3xl font-extrabold text-white">Bonjour, ${currentUserData?.fullName || 'Artiste'} 👋</h1>
        <p class="text-slate-400 mt-2">Bienvenue sur votre portail de distribution en marque blanche.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-slate-900 p-6 rounded-xl border border-slate-800">
          <h3 class="text-lg font-bold text-white mb-4">Vos statistiques d'artistes</h3>
          <p class="text-4xl font-extrabold text-teal-400">${userArtists.length}</p>
          <p class="text-slate-500 text-xs mt-1">Artiste(s) enregistré(s) sur votre compte.</p>
        </div>
      </div>
    </div>
  `;
}

// PAGE B : LISTE ET CRÉATION DES ARTISTES
function viewArtists() {
    const plan = currentUserData?.planName || 'Starter';
    // Blocage de création d'artiste selon le plan (Starter = max 1 artiste)
    const isLimitReached = (plan.toLowerCase() === 'starter' && userArtists.length >= 1);

    let artistCards = userArtists.map(artist => `
    <div class="bg-slate-900 p-5 rounded-xl border border-slate-800 flex justify-between items-center hover:border-slate-700 transition">
      <div>
        <h4 class="text-lg font-bold text-white">${artist.name}</h4>
        <span class="text-slate-500 text-xs">Genre: ${artist.primaryGenre || 'Non défini'}</span>
      </div>
      <button onclick="openArtistDetails('${artist.id}')" class="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition">Détails</button>
    </div>
  `).join('');

    if (userArtists.length === 0) {
        artistCards = `<p class="col-span-full text-slate-500 py-6 text-center">Aucun artiste enregistré pour l'instant.</p>`;
    }

    return `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-extrabold text-white">Gérer mes Artistes</h2>
          <p class="text-slate-400 text-sm">Créez et configurez les artistes pour vos sorties.</p>
        </div>
        ${isLimitReached ? `
          <div class="text-amber-500 text-sm bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-lg">
            Limite atteinte pour l'offre Starter (Max 1 artiste)
          </div>
        ` : `
          <button id="btn-open-create" class="bg-teal-500 hover:bg-teal-400 text-slate-950 px-5 py-2.5 rounded-lg font-semibold transition">Créer un artiste</button>
        `}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${artistCards}
      </div>

      <!-- Section Formulaire de création d'artiste (caché par défaut) -->
      <div id="create-artist-section" class="hidden bg-slate-900 border border-slate-800 rounded-xl p-6 mt-8 space-y-4 max-w-2xl">
        <h3 class="text-lg font-bold text-white">Nouvel Artiste</h3>
        <form id="artist-form" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Nom de l'artiste *</label>
            <input type="text" id="art-name" required class="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-teal-500">
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Genre Principal *</label>
              <select id="art-genre" required class="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-teal-500">
                <option value="Hip-Hop/Rap">Hip-Hop/Rap</option>
                <option value="Pop">Pop</option>
                <option value="Electro">Electro</option>
                <option value="Rock">Rock</option>
                <option value="R&B">R&B</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Collaborateur (Feat principal)</label>
              <input type="text" id="art-feat" placeholder="Ex: DJ Shadow" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-teal-500">
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">ID Spotify d'artiste (Optionnel)</label>
            <input type="text" id="art-spotify" placeholder="spotify:artist:..." class="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-teal-500">
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">ID Apple Music d'artiste (Optionnel)</label>
            <input type="text" id="art-apple" placeholder="1234567..." class="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-teal-500">
          </div>
          <div class="flex gap-3 pt-2">
            <button type="submit" class="bg-teal-500 hover:bg-teal-400 text-slate-950 px-6 py-2.5 rounded-lg font-semibold transition">Envoyer et Sauvegarder</button>
            <button type="button" id="btn-cancel-create" class="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-lg font-semibold transition">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// 5. ACTIONS COMPORTEMENTALES (Après injection HTML)
// ----------------------------------------------------
async function postRenderActions(path) {
    if (path === '/portail/artistes') {
        const btnOpen = document.getElementById('btn-open-create');
        const btnCancel = document.getElementById('btn-cancel-create');
        const formSec = document.getElementById('create-artist-section');
        const form = document.getElementById('artist-form');

        if (btnOpen) {
            btnOpen.addEventListener('click', () => formSec.classList.remove('hidden'));
        }
        if (btnCancel) {
            btnCancel.addEventListener('click', () => formSec.classList.add('hidden'));
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('art-name').value;
                const genre = document.getElementById('art-genre').value;
                const feat = document.getElementById('art-feat').value;
                const spotifyId = document.getElementById('art-spotify').value;
                const appleMusicId = document.getElementById('art-apple').value;

                const user = auth.currentUser;
                const token = await user.getIdToken();

                try {
                    const response = await fetch("https://api.distribution.mm-cp.uk/liaison-artiste", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            name,
                            genre,
                            feat,
                            spotifyId,
                            appleMusicId
                        })
                    });

                    // Sécurisation : On vérifie si la réponse est bien du JSON avant de tenter de la lire.
                    const contentType = response.headers.get("content-type");
                    let resData = {};

                    if (contentType && contentType.includes("application/json")) {
                        resData = await response.json();
                    } else {
                        // Si le serveur a crashé ou renvoyé du HTML (ex: erreur 404), on récupère le texte brut
                        const rawText = await response.text();
                        console.error('Réponse non-JSON reçue du serveur :', rawText);
                        throw new Error(`Le serveur a renvoyé une réponse inattendue (Code ${response.status}).`);
                    }

                    if (response.ok && resData.success) {
                        alert(`L'artiste ${name} a été validé par Too Lost.`);
                        navigate('/portail/artistes');
                    } else {
                        console.error('API error response:', response.status, resData);
                        const errorMsg = resData.error || `Status ${response.status}: ${response.statusText}`;
                        alert(`Erreur lors de la création de l'artiste : ${errorMsg}`);
                    }
                } catch (err) {
                    console.error('Fetch exception:', err);
                    alert(`Erreur de communication avec l'API : ${err.message}`);
                }
            });
        }
    }
}

// ----------------------------------------------------
// 6. ACTIONS DÉTAILS ET MODIFICATION (POPUP)
// ----------------------------------------------------
window.openArtistDetails = function (artistId) {
    const artist = userArtists.find(a => a.id === artistId);
    if (!artist) return;

    openModal(`
    <div class="space-y-4">
      <div class="border-b border-slate-800 pb-3">
        <h3 class="text-xl font-bold text-white">${artist.name}</h3>
        <p class="text-slate-500 text-xs">Le nom d'un artiste validé sur les plateformes ne peut plus être modifié directement.</p>
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Genre Principal</label>
        <input type="text" id="edit-genre" value="${artist.primaryGenre || ''}" class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white">
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Collaborateur (Feats réguliers)</label>
        <input type="text" id="edit-feat" value="${artist.feat || ''}" class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white">
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Lien / ID Spotify</label>
        <input type="text" id="edit-spotify" value="${artist.spotify_id || ''}" class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white">
      </div>
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Lien / ID Apple Music</label>
        <input type="text" id="edit-apple" value="${artist.apple_music_id || ''}" class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white">
      </div>
      <div class="flex gap-2 pt-4">
        <button onclick="saveArtistEdits('${artist.id}')" class="bg-teal-500 hover:bg-teal-400 text-slate-950 px-4 py-2 rounded-lg font-bold text-sm transition">Sauvegarder</button>
        <button onclick="closeModal()" class="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition">Fermer</button>
      </div>
    </div>
  `);
};

window.saveArtistEdits = async function (artistId) {
    const genre = document.getElementById('edit-genre').value;
    const feat = document.getElementById('edit-feat').value;
    const spotifyId = document.getElementById('edit-spotify').value;
    const appleMusicId = document.getElementById('edit-apple').value;

    const user = auth.currentUser;
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${user.uid}/artists/${artistId}?updateMask.fieldPaths=primaryGenre&updateMask.fieldPaths=feat&updateMask.fieldPaths=spotify_id&updateMask.fieldPaths=apple_music_id`;

    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            fields: {
                primaryGenre: { stringValue: genre },
                feat: { stringValue: feat },
                spotify_id: { stringValue: spotifyId },
                apple_music_id: { stringValue: appleMusicId }
            }
        })
    });

    if (response.ok) {
        alert("Informations mises à jour !");
        closeModal();
        navigate('/portail/artistes');
    } else {
        alert("Erreur lors de la mise à jour");
    }
};

// ----------------------------------------------------
// 7. GESTION DU MODAL GLOBAL
// ----------------------------------------------------
window.openModal = function (contentHtml) {
    const modal = document.getElementById('global-modal');
    document.getElementById('modal-content').innerHTML = contentHtml;
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('opacity-100');
    }, 10);
};

window.closeModal = function () {
    const modal = document.getElementById('global-modal');
    modal.classList.remove('opacity-100');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 250);
};

// Lancement initial du routeur au chargement de la page
router();