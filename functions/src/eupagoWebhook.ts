/**
 * CLOUD FUNCTION: EuPago Webhook Handler
 * Based on bot4us-crm working implementation
 * Supports: GET (health check), POST with v1 legacy, v2 transaction, v2 payment formats
 * JOY model: packs with expiry, no auto-subscriptions
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

// Read config from Firestore
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

export const eupagoWebhook = functions
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // GET = health check (EuPago verification)
  if (req.method === 'GET') {
    console.log('🔔 Webhook GET health check');
    res.status(200).send('OK');
    return;
  }

  if (req.method === 'OPTIONS') { res.status(200).send('OK'); return; }
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  console.log('🔔 Webhook POST received:', JSON.stringify(req.body).substring(0, 500));

  try {
    const config = await getPaymentConfig();
    const encryptionKey = config.paymentWebhookEncryptionKey;

    // ============ NORMALIZE PAYLOAD (3 formats) ============
    let identificador = '';
    let estado = '';
    let valor: string | number = '';
    let referencia = '';
    let entidade = '';

    let body = req.body;

    // Check for encrypted Webhooks 2.0
    if (body.data && encryptionKey) {
      const iv = req.headers['x-initialization-vector'] as string;
      const signature = req.headers['x-signature'] as string;
      if (iv) {
        try {
          if (signature) {
            const generated = crypto.createHmac('sha256', encryptionKey).update(body.data).digest('base64');
            if (!crypto.timingSafeEqual(Buffer.from(signature, 'base64'), Buffer.from(generated, 'base64'))) {
              console.log('❌ Invalid signature');
              res.status(401).send('Invalid Signature');
              return;
            }
          }
          body = decryptWebhookData(body.data, encryptionKey, iv);
          console.log('🔐 Decrypted:', JSON.stringify(body).substring(0, 300));
        } catch (e) {
          console.error('❌ Decryption failed:', e);
        }
      }
    }

    // Format 1: Webhooks 2.0 with "transaction" object
    if (body.transaction) {
      const tx = body.transaction;
      identificador = tx.identifier || '';
      estado = tx.status || '';
      valor = tx.amount?.value || tx.amount || '';
      referencia = tx.reference || '';
      entidade = tx.entity || '';
    }
    // Format 2: Webhooks 2.0 with "transactions" object
    else if (body.transactions) {
      const tx = body.transactions;
      identificador = tx.identifier || '';
      estado = tx.status || '';
      valor = tx.amount?.value || tx.amount || '';
      referencia = tx.reference || '';
      entidade = tx.entity || '';
    }
    // Format 3: Webhooks 2.0 with "payment" object
    else if (body.payment) {
      const p = body.payment;
      identificador = p.identifier || '';
      estado = p.status || '';
      valor = p.amount?.value || p.amount || '';
      referencia = p.reference || '';
      entidade = p.entity || '';
    }
    // Format 4: Legacy v1 (Portuguese field names)
    else if (body.identificador || body.estado) {
      identificador = body.identificador || '';
      estado = body.estado || '';
      valor = body.valor || '';
      referencia = body.referencia || '';
      entidade = body.entidade || '';
    }
    // Format 5: Query params (GET-style in POST body)
    else {
      identificador = String(body.identifier || body.identificador || '');
      estado = String(body.status || body.estado || '');
      valor = String(body.amount || body.valor || '');
      referencia = String(body.reference || body.referencia || '');
      entidade = String(body.entity || body.entidade || '');
    }

    console.log('📨 Parsed:', { identificador, estado, valor, referencia, entidade });

    if (!identificador && !referencia) {
      console.log('⚠️ No identifier or reference found');
      res.status(200).send('No identifier');
      return;
    }

    // ============ CHECK IF PAID ============
    const estadoLower = String(estado).toLowerCase();
    const isPaid = estadoLower === 'aprovado' || estadoLower === 'paid' ||
                   estadoLower === 'succeeded' || estadoLower === 'success';
    const isFailed = estadoLower === 'error' || estadoLower === 'cancel' ||
                     estadoLower === 'cancelled' || estadoLower === 'expired' ||
                     estadoLower === 'failed';

    // ============ FIND PAYMENT IN FIRESTORE ============
    let paymentDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let paymentId: string | null = null;

    // By identifier
    if (identificador) {
      const snap = await db.collection('payments').where('identifier', '==', identificador).limit(1).get();
      if (!snap.empty) { paymentDoc = snap.docs[0]; paymentId = paymentDoc.id; }
    }
    // By reference (Multibanco)
    if (!paymentDoc && referencia) {
      const snap = await db.collection('payments').where('reference', '==', String(referencia)).limit(1).get();
      if (!snap.empty) { paymentDoc = snap.docs[0]; paymentId = paymentDoc.id; }
    }
    // By eupagoReference
    if (!paymentDoc && referencia) {
      const snap = await db.collection('payments').where('eupagoReference', '==', String(referencia)).limit(1).get();
      if (!snap.empty) { paymentDoc = snap.docs[0]; paymentId = paymentDoc.id; }
    }

    if (!paymentDoc || !paymentId) {
      console.log('⚠️ Payment not found for:', { identificador, referencia });
      res.status(200).send('Payment not found but acknowledged');
      return;
    }

    const paymentData = paymentDoc.data();
    const userId = paymentData.userId;

    console.log('✅ Payment found:', paymentId, 'User:', userId, 'Status:', estado);

    // ============ UPDATE PAYMENT STATUS ============
    const updateData: any = {
      status: isPaid ? 'Paid' : isFailed ? 'Failed' : estado,
      webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      webhookRaw: { identificador, estado, valor, referencia, entidade },
    };
    if (isPaid) updateData.paidAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('payments').doc(paymentId).update(updateData);
    console.log('✅ Payment updated:', paymentId, isPaid ? 'PAID' : estado);

    // ============ ACTIVATE PLAN IF PAID ============
    if (isPaid) {
      await handlePaidPayment(userId, paymentData, paymentId);
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('❌ Webhook error:', error.message || error);
    // Always return 200 to prevent retries
    res.status(200).send('Error processed');
  }
});

/**
 * Handle paid payment — activate pack / credit
 */
