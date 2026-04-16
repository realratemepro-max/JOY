const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addAdmin() {
  try {
    const uid = 'As5kDDBNCFPmtqQDht8oYyWW6fE3';
    const email = 'realratemepo@gmail.com';

    console.log(`Setting up admin for UID: ${uid}`);

    // Check if already in admins collection
    const adminDoc = await db.collection('admins').doc(uid).get();
    if (!adminDoc.exists) {
      await db.collection('admins').doc(uid).set({
        email: email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        addedBy: 'system'
      });
      console.log('✓ Added to admins collection');
    } else {
      console.log('✓ Already in admins collection');
    }

    // Update users collection with admin role
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      await db.collection('users').doc(uid).update({
        role: 'admin',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✓ Updated users collection role to admin');
      console.log('Current user data:', userDoc.data());
    } else {
      // Create user document if it doesn't exist
      await db.collection('users').doc(uid).set({
        email: email,
        name: 'Joaquim Oliveira',
        role: 'admin',
        professionalProfileIds: [],
        ownedPlaceIds: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✓ Created new user document with admin role');
    }

    console.log('\nDone! User is now an admin. Please log out and log in again.');

  } catch (error) {
    console.error('Error adding admin:', error);
  }

  process.exit();
}

addAdmin();
