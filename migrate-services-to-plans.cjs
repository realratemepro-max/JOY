/**
 * JOY - Migrate services to plans
 * Creates a default location and converts services into plans
 * Run: node migrate-services-to-plans.cjs
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrate() {
  console.log('🔄 Migrating services to plans...\n');

  // 1. Check if plans already exist
  const plansSnap = await db.collection('plans').get();
  if (!plansSnap.empty) {
    console.log(`⚠ Already have ${plansSnap.size} plans. Skipping migration.`);
    console.log('   Delete plans collection first if you want to re-run.\n');
    process.exit(0);
  }

  // 2. Check if locations exist, create default if not
  const locsSnap = await db.collection('locations').get();
  let defaultLocationId;
  let defaultLocationName;

  if (locsSnap.empty) {
    console.log('📍 Creating default location...');
    const locRef = db.collection('locations').doc();
    defaultLocationId = locRef.id;
    defaultLocationName = 'Espaço Principal';
    await locRef.set({
      name: defaultLocationName,
      address: 'A definir',
      description: 'Espaço principal para aulas de yoga',
      photoUrl: '',
      costPerSession: 0,
      capacity: 10,
      amenities: ['Tapetes incluídos'],
      mapUrl: '',
      isActive: true,
      order: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`   ✓ Location: ${defaultLocationName} (${defaultLocationId})\n`);
  } else {
    const firstLoc = locsSnap.docs[0];
    defaultLocationId = firstLoc.id;
    defaultLocationName = firstLoc.data().name;
    console.log(`📍 Using existing location: ${defaultLocationName}\n`);
  }

  // 3. Load services
  const servicesSnap = await db.collection('services').get();
  if (servicesSnap.empty) {
    console.log('⚠ No services to migrate.\n');
    process.exit(0);
  }

  console.log(`📦 Migrating ${servicesSnap.size} services to plans...\n`);

  for (const serviceDoc of servicesSnap.docs) {
    const s = serviceDoc.data();

    // Convert service to plan
    const plan = {
      name: s.name,
      description: s.description || '',
      longDescription: s.longDescription || '',
      locationId: defaultLocationId,
      locationName: defaultLocationName,
      sessionsPerWeek: s.type === 'pack' ? (s.sessions ? Math.ceil(s.sessions / 4) : 1) : 1,
      sessionDuration: 60, // Default
      priceMonthly: s.type === 'monthly' ? s.price : s.price, // Use as-is
      schedule: [], // Admin needs to set schedule
      type: 'private',
      maxStudents: null,
      features: s.features || [],
      isPopular: s.isPopular || false,
      isActive: s.isActive || false,
      order: s.order || 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const planRef = db.collection('plans').doc();
    await planRef.set(plan);
    console.log(`   ✓ ${s.name} → Plan (${plan.priceMonthly}€/mês, ${plan.sessionsPerWeek}x/sem)`);
  }

  console.log('\n✅ Migration complete!');
  console.log('   → Go to /admin/plans to set schedules for each plan');
  console.log('   → Go to /admin/locations to update the default location');
  console.log('   → Old services are kept for reference (not deleted)\n');

  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
