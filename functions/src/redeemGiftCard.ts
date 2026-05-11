import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { checkRateLimit, getCallerIdentifier } from './utils/rateLimit';

const db = admin.firestore();

export const redeemGiftCard = functions.region('europe-west1').https.onCall(async (data, context) => {
  const { giftCardCode, planId, userId, userEmail, type, amount } = data;

  if (!giftCardCode || !userId) {
    throw new functions.https.HttpsError('invalid-argument', 'Campos obrigatórios em falta');
  }

  // Rate limit: 5 attempts per minute per caller (prevent brute-force of gift card codes)
  const rlIdentifier = getCallerIdentifier(context, data);
  if (!(await checkRateLimit('redeemGiftCard', rlIdentifier, 5))) {
    throw new functions.https.HttpsError('resource-exhausted', 'Demasiadas tentativas. Aguarda 1 minuto.');
  }

  // Find gift card
  const snap = await db.collection('giftCards').where('code', '==', String(giftCardCode).toUpperCase()).limit(1).get();
  if (snap.empty) throw new functions.https.HttpsError('not-found', 'Vale oferta não encontrado');

  const gcDoc = snap.docs[0];
  const gc = gcDoc.data();

  if (gc.status !== 'active') throw new functions.https.HttpsError('failed-precondition', 'Vale oferta não está ativo');
  const expiresAt: Date = gc.expiresAt?.toDate ? gc.expiresAt.toDate() : new Date(gc.expiresAt);
  if (expiresAt < new Date()) throw new functions.https.HttpsError('failed-precondition', 'Vale oferta expirado');
  if ((gc.remainingBalance || 0) <= 0) throw new functions.https.HttpsError('failed-precondition', 'Vale oferta sem saldo');

  const chargeAmount: number = typeof amount === 'number' ? amount : parseFloat(amount) || gc.remainingBalance;
  const deduct = Math.min(gc.remainingBalance, chargeAmount);
  const newBalance = Math.max(0, gc.remainingBalance - deduct);

  // Deduct from gift card
  await gcDoc.ref.update({
    remainingBalance: newBalance,
    status: newBalance <= 0 ? 'used' : 'active',
    ...(newBalance <= 0 ? { usedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    usedByUserId: userId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Create payment record
  const identifier = `joy_giftcard_${String(userId).substring(0, 8)}_${Date.now()}`;
  const payRef = await db.collection('payments').add({
    userId,
    userEmail: userEmail || '',
    planId: planId || '',
    planName: '',
    type: type || 'plan_subscription',
    amount: deduct,
    method: 'GiftCard',
    status: 'Paid',
    identifier,
    giftCardCode,
    giftCardId: gcDoc.id,
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Activate plan
  if (planId && (type === 'plan_subscription' || !type)) {
    await activatePlanPurchase(userId, userEmail || '', planId, deduct, payRef.id);
  } else if (type === 'single_class' || type === 'dropin') {
    await activateDropin(userId, payRef.id);
  }

  return { success: true, paymentId: payRef.id, deductedAmount: deduct, remainingBalance: newBalance };
});

async function activatePlanPurchase(userId: string, userEmail: string, planId: string, amount: number, paymentId: string) {
  const planDoc = await db.collection('plans').doc(planId).get();
  if (!planDoc.exists) { console.error('Plan not found:', planId); return; }
  const plan = planDoc.data()!;

  if (plan.isContentPlan) {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + (plan.validityDays || 30));
    await db.collection('contentSubscriptions').add({
      userId, userEmail, userName: userEmail,
      planId, planName: plan.name || '',
      price: amount,
      status: 'active',
      startDate: admin.firestore.Timestamp.fromDate(now),
      endDate: admin.firestore.Timestamp.fromDate(endDate),
      paymentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  const now = new Date();
  const validityDays = plan.validityDays || 30;
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + validityDays);
  const totalSessions = plan.sessionsTotal || Math.ceil((plan.sessionsPerWeek || 1) * 4.33);

  const purchaseRef = await db.collection('purchases').add({
    userId, userName: userEmail, userEmail,
    planId, planName: plan.name || '',
    locationId: plan.locationId || '', locationName: plan.locationName || '',
    priceMonthly: plan.priceMonthly || amount,
    status: 'active',
    purchaseDate: admin.firestore.Timestamp.fromDate(now),
    startDate: admin.firestore.Timestamp.fromDate(now),
    endDate: admin.firestore.Timestamp.fromDate(endDate),
    sessionsTotal: totalSessions, sessionsUsed: 0, sessionsRemaining: totalSessions,
    paymentId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    await db.collection('users').doc(userId).update({
      activePlanId: planId, activePlanName: plan.name,
      activePurchaseId: purchaseRef.id, status: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { /* user doc may not exist */ }
}

async function activateDropin(userId: string, paymentId: string) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  await db.collection('credits').add({
    userId, userName: '',
    type: 'dropin_credit', amount: 1, reason: 'Aula avulsa — Vale Oferta',
    sessionId: '', paymentId,
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
