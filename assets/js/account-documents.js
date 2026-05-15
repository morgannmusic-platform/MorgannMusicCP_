// account-documents.js
// Gère l'affichage des documents dans la section Documents du compte

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const documentsList = document.getElementById('documents-list');
  const noDocumentsMessage = document.getElementById('no-documents-message');

  const auth = getAuth();
  const db = getFirestore();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      noDocumentsMessage.style.display = '';
      documentsList.innerHTML = '<p>Veuillez vous connecter pour voir vos documents.</p>';
      return;
    }

    // On teste plusieurs champs possibles pour l'uid utilisateur
    let documents = [];
    const docsRef = collection(db, "documents");
    // 1. accountId
    let snap = await getDocs(query(docsRef, where("accountId", "==", user.uid)));
    documents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // 2. userUid si rien trouvé
    if (!documents.length) {
      snap = await getDocs(query(docsRef, where("userUid", "==", user.uid)));
      documents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    // 3. uid si rien trouvé
    if (!documents.length) {
      snap = await getDocs(query(docsRef, where("uid", "==", user.uid)));
      documents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    if (!documents.length) {
      if (noDocumentsMessage) noDocumentsMessage.style.display = '';
      if (documentsList) documentsList.innerHTML = '<p class="note">Aucun document n\'est disponible sur votre compte.</p>';
    } else {
      if (noDocumentsMessage) noDocumentsMessage.style.display = 'none';
      if (documentsList) documentsList.innerHTML = `
        <div class="documents-container">
          ${documents.map(doc => `
            <div class="document-item">
              <span class="document-title">${doc.title || doc.name || 'Document'}</span>
              <a href="${doc.url}" class="btn mini-btn" download>Télécharger</a>
              <a href="${doc.url}" class="btn mini-btn" target="_blank">Visualiser</a>
            </div>
          `).join('')}
        </div>
      `;
    }
  });
});
