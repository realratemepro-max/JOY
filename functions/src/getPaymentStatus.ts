import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const getPaymentStatus = functions.https.onCall(async (data, context) => {
  // Verificar autenticação
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { paymentId } = data;

  // Validação
  if (!paymentId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing paymentId'
    );
  }

  const db = admin.firestore();

  try {
    // Buscar documento de pagamento no Firestore
    const paymentDoc = await db.collection('payments').doc(paymentId).get();

    if (!paymentDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Payment not found'
      );
    }

    const paymentData = paymentDoc.data();

    // Verificar se o usuário tem permissão para ver este pagamento
    // (Deve ser o dono do pagamento ou um admin)
    const userId = context.auth.uid;
    const isOwner = paymentData?.userId === userId;

    // Verificar se é admin
    const userDoc = await db.collection('users').doc(userId).get();
    const isAdmin = userDoc.data()?.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not have permission to view this payment'
      );
    }

    // Retornar status do pagamento
    return {
      success: true,
      status: paymentData?.status || 'Unknown',
      payment: {
        id: paymentId,
        amount: paymentData?.amount,
        method: paymentData?.method,
        plan: paymentData?.plan,
        createdAt: paymentData?.createdAt,
        paidAt: paymentData?.paidAt,
        identifier: paymentData?.identifier,
        reference: paymentData?.reference,
        entity: paymentData?.entity,
      }
    };
  } catch (error: any) {
    console.error('Error getting payment status:', error);

    // Se já é um HttpsError, re-throw
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Failed to get payment status'
    );
  }
});
