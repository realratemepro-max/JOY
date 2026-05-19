import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// EuPago payment functions
export { createMbWayPayment } from './createMbWayPayment';
export { createMultibancoPayment } from './createMultibancoPayment';
export { eupagoWebhook } from './eupagoWebhook';
export { getPaymentStatus } from './getPaymentStatus';

// Promo Code functions
export { validatePromoCode, applyPromoCode } from './validatePromoCode';

// Gift Card functions
export { redeemGiftCard } from './redeemGiftCard';

// Referral Program
export { processReferral } from './processReferral';

// Google OAuth & Reviews (kept)
export { exchangeGoogleOAuthCode } from './googleOAuth';
export { importGoogleReviews } from './importGoogleReviews';
export { onReviewCreated, onReviewUpdated, onReviewDeleted } from './updateReviewStats';
export { onTestimonialWritten, onSessionRatingWritten } from './aggregateReviews';
export { proxyImage } from './proxyImage';

// Payment management
export { sendPaymentConfirmation } from './sendPaymentEmail';
export { manualPaymentUpdate } from './manualPaymentUpdate';

// Subscription lifecycle
export { checkExpiringSubscriptions } from './checkExpiringSubscriptions';
export { handleExpiredSubscriptions } from './handleExpiredSubscriptions';

// Notifications
export { onPurchaseCreated, onSessionUpdated, sendSessionReminders, sendExpiryWarnings, onMassMessageCreated } from './notificationTriggers';

// Zoom
export { createZoomMeeting, deleteZoomMeeting } from './createZoomMeeting';

// Professor account management
export { createProfessorAccount } from './createProfessorAccount';
export { generateProfessorResetLink } from './generateProfessorResetLink';

// Client account management
export { createClientAccount } from './createClientAccount';
export { sendClientPasswordReset } from './sendClientPasswordReset';
export { linkClientPurchases } from './linkClientPurchases';

// Admin/professor-triggered payment requests for in-person enrollments
export { requestStudentPayment } from './requestStudentPayment';

// One-off admin migration: lowercase existing email fields across collections
export { normalizeEmailsCase } from './normalizeEmailsCase';

// Payment link emails (admin/prof sends → student picks method on public page)
export { sendPaymentLink, getPaymentTokenInfo, processTokenPayment } from './paymentLinks';

// Accounting — mark invoice issued (sequential number)
export { markInvoiceIssued } from './markInvoiceIssued';

// Calendar iCal feed
export { userCalendar } from './userCalendar';

// Birthday emails
export { sendBirthdayEmails } from './birthdayEmails';

// Session management
export { cancelSessionWithRefund } from './cancelSessionWithRefund';
export { substituteSessionProfessor } from './substituteSessionProfessor';

// Notification testing
export { sendTestEmail } from './sendTestEmail';

// Backups
export { backupFirestore } from './backupFirestore';

// Chat push notifications
export { onChatMessageCreated } from './onChatMessageCreated';

// Lists for professor portal (privileged reads)
export { listClientsForProfessor } from './listClientsForProfessor';

// Professor earnings (privileged read of purchases for justification)
export { getProfessorEarnings } from './getProfessorEarnings';

// Debug
export { debugSessions } from './debugSessions';
