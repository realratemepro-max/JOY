// JOY - Joaquim Oliveira Yoga - Type Definitions

// ============ Loyalty / Gamification ============
export type LoyaltyTheme = 'chakras' | 'lotus' | 'limbs' | 'belts' | 'custom';

export interface LoyaltyLevel {
  name: string;          // e.g. "Muladhara (Raiz)"
  threshold: number;     // attendances needed to reach this level (cumulative)
  color: string;         // hex, used for visual badge
  icon?: string;         // emoji or short label for icon
  description?: string;  // what this level represents
  motivation?: string;   // celebratory message when reached
}

export interface LoyaltyConfig {
  enabled: boolean;
  theme: LoyaltyTheme;
  levels: LoyaltyLevel[];
}

// ============ Site Configuration ============
export interface PracticeSection {
  label: string;      // e.g. "A Prática"
  title: string;      // e.g. "Porquê Hatha Yoga?"
  text: string;       // introductory paragraph
  benefits: string[]; // bullet benefits
}

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

  // Vinyasa Section (legacy — kept for backward compat)
  vinyasaLabel: string;
  vinyasaTitle: string;
  vinyasaText: string;
  vinyasaBenefits: string[];

  // Dynamic practice sections (replaces vinyasa when present)
  practices?: PracticeSection[];

  // Services/Plans Section
  servicesLabel: string;
  servicesTitle: string;
  servicesSubtitle: string;
  servicesDropinTitle?: string;
  servicesDropinSubtitle?: string;
  servicesPlansTitle?: string;
  servicesPlansSubtitle?: string;

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

  // Payment Success page
  paymentSuccessTitle?: string;        // e.g. "Pagamento Confirmado!"
  paymentSuccessSubtitle?: string;     // e.g. "O teu pagamento foi processado com sucesso."
  paymentSuccessStepsTitle?: string;   // e.g. "Próximos Passos"
  paymentSuccessSteps?: string[];      // bullet steps shown after a successful payment

  // Loyalty / Gamificação
  loyalty?: LoyaltyConfig;

  // Legal (Privacidade & Termos)
  legalCompanyName?: string;   // Nome legal da empresa (ex: "Joaquim Oliveira Yoga, Unipessoal Lda")
  legalNif?: string;            // NIF / NIPC da empresa
  legalAddress?: string;        // Morada legal completa
  legalLastUpdate?: string;     // Data da última atualização (YYYY-MM-DD)

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
  dropinValidityDays: number;      // Days a drop-in session is valid after purchase (e.g. 15)
  cancellationGracePeriodDays?: number; // Days added to plan validity when admin/professor cancels a class (default 7)

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
  costPerSession: number;    // Legacy/fallback: fixed cost per session
  costMonthlyPerSlot: number; // Legacy alternative — fixed monthly cost per weekly slot
  costMonthlyBase?: number;  // Default monthly rent (excl. VAT). Per-class = (base × (1 + vat%/100)) ÷ non-cancelled-classes-that-month. Can be overridden per month via locationMonthlyCosts.
  costMonthlyVatPercent?: number; // Default VAT % applied to costMonthlyBase
  externalRatePerHour?: number; // What admin earns per hour at this external space
  capacity: number;          // Max students
  amenities: string[];
  mapUrl?: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Per-month rent override for a location ============
export interface LocationMonthlyCost {
  id: string;        // doc id = `${locationId}_${YYYY-MM}`
  locationId: string;
  year: number;
  month: number;     // 1-12
  base: number;      // monthly rent (excl. VAT) for this specific month
  vatPercent: number;
  updatedAt: Date;
}

// ============ Professors (Professores) ============
export type ProfessorPaymentModel = 'per_hour' | 'per_student';

export interface ProfessorRates {
  group?: number;     // price per hour for group classes
  private?: number;   // price per hour for private classes
  event?: number;     // price per hour for events
}

