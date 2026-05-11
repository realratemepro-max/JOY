import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

function genPromoCode(prefix: string) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix + '-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export const processReferral = functions.region('europe-west1').https.onCall(async (data) => {
  const { referredUserId } = data;
  if (!referredUserId) throw new functions.https.HttpsError('invalid-argument', 'referredUserId required');

  // Load referral program config
  const cfgDoc = await db.collection('siteConfig').doc('referrals').get();
  if (!cfgDoc.exists) return { skipped: true, reason: 'no_config' };
  const cfg = cfgDoc.data()!;
  if (!cfg.enabled) return { skipped: true, reason: 'disabled' };

  // Find pending referral for this user
  const refSnap = await db.collection('referrals').where('referredId', '==', referredUserId).where('status', '==', 'pending').limit(1).get();
  if (refSnap.empty) return { skipped: true, reason: 'no_pending_referral' };

  const refDoc = refSnap.docs[0];
  const referral = refDoc.data();

  // If trigger is 'signup', it was already processed at signup time
  if (cfg.trigger === 'signup') return { skipped: true, reason: 'trigger_is_signup' };

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 6);

  let referrerRewardPromoId: string | undefined;

  // Give referrer reward
  if (cfg.referrerRewardType === 'discount_code') {
    const code = genPromoCode('REF');
    const promoRef = await db.collection('promoCodes').add({
      code,
      discountType: cfg.referrerDiscountType || 'fixed',
      discountValue: cfg.referrerRewardValue || 10,
      isActive: true,
      maxUses: 1,
      currentUses: 0,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      applicablePlans: [],
      createdBy: 'system_referral',
      referralId: refDoc.id,
      forUserId: referral.referrerId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    referrerRewardPromoId = promoRef.id;
    console.log(`🎁 Referrer promo created: ${code} for user ${referral.referrerId}`);
  } else if (cfg.referrerRewardType === 'credit') {
    const creditExpiry = new Date(now);
    creditExpiry.setMonth(creditExpiry.getMonth() + 6);
    await db.collection('credits').add({
      userId: referral.referrerId,
      userName: referral.referrerName || '',
      type: 'dropin_credit',
      amount: cfg.referrerRewardValue || 1,
      reason: `Referência de ${referral.referredName || 'novo utilizador'}`,
      sessionId: '',
      referralId: refDoc.id,
      expiresAt: admin.firestore.Timestamp.fromDate(creditExpiry),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`🎁 Referrer credit added for user ${referral.referrerId}`);
  }

  // Mark referral as rewarded
  await refDoc.ref.update({
    status: 'rewarded',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(referrerRewardPromoId ? { referrerRewardPromoId } : {}),
  });

  return { success: true, referralId: refDoc.id, referrerRewardPromoId };
});
