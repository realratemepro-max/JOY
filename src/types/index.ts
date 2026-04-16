// JOY - Joaquim Oliveira Yoga - Type Definitions

// ============ Site Configuration ============
export interface SiteConfig {
  // Branding
  siteName: string;
  tagline: string;
  logo?: string;
  favicon?: string;

  // Hero Section
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroCtaLink: string;
  heroSecondaryText: string;
  heroImage?: string;

  // About Section
  aboutLabel: string;
  aboutTitle: string;
  aboutText: string;
  aboutImage?: string;
  aboutHighlights: string[];

  // Vinyasa Section
  vinyasaLabel: string;
  vinyasaTitle: string;
  vinyasaText: string;
  vinyasaBenefits: string[];

  // Services/Plans Section
  servicesLabel: string;
  servicesTitle: string;
  servicesSubtitle: string;

  // Testimonials Section
  testimonialsLabel: string;
  testimonialsTitle: string;

  // Contact Section
  contactLabel: string;
  contactTitle: string;
  contactSubtitle: string;
  contactCtaTitle: string;
  contactCtaText: string;
  contactEmailButton: string;
  contactPhoneButton: string;

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

// ============ Locations (Espaços) ============
export interface Location {
  id: string;
  name: string;
  address: string;
  description: string;
  photoUrl?: string;
  costPerSession: number; // Internal: Joaquim's cost
  capacity: number;
  amenities: string[];
  mapUrl?: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Plans (Planos de Aulas) ============
export interface ScheduleSlot {
  dayOfWeek: number; // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  locationId: string;
  locationName: string; // Denormalized
  sessionsPerWeek: number; // 1, 2, 3...
  sessionDuration: number; // in minutes
  priceMonthly: number;
  // Drop-in / single class
  allowDropIn: boolean;
  dropInPrice?: number; // Price per single session
  // Pack options
  allowPack: boolean;
  packSessions?: number; // e.g. 5, 10
  packPrice?: number; // Total pack price
  schedule: ScheduleSlot[];
  type: 'private' | 'group';
  maxStudents?: number;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Subscriptions (Subscrições de Clientes) ============
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'pending_payment';

export interface Subscription {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  planId: string;
  planName: string;
  locationId: string;
  locationName: string;
  sessionsPerWeek: number;
  priceMonthly: number;
  status: SubscriptionStatus;
  startDate: Date;
  endDate?: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  sessionsUsedThisPeriod: number;
  sessionsAllowedThisPeriod: number;
  lastPaymentId?: string;
  nextPaymentDue?: Date;
  cancelledAt?: Date;
  pausedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Sessions (Aulas Concretas) ============
export type AttendanceStatus = 'enrolled' | 'attended' | 'absent' | 'cancelled';
export type SessionType = 'regular' | 'makeup' | 'extra' | 'event';
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

export interface SessionStudent {
  userId: string;
  userName: string;
  subscriptionId?: string;
  status: AttendanceStatus;
}

export interface Session {
  id: string;
  planId?: string;
  locationId: string;
  locationName: string;
  date: Date;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
  enrolledStudents: SessionStudent[];
  maxCapacity: number;
  type: SessionType;
  eventId?: string; // V2
  status: SessionStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Events (V2) ============
export interface YogaEvent {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  photoUrl?: string;
  locationId: string;
  locationName: string;
  date: Date;
  startTime: string;
  endTime: string;
  price: number;
  capacity: number;
  enrolledCount: number;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Users ============
export type UserRole = 'admin' | 'client';
export type UserExperience = 'beginner' | 'intermediate' | 'advanced';
export type UserStatus = 'active' | 'inactive' | 'lead';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  photoUrl?: string;
  dateOfBirth?: string;
  emergencyContact?: string;
  goals?: string;
  injuries?: string;
  experience?: UserExperience;
  notes?: string; // Admin-only notes
  activePlanId?: string;
  activePlanName?: string;
  status: UserStatus;
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

// ============ Payments ============
export type PaymentMethod = 'MBWay' | 'Multibanco' | 'CreditCard';
export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Expired' | 'Cancelled';
export type PaymentType = 'plan_subscription' | 'event_booking' | 'single_class';

export interface Payment {
  id: string;
  userId?: string;
  userEmail: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  identifier: string;

  // What was paid for
  type?: PaymentType;
  plan?: string; // Legacy compatibility
  planId?: string;
  planName?: string;
  locationId?: string;
  locationName?: string;
  eventId?: string; // V2
  billingPeriodStart?: Date;
  billingPeriodEnd?: Date;

  // EuPago
  eupagoTransactionId?: string;
  eupagoReference?: string;
  entity?: string;
  reference?: string;
  eupagoResponse?: any;
  userPhone?: string;

  // Promo
  promoCodeId?: string;
  discountAmount?: number;

  // Legacy fields
  serviceId?: string;
  serviceName?: string;
  isUpgrade?: boolean;
  previousPlan?: string;
  clientId?: string;

  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  expiresAt?: Date;
}

// ============ Legacy: Services (deprecated, kept for migration) ============
export interface YogaService {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  price: number;
  duration: string;
  sessions?: number;
  type: 'single' | 'pack' | 'monthly';
  isPopular?: boolean;
  isActive: boolean;
  features: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Legacy: Client (deprecated, replaced by User with role='client') ============
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

// ============ Client Resources (V2) ============
export interface ClientResource {
  id: string;
  title: string;
  description?: string;
  type: 'pdf' | 'video' | 'link';
  url: string;
  thumbnailUrl?: string;
  targetUserIds?: string[]; // null = all clients
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}
