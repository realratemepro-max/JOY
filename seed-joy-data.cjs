/**
 * JOY - Seed initial data to Firestore
 * Run: node seed-joy-data.cjs
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function seedData() {
  console.log('🧘 Seeding JOY data...\n');

  // 1. Site Config
  console.log('📝 Creating site config...');
  await db.doc('siteConfig/main').set({
    siteName: 'JOY - Joaquim Oliveira Yoga',
    tagline: 'Encontra o teu equilíbrio interior através do Vinyasa Yoga',
    heroTitle: 'Transforma a tua vida com Vinyasa Yoga',
    heroSubtitle: 'Aulas particulares personalizadas para o teu corpo, mente e espírito. Descobre o poder transformador do yoga com acompanhamento individual.',
    heroCtaText: 'Reservar Aula Particular',
    heroCtaLink: '#servicos',
    heroImage: '',
    aboutTitle: 'Sobre Joaquim Oliveira',
    aboutText: 'Com mais de 10 anos de prática e formação internacional em Vinyasa Yoga, dedico-me a guiar cada aluno numa jornada única de autodescoberta e transformação. Acredito que o yoga vai muito além das posturas físicas — é um caminho para o equilíbrio, a paz interior e uma vida mais consciente.\n\nFormado pela Yoga Alliance (RYT-500), especializei-me em Vinyasa Flow, adaptando cada prática ao nível e objetivos individuais de cada pessoa. Nas minhas aulas particulares, crio sequências personalizadas que respeitam o teu corpo e desafiam os teus limites de forma segura e progressiva.',
    aboutImage: '',
    aboutHighlights: [
      'RYT-500 Yoga Alliance',
      '+10 anos de experiência',
      '+500 alunos acompanhados',
      'Formação internacional'
    ],
    vinyasaTitle: 'Porquê Vinyasa Yoga?',
    vinyasaText: 'O Vinyasa Yoga é uma prática dinâmica que sincroniza movimento e respiração, criando uma meditação em movimento. Cada sessão é única, fluida e adaptada às tuas necessidades.',
    vinyasaBenefits: [
      'Reduz o stress e a ansiedade, promovendo calma interior',
      'Aumenta a força, flexibilidade e equilíbrio do corpo',
      'Melhora a concentração e clareza mental',
      'Promove uma melhor qualidade de sono',
      'Fortalece o sistema imunitário',
      'Desenvolve consciência corporal e autoconhecimento',
      'Alivia dores crónicas e tensões musculares',
      'Conecta corpo, mente e respiração numa prática fluida'
    ],
    email: 'joaquim@joyoga.pt',
    phone: '+351 912 345 678',
    instagram: 'joaquimoliveirayoga',
    facebook: 'joaquimoliveirayoga',
    youtube: '',
    location: 'Lisboa, Portugal',
    mapUrl: '',
    footerText: '© 2024 JOY - Joaquim Oliveira Yoga. Todos os direitos reservados.',
    metaTitle: 'JOY - Joaquim Oliveira Yoga | Aulas Particulares de Vinyasa Yoga',
    metaDescription: 'Aulas particulares de Vinyasa Yoga em Lisboa. Transforme a sua vida com sessões personalizadas. Reserva a tua primeira aula.',
    primaryColor: '#7c9a72',
    secondaryColor: '#c4a882',
    accentColor: '#c17f59',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('   ✓ Site config created\n');

  // 2. Services
  console.log('📦 Creating services...');
  const services = [
    {
      name: 'Aula Experimental',
      description: 'Primeira aula para conheceres a prática e o método. Sem compromisso.',
      price: 25,
      duration: '60 min',
      type: 'single',
      isPopular: false,
      isActive: true,
      features: [
        'Avaliação inicial personalizada',
        'Adaptação ao teu nível',
        'Material incluído',
        'Sem compromisso'
      ],
      order: 0,
    },
    {
      name: 'Aula Individual',
      description: 'Sessão particular com prática totalmente adaptada aos teus objetivos.',
      price: 45,
      duration: '60 min',
      type: 'single',
      isPopular: false,
      isActive: true,
      features: [
        'Prática 100% personalizada',
        'Ajustes posturais individuais',
        'Sequência adaptada ao teu nível',
        'Técnicas de respiração (Pranayama)',
        'Relaxamento e meditação final'
      ],
      order: 1,
    },
    {
      name: 'Pack 5 Aulas',
      description: 'O pacote ideal para quem quer iniciar uma prática regular e consistente.',
      price: 180,
      duration: 'Pack 5 sessões de 60 min',
      sessions: 5,
      type: 'pack',
      isPopular: true,
      isActive: true,
      features: [
        'Tudo da Aula Individual',
        'Desconto de 20% (36€/aula)',
        'Plano de evolução personalizado',
        'Flexibilidade de horários',
        'Válido por 2 meses'
      ],
      order: 2,
    },
    {
      name: 'Pack 10 Aulas',
      description: 'Para quem quer compromisso e resultados profundos na prática.',
      price: 320,
      duration: 'Pack 10 sessões de 60 min',
      sessions: 10,
      type: 'pack',
      isPopular: false,
      isActive: true,
      features: [
        'Tudo da Aula Individual',
        'Desconto de 29% (32€/aula)',
        'Plano de evolução trimestral',
        'Acompanhamento entre sessões',
        'Práticas guiadas para casa',
        'Válido por 4 meses'
      ],
      order: 3,
    },
  ];

  for (const service of services) {
    const ref = db.collection('services').doc();
    await ref.set({
      ...service,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`   ✓ ${service.name} - ${service.price}€`);
  }
  console.log('');

  // 3. Testimonials
  console.log('💬 Creating testimonials...');
  const testimonials = [
    {
      name: 'Ana Sofia R.',
      text: 'As aulas com o Joaquim transformaram completamente a minha relação com o meu corpo. A atenção personalizada faz toda a diferença. Saio de cada sessão renovada e com mais energia para o dia a dia.',
      rating: 5,
      photo: '',
      isActive: true,
      order: 0,
    },
    {
      name: 'Miguel C.',
      text: 'Comecei sem qualquer experiência e em poucas semanas já sentia melhorias incríveis na flexibilidade e no stress. O Joaquim tem uma capacidade única de adaptar a prática a cada pessoa.',
      rating: 5,
      photo: '',
      isActive: true,
      order: 1,
    },
    {
      name: 'Catarina M.',
      text: 'Depois de anos com dores nas costas, o yoga com o Joaquim foi a melhor decisão que tomei. A abordagem personalizada e o cuidado com a postura são excecionais. Recomendo a 100%.',
      rating: 5,
      photo: '',
      isActive: true,
      order: 2,
    },
    {
      name: 'Pedro L.',
      text: 'Pratico há 6 meses e a evolução tem sido incrível. O Joaquim é muito atencioso e profissional. As aulas particulares permitem um progresso que nunca consegui em aulas de grupo.',
      rating: 5,
      photo: '',
      isActive: true,
      order: 3,
    },
  ];

  for (const testimonial of testimonials) {
    const ref = db.collection('testimonials').doc();
    await ref.set({
      ...testimonial,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`   ✓ ${testimonial.name}`);
  }
  console.log('');

  // 4. Check/Create admin
  console.log('👤 Checking admin users...');
  const adminsSnap = await db.collection('admins').get();
  if (adminsSnap.empty) {
    console.log('   ⚠ No admin users found!');
    console.log('   To set up admin, run:');
    console.log('   node -e "const admin=require(\'firebase-admin\');admin.initializeApp({credential:admin.credential.cert(require(\'./serviceAccountKey.json\'))});admin.firestore().doc(\'admins/YOUR_UID\').set({email:\'your@email.com\',createdAt:new Date()})"');
  } else {
    adminsSnap.forEach(doc => {
      console.log(`   ✓ Admin: ${doc.id} (${doc.data().email || 'no email'})`);
    });
  }
  console.log('');

  console.log('🎉 JOY data seeded successfully!');
  console.log('   → Site config: siteConfig/main');
  console.log(`   → Services: ${services.length} created`);
  console.log(`   → Testimonials: ${testimonials.length} created`);
  console.log('\nNext steps:');
  console.log('   1. Run: npm run build');
  console.log('   2. Run: firebase deploy');
  console.log('   3. Visit your site!');

  process.exit(0);
}

seedData().catch(err => {
  console.error('Error seeding data:', err);
  process.exit(1);
});
