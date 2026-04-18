import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { SiteConfig } from '../types';

export const defaultSiteConfig: SiteConfig = {
  siteName: 'JOY - Joaquim Oliveira Yoga',
  tagline: 'Encontra o teu equilíbrio interior através do Vinyasa Yoga',
  heroBadge: 'Vinyasa Yoga',
  heroTitle: 'Transforma a tua vida com Vinyasa Yoga',
  heroSubtitle: 'Aulas particulares personalizadas para o teu corpo, mente e espírito. Descobre o poder transformador do yoga com acompanhamento individual.',
  heroCtaText: 'Reservar Aula Particular',
  heroCtaLink: '#servicos',
  heroSecondaryText: 'Saber Mais',
  aboutLabel: 'Sobre Mim',
  aboutTitle: 'Sobre Joaquim Oliveira',
  aboutText: 'Com mais de 10 anos de prática e formação internacional em Vinyasa Yoga, dedico-me a guiar cada aluno numa jornada única de autodescoberta e transformação. Acredito que o yoga vai muito além das posturas físicas - é um caminho para o equilíbrio, a paz interior e uma vida mais consciente.\n\nFormado pela Yoga Alliance (RYT-500), especializei-me em Vinyasa Flow, adaptando cada prática ao nível e objetivos individuais de cada pessoa. Nas minhas aulas particulares, crio sequências personalizadas que respeitam o teu corpo e desafiam os teus limites de forma segura e progressiva.',
  aboutHighlights: [
    'RYT-500 Yoga Alliance',
    '+10 anos de experiência',
    '+500 alunos acompanhados',
    'Formação internacional'
  ],
  vinyasaLabel: 'A Prática',
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
  servicesLabel: 'Aulas Particulares',
  servicesTitle: 'Escolhe o Teu Plano',
  servicesSubtitle: 'Cada aula é totalmente personalizada e adaptada ao teu nível, objetivos e necessidades.',
  testimonialsLabel: 'Testemunhos',
  testimonialsTitle: 'O que dizem os meus alunos',
  contactLabel: 'Contacto',
  contactTitle: 'Pronto para começar?',
  contactSubtitle: 'Marca a tua primeira aula experimental e descobre como o Vinyasa Yoga pode transformar a tua vida. Não é preciso experiência prévia.',
  contactCtaTitle: 'Aula Experimental',
  contactCtaText: 'Agenda a tua primeira sessão e sente a diferença do acompanhamento personalizado.',
  contactEmailButton: 'Enviar Email',
  contactPhoneButton: 'Ligar Agora',
  email: 'geral@joaquimyoga.pt',
  phone: '+351 912 345 678',
  instagram: 'joaquimoliveirayoga',
  facebook: 'joaquimoliveirayoga',
  youtube: '',
  location: 'Lisboa, Portugal',
  mapUrl: '',
  footerText: '2024 JOY - Joaquim Oliveira Yoga. Todos os direitos reservados.',
  metaTitle: 'JOY - Joaquim Oliveira Yoga | Aulas Particulares de Vinyasa Yoga',
  metaDescription: 'Aulas particulares de Vinyasa Yoga em Lisboa. Transforme a sua vida com sessões personalizadas. Reserva a tua primeira aula.',
  primaryColor: '#7c9a72',
  secondaryColor: '#c4a882',
  accentColor: '#c17f59',
  bookingMinHoursBefore: 24,
  cancelLimitHoursBefore: 2,
  cancelRefundPolicy: 'credit',
  lateCancelPenalty: 'no_refund',
  creditValidityDays: 30,
  paymentProvider: 'eupago',
  paymentApiKey: '',
  paymentApiBaseUrl: 'https://clientes.eupago.pt',
  paymentWebhookEncryptionKey: '',
  paymentMethodsMbway: true,
  paymentMethodsMultibanco: true,
  updatedAt: new Date(),
};

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const docRef = doc(db, 'siteConfig', 'main');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...defaultSiteConfig,
        ...data,
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    }

    // Create default config if doesn't exist
    await setDoc(doc(db, 'siteConfig', 'main'), {
      ...defaultSiteConfig,
      updatedAt: new Date(),
    });
    return defaultSiteConfig;
  } catch (error) {
    console.error('Error loading site config:', error);
    return defaultSiteConfig;
  }
}

export async function updateSiteConfig(config: Partial<SiteConfig>): Promise<void> {
  const docRef = doc(db, 'siteConfig', 'main');
  await setDoc(docRef, { ...config, updatedAt: new Date() }, { merge: true });
}
