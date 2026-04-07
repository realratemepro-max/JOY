import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const EUPAGO_API_KEY = functions.config().eupago?.api_key;
const EUPAGO_BASE_URL = functions.config().eupago?.api_base_url || 'https://clientes.eupago.pt';

export const createMultibancoPayment = functions.https.onCall(async (data, context) => {
  // Verificar autenticação
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { planId, amount, email, userId } = data;

  // Validação
  if (!planId || !amount || !email) {
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
      method: 'Multibanco',
      status: 'Pending',
      identifier,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const paymentId = paymentRef.id;

    // Chamar API EuPago para criar referência Multibanco
    // IMPORTANTE: Multibanco usa autenticação no body (chave), NÃO no header!
    const eupagoResponse = await axios.post(
      `${EUPAGO_BASE_URL}/clientes/rest_api/multibanco/create`,
      {
        chave: EUPAGO_API_KEY, // API Key no body!
        valor: parseFloat(amount),
        id: identifier,
        per_dup: 0, // 0 = não permitir duplicados
        email: email,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
      }
    );

    const responseData = eupagoResponse.data;

    // Calcular data de expiração (7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Atualizar documento com referência Multibanco
    await paymentRef.update({
      entity: responseData.entidade,
      reference: responseData.referencia,
      eupagoResponse: responseData,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Multibanco payment created:', paymentId);

    return {
      success: true,
      paymentId,
      entity: responseData.entidade,
      reference: responseData.referencia,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error: any) {
    console.error('Error creating Multibanco payment:', error);

    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Failed to create Multibanco payment'
    );
  }
});
