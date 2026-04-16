// Script to fetch and update workplace photos from Google Places API
// Run with: node scripts/updateWorkplacePhotos.cjs

const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCwjy0OU3VMpU-6fQFy3sBzAHsuthwbxfM';

async function fetchGooglePlacePhotos(placeId) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.result?.photos) {
      const photoUrls = data.result.photos
        .slice(0, 3)
        .map((photo) => {
          const photoRef = photo.photo_reference || photo.reference;
          if (photoRef) {
            return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
          }
          return null;
        })
        .filter((url) => url !== null);

      return photoUrls;
    }

    return [];
  } catch (error) {
    console.error(`Error fetching photos for place ${placeId}:`, error);
    return [];
  }
}

async function updateWorkplacePhotos() {
  console.log('Starting to update workplace photos...\n');

  try {
    // Get all professionals
    const professionalsSnapshot = await db.collection('professionals').get();

    let updatedCount = 0;
    let totalWorkplaces = 0;

    for (const profDoc of professionalsSnapshot.docs) {
      const profData = profDoc.data();
      
      if (!profData.workplaces || profData.workplaces.length === 0) {
        continue;
      }

      let workplacesUpdated = false;
      const updatedWorkplaces = [];

      for (const workplace of profData.workplaces) {
        totalWorkplaces++;
        
        // Skip if already has photos
        if (workplace.photos && workplace.photos.length > 0) {
          console.log(`✅ ${workplace.name} - Already has photos`);
          updatedWorkplaces.push(workplace);
          continue;
        }

        // Try to fetch photos from Google Places API
        if (workplace.placeId) {
          console.log(`📸 Fetching photos for: ${workplace.name}`);
          const photos = await fetchGooglePlacePhotos(workplace.placeId);

          if (photos.length > 0) {
            console.log(`✅ Found ${photos.length} photos for ${workplace.name}`);
            updatedWorkplaces.push({
              ...workplace,
              photos
            });
            updatedCount++;
            workplacesUpdated = true;
          } else {
            console.log(`❌ No photos found for ${workplace.name}`);
            updatedWorkplaces.push(workplace);
          }
        } else {
          console.log(`⚠️  No placeId for ${workplace.name}`);
          updatedWorkplaces.push(workplace);
        }
      }

      // Update professional document if workplaces were updated
      if (workplacesUpdated) {
        await db.collection('professionals').doc(profDoc.id).update({
          workplaces: updatedWorkplaces,
          updatedAt: new Date()
        });
        console.log(`Updated professional: ${profData.name}\n`);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`📊 Total: ${totalWorkplaces}`);
  } catch (error) {
    console.error('Error updating workplace photos:', error);
  }

  // Close the app
  await admin.app().delete();
  process.exit(0);
}

updateWorkplacePhotos();
