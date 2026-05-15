console.log("JS chargé");
// lecteur-ap.js
// Gestion du pop-up code et affichage du lecteur (Firestore)

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, collection, query, getDocs } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
  authDomain: "morgann-music-cp.firebaseapp.com",
  projectId: "morgann-music-cp",
  storageBucket: "morgann-music-cp.appspot.com",
  messagingSenderId: "666812685196",
  appId: "1:666812685196:web:fe3df6749ae768d68494a9"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const modal = document.getElementById('ap-modal');
const submitBtn = document.getElementById('ap-submit');
const exitBtn = document.getElementById('ap-exit');
const codeInput = document.getElementById('ap-code');
const errorDiv = document.getElementById('ap-error');
const lecteurContainer = document.getElementById('ap-lecteur-container');
const audioEl = document.getElementById('ap-audio');
const titleEl = document.getElementById('ap-title');
const artistEl = document.getElementById('ap-artist');

let lecteurs = null;

async function fetchLecteurs() {
  lecteurs = {};
  const q = query(collection(db, "lecteurAP"));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const data = doc.data();
    lecteurs[data.code] = data;
  });
}

function checkCode(code) {
  return lecteurs && lecteurs[code] ? lecteurs[code] : null;
}

// --- LECTEUR AUDIO CUSTOM ---
const playBtn = document.getElementById('ap-play');
const progressBar = document.getElementById('ap-progress');
const currentTimeEl = document.getElementById('ap-current');
const durationEl = document.getElementById('ap-duration');
const coverEl = document.getElementById('ap-cover');

submitBtn.onclick = async function() {
  errorDiv.textContent = '';
  if (!lecteurs) await fetchLecteurs();
  const code = codeInput.value.trim();
  const lecteur = checkCode(code);
  if (!lecteur) {
    errorDiv.textContent = "Code invalide ou aucun fichier associé.";
    return;
  }
  modal.style.display = 'none';
  lecteurContainer.style.display = '';
  titleEl.textContent = lecteur.title;
  artistEl.textContent = lecteur.artist;
  audioEl.src = lecteur.audioUrl;
  coverEl.src = lecteur.coverUrl || '/assets/img/default-cover.png';
  audioEl.load();
  playBtn.innerHTML = '⏵';
  progressBar.value = 0;
  currentTimeEl.textContent = '0:00';
  durationEl.textContent = '0:00';
};

playBtn.onclick = function() {
  if (audioEl.paused) {
    audioEl.play();
    playBtn.innerHTML = '⏸';
  } else {
    audioEl.pause();
    playBtn.innerHTML = '⏵';
  }
};

audioEl.addEventListener('play', () => playBtn.innerHTML = '⏸');
audioEl.addEventListener('pause', () => playBtn.innerHTML = '⏵');

audioEl.addEventListener('timeupdate', () => {
  if (!audioEl.duration) return;
  progressBar.value = Math.floor((audioEl.currentTime / audioEl.duration) * 100);
  currentTimeEl.textContent = formatTime(audioEl.currentTime);
  durationEl.textContent = formatTime(audioEl.duration);
});

progressBar.addEventListener('input', () => {
  if (!audioEl.duration) return;
  audioEl.currentTime = (progressBar.value / 100) * audioEl.duration;
});

function formatTime(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

exitBtn.onclick = function() {
  window.location.href = '/';
};


window.onload = async function() {
  try {
    await fetchLecteurs();
    console.log("fetchLecteurs terminé");
  } catch (e) {
    console.error("Erreur fetchLecteurs", e);
  }
  modal.style.display = '';
  lecteurContainer.style.display = 'none';
  codeInput.value = '';
  errorDiv.textContent = '';
  console.log("Modal forcé visible");
};
