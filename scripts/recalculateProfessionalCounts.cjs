// Script to recalculate professional counts for all places
// Run with: node scripts/recalculateProfessionalCounts.cjs

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function recalculateProfessionalCounts() {
  console.log('Starting to recalculate professional counts...\n');

  try {
    // Get all places
    const placesSnapshot = await db.collection('places').get();
    
    let updated = 0;

    for (const placeDoc of placesSnapshot.docs) {
      const placeData = placeDoc.data();
      const placeId = placeData.googlePlaceId;

      // Count professionals who have this place in their workplaces
      const professionalsSnapshot = await db.collection('professionals').get();
      
      let count = 0;
      for (const profDoc of professionalsSnapshot.docs) {
        const profData = profDoc.data();
        if (profData.workplaces && Array.isArray(profData.workplaces)) {
          const hasWorkplace = profData.workplaces.some(wp => wp.placeId === placeId);
          if (hasWorkplace) {
            count++;
          }
        }
      }

      // Update the place document if count differs
      const currentCount = placeData.professionalsCount || 0;
      if (currentCount !== count) {
        console.log(`📍 ${placeData.name}`);
        console.log(`   Old count: ${currentCount}, New count: ${count}`);
        
        await db.collection('places').doc(placeDoc.id).update({
          professionalsCount: count,
          updatedAt: new Date()
        });
        
        console.log(`   ✅ Updated\n`);
        updated++;
      } else {
        console.log(`✅ ${placeData.name} - No change needed (${count} professionals)\n`);
      }
    }

    console.log('=== Summary ===');
    console.log(`✅ Updated: ${updated}`);
    console.log(`📊 Total places: ${placesSnapshot.size}`);
  } catch (error) {
    console.error('Error recalculating professional counts:', error);
  }

  // Close the app
  await admin.app().delete();
  process.exit(0);
}

recalculateProfessionalCounts();
