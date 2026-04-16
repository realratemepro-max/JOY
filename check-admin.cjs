const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAndFixAdmin() {
  try {
    const userId = 'pkJlBQQBgMhu9BvXRkkz1t5mOb52'; // olijack84@gmail.com

    console.log('Checking user document for:', userId);

    const userDoc = await db.collection('users').doc(userId).get();

    if (userDoc.exists) {
      console.log('User document exists:');
      console.log(JSON.stringify(userDoc.data(), null, 2));

      const userData = userDoc.data();
      if (userData.role !== 'admin') {
        console.log('\n⚠️  User is not admin! Setting role to admin...');
        await db.collection('users').doc(userId).update({
          role: 'admin',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ User role updated to admin');
      } else {
        console.log('\n✅ User is already admin');
      }
    } else {
      console.log('❌ User document does NOT exist. Creating it...');

      await db.collection('users').doc(userId).set({
        email: 'olijack84@gmail.com',
        name: 'Joaquim Oliveira Manuel Alexandre Oliveira',
        role: 'admin',
        plan: 'pro',
        professionalProfileIds: [],
        ownedPlaceIds: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ Admin user document created');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAndFixAdmin();
