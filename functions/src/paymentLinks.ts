/**
 * Payment-link flow — admin or linked professor sends an email to a student
 * with a public link. Student clicks → opens /pay/{token} → picks plan + method
 * → pays via MB Way or Multibanco. Token is single-use, expires in 7 days.
 *
 * Exports:
 *  - sendPaymentLink    (admin/prof)    create token + email student
 *  - getPaymentTokenInfo (public)       read token state + available plans
 *  - processTokenPayment (public)       generate EuPago payment via token
 *
 * Webhook eupagoWebhook handles confirmation and marks token paid.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import crypto from 'crypto';

const db = admin.firestore();

const TOKEN_TTL_DAYS = 7;

async function loadConfig() {
  const [mainSnap, notifSnap] = await Promise.all([
    db.collection('siteConfig').doc('main').get(),
    db.collection('siteConfig').doc('notifications').get(),
  ]);
  return { ...(mainSnap.data() || {}), ...(notifSnap.data() || {}) };
}

async function loadEupagoCreds() {
  const main = (await db.collection('siteConfig').doc('main').get()).data() || {};
  return {
    apiKey: main.paymentApiKey || process.env.EUPAGO_CLIENT_ID || (functions.config() as any).eupago?.api_key,
    baseUrl: main.paymentApiBaseUrl || 'https://clientes.eupago.pt',
  };
}

async function isAdminOrLinkedProfessor(callerUid: string, sessionProfessorId?: string): Promise<boolean> {
  if (!callerUid) return false;
  const adm = await db.collection('admins').doc(callerUid).get();
  if (adm.exists) return true;
  if (!sessionProfessorId) return false;
  const prof = await db.collection('professors').doc(sessionProfessorId).get();
  return prof.exists && prof.data()?.linkedUserId === callerUid;
}

async function sendEmail(config: any, to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (config.emailProvider === 'resend' && config.resendApiKey) {
      await axios.post('https://api.resend.com/emails', {
        from: `${config.emailFromName || 'JOY Yoga'} <${config.resendFromEmail || config.emailFrom || 'noreply@joaquimyoga.pt'}>`,
        to, subject, html,
      }, { headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' } });
      return { ok: true };
    }
    if (config.emailProvider === 'gmail' && config.gmailAppPassword && config.emailFrom) {
      const nodemailer = require('nodemailer');
      const t = nodemailer.createTransport({ service: 'gmail', auth: { user: config.emailFrom, pass: config.gmailAppPassword } });
      await t.sendMail({ from: `"${config.emailFromName || 'JOY'}" <${config.emailFrom}>`, to, subject, html });
      return { ok: true };
    }
    return { ok: false, error: 'Sem provedor de email configurado' };
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.message || err?.message || 'Erro desconhecido' };
  }
}

function buildPaymentEmailHtml({ studentName, sessionDate, sessionTime, locationName, professorName, payUrl, siteName }: any) {
  const greeting = studentName ? `Olá ${String(studentName).split(' ')[0]}!` : 'Olá!';
  return `
  <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; background: #faf8f5; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #7c9a72, #5a7a52); padding: 2rem; text-align: center;">
      <h1 style="color: white; font-family: Georgia, serif; font-weight: 400; font-size: 1.75rem; margin: 0;">${greeting}</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 0.5rem 0 0; font-size: 0.9375rem;">A tua aula está reservada — falta pagar.</p>
    </div>
    <div style="padding: 2rem; background: white;">
      <p style="color: #4a5568; font-size: 1rem; line-height: 1.6; margin: 0 0 1.5rem;">
        Foste inscrita na seguinte aula:
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
        <tr><td style="padding: 0.375rem 0; color: #888; font-size: 0.875rem;">📅 Data</td><td style="padding: 0.375rem 0; font-weight: 600;">${sessionDate}</td></tr>
        <tr><td style="padding: 0.375rem 0; color: #888; font-size: 0.875rem;">🕐 Hora</td><td style="padding: 0.375rem 0; font-weight: 600;">${sessionTime}</td></tr>
        <tr><td style="padding: 0.375rem 0; color: #888; font-size: 0.875rem;">📍 Espaço</td><td style="padding: 0.375rem 0; font-weight: 600;">${locationName}</td></tr>
        ${professorName ? `<tr><td style="padding: 0.375rem 0; color: #888; font-size: 0.875rem;">👤 Professor</td><td style="padding: 0.375rem 0; font-weight: 600;">${professorName}</td></tr>` : ''}
      </table>
      <p style="color: #4a5568; font-size: 1rem; line-height: 1.6; margin: 0 0 1.25rem;">
        Para garantires a tua presença, clica no botão abaixo e escolhe o método de pagamento (MB Way ou Multibanco):
      </p>
      <div style="text-align: center; margin: 1.5rem 0;">
        <a href="${payUrl}" style="display: inline-block; background: #7c9a72; color: white; padding: 0.875rem 2rem; border-radius: 8px; text-decoration: none; font-family: sans-serif; font-weight: 600; font-size: 1rem;">
          Pagar a minha aula
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 0.8125rem; margin: 1.25rem 0 0; text-align: center; line-height: 1.5;">
        Este link é válido por 7 dias. Se já pagaste, podes ignorar este email.
      </p>
    </div>
    <div style="padding: 1rem; text-align: center; background: #f5f0ea;">
      <p style="color: #a0aec0; font-size: 0.8125rem; margin: 0; font-family: sans-serif;">Com carinho, <strong style="color: #7c9a72;">${siteName || 'JOY'}</strong></p>
    </div>
  </div>`;
}

// ===========================================================================
// 1) sendPaymentLink — admin/prof creates token + emails student
// ===========================================================================
export const sendPaymentLink = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Não autenticado.');
    const callerUid: string = context.auth.uid;

    const { sessionId, studentId } = data as { sessionId: string; studentId: string };
    if (!sessionId || !studentId) {
      throw new functions.https.HttpsError('invalid-argument', 'sessionId e studentId obrigatórios.');
    }

    // Load session + verify enrollment
    const sessionSnap = await db.collection('sessions').doc(sessionId).get();
    if (!sessionSnap.exists) throw new functions.https.HttpsError('not-found', 'Aula não encontrada.');
    const sessionData = sessionSnap.data()!;
    const enrolled = (sessionData.enrolledStudents || []) as any[];
    const student = enrolled.find(e => e.userId === studentId);
    if (!student) throw new functions.https.HttpsError('failed-precondition', 'Aluno não está inscrito.');

    // Authorisation
    const ok = await isAdminOrLinkedProfessor(callerUid, sessionData.professorId);
    if (!ok) throw new functions.https.HttpsError('permission-denied', 'Sem permissão.');

    // Resolve student email (from users doc OR enrolled record)
    let studentEmail = student.userEmail || '';
    let studentName = student.userName || '';
    let studentPhone = student.userPhone || '';
    if (!studentEmail) {
      const userSnap = await db.collection('users').doc(studentId).get();
      const u = userSnap.exists ? userSnap.data() : null;
      if (u?.email) {
        studentEmail = String(u.email).trim().toLowerCase();
        studentName = studentName || u.name || '';
        studentPhone = studentPhone || u.phone || '';
      }
    } else {
      studentEmail = String(studentEmail).trim().toLowerCase();
    }
    if (!studentEmail) throw new functions.https.HttpsError('failed-precondition', 'Aluno sem email registado.');

    // Create token doc
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

    await db.collection('paymentTokens').doc(token).set({
      sessionId,
      sessionDate: sessionData.date,
      sessionStartTime: sessionData.startTime || '',
      locationId: sessionData.locationId || '',
      locationName: sessionData.locationName || '',
      professorName: sessionData.professorName || '',
      studentId,
      studentEmail,
      studentName,
      studentPhone,
      status: 'pending',
      createdBy: callerUid,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send email
    const config = await loadConfig();
    const siteUrl: string = config.siteUrl || 'https://joaquimyoga.pt';
    const payUrl = `${siteUrl.replace(/\/$/, '')}/pay/${token}`;
    const sessionDateObj = sessionData.date?.toDate ? sessionData.date.toDate() : new Date(sessionData.date);
    const sessionDateStr = sessionDateObj.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    const html = buildPaymentEmailHtml({
      studentName,
      sessionDate: sessionDateStr,
      sessionTime: sessionData.startTime || '',
      locationName: sessionData.locationName || '',
      professorName: sessionData.professorName || '',
      payUrl,
      siteName: config.siteName || 'JOY',
    });

    const emailRes = await sendEmail(config, studentEmail, `Pagamento da tua aula — ${config.siteName || 'JOY'}`, html);

    // Log to notificationLogs so admin sees it in client comms tab
    await db.collection('notificationLogs').add({
      trigger: 'payment_link_sent',
      recipientEmail: studentEmail,
      recipientName: studentName || null,
      channels: [emailRes.ok ? 'email:ok' : `email:failed:${(emailRes.error || '').substring(0, 60)}`],
      message: emailRes.ok
        ? `Link de pagamento enviado para ${studentEmail}`
        : `Falhou: ${emailRes.error}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true, token, emailSent: emailRes.ok, emailError: emailRes.error || null, payUrl };
  });

// ===========================================================================
// 2) getPaymentTokenInfo — public, returns class+plans+student
// ===========================================================================
export const getPaymentTokenInfo = functions
  .region('europe-west1')
  .https.onCall(async (data, _context) => {
    const { token } = data as { token: string };
    if (!token) throw new functions.https.HttpsError('invalid-argument', 'Token em falta.');

    const docSnap = await db.collection('paymentTokens').doc(token).get();
    if (!docSnap.exists) throw new functions.https.HttpsError('not-found', 'Link inválido.');
    const t = docSnap.data()!;

    const expiresAt = t.expiresAt?.toDate ? t.expiresAt.toDate() : new Date(t.expiresAt);
    if (expiresAt < new Date()) {
      return { status: 'expired', studentName: t.studentName, expiresAt: expiresAt.toISOString() };
    }
    if (t.status === 'paid') {
      return { status: 'paid', studentName: t.studentName, paidVia: t.paidVia, paidAt: t.paidAt?.toDate?.()?.toISOString?.() };
    }

    // Pending — return everything for the UI
    const plansSnap = await db.collection('plans').orderBy('order').get();
    const plans = plansSnap.docs.map(d => {
      const p = d.data() as any;
      return {
        id: d.id,
        name: p.name || '',
        billingType: p.billingType || 'subscription',
        priceMonthly: Number(p.priceMonthly || 0),
        pricePerSession: Number(p.pricePerSession || 0),
        sessionsTotal: p.sessionsTotal || Math.ceil((p.sessionsPerWeek || 1) * 4.33),
        locationId: p.locationId || '',
        isContentPlan: !!p.isContentPlan,
        isActive: p.isActive !== false,
      };
    }).filter(p => p.isActive && !p.isContentPlan && (!p.locationId || p.locationId === t.locationId));

    const sessionDate = t.sessionDate?.toDate ? t.sessionDate.toDate() : new Date(t.sessionDate);

    return {
      status: 'pending',
      studentName: t.studentName,
      sessionDate: sessionDate.toISOString(),
      sessionStartTime: t.sessionStartTime,
      locationName: t.locationName,
      professorName: t.professorName,
      plans,
      expiresAt: expiresAt.toISOString(),
    };
  });

// ===========================================================================
// 3) processTokenPayment — public, generates EuPago payment
// ===========================================================================
export const processTokenPayment = functions
  .region('europe-west1')
  .https.onCall(async (data, _context) => {
    const { token, planId, method, phone, nif, consumidorFinal } = data as { token: string; planId: string; method: 'mbway' | 'multibanco'; phone?: string; nif?: string; consumidorFinal?: boolean };
    if (!token || !planId || !method) {
      throw new functions.https.HttpsError('invalid-argument', 'token, planId e method são obrigatórios.');
    }
    if (method !== 'mbway' && method !== 'multibanco') {
      throw new functions.https.HttpsError('invalid-argument', 'Método inválido.');
    }

    const tokenRef = db.collection('paymentTokens').doc(token);
    const tokenSnap = await tokenRef.get();
    if (!tokenSnap.exists) throw new functions.https.HttpsError('not-found', 'Link inválido.');
    const t = tokenSnap.data()!;

    const expiresAt = t.expiresAt?.toDate ? t.expiresAt.toDate() : new Date(t.expiresAt);
    if (expiresAt < new Date()) throw new functions.https.HttpsError('failed-precondition', 'Link expirado.');
    if (t.status === 'paid') throw new functions.https.HttpsError('failed-precondition', 'Aula já paga.');

    // Load plan
    const planSnap = await db.collection('plans').doc(planId).get();
    if (!planSnap.exists) throw new functions.https.HttpsError('not-found', 'Plano não encontrado.');
    const plan = planSnap.data()!;
    const isDropin = plan.billingType === 'dropin';
    const amount = isDropin
      ? Number(plan.pricePerSession || plan.priceMonthly || 0)
      : Number(plan.priceMonthly || 0);
    if (amount <= 0) throw new functions.https.HttpsError('failed-precondition', 'Plano sem preço.');

    if (method === 'mbway' && !phone) {
      throw new functions.https.HttpsError('invalid-argument', 'Telefone obrigatório para MB Way.');
    }

    const { apiKey, baseUrl } = await loadEupagoCreds();
    if (!apiKey) throw new functions.https.HttpsError('failed-precondition', 'EuPago não configurado.');

    const identifier = `joy_${method}_tok_${token.substring(0, 10)}_${Date.now()}`;

    // Create payment doc
    const paymentRef = await db.collection('payments').add({
      userId: t.studentId,
      userEmail: t.studentEmail,
      userPhone: phone || t.studentPhone || '',
      planId,
      planName: plan.name || '',
      type: isDropin ? 'single_class' : 'plan_subscription',
      amount,
      method: method === 'mbway' ? 'MBWay' : 'Multibanco',
      status: 'Pending',
      identifier,
      sessionId: t.sessionId,
      paymentTokenId: token,
      startMode: 'immediate',
      nif: nif || '',
      consumidorFinal: !!consumidorFinal,
      invoiceStatus: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      if (method === 'mbway') {
        const resp = await axios.post(
          `${baseUrl}/api/v1.02/mbway/create`,
          {
            payment: {
              amount: { currency: 'EUR', value: Number(amount.toFixed(2)) },
              identifier,
              customerPhone: phone,
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
        await tokenRef.update({
          status: 'awaiting_confirmation',
          chosenMethod: 'mbway',
          paymentId: paymentRef.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { ok: true, method: 'mbway', paymentId: paymentRef.id };
      }

      // Multibanco
      const resp = await axios.post(
        `${baseUrl}/api/v1.02/multibanco/create`,
        {
          payment: {
            amount: { currency: 'EUR', value: Number(amount.toFixed(2)) },
            identifier,
            expirationTime: 72,
          },
          customer: { email: t.studentEmail || '' },
        },
        { headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' } }
      );
      const entity = resp.data?.paymentMethod?.entity || resp.data?.entity || null;
      const reference = resp.data?.paymentMethod?.reference || resp.data?.reference || null;
      await paymentRef.update({
        eupagoResponse: resp.data,
        entity, reference,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await tokenRef.update({
        status: 'awaiting_confirmation',
        chosenMethod: 'multibanco',
        paymentId: paymentRef.id,
        entity, reference,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { ok: true, method: 'multibanco', paymentId: paymentRef.id, entity, reference, amount };
    } catch (err: any) {
      await paymentRef.update({
        status: 'Failed',
        error: err?.response?.data || err?.message || 'erro',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.error('processTokenPayment EuPago error:', err?.response?.data || err?.message);
      throw new functions.https.HttpsError('internal', err?.message || 'Erro EuPago.');
    }
  });
