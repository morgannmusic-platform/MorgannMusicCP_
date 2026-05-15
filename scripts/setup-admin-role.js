#!/usr/bin/env node

/**
 * Script pour vérifier et configurer les rôles admin dans Firestore
 * Usage: npm run setup:admin -- <uid> [role]
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Recherche le fichier service account
function findServiceAccountFile() {
  const possiblePaths = [
    './firebase-adminsdk.json',
    '../firebase-adminsdk.json',
    path.join(process.env.HOME, '.firebase', 'adminsdk.json'),
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return path.resolve(filePath);
    }
  }
  return null;
}

// Initialiser Firebase Admin
function initFirebase() {
  const serviceAccountPath = findServiceAccountFile();
  
  if (!serviceAccountPath) {
    console.error('❌ Fichier firebase-adminsdk.json non trouvé');
    console.error('\n📥 Pour le télécharger:');
    console.error('   1. Va à https://console.firebase.google.com/project/morgann-music-cp/settings/serviceaccounts/adminsdk');
    console.error('   2. Clique sur "Générer une nouvelle clé privée"');
    console.error('   3. Sauvegarde le fichier comme ./firebase-adminsdk.json');
    process.exit(1);
  }

  try {
    const serviceAccount = require(path.resolve(serviceAccountPath));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'morgann-music-cp'
    });
    console.log('✅ Firebase Admin connecté');
  } catch (err) {
    console.error('❌ Erreur lors du chargement du service account:', err.message);
    process.exit(1);
  }
}

async function checkAndSetAdminRole(uid, role = 'admin') {
  try {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    
    // Vérifier si le document existe
    const userSnap = await userRef.get();
    if (!userSnap.exists()) {
      console.error(`\n❌ Utilisateur avec UID "${uid}" n'existe pas dans Firestore`);
      console.error('   Vérifie que l\'UID est correct et que l\'utilisateur a un document Firestore.');
      process.exit(1);
    }

    const userData = userSnap.data();
    console.log('\n📄 Données actuelles du document users/' + uid + ':');
    console.log(JSON.stringify(userData, null, 2));

    // Vérifier si l'utilisateur est déjà admin
    const currentRole = userData.role || userData.accountType || 'none';
    console.log('\n📋 Rôle actuel:', currentRole);

    if (currentRole.toLowerCase() === role.toLowerCase()) {
      console.log(`\n✅ L'utilisateur a déjà le rôle "${role}".`);
      process.exit(0);
    }

    // Ajouter le rôle
    console.log(`\n⏳ Ajout du rôle "${role}"...`);
    
    await userRef.update({
      role: role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Vérifier que la mise à jour a fonctionné
    const updatedSnap = await userRef.get();
    const updatedData = updatedSnap.data();
    
    console.log('\n✅ Mise à jour réussie!');
    console.log('\n📄 Nouvelles données du document:');
    console.log(JSON.stringify(updatedData, null, 2));

    console.log(`\n🎉 L'utilisateur ${uid} est maintenant admin!`);
    console.log('💾 Les modifications vont affecter les uploads immédiatement.');
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erreur lors de la mise à jour:', err.message);
    process.exit(1);
  }
}

// Récupérer les paramètres
const uid = process.argv[2];
const role = process.argv[3] || 'admin';

if (!uid) {
  console.error('\n❌ UID requis');
  console.error('\nUsage:');
  console.error('  node scripts/setup-admin-role.js <uid> [role]');
  console.error('\nExemple:');
  console.error('  node scripts/setup-admin-role.js TBBreXgsEsdh0FddRlf8DN5SctM2 admin');
  console.error('\nOù trouver l\'UID:');
  console.error('  1. Console Firebase → Authentication');
  console.error('  2. Clique sur l\'utilisateur');
  console.error('  3. Copie l\'UID affiché');
  process.exit(1);
}

initFirebase();
checkAndSetAdminRole(uid, role);
