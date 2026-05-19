/**
 * Admin or linked-professor triggers a payment request on behalf of a student
 * who was added manually to a session.
 *
 * Supports three methods:
 *  - mbway: dispatches MB Way push via EuPago; webhook confirms automatically
 *  - multibanco: generates entity/reference via EuPago; webhook confirms when paid
 *  - cash: records cashPayment directly on the session enrollment + creates a
 *          purchase doc so future logic stays consistent
 *
 * Product can be a drop-in plan OR a pack plan (e.g. Essencial 4 aulas).
 * If a pack is bought via MB Way/Multibanco, the webhook handles purchase
 * creation + auto-consumes 1 session for this specific class.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const db = admin.firestore();

async function isCallerAuthorised(callerUid: string, method: string): Promise<{ ok: boolean; role: 'admin' | 'professor' | null; professorId?: string }> {
  // Admin always allowed
  const adminDoc = await db.collection('admins').doc(callerUid).get();
  if (adminDoc.exists) return { ok: true, role: 'admin' };

  // Linked professor — needs the right permission
  const profSnap = await db.collection('professors')
    .where('linkedUserId', '==', callerUid)
    .limit(1)
    .get();
  if (profSnap.empty) return { ok: false, role: null };

  const profData = profSnap.docs[0].data();
  const perms = profData.permissions || {};

  if (method === 'cash' && !perms.canAcceptCashPayment) return { ok: false, role: null };
  if ((method === 'mbway' || method === 'multibanco') && !perms.canRequestOnlinePayment) return { ok: false, role: null };

  return { ok: true, role: 'professor', professorId: profSnap.docs[0].id };
}

async function loadEupagoConfig() {
  const doc = await db.collection('siteConfig').doc('main').get();
  const data = doc.exists ? doc.data() || {} : {};
  return {
    apiKey: data.paymentApiKey || process.env.EUPAGO_CLIENT_ID || (functions.config() as any).eupago?.api_key,
    baseUrl: data.paymentApiBaseUrl || 'https://clientes.eupago.pt',
  };
}

export const requestStudentPayment = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Não autenticado.');
    const callerUid: string = context.auth.uid;

    const {
      studentId,           // user uid of the student
      studentEmail: rawStudentEmail,
      studentName,
      studentPhone,        // required for mbway
      sessionId,
      planId,              // dropin plan OR pack plan id
      method,              // 'mbway' | 'multibanco' | 'cash'
      cashAmount,          // only for cash
      nif,
      consumidorFinal,
    } = data as Record<string, any>;

    if (!studentId || !sessionId || !planId || !method) {
      throw new functions.https.HttpsError('invalid-argument', 'studentId, sessionId, planId e method são obrigatórios.');
    }
    let studentEmail = rawStudentEmail ? String(rawStudentEmail).trim().toLowerCase() : '';
    let resolvedStudentName: string = studentName || '';
    let resolvedStudentPhone: string = studentPhone || '';

    // Fallback: read email/name/phone from users/{studentId} if not provided
    let resolvedNif: string = nif || '';
    let resolvedConsumidorFinal: boolean = consumidorFinal === true;
    if (!studentEmail || !resolvedStudentName || !resolvedStudentPhone || (!resolvedNif && !resolvedConsumidorFinal)) {
      try {
        const userSnap = await db.collection('users').doc(studentId).get();
        const u = userSnap.exists ? userSnap.data() : null;
        if (u) {
          if (!studentEmail && u.email) studentEmail = String(u.email).trim().toLowerCase();
          if (!resolvedStudentName && u.name) resolvedStudentName = u.name;
          if (!resolvedStudentPhone && u.phone) resolvedStudentPhone = u.phone;
          if (!resolvedNif && u.nif) resolvedNif = u.nif;
          if (consumidorFinal === undefined && u.consumidorFinal) resolvedConsumidorFinal = true;
        }
      } catch (e) {
        console.log('Could not load user doc for payment fallback:', e);
      }
    }

    const auth = await isCallerAuthorised(callerUid, method);
    if (!auth.ok) throw new functions.https.HttpsError('permission-denied', 'Sem permissão para este método.');

    // Load plan
    const planDoc = await db.collection('plans').doc(planId).get();
    if (!planDoc.exists) throw new functions.https.HttpsError('not-found', 'Plano não encontrado.');
    const plan = planDoc.data()!;

    const isDropin = plan.billingType === 'dropin';
    const planPrice = isDropin
      ? Number(plan.pricePerSession || plan.priceMonthly || 0)
      : Number(plan.priceMonthly || 0);

    if (planPrice <= 0) throw new functions.https.HttpsError('failed-precondition', 'Plano sem preço definido.');

    // ----- CASH path: handled directly here -----
    if (method === 'cash') {
      const amount = Number(cashAmount || planPrice);
      const now = new Date();

      // Create a purchase doc so reporting stays consistent
      const sessionsTotal = isDropin
        ? 1
        : (plan.sessionsTotal || Math.ceil((plan.sessionsPerWeek || 1) * 4.33));
      const validityDays = plan.validityDays || (isDropin ? 15 : 30);
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + validityDays);

      const purchaseRef = await db.collection('purchases').add({
        userId: studentId,
        userEmail: studentEmail || '',
        userName: resolvedStudentName || studentEmail || '',
        planId,
        planName: plan.name || '',
        locationId: plan.locationId || '',
        locationName: plan.locationName || '',
        priceMonthly: amount,
        billingType: isDropin ? 'dropin' : 'subscription',
        status: 'active',
        purchaseDate: admin.firestore.Timestamp.fromDate(now),
        startDate: admin.firestore.Timestamp.fromDate(now),
        endDate: admin.firestore.Timestamp.fromDate(endDate),
        sessionsTotal,
        sessionsUsed: 1, // this session counts
        sessionsRemaining: Math.max(0, sessionsTotal - 1),
        paymentMethod: 'cash',
        recordedBy: callerUid,
        nif: resolvedConsumidorFinal ? '' : resolvedNif,
        consumidorFinal: resolvedConsumidorFinal,
        invoiceStatus: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update the existing enrollment in the session — link to purchase + record cash
      const sessionRef = db.collection('sessions').doc(sessionId);
      await db.runTransaction(async tx => {
        const snap = await tx.get(sessionRef);
        if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Sessão não encontrada.');
        const enrolled = (snap.data()?.enrolledStudents || []) as any[];
        const idx = enrolled.findIndex(s => s.userId === studentId);
        if (idx === -1) throw new functions.https.HttpsError('failed-precondition', 'Aluno não está inscrito nesta aula.');
        enrolled[idx] = {
          ...enrolled[idx],
          purchaseId: purchaseRef.id,
          paymentStatus: 'paid',
          paymentMethod: 'cash',
          cashPayment: {
            amount,
            recordedBy: callerUid,
            recordedAt: new Date(),
          },
        };
        tx.update(sessionRef, { enrolledStudents: enrolled, updatedAt: new Date() });
      });

      return { success: true, method: 'cash', purchaseId: purchaseRef.id, amount };
    }

    // ----- MB Way / Multibanco path: dispatch via EuPago -----
    const { apiKey, baseUrl } = await loadEupagoConfig();
    if (!apiKey) throw new functions.https.HttpsError('failed-precondition', 'EuPago não configurado.');

    const identifierPrefix = method === 'mbway' ? 'joy_mbway_admin' : 'joy_mb_admin';
    const identifier = `${identifierPrefix}_${studentId.substring(0, 8)}_${Date.now()}`;

    // Create the payment doc first (webhook reads this on confirmation)
    const paymentRef = await db.collection('payments').add({
      userId: studentId,
      userEmail: studentEmail || '',
      userPhone: resolvedStudentPhone || '',
      planId,
      planName: plan.name || '',
      type: isDropin ? 'single_class' : 'plan_subscription',
      amount: planPrice,
      method: method === 'mbway' ? 'MBWay' : 'Multibanco',
      status: 'Pending',
      identifier,
      sessionId,
      requestedBy: callerUid,
      requestedByRole: auth.role,
      startMode: 'immediate',
      nif: resolvedConsumidorFinal ? '' : resolvedNif,
      consumidorFinal: resolvedConsumidorFinal,
      invoiceStatus: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const paymentId = paymentRef.id;

    try {
      if (method === 'mbway') {
        if (!resolvedStudentPhone) throw new functions.https.HttpsError('invalid-argument', 'Telefone do aluno obrigatório para MB Way.');
        const resp = await axios.post(
          `${baseUrl}/api/v1.02/mbway/create`,
          {
            payment: {
              amount: { currency: 'EUR', value: Number(planPrice.toFixed(2)) },
              identifier,
              customerPhone: resolvedStudentPhone,
              countryCode: '+351',
            },
          },
          { headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' } }
        );
        await paymentRef.update({
          eupagoResponse: resp.data,
          eupagoTransactionId: resp.data?.transactionID || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, method: 'mbway', paymentId, transactionId: resp.data?.transactionID };
      }

      // Multibanco
      const resp = await axios.post(
        `${baseUrl}/api/v1.02/multibanco/create`,
        {
          payment: {
            amount: { currency: 'EUR', value: Number(planPrice.toFixed(2)) },
            identifier,
            expirationTime: 72, // hours
          },
          customer: { email: studentEmail || '' },
        },
        { headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' } }
      );
      await paymentRef.update({
        eupagoResponse: resp.data,
        entity: resp.data?.paymentMethod?.entity || resp.data?.entity || null,
        reference: resp.data?.paymentMethod?.reference || resp.data?.reference || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {
        success: true,
        method: 'multibanco',
        paymentId,
        entity: resp.data?.paymentMethod?.entity || resp.data?.entity,
        reference: resp.data?.paymentMethod?.reference || resp.data?.reference,
      };
    } catch (err: any) {
      await paymentRef.update({
        status: 'Failed',
        error: err?.response?.data || err?.message || 'Erro desconhecido',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.error('requestStudentPayment EuPago error:', err?.response?.data || err?.message);
      throw new functions.https.HttpsError('internal', err?.message || 'Erro ao contactar EuPago.');
    }
  });
