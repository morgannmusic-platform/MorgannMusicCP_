#!/usr/bin/env node

/**
 * Script pour ajouter le rôle "admin" à un utilisateur Firestore
 * Usage: node scripts/set-admin-role.js <uid> [role]
 * 
 * Exemple:
 *   node scripts/set-admin-role.js TBBreXgsEsdh0FddRlf8DN5SctM2 admin
 *   node scripts/set-admin-role.js TBBreXgsEsdh0FddRlf8DN5SctM2
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialiser Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '../firebase-adminsdk.json');
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'morgann-music-cp'
    });
  } catch (err) {
    console.error('❌ Erreur: Fichier firebase-adminsdk.json non trouvé');
    console.error('   Télécharge le fichier depuis: https://console.firebase.google.com/project/morgann-music-cp/settings/serviceaccounts/adminsdk');
    process.exit(1);
  }
}

async function setAdminRole(uid, role = 'admin') {
  try {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    
    // Vérifier si le document existe
    const userSnap = await userRef.get();
    if (!userSnap.exists()) {
      console.error(`❌ Utilisateur avec UID "${uid}" n'existe pas dans Firestore`);
      process.exit(1);
    }
    
    // Mettre à jour le document avec le rôle
    await userRef.update({
      role: role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Rôle "${role}" ajouté au document users/${uid}`);
    
    // Vérifier le document mis à jour
    const updatedSnap = await userRef.get();
    console.log(`📄 Données du document:`, updatedSnap.data());
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

// Récupérer les paramètres
const uid = process.argv[2];
const role = process.argv[3] || 'admin';

if (!uid) {
  console.error('❌ UID requis');
  console.error('Usage: node scripts/set-admin-role.js <uid> [role]');
  console.error('Example: node scripts/set-admin-role.js TBBreXgsEsdh0FddRlf8DN5SctM2 admin');
  process.exit(1);
}

setAdminRole(uid, role);
