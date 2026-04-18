/**
 * CLOUD FUNCTION: Create MB WAY Payment
 * Reads API config from Firestore siteConfig (not hardcoded)
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const db = admin.firestore();
const SITE_URL = 'https://joaquimyoga.pt';
const WEBHOOK_URL = 'https://us-central1-realrateme-731f1.cloudfunctions.net/eupagoWebhook';

// Cache config per function instance
let cachedConfig: any = null;
async function getConfig() {
  if (cachedConfig) return cachedConfig;
  const doc = await db.collection('siteConfig').doc('main').get();
  cachedConfig = doc.exists ? doc.data() : {};
  return cachedConfig;
}

export const createMbWayPayment = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).send(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const config = await getConfig();
    const API_KEY = config.paymentApiKey || process.env.EUPAGO_CLIENT_ID || functions.config().eupago?.api_key;
    const BASE_URL = config.paymentApiBaseUrl || 'https://clientes.eupago.pt';

    const { userId, amount, phone, email, planId, planName, type } = req.body;

    if (!userId || !amount || !phone || !email || !planId) {
      res.status(400).json({ error: 'Campos obrigatórios: userId, amount, phone, email, planId' }); return;
    }
    if (parseFloat(amount) < 1.0) {
      res.status(400).json({ error: 'Valor mínimo: €1.00' }); return;
    }

    const identifier = `joy_mbway_${userId.substring(0, 8)}_${Date.now()}`;

    const ref = await db.collection('payments').add({
      userId, userEmail: email, userPhone: phone,
      planId, planName: planName || '',
      type: type || 'plan_subscription',
      amount: parseFloat(amount), method: 'MBWay', status: 'Pending', identifier,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const paymentId = ref.id;

    const eupagoResponse = await axios.post(
      `${BASE_URL}/api/v1.02/mbway/create`,
      {
        payment: {
          identifier, amount: { value: parseFloat(amount).toFixed(2), currency: 'EUR' },
          customerPhone: phone, countryCode: '351', lang: 'PT',
          successUrl: `${SITE_URL}/payment-success?method=mbway&paymentId=${paymentId}`,
          failUrl: `${SITE_URL}/payment-failed?method=mbway`,
          backUrl: SITE_URL, notificationUrl: WEBHOOK_URL,
        },
        customer: { notify: false, email },
      },
      { headers: { Authorization: `ApiKey ${API_KEY}`, 'Content-Type': 'application/json' } }
    );

    await db.collection('payments').doc(paymentId).update({
      eupagoTransactionId: eupagoResponse.data.transactionID,
      eupagoReference: eupagoResponse.data.reference,
      eupagoResponse: eupagoResponse.data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true, paymentId,
      transactionId: eupagoResponse.data.transactionID,
      reference: eupagoResponse.data.reference,
    });
  } catch (error: any) {
    console.error('❌ MB WAY failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Falha MB WAY', details: error.response?.data || error.message });
  }
});
