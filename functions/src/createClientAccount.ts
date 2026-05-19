import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const createClientAccount = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Verify admin caller (admins live in /admins/{uid}, same as rules & other functions)
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Não autenticado.');
    const adminDoc = await admin.firestore().collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem criar contas.');
    }

    const { name, email: rawEmail, phone } = data as { name: string; email: string; phone?: string };
    if (!name || !rawEmail) throw new functions.https.HttpsError('invalid-argument', 'Nome e email são obrigatórios.');
    const email = String(rawEmail).trim().toLowerCase();

    const db = admin.firestore();
    const [mainSnap, notifSnap] = await Promise.all([
      db.collection('siteConfig').doc('main').get(),
      db.collection('siteConfig').doc('notifications').get(),
    ]);
    // Email credentials live in siteConfig/notifications (where the rest of the system reads them)
    const config = { ...(mainSnap.data() || {}), ...(notifSnap.data() || {}) };
    const siteName: string = config.siteName || 'JOY';

    let uid: string;
    let isNewUser = false;

    try {
      const existing = await admin.auth().getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const newUser = await admin.auth().createUser({ email, displayName: name });
      uid = newUser.uid;
      isNewUser = true;
    }

    // Create or update user document
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await userRef.set({
        email,
        name,
        phone: phone || '',
        role: 'client',
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await userRef.update({ name, phone: phone || '', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    // Link any orphan purchases (paid as guest, userId differs) to this user's uid
    try {
      const orphanPurchases = await db.collection('purchases').where('userEmail', '==', email).get();
      let linked = 0;
      const batch = db.batch();
      orphanPurchases.docs.forEach(d => {
        const data = d.data();
        if (!data.userId || data.userId !== uid) {
          batch.update(d.ref, { userId: uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          linked++;
        }
      });
      if (linked > 0) {
        await batch.commit();
        console.log(`🔗 Linked ${linked} orphan purchase(s) to new client uid ${uid} (${email})`);
      }
    } catch (e) {
      console.error('Failed to link orphan purchases:', e);
    }

    // Generate password reset / setup link
    const resetLink = await admin.auth().generatePasswordResetLink(email);

    // Send invite email
    const subject = `Bem-vindo(a) ao ${siteName} — Crie a sua password`;
    const html = `
      <div style="font-family: 'Georgia', serif; max-width: 520px; margin: 0 auto; background: #faf8f5; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c9a72, #5a7a52); padding: 2.5rem 2rem; text-align: center;">
          <h1 style="color: white; font-family: Georgia, serif; font-weight: 400; font-size: 1.875rem; margin: 0 0 0.5rem;">Bem-vindo(a), ${name.split(' ')[0]}!</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 0; font-size: 1rem;">A sua conta no ${siteName} está pronta</p>
        </div>
        <div style="padding: 2rem; background: white;">
          <p style="color: #4a5568; font-size: 1rem; line-height: 1.7; margin: 0 0 1.5rem;">
            ${isNewUser ? 'A sua conta foi criada com sucesso.' : 'A sua conta já existe.'} Para aceder ao portal do cliente, clique no botão abaixo e crie a sua password pessoal.
          </p>
          <div style="text-align: center; margin: 1.5rem 0;">
            <a href="${resetLink}" style="display: inline-block; background: #7c9a72; color: white; padding: 0.875rem 2rem; border-radius: 8px; text-decoration: none; font-family: sans-serif; font-weight: 600; font-size: 1rem;">
              Criar a minha password
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 0.8125rem; margin: 1rem 0 0; text-align: center;">
            Este link é válido por 24 horas. Se não pediu este acesso, pode ignorar este email.
          </p>
        </div>
        <div style="padding: 1.25rem; text-align: center; background: #f5f0ea;">
          <p style="color: #a0aec0; font-size: 0.8125rem; margin: 0; font-family: sans-serif;">
            Com carinho, <strong style="color: #7c9a72;">${siteName}</strong>
          </p>
        </div>
      </div>
    `;

    let emailSent = false;
    let emailError: string | null = null;
    const fromName: string = config.fromName || siteName;
    const fromEmail: string = config.fromEmail || config.emailFrom || config.resendFromEmail || 'noreply@joaquimyoga.pt';

    try {
      if (config.emailProvider === 'resend' && config.resendApiKey) {
        const axios = require('axios');
        await axios.post('https://api.resend.com/emails', {
          from: `${fromName} <${fromEmail}>`, to: email, subject, html,
        }, { headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' } });
        emailSent = true;
        console.log('✅ Client invite email sent via Resend to:', email);
      } else if (config.emailProvider === 'gmail' && config.gmailAppPassword && config.emailFrom) {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: config.emailFrom, pass: config.gmailAppPassword },
        });
        await transporter.sendMail({ from: `"${fromName}" <${config.emailFrom}>`, to: email, subject, html });
        emailSent = true;
        console.log('✅ Client invite email sent via Gmail to:', email);
      } else {
        emailError = 'Nenhum provedor de email configurado (Gmail App Password ou Resend API key)';
        console.warn('⚠️', emailError);
      }
    } catch (err: any) {
      emailError = err?.response?.data?.message || err?.message || 'Erro desconhecido';
      console.error('❌ Client invite email failed:', emailError);
    }

    // Log to notificationLogs so it appears in the client's Comunicações tab
    try {
      await db.collection('notificationLogs').add({
        trigger: 'client_invite',
        recipientEmail: email,
        recipientName: name || null,
        channels: [emailSent ? 'email:ok' : `email:failed:${(emailError || 'no provider').substring(0, 50)}`],
        message: emailSent
          ? `Convite enviado para ${email} (${isNewUser ? 'conta nova' : 'conta já existia'})`
          : `Convite gerado mas email falhou: ${emailError || 'sem provedor'}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (logErr) {
      console.error('Failed to log client_invite notification:', logErr);
    }

    return { uid, isNewUser, resetLink, emailSent, emailError };
  });
