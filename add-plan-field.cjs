const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addPlanField() {
  try {
    const userId = 'pkJlBQQBgMhu9BvXRkkz1t5mOb52';

    await db.collection('users').doc(userId).update({
      plan: 'pro',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Added plan field: pro');

    const userDoc = await db.collection('users').doc(userId).get();
    console.log('\nUpdated user document:');
    console.log(JSON.stringify(userDoc.data(), null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addPlanField();