async function handlePaidPayment(userId: string, paymentData: any, paymentId: string) {
  try {
    const { planId, type, giftCardId, giftCardDiscount } = paymentData;
    const config = await getPaymentConfig();

    // Deduct partial gift card balance if used alongside EuPago payment
    if (giftCardId && giftCardDiscount) {
      const gcRef = db.collection('giftCards').doc(giftCardId);
      const gcDoc = await gcRef.get();
      if (gcDoc.exists) {
        const gc = gcDoc.data()!;
        const newBalance = Math.max(0, (gc.remainingBalance || 0) - giftCardDiscount);
        await gcRef.update({
          remainingBalance: newBalance,
          status: newBalance <= 0 ? 'used' : 'active',
          ...(newBalance <= 0 ? { usedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
          usedByUserId: userId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // GIFT CARD PURCHASE — create the gift card and send email to recipient
    if (type === 'gift_card') {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = 'VALE-';
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      await db.collection('giftCards').add({
        code,
        initialBalance: paymentData.amount,
        remainingBalance: paymentData.amount,
        purchaserEmail: paymentData.userEmail || '',
        purchaserName: paymentData.purchaserName || '',
        recipientName: paymentData.recipientName || '',
        recipientEmail: paymentData.recipientEmail || '',
        message: paymentData.giftMessage || '',
        status: 'active',
        paymentId,
        createdBy: 'online',
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('🎁 Gift card created with code:', code);
      return;
    }

    // EVENT BOOKING
    if (type === 'event_booking') {
      console.log('🎫 Event booking paid:', paymentId);
      // Even for events, mark token as paid if linked
      if (paymentData.paymentTokenId) {
        try {
          await db.collection('paymentTokens').doc(paymentData.paymentTokenId).update({
            status: 'paid',
            paidVia: paymentData.method === 'MBWay' ? 'mbway' : 'multibanco',
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (e) { console.error('Failed to mark token paid (event):', e); }
      }
      return;
    }

    // Helper to mark linked token as paid
    const markTokenPaid = async () => {
      if (!paymentData.paymentTokenId) return;
      try {
        await db.collection('paymentTokens').doc(paymentData.paymentTokenId).update({
          status: 'paid',
          paidVia: paymentData.method === 'MBWay' ? 'mbway' : 'multibanco',
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('🔓 Token marked paid:', paymentData.paymentTokenId);
      } catch (e) { console.error('Failed to mark token paid:', e); }
    };

    // DROP-IN — create a 1-session purchase doc (uniform with plans), enroll if sessionId provided
    if (type === 'single_class' || type === 'dropin') {
      console.log('🎟️ Drop-in paid:', paymentId);
      const targetSessionId = paymentData.sessionId;

      // Lookup plan info for locationId/locationName + price
      let dropinPlan: any = null;
      if (planId) {
        const planSnap = await db.collection('plans').doc(planId).get();
        if (planSnap.exists) dropinPlan = planSnap.data();
      }

      // Lookup user name
      let userName = paymentData.userEmail || '';
      try {
        const userSnap = await db.collection('users').doc(userId).get();
        if (userSnap.exists) userName = userSnap.data()?.name || userName;
      } catch (e) { /* ignore */ }

      const nowDate = new Date();
      // Validity priority: plan.validityDays → config.dropinValidityDays → 15
      const dropinDays = (dropinPlan && dropinPlan.validityDays)
        || config.dropinValidityDays
        || 15;
      const dropinExpiry = new Date(nowDate);
      dropinExpiry.setDate(dropinExpiry.getDate() + dropinDays);

      // Create the purchase doc — sessionsUsed=1 if we will enroll, 0 otherwise
      const willEnroll = !!targetSessionId;
      const purchaseRef = await db.collection('purchases').add({
        userId, userName, userEmail: paymentData.userEmail || '',
        planId: planId || '',
        planName: (dropinPlan && dropinPlan.name) || paymentData.planName || 'Aula Avulsa',
        locationId: (dropinPlan && dropinPlan.locationId) || '',
        locationName: (dropinPlan && dropinPlan.locationName) || '',
        priceMonthly: paymentData.amount,
        billingType: 'dropin',
        status: 'active',
        purchaseDate: admin.firestore.Timestamp.fromDate(nowDate),
        startDate: admin.firestore.Timestamp.fromDate(nowDate),
        endDate: admin.firestore.Timestamp.fromDate(dropinExpiry),
        sessionsTotal: 1,
        sessionsUsed: willEnroll ? 1 : 0,
        sessionsRemaining: willEnroll ? 0 : 1,
        paymentId,
        nif: paymentData.nif || '',
        consumidorFinal: !!paymentData.consumidorFinal,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Drop-in purchase created:', purchaseRef.id);

      // If a session was specified, enroll the user with this purchaseId
      if (targetSessionId) {
        try {
          const sessionRef = db.collection('sessions').doc(targetSessionId);
          await db.runTransaction(async tx => {
            const snap = await tx.get(sessionRef);
            if (!snap.exists) {
              console.error('❌ Drop-in target session not found:', targetSessionId);
              return;
            }
            const enrolled = (snap.data()?.enrolledStudents || []) as any[];
            const idx = enrolled.findIndex(e => e.userId === userId);
            const paymentMethod = paymentData.method === 'MBWay' ? 'mbway' : 'multibanco';
            if (idx === -1) {
              // Self-checkout flow: add new enrollment
              enrolled.push({
                userId, userName, status: 'enrolled',
                attendanceMode: paymentData.attendanceMode || 'presencial',
                paymentId,
                purchaseId: purchaseRef.id,
                paymentStatus: 'paid',
                paymentMethod,
              });
            } else {
              // Admin-triggered flow: student was already added, just mark as paid
              enrolled[idx] = {
                ...enrolled[idx],
                paymentId,
                purchaseId: purchaseRef.id,
                paymentStatus: 'paid',
                paymentMethod,
              };
            }
            tx.update(sessionRef, { enrolledStudents: enrolled, updatedAt: new Date() });
          });
          console.log('✅ Drop-in linked to session:', targetSessionId);
        } catch (e) {
          console.error('❌ Failed to enroll user in session after drop-in payment:', e);
        }
      }
      await markTokenPaid();
      return;
    }

    // PLAN PURCHASE — activate pack
    if (!planId) { console.error('❌ No planId'); return; }

    const planDoc = await db.collection('plans').doc(planId).get();
    if (!planDoc.exists) { console.error('❌ Plan not found:', planId); return; }

    const plan = planDoc.data()!;
    const now = new Date();
    const periodEnd = new Date(now);
    const validityDays = plan.validityDays || 30;
    periodEnd.setDate(periodEnd.getDate() + validityDays);

    // CONTENT PLAN — library subscription
    if (plan.isContentPlan) {
      const subRef = await db.collection('contentSubscriptions').add({
        userId, userEmail: paymentData.userEmail || '', userName: paymentData.userName || paymentData.userEmail || '',
        planId, planName: plan.name || '',
        price: plan.priceMonthly || paymentData.amount,
        status: 'active',
        startDate: admin.firestore.Timestamp.fromDate(now),
        endDate: admin.firestore.Timestamp.fromDate(periodEnd),
        paymentId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Content subscription activated:', subRef.id, `until ${periodEnd.toISOString().slice(0, 10)}`);
      return;
    }

    const totalSessions = plan.sessionsTotal || Math.ceil((plan.sessionsPerWeek || 1) * 4.33);
    const startMode: string = paymentData.startMode === 'first_class' ? 'first_class' : 'immediate';
    const pendingStart = startMode === 'first_class';

    // If admin/professor triggered this payment for an existing enrollment, the
    // payment doc has a sessionId. In that case we auto-consume 1 session for it.
    const linkedSessionId: string | null = paymentData.sessionId || null;
    const willConsumeOne = !!linkedSessionId && !pendingStart;

    const purchaseRef = await db.collection('purchases').add({
      userId, userName: paymentData.userEmail || '', userEmail: paymentData.userEmail || '',
      planId, planName: plan.name || '',
      locationId: plan.locationId || '', locationName: plan.locationName || '',
      priceMonthly: plan.priceMonthly || paymentData.amount,
      status: 'active',
      purchaseDate: admin.firestore.Timestamp.fromDate(now),
      startDate: pendingStart ? null : admin.firestore.Timestamp.fromDate(now),
      endDate: pendingStart ? null : admin.firestore.Timestamp.fromDate(periodEnd),
      pendingStart,
      validityDays,
      sessionsTotal: totalSessions,
      sessionsUsed: willConsumeOne ? 1 : 0,
      sessionsRemaining: willConsumeOne ? Math.max(0, totalSessions - 1) : totalSessions,
      paymentId,
      nif: paymentData.nif || '',
      consumidorFinal: !!paymentData.consumidorFinal,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Purchase activated:', purchaseRef.id, `(${totalSessions} sessions, ${pendingStart ? 'pending start (1st class)' : `until ${periodEnd.toISOString().slice(0, 10)}`}${willConsumeOne ? ', -1 for linked session' : ''})`);

    // If linked to an existing enrollment, update that student entry to mark as paid
    if (linkedSessionId) {
      try {
        const sessionRef = db.collection('sessions').doc(linkedSessionId);
        await db.runTransaction(async tx => {
          const snap = await tx.get(sessionRef);
          if (!snap.exists) return;
          const enrolled = (snap.data()?.enrolledStudents || []) as any[];
          const idx = enrolled.findIndex(s => s.userId === userId);
          if (idx === -1) {
            // Not yet enrolled — add them now
            enrolled.push({
              userId,
              userName: paymentData.userName || paymentData.userEmail || '',
              status: 'enrolled',
              attendanceMode: paymentData.attendanceMode || 'presencial',
              paymentId,
              purchaseId: purchaseRef.id,
              paymentStatus: 'paid',
              paymentMethod: paymentData.method === 'MBWay' ? 'mbway' : 'multibanco',
            });
          } else {
            enrolled[idx] = {
              ...enrolled[idx],
              purchaseId: purchaseRef.id,
              paymentId,
              paymentStatus: 'paid',
              paymentMethod: paymentData.method === 'MBWay' ? 'mbway' : 'multibanco',
            };
          }
          tx.update(sessionRef, { enrolledStudents: enrolled, updatedAt: new Date() });
        });
        console.log('🔗 Linked plan purchase to session enrollment:', linkedSessionId);
      } catch (e) {
        console.error('Failed to link plan purchase to session:', e);
      }
    }

    // Update user
    try {
      await db.collection('users').doc(userId).update({
        role: 'client', activePlanId: planId, activePlanName: plan.name,
        activePurchaseId: purchaseRef.id, status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) { console.log('⚠️ Could not update user doc'); }
    await markTokenPaid();
  } catch (error) {
    console.error('❌ handlePaidPayment error:', error);
  }
}
