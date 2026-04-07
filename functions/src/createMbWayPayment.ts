import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const EUPAGO_API_KEY = functions.config().eupago?.api_key;
const EUPAGO_BASE_URL = functions.config().eupago?.api_base_url || 'https://clientes.eupago.pt';

export const createMbWayPayment = functions.https.onCall(async (data, context) => {
  // Verificar autenticação
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { planId, amount, phone, email, userId } = data;

  // Validação
  if (!planId || !amount || !phone || !email) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required fields'
    );
  }

  const db = admin.firestore();

  try {
    // Criar identificador único para o pagamento
    const identifier = `RRM-${Date.now()}-${userId.substring(0, 8)}`;

    // Criar documento de pagamento no Firestore
    const paymentRef = await db.collection('payments').add({
      userId,
      userEmail: email,
      plan: planId,
      amount: parseFloat(amount),
      method: 'MBWay',
      status: 'Pending',
      identifier,
      userPhone: phone,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const paymentId = paymentRef.id;

    // Chamar API EuPago para criar pagamento MB WAY
    const eupagoResponse = await axios.post(
      `${EUPAGO_BASE_URL}/api/v1.02/mbway/create`,
      {
        payment: {
          identifier: identifier,
          amount: {
            value: parseFloat(amount).toFixed(2),
            currency: 'EUR',
          },
          customerPhone: phone,
          countryCode: '351',
          lang: 'PT',
          successUrl: `https://www.realrateme.me/payment-success?method=mbway&paymentId=${paymentId}`,
          failUrl: `https://www.realrateme.me/payment-failed?method=mbway`,
          backUrl: `https://www.realrateme.me/pricing`,
          notificationUrl: `https://us-central1-realrateme-731f1.cloudfunctions.net/eupagoWebhook`,
        },
        customer: {
          notify: false,
          email: email,
        },
      },
      {
        headers: {
          Authorization: `ApiKey ${EUPAGO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Atualizar documento com resposta EuPago
    await paymentRef.update({
      eupagoResponse: eupagoResponse.data,
      eupagoTransactionId: eupagoResponse.data.transactionID || null,
      eupagoReference: eupagoResponse.data.reference || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('MB WAY payment created:', paymentId);

    return {
      success: true,
      paymentId,
      transactionId: eupagoResponse.data.transactionID,
    };
  } catch (error: any) {
    console.error('Error creating MB WAY payment:', error);

    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Failed to create MB WAY payment'
    );
  }
});
