/**
 * Script to clean Google PhotoService URLs from Firestore
 *
 * Google PhotoService URLs return 403 errors when accessed from web browsers.
 * This script removes them from the places collection.
 *
 * Run with: node scripts/cleanGooglePhotos.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanGooglePhotos() {
  console.log('Starting cleanup of Google PhotoService URLs...\n');

  try {
    // Get all places
    const placesSnapshot = await db.collection('places').get();

    console.log(`Found ${placesSnapshot.size} places to check\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const doc of placesSnapshot.docs) {
      const placeData = doc.data();

      if (placeData.photos && Array.isArray(placeData.photos) && placeData.photos.length > 0) {
        // Filter out PhotoService URLs
        const cleanedPhotos = placeData.photos.filter(
          photoUrl => !photoUrl.includes('PhotoService.GetPhoto')
        );

        // Only update if we removed some photos
        if (cleanedPhotos.length !== placeData.photos.length) {
          await doc.ref.update({ photos: cleanedPhotos });
          console.log(`✓ Updated ${doc.id}: ${placeData.name}`);
          console.log(`  Removed ${placeData.photos.length - cleanedPhotos.length} PhotoService URL(s)`);
          console.log(`  Remaining photos: ${cleanedPhotos.length}\n`);
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    console.log('\n=== Cleanup Complete ===');
    console.log(`Updated: ${updatedCount} places`);
    console.log(`Skipped: ${skippedCount} places (no PhotoService URLs found)`);
    console.log(`Total: ${placesSnapshot.size} places checked`);

  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }

  process.exit(0);
}

cleanGooglePhotos();
