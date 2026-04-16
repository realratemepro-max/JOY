const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixUserPlaces() {
  try {
    const userId = 'pkJlBQQBgMhu9BvXRkkz1t5mOb52';

    // Remove the deleted place ID from ownedPlaceIds
    await db.collection('users').doc(userId).update({
      ownedPlaceIds: [] // Clear the array since the place doesn't exist
    });

    console.log('✓ Removed deleted place ID from User document');
    console.log('User now has 0 owned places');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixUserPlaces();
