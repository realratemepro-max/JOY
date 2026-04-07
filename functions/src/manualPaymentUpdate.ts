import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Manually update a payment status (admin only)
 * Use this when webhook fails or for testing
 */
export const manualPaymentUpdate = functions.https.onCall(async (data, context) => {
  // Verify admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();

  try {
    // Check if user is admin
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    const { paymentId, newStatus } = data;

    if (!paymentId || !newStatus) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing paymentId or newStatus');
    }

    // Get payment
    const paymentDoc = await db.collection('payments').doc(paymentId).get();
    if (!paymentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payment not found');
    }

    const payment = paymentDoc.data();
    const oldStatus = payment?.status;

    // Update payment status
    await paymentDoc.ref.update({
      status: newStatus,
      paidAt: newStatus === 'Paid' ? admin.firestore.FieldValue.serverTimestamp() : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      manuallyUpdated: true,
      manuallyUpdatedBy: context.auth.uid,
    });

    console.log(`Payment ${paymentId} manually updated from ${oldStatus} to ${newStatus}`);

    // If marking as Paid, create subscription
    if (newStatus === 'Paid' && oldStatus !== 'Paid') {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // 1 year

      const subscriptionId = payment?.userId || paymentId;

      // Create subscription
      await db.collection('subscriptions').doc(subscriptionId).set({
        userId: payment?.userId,
        plan: payment?.plan || 'pro',
        status: 'active',
        startDate: admin.firestore.Timestamp.fromDate(startDate),
        endDate: admin.firestore.Timestamp.fromDate(endDate),
        paymentId: paymentId,
        autoRenew: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update user to PRO
      if (payment?.plan === 'pro' || payment?.plan === 'pro-monthly' || payment?.plan === 'pro-annual') {
        const expiryDate = new Date(startDate);
        if (payment?.plan === 'pro-monthly') {
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        } else {
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        }

        await db.collection('users').doc(payment.userId).update({
          plan: 'pro',
          subscriptionId: subscriptionId,
          subscriptionExpiry: admin.firestore.Timestamp.fromDate(expiryDate),
          subscriptionStatus: 'active',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Send payment confirmation email
        try {
          const userDoc = await db.collection('users').doc(payment.userId).get();
          const userData = userDoc.data();

          if (userData && userData.email) {
            await db.collection('emails').add({
              to: userData.email,
              subject: 'Pagamento Confirmado - RealRateMe PRO',
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #78350f; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
                    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>✓ Pagamento Confirmado!</h1>
                    </div>
                    <div class="content">
                      <p>Olá <strong>${userData.name || 'Cliente'}</strong>,</p>
                      <p>O teu pagamento foi processado com sucesso! A tua subscrição <strong>RealRateMe PRO</strong> está agora ativa.</p>
                      <p>Válido até: <strong>${expiryDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>
                      <p style="text-align: center; margin-top: 30px;">
                        <a href="https://realrateme-731f1.web.app/dashboard" class="button">Ir para o Dashboard</a>
                      </p>
                    </div>
                    <div class="footer">
                      <p>RealRateMe - A tua reputação profissional em destaque</p>
                    </div>
                  </div>
                </body>
                </html>
              `,
              status: 'pending',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        } catch (emailError) {
          console.error('Error queuing email:', emailError);
        }

        console.log('User upgraded to PRO:', payment.userId);
      }
    }

    return {
      success: true,
      message: `Payment ${paymentId} updated from ${oldStatus} to ${newStatus}`,
      subscriptionCreated: newStatus === 'Paid' && oldStatus !== 'Paid',
    };
  } catch (error: any) {
    console.error('Error in manual payment update:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', error.message || 'Failed to update payment');
  }
});
