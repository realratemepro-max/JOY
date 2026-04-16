// Copy photos from workplaces to places
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function syncPhotosToPlaces() {
  console.log('🔍 Syncing photos from workplaces to places...\n');

  const profsSnapshot = await db.collection('professionals').get();
  const placesSnapshot = await db.collection('places').get();

  let updated = 0;

  for (const profDoc of profsSnapshot.docs) {
    const prof = profDoc.data();
    const workplaces = prof.workplaces || [];

    for (const workplace of workplaces) {
      if (!workplace.placeId || !workplace.photos || workplace.photos.length === 0) {
        continue;
      }

      // Find matching place by googlePlaceId
      const matchingPlace = placesSnapshot.docs.find(
        placeDoc => placeDoc.data().googlePlaceId === workplace.placeId
      );

      if (matchingPlace) {
        console.log(`📍 ${workplace.name}`);
        console.log(`   Copying ${workplace.photos.length} photos to place`);

        await matchingPlace.ref.update({
          photos: workplace.photos,
          updatedAt: new Date()
        });

        console.log(`   ✅ Updated!\n`);
        updated++;
      }
    }
  }

  console.log(`\n✅ Done! Updated ${updated} places with photos from workplaces`);
  process.exit(0);
}

syncPhotosToPlaces().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
