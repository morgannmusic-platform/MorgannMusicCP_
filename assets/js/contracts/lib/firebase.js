import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
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
export const functions = getFunctions(app, "europe-west1");
