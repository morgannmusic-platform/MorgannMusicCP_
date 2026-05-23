import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
  authDomain: "morgann-music-cp.firebaseapp.com",
  projectId: "morgann-music-cp",
  storageBucket: "morgann-music-cp.firebasestorage.app",
  messagingSenderId: "666812685196",
  appId: "1:666812685196:web:fe3df6749ae768d68494a9"
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "europe-west1");

export function euro(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export function ensureLoggedInRedirect(redirectUrl) {
  const target = encodeURIComponent(redirectUrl || window.location.href);
  window.location.href = `/login.html?redirect=${target}`;
}

export function showShopDevWarning() {
  try {
    const key = "shopDevWarningShown";
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
    alert("⚠️ Shop en développement : merci de ne rien acheter pour le moment.");
  } catch {
    alert("⚠️ Shop en développement : merci de ne rien acheter pour le moment.");
  }
}
