/**
 * Script de debug pour diagnostiquer les problèmes de permission Storage
 * À copier dans la console du navigateur (F12 → Console) sur /dash/admin/create-release.html
 */

async function debugStoragePermissions() {
  console.log('🔍 === DIAGNOSTIC STORAGE PERMISSIONS ===\n');

  // Imports Firebase
  const { getAuth, getIdTokenResult } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js");
  const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js");
  const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");

  const firebaseConfig = {
    apiKey: "AIzaSyDSPUArpApBuK0Cn9VbeMtqk4JC-gqruJc",
    authDomain: "morgann-music-cp.firebaseapp.com",
    projectId: "morgann-music-cp",
    storageBucket: "morgann-music-cp.firebasestorage.app",
    messagingSenderId: "666812685196",
    appId: "1:666812685196:web:fe3df6749ae768d68494a9",
    measurementId: "G-FKSSXYEZF0"
  };

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('📱 UTILISATEUR ACTUEL:');
  const user = auth.currentUser;
  if (!user) {
    console.error('❌ Aucun utilisateur connecté');
    return;
  }

  console.log('  UID:', user.uid);
  console.log('  Email:', user.email);
  console.log('  Display Name:', user.displayName);

  // Vérifier les custom claims
  console.log('\n🔑 CUSTOM CLAIMS (Firebase Auth):');
  try {
    const tokenResult = await getIdTokenResult(user);
    console.log('  admin:', tokenResult.claims.admin || false);
    console.log('  staff:', tokenResult.claims.staff || false);
    console.log('  role:', tokenResult.claims.role || 'not set');
    console.log('  Tous les claims:', JSON.stringify(tokenResult.claims, null, 2));
  } catch (err) {
    console.error('  ❌ Erreur lors de la récupération des claims:', err.message);
  }

  // Vérifier le document Firestore
  console.log('\n📄 DOCUMENT FIRESTORE (users/' + user.uid + '):');
  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (userSnap.exists()) {
      const userData = userSnap.data();
      console.log('  ✅ Document existe');
      console.log('\n  Champs du document:');
      
      // Afficher tous les champs pertinents
      const relevantFields = ['role', 'accountType', 'userRole', 'type', 'email', 'displayName', 'updatedAt'];
      relevantFields.forEach(field => {
        const value = userData[field];
        if (value !== undefined) {
          console.log('    ' + field + ':', JSON.stringify(value));
        }
      });

      console.log('\n  Tous les champs:');
      Object.keys(userData).forEach(key => {
        console.log('    ' + key + ':', JSON.stringify(userData[key]));
      });

      // Vérifier si admin
      const isAdminStatus = userData.role === 'admin' || userData.role === 'owner' || userData.accountType === 'admin';
      console.log('\n  📊 Analyse:', isAdminStatus ? '✅ ADMIN' : '❌ PAS ADMIN');
    } else {
      console.error('  ❌ Document n\'existe pas! C\'est un problème.');
    }
  } catch (err) {
    console.error('  ❌ Erreur lors de la lecture du document:', err.message);
    console.error('  Code:', err.code);
  }

  console.log('\n💡 SUGGESTIONS:');
  const user_snap = await getDoc(doc(db, "users", user.uid));
  if (!user_snap.exists()) {
    console.log('  1. ❌ Le document utilisateur n\'existe pas dans Firestore');
    console.log('     Solution: Créer le document avec role: "admin"');
  } else {
    const userData = user_snap.data();
    if (!userData.role && !userData.accountType) {
      console.log('  1. ❌ Aucun champ "role" ou "accountType" trouvé');
      console.log('     Solution: Ajouter field role: "admin" au document');
      console.log('     Commande: node scripts/setup-admin-role.js ' + user.uid);
    }
  }

  console.log('\n✅ Diagnostic terminé. Copie les infos ci-dessus et envoie-les pour debug.');
}

// Exécuter le diagnostic
debugStoragePermissions().catch(err => {
  console.error('❌ Erreur du diagnostic:', err);
});
