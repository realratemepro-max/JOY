// JOY - Joaquim Oliveira Yoga - Type Definitions

// ============ Site Configuration ============
export interface SiteConfig {
  // Branding
  siteName: string;
  tagline: string;
  logo?: string;
  favicon?: string;

  // Hero Section
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroCtaLink: string;
  heroImage?: string;

  // About Section
  aboutTitle: string;
  aboutText: string;
  aboutImage?: string;
  aboutHighlights: string[];

  // Vinyasa Section
  vinyasaTitle: string;
  vinyasaText: string;
  vinyasaBenefits: string[];

  // Contact Info
  email: string;
  phone: string;
  instagram?: string;
  facebook?: string;
  youtube?: string;
  location?: string;
  mapUrl?: string;

  // Footer
  footerText: string;

  // SEO
  metaTitle: string;
  metaDescription: string;

  // Theme colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;

  updatedAt: Date;
}

// ============ Services / Packages ============
export interface YogaService {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  price: number;
  duration: string; // e.g. "60 min", "Pack 5 aulas"
  sessions?: number; // number of sessions in pack
  type: 'single' | 'pack' | 'monthly';
  isPopular?: boolean;
  isActive: boolean;
  features: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Testimonials ============
export interface Testimonial {
  id: string;
  name: string;
  text: string;
  rating: number;
  photo?: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
}

// ============ Clients / Leads ============
export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  totalSpent: number;
  sessionsRemaining: number;
  totalSessions: number;
  status: 'active' | 'inactive' | 'lead';
  createdAt: Date;
  updatedAt: Date;
}

// ============ Bookings ============
export interface Booking {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  serviceId: string;
  serviceName: string;
  date?: Date;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentId?: string;
  amount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Payments ============
export type PaymentMethod = 'MBWay' | 'Multibanco' | 'CreditCard';
export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Expired' | 'Cancelled';

export interface Payment {
  id: string;
  userId?: string;
  clientId?: string;
  userEmail: string;
  plan: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  identifier: string;
  eupagoTransactionId?: string;
  eupagoReference?: string;
  entity?: string;
  reference?: string;
  eupagoResponse?: any;
  userPhone?: string;
  isUpgrade?: boolean;
  previousPlan?: string;
  serviceId?: string;
  serviceName?: string;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  expiresAt?: Date;
}

// ============ User (Admin) ============
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  plan?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'user';

// ============ Promo Codes ============
export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  isActive: boolean;
  maxUses: number;
  currentUses: number;
  expiresAt?: Date;
  applicablePlans?: string[];
  minPurchaseAmount?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Pricing Plan (for checkout compatibility) ============
export interface PricingPlan {
  id: string;
  name: string;
  namePt?: string;
  priceAnnual: number;
  priceMonthly?: number;
  billingPeriod?: string;
  description?: string;
  descriptionPt?: string;
  features: Record<string, any>;
  isPopular?: boolean;
  isActive: boolean;
  savings?: number;
  createdAt: Date;
  updatedAt: Date;
}
