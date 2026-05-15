// lecteur-ap-admin.js
// Gestion de l'admin pour créer des lecteurs d'avant-première (Firebase)

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, updateDoc, doc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
  authDomain: "morgann-music-cp.firebaseapp.com",
  projectId: "morgann-music-cp",
  storageBucket: "morgann-music-cp.firebasestorage.app",
  messagingSenderId: "666812685196",
  appId: "1:666812685196:web:fe3df6749ae768d68494a9"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const addBtn = document.getElementById('ap-admin-add');
const modal = document.getElementById('ap-admin-modal');
const saveBtn = document.getElementById('ap-admin-save');
const cancelBtn = document.getElementById('ap-admin-cancel');
const codeInput = document.getElementById('ap-admin-code');
const titleInput = document.getElementById('ap-admin-title');
const artistInput = document.getElementById('ap-admin-artist');
const audioInput = document.getElementById('ap-admin-audio');
const errorDiv = document.getElementById('ap-admin-error');
const listDiv = document.getElementById('ap-admin-list');

let currentEditId = null;
async function renderList() {
  listDiv.innerHTML = '';
  const q = query(collection(db, "lecteurAP"));
  const snap = await getDocs(q);
  snap.forEach(d => {
    const lecteur = d.data();
    const div = document.createElement('div');
    div.className = 'ap-admin-item';
    div.innerHTML = `<b>${lecteur.title}</b> — ${lecteur.artist} <span class='ap-admin-code'>[${lecteur.code}]</span> <button class='ap-admin-edit' data-id='${d.id}'>Modifier</button>`;
    listDiv.appendChild(div);
  });
  // Ajoute les listeners sur les boutons Modifier
  document.querySelectorAll('.ap-admin-edit').forEach(btn => {
    btn.onclick = async function() {
      const id = btn.getAttribute('data-id');
      const q = query(collection(db, "lecteurAP"));
      const snap = await getDocs(q);
      let lecteurDoc = null;
      snap.forEach(d => { if (d.id === id) lecteurDoc = d; });
      if (!lecteurDoc) return;
      const lecteur = lecteurDoc.data();
      codeInput.value = lecteur.code;
      titleInput.value = lecteur.title;
      artistInput.value = lecteur.artist;
      audioInput.value = '';
      modal.style.display = '';
      errorDiv.textContent = '';
      currentEditId = id;
    };
  });
}

addBtn.onclick = function() {
  modal.style.display = '';
  codeInput.value = '';
  titleInput.value = '';
  artistInput.value = '';
  audioInput.value = '';
  errorDiv.textContent = '';
  currentEditId = null;
};

cancelBtn.onclick = function() {
  modal.style.display = 'none';
 };



saveBtn.onclick = async function(event) {
  event?.preventDefault?.();
  errorDiv.textContent = '';
  const code = codeInput.value.trim();
  const title = titleInput.value.trim();
  const artist = artistInput.value.trim();
  const file = audioInput.files[0];
  if (!code || !title || !artist || (!file && !currentEditId)) {
    errorDiv.textContent = 'Tous les champs sont obligatoires.';
    return;
  }
  if (!currentEditId) {
    // Création
    const q = query(collection(db, "lecteurAP"));
    const snap = await getDocs(q);
    let codeExists = false;
    snap.forEach(doc => { if (doc.data().code === code) codeExists = true; });
    if (codeExists) {
      errorDiv.textContent = 'Ce code existe déjà.';
      return;
    }
    const progressBar = document.getElementById('ap-admin-progress-bar');
    const progress = document.getElementById('ap-admin-progress');
    progressBar.style.display = '';
    progress.style.width = '0%';
    const storageRef = ref(storage, `lecteur-ap/${code}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on('state_changed', (snapshot) => {
      const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      progress.style.width = percent + '%';
    }, (error) => {
      errorDiv.textContent = 'Erreur upload : ' + error.message;
      progressBar.style.display = 'none';
    }, async () => {
      const audioUrl = await getDownloadURL(uploadTask.snapshot.ref);
      console.log('URL fichier uploadé:', audioUrl);
      await addDoc(collection(db, "lecteurAP"), {
        code,
        title,
        artist,
        audioUrl,
        createdAt: new Date().toISOString()
      });
      progress.style.width = '100%';
      setTimeout(() => { progressBar.style.display = 'none'; }, 500);
      modal.style.display = 'none';
      renderList();
    });
  } else {
    // Edition
    const lecteurRef = doc(db, "lecteurAP", currentEditId);
    await updateDoc(lecteurRef, { code, title, artist });
    modal.style.display = 'none';
    renderList();
  }
};


document.addEventListener('DOMContentLoaded', renderList);
