const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAllUsers() {
  try {
    console.log('Checking all users...\n');

    // Check users collection
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users:\n`);

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Email: ${data.email}`);
      console.log(`Name: ${data.name}`);
      console.log(`Role: ${data.role || 'NO ROLE SET'}`);
      console.log(`Plan: ${data.plan || 'NO PLAN SET'}`);
      console.log('---');
    });

    // Check admins collection
    const adminsSnapshot = await db.collection('admins').get();
    console.log(`\nFound ${adminsSnapshot.size} admin documents:\n`);

    adminsSnapshot.forEach(doc => {
      console.log(`Admin ID: ${doc.id}`);
      console.log(`Data: ${JSON.stringify(doc.data())}`);
      console.log('---');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllUsers();
