/**
 * CLOUD FUNCTION: EuPago Webhook Handler
 * Supports Webhooks 1.0 (GET) and 2.0 (POST with optional encryption)
 * JOY model: no auto-subscriptions, packs with expiry, manual purchase
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

// Load config from Firestore (cached per function instance)
let cachedConfig: any = null;
async function getPaymentConfig() {
  if (cachedConfig) return cachedConfig;
  const doc = await db.collection('siteConfig').doc('main').get();
  cachedConfig = doc.exists ? doc.data() : {};
  return cachedConfig;
}

function decryptWebhookData(encryptedData: string, key: string, iv: string): any {
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'base64'));
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

function verifySignature(data: string, signature: string, key: string): boolean {
  try {
    const generated = crypto.createHmac('sha256', key).update(data).digest('base64');
    return crypto.timingSafeEqual(Buffer.from(signature, 'base64'), Buffer.from(generated, 'base64'));
  } catch { return false; }
}

export const eupagoWebhook = functions.https.onRequest(async (req, res) => {
  console.log('🔔 Webhook:', { method: req.method, query: req.query, body: req.body });

  try {
    const config = await getPaymentConfig();
    const encryptionKey = config.paymentWebhookEncryptionKey || process.env.EUPAGO_WEBHOOK_ENCRYPTION_KEY;

    let transactionData: any;

    // Webhooks 1.0 (GET)
    if (req.method === 'GET') {
      const { valor, canal, referencia, transacao, identificador } = req.query;
      transactionData = {
        reference: referencia, identifier: identificador,
        amount: { value: valor }, channel: canal, trid: transacao, status: 'Paid',
      };
    }
    // Webhooks 2.0 (POST)
    else if (req.method === 'POST') {
      if (req.body.data && encryptionKey) {
        const iv = req.headers['x-initialization-vector'] as string;
        const signature = req.headers['x-signature'] as string;
        if (!iv) { res.status(400).send('Missing IV'); return; }
        if (signature && !verifySignature(req.body.data, signature, encryptionKey)) {
          res.status(401).send('Invalid Signature'); return;
        }
        const webhookData = decryptWebhookData(req.body.data, encryptionKey, iv);
        const tx = webhookData.transaction || webhookData.transactions;
        if (tx) transactionData = { ...tx };
      } else if (req.body.transactions) {
        transactionData = { ...req.body.transactions };
      } else {
        transactionData = req.body;
      }
    } else {
      res.status(405).send('Method Not Allowed'); return;
    }

    if (!transactionData) { res.status(400).send('Invalid Payload'); return; }

    // Find payment in Firestore
    let paymentDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let paymentId: string | null = null;

    if (transactionData.identifier) {
      const snap = await db.collection('payments').where('identifier', '==', transactionData.identifier).limit(1).get();
      if (!snap.empty) { paymentDoc = snap.docs[0]; paymentId = paymentDoc.id; }
    }
    if (!paymentDoc && transactionData.reference) {
      const snap = await db.collection('payments').where('reference', '==', String(transactionData.reference)).limit(1).get();
      if (!snap.empty) { paymentDoc = snap.docs[0]; paymentId = paymentDoc.id; }
    }

    if (!paymentDoc || !paymentId) {
      console.log('⚠️ Payment not found');
      res.status(200).send('Payment not found but acknowledged'); return;
    }

    const paymentData = paymentDoc.data();
    const userId = paymentData.userId;

    // Update payment status
    await db.collection('payments').doc(paymentId).update({
      status: transactionData.status,
      eupagoTransactionId: transactionData.trid || null,
      paidAt: transactionData.status === 'Paid' ? admin.firestore.FieldValue.serverTimestamp() : null,
      webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Payment updated:', paymentId, transactionData.status);

    if (transactionData.status === 'Paid') {
      await handlePaidPayment(userId, paymentData, paymentId, config);
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    res.status(200).send('Error processed');
  }
});

/**
 * Handle paid payment — activate pack / credit based on plan type
 * NO auto-subscriptions. Client buys manually each time.
 */
async function handlePaidPayment(userId: string, paymentData: any, paymentId: string, config: any) {
  try {
    const { planId, type } = paymentData;
    const creditValidityDays = config.creditValidityDays || 30;

    // EVENT BOOKING
    if (type === 'event_booking') {
      console.log('🎫 Event booking paid:', paymentId);
      // TODO: Add user to event enrolledStudents
      return;
    }

    // DROP-IN / SINGLE CLASS — give 1 session credit
    if (type === 'single_class' || type === 'dropin') {
      console.log('🎟️ Drop-in paid:', paymentId);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + creditValidityDays);
      await db.collection('credits').add({
        userId,
        userName: paymentData.userEmail || '',
        type: 'dropin_credit',
        amount: 1,
        reason: 'Aula avulsa comprada',
        sessionId: '',
        paymentId,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // PLAN PURCHASE — activate pack with sessions and expiry
    if (!planId) { console.error('❌ No planId'); return; }

    const planDoc = await db.collection('plans').doc(planId).get();
    if (!planDoc.exists) { console.error('❌ Plan not found:', planId); return; }

    const plan = planDoc.data()!;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month validity

    const sessionsPerWeek = plan.sessionsPerWeek || 1;
    const totalSessions = Math.ceil(sessionsPerWeek * 4.33); // ~sessions in a month

    // Create a purchase record (not a recurring subscription)
    const purchaseData: any = {
      userId,
      userName: paymentData.userEmail || '',
      userEmail: paymentData.userEmail || '',
      planId,
      planName: plan.name || '',
      locationId: plan.locationId || '',
      locationName: plan.locationName || '',
      sessionsPerWeek,
      priceMonthly: plan.priceMonthly || paymentData.amount,
      status: 'active',
      purchaseDate: admin.firestore.Timestamp.fromDate(now),
      startDate: admin.firestore.Timestamp.fromDate(now),
      endDate: admin.firestore.Timestamp.fromDate(periodEnd),
      sessionsTotal: totalSessions,
      sessionsUsed: 0,
      sessionsRemaining: totalSessions,
      paymentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const purchaseRef = await db.collection('purchases').add(purchaseData);
    console.log('✅ Purchase activated:', purchaseRef.id, `(${totalSessions} sessions until ${periodEnd.toISOString().slice(0, 10)})`);

    // Update user
    try {
      await db.collection('users').doc(userId).update({
        role: 'client',
        activePlanId: planId,
        activePlanName: plan.name,
        activePurchaseId: purchaseRef.id,
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.log('⚠️ Could not update user doc');
    }
  } catch (error) {
    console.error('❌ handlePaidPayment error:', error);
  }
}
