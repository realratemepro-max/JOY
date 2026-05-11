import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const createClientAccount = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Verify admin caller
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Não autenticado.');
    const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (callerDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem criar contas.');
    }

    const { name, email, phone } = data as { name: string; email: string; phone?: string };
    if (!name || !email) throw new functions.https.HttpsError('invalid-argument', 'Nome e email são obrigatórios.');

    const db = admin.firestore();
    const configSnap = await db.collection('siteConfig').doc('main').get();
    const config = configSnap.data() || {};
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

    if (config.resendApiKey) {
      const fetch = require('node-fetch');
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: config.resendFromEmail || `noreply@joaquimyoga.pt`,
          to: email,
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError('internal', `Erro ao enviar email: ${err}`);
      }
    } else if (config.emailProvider === 'gmail' && config.gmailAppPassword) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: config.emailFrom, pass: config.gmailAppPassword },
      });
      await transporter.sendMail({ from: `"${siteName}" <${config.emailFrom}>`, to: email, subject, html });
    } else {
      throw new functions.https.HttpsError('failed-precondition', 'Nenhum serviço de email configurado.');
    }

    return { uid, isNewUser };
  });
