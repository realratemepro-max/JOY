/**
 * CLOUD FUNCTION: Create Multibanco Payment
 * Reads API config from Firestore siteConfig (not hardcoded)
 * Uses BODY auth (chave), not header auth!
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const db = admin.firestore();

let cachedConfig: any = null;
async function getConfig() {
  if (cachedConfig) return cachedConfig;
  const doc = await db.collection('siteConfig').doc('main').get();
  cachedConfig = doc.exists ? doc.data() : {};
  return cachedConfig;
}

export const createMultibancoPayment = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).send(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const config = await getConfig();
    const API_KEY = config.paymentApiKey || process.env.EUPAGO_CLIENT_ID || functions.config().eupago?.api_key;
    const BASE_URL = config.paymentApiBaseUrl || 'https://clientes.eupago.pt';

    const { userId, amount, customerEmail, planId, planName, type } = req.body;

    if (!userId || !amount || !customerEmail || !planId) {
      res.status(400).json({ error: 'Campos obrigatórios: userId, amount, customerEmail, planId' }); return;
    }
    if (parseFloat(amount) < 1.0) {
      res.status(400).json({ error: 'Valor mínimo: €1.00' }); return;
    }

    const identifier = `joy_mb_${userId.substring(0, 8)}_${Date.now()}`;

    const ref = await db.collection('payments').add({
      userId, userEmail: customerEmail,
      planId, planName: planName || '',
      type: type || 'plan_subscription',
      amount: parseFloat(amount), method: 'Multibanco', status: 'Pending', identifier,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const paymentId = ref.id;

    const eupagoResponse = await axios.post(
      `${BASE_URL}/clientes/rest_api/multibanco/create`,
      { chave: API_KEY, valor: parseFloat(amount), id: identifier, per_dup: 0, email: customerEmail },
      { headers: { 'Content-Type': 'application/json', accept: 'application/json' } }
    );

    await db.collection('payments').doc(paymentId).update({
      entity: eupagoResponse.data.entidade,
      reference: eupagoResponse.data.referencia,
      eupagoResponse: eupagoResponse.data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true, paymentId,
      entity: eupagoResponse.data.entidade,
      reference: eupagoResponse.data.referencia,
      amount,
    });
  } catch (error: any) {
    console.error('❌ Multibanco failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Falha Multibanco', details: error.response?.data || error.message });
  }
});
