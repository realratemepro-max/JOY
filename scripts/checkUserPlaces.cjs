const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUserPlaces() {
  try {
    const userId = 'pkJlBQQBgMhu9BvXRkkz1t5mOb52'; // Your user ID

    // Check User document
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log('User document does not exist');
    } else {
      const userData = userDoc.data();
      console.log('\n=== USER DOCUMENT ===');
      console.log('User ID:', userId);
      console.log('Email:', userData.email);
      console.log('Plan:', userData.plan || 'NOT SET');
      console.log('ownedPlaceIds:', userData.ownedPlaceIds || []);
      console.log('professionalProfileIds:', userData.professionalProfileIds || []);
    }

    // Check actual places with ownerId
    console.log('\n=== ACTUAL PLACES ===');
    const placesSnapshot = await db.collection('places')
      .where('ownerId', '==', userId)
      .get();

    console.log('Found', placesSnapshot.size, 'places with ownerId =', userId);
    placesSnapshot.docs.forEach(doc => {
      console.log(`  - ${doc.data().name} (${doc.id})`);
    });

    // Check pricing
    console.log('\n=== PRICING PLANS ===');
    const pricingSnapshot = await db.collection('pricing').get();
    pricingSnapshot.docs.forEach(doc => {
      const plan = doc.data();
      console.log(`${doc.id}:`, {
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval
      });
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUserPlaces();
