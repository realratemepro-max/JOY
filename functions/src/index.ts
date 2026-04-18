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

// Google OAuth & Reviews (kept)
export { exchangeGoogleOAuthCode } from './googleOAuth';
export { importGoogleReviews } from './importGoogleReviews';
export { onReviewCreated, onReviewUpdated, onReviewDeleted } from './updateReviewStats';
export { proxyImage } from './proxyImage';

// Payment management
export { sendPaymentConfirmation } from './sendPaymentEmail';
export { manualPaymentUpdate } from './manualPaymentUpdate';

// Subscription lifecycle
export { checkExpiringSubscriptions } from './checkExpiringSubscriptions';
export { handleExpiredSubscriptions } from './handleExpiredSubscriptions';
