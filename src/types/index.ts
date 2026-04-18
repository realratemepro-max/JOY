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

  // Business Rules
  bookingMinHoursBefore: number;   // Min hours before session to book (e.g. 24)
  cancelLimitHoursBefore: number;  // Max hours before session to cancel (e.g. 2)
  cancelRefundPolicy: 'credit' | 'refund' | 'none'; // What happens on valid cancel
  lateCancelPenalty: 'no_refund' | 'half_credit' | 'none'; // Late cancel penalty
  creditValidityDays: number;      // Days a credit is valid after cancellation (e.g. 30)

  // Payment Provider Config
  paymentProvider: 'eupago' | 'other';
  paymentApiKey: string;
  paymentApiBaseUrl: string;
  paymentWebhookEncryptionKey?: string;
  paymentMethodsMbway: boolean;
  paymentMethodsMultibanco: boolean;

  updatedAt: Date;
}

// ============ Locations (Espaços) ============
export interface Location {
  id: string;
  name: string;
  address: string;
  description: string;
  photoUrl?: string;
  isExternal: boolean;       // External space where admin teaches but doesn't manage
  costPerSession: number;    // Legacy: flat cost per session
  costMonthlyPerSlot: number; // Monthly cost per weekly time slot (e.g. 30€/month per slot)
  externalRatePerHour?: number; // What admin earns per hour at this external space
  capacity: number;          // Max students
  amenities: string[];
  mapUrl?: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Professors (Professores) ============
export type ProfessorPaymentModel = 'per_hour' | 'per_student';

export interface ProfessorRates {
  group?: number;     // price per hour for group classes
  private?: number;   // price per hour for private classes
  event?: number;     // price per hour for events
}

export interface Professor {
  id: string;
  name: string;
  style: string;       // e.g. "Vinyasa", "Hatha", "Yin"
  age?: number;
  bio: string;
  photoUrl?: string;
  isActive: boolean;

  // Payment
  paymentModel: ProfessorPaymentModel;
  rates: ProfessorRates;          // per_hour: €/h by class type
  pricePerStudent?: number;       // per_student: € per student per session
  deductSpaceCost?: boolean;      // per_student: subtract location cost from earnings

  createdAt: Date;
  updatedAt: Date;
}

// ============ Plans (Planos de Aulas) ============
// Two types: 'subscription' (monthly) or 'dropin' (single class)
export type PlanBillingType = 'subscription' | 'dropin';

export interface Plan {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  billingType: PlanBillingType;
  locationId: string;
  locationName: string;
  // Subscription fields (only when billingType = 'subscription')
  sessionsPerWeek?: number; // 1, 2, 3...
  priceMonthly?: number;
  // Drop-in fields (only when billingType = 'dropin')
  pricePerSession?: number;
  // Common
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

// ============ Aulas (Sessions) ============
export type AttendanceStatus = 'enrolled' | 'attended' | 'absent' | 'cancelled';
export type SessionClassType = 'group' | 'private'; // Grupo ou Privada
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'replaced';
export type CancelReason = 'professor_sick' | 'space_unavailable' | 'weather' | 'other';
export type ReplacementStatus = 'pending' | 'accepted' | 'refused';
export type SessionRecurrence = 'none' | 'weekly';

export interface SessionStudent {
  userId: string;
  userName: string;
  subscriptionId?: string;
  status: AttendanceStatus;
  replacementResponse?: ReplacementStatus; // response to professor substitution
}

export interface Session {
  id: string;
  name?: string; // Optional name for the class

  // Location
  locationId: string;
  locationName: string;
  maxCapacity: number;

  // Professor
  professorId?: string;
  professorName?: string;

  // Schedule
  date: Date;
  startTime: string;
  endTime: string;
  duration: number; // minutes (e.g. 60, 75, 90)
  dayOfWeek: number;

  // Recurrence
  recurrence: SessionRecurrence;
  recurrenceEndDate?: Date;

  // Type
  classType: SessionClassType; // 'group' or 'private'

  // Students
  enrolledStudents: SessionStudent[];

  // Status
  status: SessionStatus;
  notes?: string;

  // Cancellation / Replacement
  cancelReason?: CancelReason;
  cancelReasonText?: string; // free text when reason is 'other'
  cancelledBy?: string; // admin userId
  cancelledAt?: Date;
  replacementProfessorId?: string;
  replacementProfessorName?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ============ Credits ============
export type CreditType = 'dropin_credit' | 'session_return';

export interface Credit {
  id: string;
  userId: string;
  userName: string;
  type: CreditType;
  amount: number; // 1 = one session credit
  reason: string;
  sessionId: string; // the cancelled session
  sessionDate?: Date;
  usedAt?: Date;
  usedSessionId?: string; // the session where it was redeemed
  expiresAt: Date;
  createdAt: Date;
}

// ============ Events (V2) ============
export interface YogaEvent {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  photoUrl?: string;
  locationId: string;
  professorId?: string;
  professorName?: string;
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
