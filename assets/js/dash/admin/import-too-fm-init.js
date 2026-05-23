// Injection du module d'import too.fm dans admin/release.html
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { injectTooFmImport } from './import-too-fm.js';

const firebaseConfig = {
  apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
  authDomain: "morgann-music-cp.firebaseapp.com",
  projectId: "morgann-music-cp",
  storageBucket: "morgann-music-cp.firebasestorage.app",
  messagingSenderId: "666812685196",
  appId: "1:666812685196:web:fe3df6749ae768d68494a9"
};

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", function () {
  if (window.location.pathname.endsWith('/admin/linkrelease.html') || window.location.pathname.endsWith('/admin/release.html')) {
    const checkReady = setInterval(() => {
      const content = document.getElementById('contentArea');
      if (content && content.style.display !== 'none') {
        clearInterval(checkReady);
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) injectTooFmImport(db, id);
      }
    }, 300);
  }
});