export interface ProfessorPermissions {
  canMarkAttendance: boolean;       // mark students present/absent
  canCancelSessions: boolean;       // cancel their own sessions
  canSubstituteSession: boolean;    // assign a substitute professor for their own sessions
  canCreateSessions: boolean;       // create new sessions
  canEditSessions: boolean;         // edit session details (time, location)
  canManageWaitlist: boolean;       // promote/remove waitlist entries
  canViewStudentContacts: boolean;  // see student phone/email
  canViewEarnings: boolean;         // see own earnings/payments
  canAddStudentsToSession: boolean; // add a registered student to a session
  canAcceptCashPayment: boolean;    // record cash payments in person
}

export const DEFAULT_PROFESSOR_PERMISSIONS: ProfessorPermissions = {
  canMarkAttendance: true,
  canCancelSessions: false,
  canSubstituteSession: false,
  canCreateSessions: false,
  canEditSessions: false,
  canManageWaitlist: true,
  canViewStudentContacts: false,
  canViewEarnings: true,
  canAddStudentsToSession: false,
  canAcceptCashPayment: false,
};

export interface Professor {
  id: string;
  name: string;
  style: string;       // e.g. "Vinyasa", "Hatha", "Yin"
  age?: number;
  bio: string;
  photoUrl?: string;
  isActive: boolean;

  // Landing page visibility
  showOnLanding?: boolean;
  landingSpecialty?: string;    // e.g. "Hatha Yoga · Meditação"
  landingBio?: string;          // shorter bio for the landing page card
  landingHighlights?: string[]; // e.g. ["RYT-200 Yoga Alliance", "+5 anos experiência"]

  // Payment
  paymentModel: ProfessorPaymentModel;
  rates: ProfessorRates;          // per_hour: €/h by class type
  pricePerStudent?: number;       // per_student: € per student per session
  deductSpaceCost?: boolean;      // per_student: subtract location cost from earnings

  // Personal
  dateOfBirth?: string;           // YYYY-MM-DD

