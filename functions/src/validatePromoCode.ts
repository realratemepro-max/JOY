import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const validatePromoCode = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { code, planId, amount } = data;

  if (!code || !planId || !amount) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  const db = admin.firestore();

  try {
    const codeUpper = code.toUpperCase().trim();

    // Find promo code
    const promoSnapshot = await db
      .collection('promoCodes')
      .where('code', '==', codeUpper)
      .limit(1)
      .get();

    if (promoSnapshot.empty) {
      return {
        valid: false,
        error: 'Código promocional não encontrado',
      };
    }

    const promoDoc = promoSnapshot.docs[0];
    const promo = promoDoc.data();

    // Check if active
    if (!promo.isActive) {
      return {
        valid: false,
        error: 'Código promocional inativo',
      };
    }

    // Check expiration
    if (promo.expiresAt && promo.expiresAt.toDate() < new Date()) {
      return {
        valid: false,
        error: 'Código promocional expirado',
      };
    }

    // Check max uses
    if (promo.maxUses > 0 && promo.currentUses >= promo.maxUses) {
      return {
        valid: false,
        error: 'Limite de usos atingido',
      };
    }

    // Check minimum purchase amount
    if (promo.minPurchaseAmount && amount < promo.minPurchaseAmount) {
      return {
        valid: false,
        error: `Valor mínimo de compra: €${promo.minPurchaseAmount.toFixed(2)}`,
      };
    }

    // Check applicable plans
    if (promo.applicablePlans && promo.applicablePlans.length > 0) {
      if (!promo.applicablePlans.includes(planId)) {
        return {
          valid: false,
          error: 'Este código não é válido para este plano',
        };
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.discountType === 'percentage') {
      discountAmount = (amount * promo.discountValue) / 100;
    } else {
      discountAmount = promo.discountValue;
    }

    // Discount cannot be more than the total amount
    if (discountAmount > amount) {
      discountAmount = amount;
    }

    const finalAmount = amount - discountAmount;

    return {
      valid: true,
      promoCodeId: promoDoc.id,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      finalAmount: parseFloat(finalAmount.toFixed(2)),
    };
  } catch (error: any) {
    console.error('Error validating promo code:', error);
    throw new functions.https.HttpsError('internal', 'Erro ao validar código promocional');
  }
});

export const applyPromoCode = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { promoCodeId, paymentId, discountAmount, originalAmount, finalAmount } = data;

  if (!promoCodeId || !paymentId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  const db = admin.firestore();

  try {
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email || 'unknown';

    // Increment promo code usage
    const promoRef = db.collection('promoCodes').doc(promoCodeId);
    await promoRef.update({
      currentUses: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create redemption record
    await db.collection('promoCodeRedemptions').add({
      promoCodeId,
      userId,
      userEmail,
      paymentId,
      discountAmount,
      originalAmount,
      finalAmount,
      redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Promo code applied:', promoCodeId, 'for payment:', paymentId);

    return { success: true };
  } catch (error: any) {
    console.error('Error applying promo code:', error);
    throw new functions.https.HttpsError('internal', 'Erro ao aplicar código promocional');
  }
});
