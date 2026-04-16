const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkPlaceFields() {
  try {
    const placesSnapshot = await db.collection('places').limit(5).get();

    console.log(`\nFound ${placesSnapshot.size} places. Checking fields...\n`);

    placesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      console.log(`Place: ${data.name || doc.id}`);
      console.log(`  - ownerId: ${data.ownerId || 'NOT SET'}`);
      console.log(`  - createdBy: ${data.createdBy || 'NOT SET'}`);
      console.log(`  - claimedBy: ${data.claimedBy || 'NOT SET'}`);
      console.log(`  - isClaimed: ${data.isClaimed || false}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPlaceFields();
