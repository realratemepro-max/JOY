const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function diagnosePermissions() {
  try {
    // Get the place that's failing to delete
    const placeName = "Joaquim Oliveira Estúdio de Yoga";

    const placesSnapshot = await db.collection('places')
      .where('name', '==', placeName)
      .limit(1)
      .get();

    if (placesSnapshot.empty) {
      console.log('Place not found');
      process.exit(1);
    }

    const placeDoc = placesSnapshot.docs[0];
    const placeData = placeDoc.data();
    const placeId = placeDoc.id;

    console.log('\n=== PLACE INFORMATION ===');
    console.log('Place ID:', placeId);
    console.log('Place Name:', placeData.name);
    console.log('ownerId:', placeData.ownerId || 'NOT SET');
    console.log('createdBy:', placeData.createdBy || 'NOT SET');
    console.log('claimedBy:', placeData.claimedBy || 'NOT SET');
    console.log('isClaimed:', placeData.isClaimed || false);

    // Check related reviews
    console.log('\n=== RELATED REVIEWS ===');
    const reviewsSnapshot = await db.collection('placeReviews')
      .where('placeId', '==', placeId)
      .get();

    console.log('Found', reviewsSnapshot.size, 'reviews');
    if (reviewsSnapshot.size > 0) {
      reviewsSnapshot.docs.forEach((doc, index) => {
        const review = doc.data();
        console.log(`Review ${index + 1}:`, {
          placeId: review.placeId,
          placeOwnerId: review.placeOwnerId || 'NOT SET'
        });
      });
    }

    // Check professionals with this workplace
    console.log('\n=== PROFESSIONALS WITH THIS WORKPLACE ===');
    const professionalsSnapshot = await db.collection('professionals').get();
    let foundWorkplaces = 0;

    professionalsSnapshot.docs.forEach(profDoc => {
      const professional = profDoc.data();
      if (professional.workplaces && Array.isArray(professional.workplaces)) {
        const hasWorkplace = professional.workplaces.some(w => w.placeId === placeId);
        if (hasWorkplace) {
          foundWorkplaces++;
          console.log(`Professional: ${professional.name} (userId: ${professional.userId})`);
        }
      }
    });
    console.log('Total professionals with this workplace:', foundWorkplaces);

    // Get all users to check UIDs
    console.log('\n=== USERS ===');
    const usersSnapshot = await admin.auth().listUsers();
    console.log('Total users in Auth:', usersSnapshot.users.length);
    usersSnapshot.users.forEach(user => {
      console.log(`- ${user.email}: UID = ${user.uid}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

diagnosePermissions();
