// Script Node.js pour ajouter le claim admin à un utilisateur Firebase
// Usage : node setAdminClaim.js <uid>

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node setAdminClaim.js <uid>');
  process.exit(1);
}

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`Claim admin ajouté à l'utilisateur ${uid}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur lors de la mise à jour du claim:', error);
    process.exit(1);
  });