  // Portal access
  linkedUserId?: string;          // Firebase auth uid of professor's account
  linkedEmail?: string;           // email shown in admin for reference
  permissions: ProfessorPermissions;

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
  sessionsTotal?: number; // fixed sessions per pack: 4, 8, 12...
  priceMonthly?: number;
  // Drop-in fields (only when billingType = 'dropin')
  pricePerSession?: number;
  // Common
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  isContentPlan?: boolean; // library/digital content add-on
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Content Library ============
export type ContentType = 'video' | 'audio' | 'both';

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  category: string;
  type: ContentType;
  videoUrl?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  duration?: number; // minutes
  isPremium: boolean;
  isActive: boolean;
  order: number;
  tags?: string[];
  instructor?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentSubscription {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  planId: string;
  planName: string;
  price: number;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'expired' | 'cancelled';
  paymentId?: string;
  createdAt: Date;
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
export type SessionClassType = 'group' | 'private' | 'both'; // Grupo, Privada, ou Grupo+Privada (turma fechada)
export type PlanClassType = 'group' | 'private' | 'both'; // Modalidade do plano
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'replaced';
export type CancelReason = 'professor_sick' | 'space_unavailable' | 'weather' | 'other';
export type ReplacementStatus = 'pending' | 'accepted' | 'refused';
export type SessionRecurrence = 'none' | 'weekly';

export interface SessionStudent {
  userId: string;
  userName: string;
  subscriptionId?: string;
  status: AttendanceStatus;
  attendanceMode?: 'presencial' | 'online';
  replacementResponse?: ReplacementStatus;
  notifiedAttended?: boolean; // post-class notification sent
  cashPayment?: {
    amount: number;
    recordedBy: string;
    recordedAt: Date;
  };
}

export interface WaitlistEntry {
  userId: string;
  userName: string;
  userEmail: string;
  position: number;
  joinedAt: Date;
  notified?: boolean;
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
  waitlist?: WaitlistEntry[];

  // Status
  status: SessionStatus;
  notes?: string;

  // Space cost — optional override for this specific session (overrides location.costPerSession default)
  spaceCost?: number;

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
export type UserRole = 'admin' | 'professor' | 'client';
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
  professorId?: string; // Set when role='professor', links to professors collection
  activePlanId?: string;
  activePlanName?: string;
  chatVisible?: boolean; // Client opt-in to be discoverable by other clients in chat
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
export type PaymentMethod = 'MBWay' | 'Multibanco' | 'CreditCard' | 'Numerário';
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

// ============ Professor Payments (studio → professor) ============
export type ProfessorPaymentMethod = 'transfer' | 'mbway' | 'cash' | 'other';
export type ProfessorPaymentStatus = 'pending_confirmation' | 'confirmed';

export interface ProfessorPayment {
  id: string;
  professorId: string;
  professorName: string;
  amount: number;
  periodFrom: Date;
  periodTo: Date;
  paidAt: Date;
  paymentMethod: ProfessorPaymentMethod;
  notes?: string;
  status: ProfessorPaymentStatus;
  confirmedAt?: Date | null;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
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

// ============ Referral Program ============
export type ReferralRewardType = 'discount_code' | 'credit';
export type ReferralTrigger = 'signup' | 'first_purchase';
export type ReferralDiscountType = 'percentage' | 'fixed';

export interface ReferralConfig {
  enabled: boolean;
  // What the referrer gets
  referrerRewardType: ReferralRewardType;   // 'discount_code' | 'credit'
  referrerRewardValue: number;               // € amount or sessions
  referrerDiscountType: ReferralDiscountType; // only if reward = 'discount_code'
  // When the referrer gets the reward
  trigger: ReferralTrigger;                  // 'signup' | 'first_purchase'
  // What the referred (new user) gets
  referredEnabled: boolean;
  referredDiscountType: ReferralDiscountType;
  referredDiscountValue: number;             // % or €
  // Display
  description: string;                       // shown to users
  updatedAt?: Date;
}

export type ReferralStatus = 'pending' | 'rewarded' | 'cancelled';

export interface Referral {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  referrerCode: string;
  referredId: string;
  referredName: string;
  referredEmail: string;
  status: ReferralStatus;
  trigger: ReferralTrigger;
  referrerRewardPromoId?: string;   // promo code given to referrer
  referredPromoId?: string;         // promo code given to referred
  createdAt: Date;
  completedAt?: Date;
}

// ============ Gift Cards (Vales Oferta) ============
export type GiftCardStatus = 'active' | 'used' | 'expired' | 'cancelled';

export interface GiftCard {
  id: string;
  code: string;                // e.g. "VALE-ABC123"
  initialBalance: number;      // original value in €
  remainingBalance: number;    // current remaining €
  purchaserName?: string;
  purchaserEmail?: string;
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
  status: GiftCardStatus;
  paymentId?: string;          // if purchased online via EuPago
  expiresAt: Date;
  usedAt?: Date;
  usedByUserId?: string;
  createdBy: 'admin' | 'online';
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

// ============ Notifications Config ============
export type NotificationChannel = 'email' | 'whatsapp' | 'telegram' | 'app';
export type NotificationTrigger =
  | 'plan_purchased'        // Client buys a plan
  | 'session_booked'        // Client books a session
  | 'session_cancelled'     // Client cancels a session
  | 'session_reminder'      // X hours before session
  | 'plan_expiring'         // X days before plan expires
  | 'session_cancelled_admin' // Admin cancels session
  | 'professor_substituted' // Professor replaced
  | 'waitlist_promoted'     // Student promoted from waitlist
  | 'class_attended'        // Student marked present post-class
  | 'mass_message';         // Admin sends bulk message

export interface NotificationSetting {
  trigger: NotificationTrigger;
  label: string;
  description: string;
  channels: {
    email: boolean;
    whatsapp: boolean;
    telegram: boolean;
    app: boolean;
  };
  notifyStudent: boolean;
  notifyProfessor: boolean;
  template?: string;
  professorTemplate?: string;
}

export interface NotificationConfig {
  // Email settings
  emailEnabled: boolean;
  emailProvider: 'gmail' | 'resend' | 'other';
  emailFrom: string;
  emailFromName: string;
  gmailAppPassword?: string; // Gmail App Password
  resendApiKey?: string;     // Resend.com API Key
  resendFromEmail?: string;  // Resend verified sender (e.g. noreply@joaquimyoga.pt)

  // WhatsApp settings
  whatsappEnabled: boolean;
  whatsappMode: 'link' | 'api'; // link = wa.me links, api = Business API
  whatsappApiToken?: string;
  whatsappPhoneId?: string;

  // Telegram settings
  telegramEnabled: boolean;
  telegramBotToken?: string;
  telegramChatId?: string; // default group/channel

  // Timing
  sessionReminderHours: number; // hours before session to send reminder
  planExpiryWarningDays: number; // days before expiry to warn

  // Per-trigger settings
  triggers: NotificationSetting[];
}

// ============ Session Ratings ============
export type RatingStatus = 'auto_approved' | 'pending' | 'approved' | 'rejected';

export interface SessionRating {
  id: string;
  sessionId: string;
  sessionName?: string;
  sessionDate?: Date;
  userId: string;
  userName: string;
  stars: number; // 1-5
  comment?: string; // if present → pending approval
  status: RatingStatus;
  testimonialId?: string; // created when approved
  createdAt: Date;
}

// ============ Chat ============
export type ChatSenderRole = 'admin' | 'professor' | 'client';
export type ConversationType = 'direct' | 'group' | 'community';

export interface ChatMember {
  userId: string;
  role: ChatSenderRole;
  name: string;
  email?: string;
  photoUrl?: string;
}

export interface ChatAttachment {
  type: 'image' | 'file';
  url: string;
  name?: string;
  size?: number;
  contentType?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: ChatSenderRole;
  text?: string;
  attachment?: ChatAttachment;
  createdAt: Date;
  readAt?: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

export interface Conversation {
  id: string;

  // New fields (preferred)
  type?: ConversationType;
  members?: ChatMember[];           // for direct + group
  memberIds?: string[];             // denormalized for queries (where memberIds array-contains uid)
  name?: string;                    // for group/community
  description?: string;
  iconUrl?: string;
  isOpenToAll?: boolean;            // community joinable by all clients
  mutedBy?: { [userId: string]: number | true };  // userId → epoch ms (or true for forever)

  // Legacy fields (admin↔client direct chat) — kept for backward compat
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  professorId?: string;             // when conversation has a linked professor

  // Common
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageSenderId?: string;
  unreadAdmin?: number;
  unreadClient?: number;
  unreadByUser?: { [userId: string]: number };  // for groups + new conversations
  createdAt: Date;
  updatedAt: Date;
}

// ============ Professor Personal Tool ============
// Stored in subcollections: professors/{id}/personalLocations & /personalSessions
// Completely private — no admin access enforced at Firestore rules level.

export type PersonalPaymentType = 'fixed' | 'per_student' | 'manual' | 'per_occupancy';
export type PersonalSessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface OccupancyTier {
  minPct: number;
  maxPct: number;
  amount: number;
}

export interface PersonalStudent {
  name: string;      // optional — professor may just track a count
  present: boolean;
}

export interface PersonalLocation {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  // Default payment terms for sessions at this location
  defaultPaymentType: PersonalPaymentType;
  defaultFixedAmount?: number;
  defaultRatePerStudent?: number;
  defaultOccupancyTiers?: OccupancyTier[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonalSession {
  id: string;
  name: string;           // e.g. "Vinyasa Yoga"
  date: Date;
  startTime: string;      // "18:30"
  endTime: string;        // "19:30"
  duration?: number;      // minutes

  locationId?: string;    // ref to personalLocations
  locationName: string;   // free text or from location

  // Students — either named list OR just a count
  students?: PersonalStudent[];   // named tracking (optional)
  studentsExpected?: number;
  studentsPresent?: number;       // manual count (if no named list)

  // Payment
  paymentType: PersonalPaymentType;
  fixedAmount?: number;
  ratePerStudent?: number;
  manualAmount?: number;
  occupancyTiers?: OccupancyTier[];
  // computed: fixed | ratePerStudent × studentsPresent | manualAmount

  // Status
  status: PersonalSessionStatus;

  // Financial tracking
  isPaid: boolean;
  paidAmount?: number;
  paidAt?: Date;
  receiptIssued: boolean;
  receiptNumber?: string;
  notes?: string;

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
