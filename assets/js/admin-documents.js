// admin-documents.js
// Gère la page d'administration des documents

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('add-document-btn');
  const modal = document.getElementById('add-document-modal');
  const closeModal = document.getElementById('close-modal');
  const form = document.getElementById('add-document-form');
  const documentsList = document.getElementById('documents-list');

  // Ouvre la popup
  addBtn.addEventListener('click', () => {
    modal.style.display = '';
  });

  // Ferme la popup
  closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Ferme la popup si clic en dehors
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  // Récupération des comptes Firebase (utilisateurs) via Firestore
  const select = document.getElementById('account-select');
  let accounts = [];
  import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js")
    .then(({ getFirestore, collection, getDocs }) => {
      const db = getFirestore();
      return getDocs(collection(db, "users"));
    })
    .then((snapshot) => {
      accounts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.displayName || data.artistName || data.name || data.email || doc.id,
          email: data.email || '',
        };
      });
      accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.id;
        opt.textContent = acc.name + (acc.email ? ` (${acc.email})` : '');
        select.appendChild(opt);
      });
    })
    .catch(() => {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Erreur chargement comptes';
      select.appendChild(opt);
    });


  // Charge et affiche les documents depuis Firestore
  async function loadAndRenderDocuments() {
    const { getFirestore, collection, getDocs, query, orderBy } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");
    const db = getFirestore();
    // On trie par date de création décroissante si possible
    const q = query(collection(db, "documents"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const documents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (!documents.length) {
      documentsList.innerHTML = '<div class="documents-container"><p class="note">Aucun document pour le moment.</p></div>';
    } else {
      documentsList.innerHTML = `
        <div class="documents-container">
          ${documents.map(doc => `
            <div class="document-item" data-doc-id="${doc.id}">
              <span class="document-title">${doc.title}</span>
              <span class="document-account">Compte: ${doc.accountName}</span>
              <a href="${doc.url}" class="btn mini-btn" download>Télécharger</a>
              <a href="${doc.url}" class="btn mini-btn" target="_blank">Visualiser</a>
              <button class="btn mini-btn danger-btn delete-document-btn" data-doc-id="${doc.id}" data-url="${doc.url}"><i class='bx bx-trash'></i> Supprimer</button>
            </div>
          `).join('')}
        </div>
      `;
      // Ajout des listeners pour suppression
      setTimeout(() => {
        document.querySelectorAll('.delete-document-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const docId = btn.getAttribute('data-doc-id');
            const fileUrl = btn.getAttribute('data-url');
            if (!confirm('Supprimer ce document ?')) return;
            // Suppression Firestore
            const { getFirestore, doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");
            const db = getFirestore();
            await deleteDoc(doc(db, "documents", docId));
            // Suppression Storage (optionnel)
            if (fileUrl) {
              try {
                const { getStorage, ref, deleteObject } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js");
                const storage = getStorage();
                // On doit retrouver le chemin à partir de l'URL
                const url = new URL(fileUrl);
                const pathMatch = url.pathname.match(/\/o\/(.+)$/);
                let filePath = null;
                if (pathMatch && pathMatch[1]) {
                  filePath = decodeURIComponent(pathMatch[1]);
                } else {
                  // fallback: essayer de deviner le chemin
                  const parts = fileUrl.split("/documents/");
                  if (parts[1]) filePath = "documents/" + parts[1].split("?")[0];
                }
                if (filePath) {
                  const fileRef = ref(storage, filePath);
                  await deleteObject(fileRef);
                }
              } catch (err) {
                // ignore erreur suppression storage
              }
            }
            // Recharge la liste
            await loadAndRenderDocuments();
          });
        });
      }, 100);
    }
  }



  // Ajout d'un document (réel Firestore + Storage)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const accountId = select.value;
    const accountName = accounts.find(a => a.id === accountId)?.name || '';
    const title = document.getElementById('document-title').value;
    const fileInput = document.getElementById('document-file');
    const file = fileInput.files[0];
    if (!file) return;

    // Upload du fichier dans Firebase Storage
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js");
    const { getFirestore, collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");
    const storage = getStorage();
    const db = getFirestore();
    const storageRef = ref(storage, `documents/${accountId}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    // Ajout du document dans Firestore avec le champ accountId
    await addDoc(collection(db, "documents"), {
      title,
      url,
      accountId,
      accountName,
      createdAt: serverTimestamp()
    });

    // Recharge la liste depuis Firestore
    await loadAndRenderDocuments();
    modal.style.display = 'none';
    form.reset();
  });

  // Charge la liste au chargement de la page
  loadAndRenderDocuments();
});
