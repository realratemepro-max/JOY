// Script to update existing places with Google Photos
// Run with: node scripts/updatePlacePhotos.cjs

const admin = require('firebase-admin');
const fetch = require('node-fetch');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Google Maps API Key from environment
const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE';

async function getPlacePhotos(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.result.photos) {
      // Get up to 5 photo references
      const photoReferences = data.result.photos.slice(0, 5).map(photo => photo.photo_reference);

      // Convert photo references to URLs
      const photoUrls = photoReferences.map(ref =>
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ref}&key=${GOOGLE_MAPS_API_KEY}`
      );

      return photoUrls;
    }

    return [];
  } catch (error) {
    console.error(`Error fetching photos for place ${placeId}:`, error);
    return [];
  }
}

async function updatePlacesWithPhotos() {
  console.log('Starting to update places with photos...\n');

  try {
    const placesSnapshot = await db.collection('places').get();

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of placesSnapshot.docs) {
      const place = doc.data();

      // Skip if already has photos
      if (place.photos && place.photos.length > 0) {
        console.log(`⏭️  Skipping ${place.name} - already has photos`);
        skipped++;
        continue;
      }

      if (!place.googlePlaceId) {
        console.log(`⚠️  Skipping ${place.name} - no googlePlaceId`);
        skipped++;
        continue;
      }

      console.log(`📸 Fetching photos for: ${place.name}`);
      const photos = await getPlacePhotos(place.googlePlaceId);

      if (photos.length > 0) {
        await doc.ref.update({
          photos: photos,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Updated ${place.name} with ${photos.length} photos`);
        updated++;
      } else {
        console.log(`❌ No photos found for ${place.name}`);
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n=== Summary ===');
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${placesSnapshot.size}`);

  } catch (error) {
    console.error('Error updating places:', error);
  }

  process.exit(0);
}

updatePlacesWithPhotos();
