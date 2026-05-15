// Connexion Firestore (identifiants du site MMCP)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "mm-cp.uk",
  projectId: "mmcp-6b1e2",
  storageBucket: "mmcp-6b1e2.appspot.com",
  messagingSenderId: "",
  appId: "VOTRE_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.getElementById('deployForm');
const tableBody = document.querySelector('#deployTable tbody');

async function loadDeployments() {
  tableBody.innerHTML = '';
  const q = query(collection(db, 'deployments'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const d = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.date}</td><td>${d.nbFiles}</td><td>${d.resume}</td>`;
    tableBody.appendChild(tr);
  });
}

form.onsubmit = async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  await addDoc(collection(db, 'deployments'), {
    date: data.date,
    nbFiles: Number(data.nbFiles),
    resume: data.resume
  });
  form.reset();
  loadDeployments();
};

window.addEventListener('DOMContentLoaded', loadDeployments);
