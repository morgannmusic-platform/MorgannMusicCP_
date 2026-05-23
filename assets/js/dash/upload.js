// JS pour uploader une sortie complète dans Firestore

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
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
window.db = db;
window.auth = auth;

// Récupère toutes les données du formulaire
async function collectAndSendRelease(e) {
  e.preventDefault();
  const form = document.getElementById('releaseForm');
  const formData = new FormData(form);
  // Récupération de tous les champs simples
  const data = Object.fromEntries(formData.entries());

  // Champs spéciaux (cases à cocher, multi-select, etc.)
  data.mainArtistSelect = Array.from(document.getElementById('mainArtistSelect').selectedOptions).map(opt => opt.value);
  data.isInstrumentalRelease = document.getElementById('isInstrumentalRelease').checked;
  data.originalDate = document.getElementById('originalDateCheck').checked ? document.getElementById('originalDate').value : null;
  data.preorderDate = document.getElementById('preorderDateCheck').checked ? document.getElementById('preorderDate').value : null;
  data.lyricFind = document.getElementById('lyricFind').checked;
  // Ajoute ici tous les autres checkboxes si besoin

  // TODO: Ajouter la récupération des pistes (tracks) et des fichiers uploadés
  data.tracks = window.uploadedTracks || [];

  data.createdAt = serverTimestamp();

  try {
    await addDoc(collection(db, 'sorties'), data);
    alert('Sortie enregistrée avec succès !');
    form.reset();
  } catch (err) {
    alert('Erreur Firestore : ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('releaseForm').addEventListener('submit', collectAndSendRelease);
});
