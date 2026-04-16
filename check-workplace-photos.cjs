// Check if professionals' workplaces have photos we can copy to places
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function checkWorkplacePhotos() {
  console.log('🔍 Checking professionals for workplace photos...\n');

  const profsSnapshot = await db.collection('professionals').get();

  for (const profDoc of profsSnapshot.docs) {
    const prof = profDoc.data();
    const workplaces = prof.workplaces || [];

    if (workplaces.length === 0) continue;

    console.log(`👤 ${prof.name}:`);

    for (const workplace of workplaces) {
      console.log(`  📍 ${workplace.name}`);
      console.log(`     Place ID: ${workplace.placeId || 'N/A'}`);
      console.log(`     Photos: ${workplace.photos ? workplace.photos.length : 0}`);

      if (workplace.photos && workplace.photos.length > 0) {
        console.log(`     First photo: ${workplace.photos[0].substring(0, 80)}...`);
      }
      console.log('');
    }
  }

  process.exit(0);
}

checkWorkplacePhotos().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
