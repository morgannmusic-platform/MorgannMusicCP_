// Script pour lister toutes les sorties Firestore (releases) pour la recherche globale
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
  authDomain: "morgann-music-cp.firebaseapp.com",
  projectId: "morgann-music-cp",
  storageBucket: "morgann-music-cp.firebasestorage.app",
  messagingSenderId: "666812685196",
  appId: "1:666812685196:web:fe3df6749ae768d68494a9",
  measurementId: "G-FKSSXYEZF0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function listAllReleases() {
  const releasesCol = collection(db, 'releases');
  const releasesSnapshot = await getDocs(releasesCol);
  const releases = [];
  releasesSnapshot.forEach(doc => {
    const rel = doc.data();
    rel.id = doc.id;
    if (!rel.deleted) {
      releases.push(rel);
    }
  });
  // Tri décroissant par date de sortie
  releases.sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
  return releases;
}
